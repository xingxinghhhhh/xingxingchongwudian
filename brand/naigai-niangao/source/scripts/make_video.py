import argparse
import json
import subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = Path(__file__).resolve().parents[1]

def load_font(size: int):
    candidates = [
        "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
        "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "C:/Windows/Fonts/msyh.ttc",
        "C:/Windows/Fonts/simhei.ttf",
        "C:/Windows/Fonts/simsun.ttc",
    ]
    for p in candidates:
        if Path(p).exists():
            return ImageFont.truetype(p, size=size)
    return ImageFont.load_default()

def wrap_text(text, font, max_width):
    lines, cur = [], ""
    dummy = Image.new("RGB", (10, 10))
    draw = ImageDraw.Draw(dummy)
    for ch in text:
        if ch == "\n":
            lines.append(cur); cur = ""; continue
        test = cur + ch
        if draw.textbbox((0, 0), test, font=font)[2] <= max_width:
            cur = test
        else:
            if cur: lines.append(cur)
            cur = ch
    if cur: lines.append(cur)
    return lines

def cover_resize(img, size):
    tw, th = size; w, h = img.size
    scale = max(tw/w, th/h)
    nw, nh = int(w*scale), int(h*scale)
    img = img.resize((nw, nh), Image.Resampling.LANCZOS)
    return img.crop(((nw-tw)//2, (nh-th)//2, (nw+tw)//2, (nh+th)//2))

def contain_resize(img, max_size):
    mw, mh = max_size; w, h = img.size
    scale = min(mw/w, mh/h)
    return img.resize((int(w*scale), int(h*scale)), Image.Resampling.LANCZOS)

def make_slide(img_path, subtitle, out_path, cfg, font):
    width, height = cfg["width"], cfg["height"]
    img = Image.open(img_path).convert("RGB")
    bg = cover_resize(img, (width, height)).filter(ImageFilter.GaussianBlur(28))
    bg = bg.point(lambda p: int(p * 0.82))
    fg = contain_resize(img, (int(width*0.92), int(height*0.68)))
    bg.paste(fg, ((width-fg.width)//2, int(height*0.16)))

    draw = ImageDraw.Draw(bg, "RGBA")
    max_text_w = int(width*0.84)
    lines = wrap_text(subtitle, font, max_text_w)
    line_h = int(cfg["font_size"]*1.35)
    box_pad_x, box_pad_y = 36, 24
    text_h = line_h * len(lines)
    box_w = max_text_w + box_pad_x*2
    box_h = text_h + box_pad_y*2
    box_x = (width-box_w)//2
    box_y = height - cfg["subtitle_bottom_margin"] - box_h
    draw.rounded_rectangle([box_x, box_y, box_x+box_w, box_y+box_h], radius=34, fill=(0,0,0,cfg["subtitle_box_opacity"]))
    for i, line in enumerate(lines):
        bbox = draw.textbbox((0,0), line, font=font)
        tx = (width - (bbox[2]-bbox[0]))//2
        ty = box_y + box_pad_y + i*line_h
        draw.text((tx+2, ty+2), line, font=font, fill=(0,0,0,130))
        draw.text((tx, ty), line, font=font, fill=(255,255,255,255))
    bg.save(out_path)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", default="assets/day04")
    ap.add_argument("--config", default="config/video_config.json")
    ap.add_argument("--output", default=None)
    args = ap.parse_args()
    input_dir = (ROOT / args.input).resolve()
    cfg = json.loads((ROOT / args.config).read_text(encoding="utf-8"))
    output = ROOT / (args.output or cfg["output"])
    output.parent.mkdir(parents=True, exist_ok=True)
    tmp = ROOT / "output" / "tmp_slides"
    tmp.mkdir(parents=True, exist_ok=True)

    images = sorted([p for p in input_dir.iterdir() if p.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}])
    if not images:
        raise SystemExit(f"No images found in {input_dir}")
    subtitles_file = input_dir / "subtitles.txt"
    subtitles = subtitles_file.read_text(encoding="utf-8").splitlines() if subtitles_file.exists() else []
    while len(subtitles) < len(images): subtitles.append("")
    font = load_font(int(cfg["font_size"]))
    slide_paths = []
    for i, img in enumerate(images):
        p = tmp / f"slide_{i+1:02d}.png"
        make_slide(img, subtitles[i], p, cfg, font)
        slide_paths.append(p)

    concat = tmp / "concat.txt"
    dur = float(cfg["seconds_per_image"])
    with concat.open("w", encoding="utf-8") as f:
        for p in slide_paths:
            f.write(f"file '{p.as_posix()}'\n")
            f.write(f"duration {dur}\n")
        f.write(f"file '{slide_paths[-1].as_posix()}'\n")

    cmd = ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(concat), "-r", str(cfg["fps"]), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", str(output)]
    subprocess.run(cmd, check=True)
    print(f"Created: {output}")

if __name__ == "__main__":
    main()
