from __future__ import annotations

from pathlib import Path
from typing import Iterable

import imageio.v2 as imageio
import numpy as np
from PIL import Image, ImageDraw, ImageFont


WIDTH = 1080
HEIGHT = 1920
FPS = 30

BASE_DIR = Path(__file__).resolve().parent
OUTPUT_DIR = BASE_DIR / "output"

FONT_CANDIDATES = [
    Path(r"C:\Windows\Fonts\msyh.ttc"),
    Path(r"C:\Windows\Fonts\msyhbd.ttc"),
    Path(r"C:\Windows\Fonts\simhei.ttf"),
]


SCENES = [
    {
        "image": BASE_DIR / "奶盖标准图.png",
        "duration": 4.0,
        "subtitle": "这是奶盖，\n一只看起来不太好接近的小猫。",
        "zoom_start": 1.00,
        "zoom_end": 1.08,
        "pan_start": (0.50, 0.50),
        "pan_end": (0.47, 0.50),
    },
    {
        "image": BASE_DIR / "年糕标准图.png",
        "duration": 4.0,
        "subtitle": "这是年糕，\n一只想和全世界做朋友的小狗。",
        "zoom_start": 1.00,
        "zoom_end": 1.08,
        "pan_start": (0.50, 0.50),
        "pan_end": (0.53, 0.49),
    },
    {
        "image": BASE_DIR / "同框标准图.png",
        "duration": 5.0,
        "subtitle": "一个假装不在意，\n一个每天都想贴贴。",
        "zoom_start": 1.00,
        "zoom_end": 1.06,
        "pan_start": (0.50, 0.52),
        "pan_end": (0.50, 0.48),
    },
    {
        "image": BASE_DIR / "睡觉陪伴图.png",
        "duration": 5.0,
        "subtitle": "从今天开始，\n记录它们一起长大的日子。",
        "zoom_start": 1.02,
        "zoom_end": 1.10,
        "pan_start": (0.50, 0.52),
        "pan_end": (0.49, 0.50),
    },
]


def load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in FONT_CANDIDATES:
        if path.exists():
            return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default()


TITLE_FONT = load_font(72)
SUBTITLE_FONT = load_font(48)
SMALL_FONT = load_font(36)


def lerp(start: float, end: float, t: float) -> float:
    return start + (end - start) * t


def ease_in_out(t: float) -> float:
    return 3 * t**2 - 2 * t**3


def cover_crop(image: Image.Image, zoom: float, focus_x: float, focus_y: float) -> Image.Image:
    src = image.convert("RGB")
    base_scale = max(WIDTH / src.width, HEIGHT / src.height)
    target_w = max(1, int(src.width * base_scale * zoom))
    target_h = max(1, int(src.height * base_scale * zoom))
    resized = src.resize((target_w, target_h), Image.Resampling.LANCZOS)

    max_left = max(0, target_w - WIDTH)
    max_top = max(0, target_h - HEIGHT)
    left = int(max_left * focus_x)
    top = int(max_top * focus_y)
    left = max(0, min(left, max_left))
    top = max(0, min(top, max_top))
    return resized.crop((left, top, left + WIDTH, top + HEIGHT))


def draw_gradient(frame: Image.Image) -> None:
    overlay = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    pixels = overlay.load()
    for y in range(HEIGHT):
        alpha = 0
        if y > HEIGHT * 0.62:
            alpha = int(min(165, (y - HEIGHT * 0.62) / (HEIGHT * 0.38) * 165))
        elif y < HEIGHT * 0.12:
            alpha = int((HEIGHT * 0.12 - y) / (HEIGHT * 0.12) * 40)
        for x in range(WIDTH):
            pixels[x, y] = (18, 14, 12, alpha)
    frame.alpha_composite(overlay)


def draw_subtitle(frame: Image.Image, text: str) -> None:
    draw = ImageDraw.Draw(frame)
    lines = text.splitlines()

    padding_x = 48
    padding_y = 28
    line_gap = 12

    bboxes = [draw.textbbox((0, 0), line, font=SUBTITLE_FONT) for line in lines]
    max_width = max(box[2] - box[0] for box in bboxes)
    line_heights = [box[3] - box[1] for box in bboxes]
    text_height = sum(line_heights) + line_gap * (len(lines) - 1)

    box_w = max_width + padding_x * 2
    box_h = text_height + padding_y * 2
    box_x = (WIDTH - box_w) // 2
    box_y = HEIGHT - box_h - 180

    draw.rounded_rectangle(
        (box_x, box_y, box_x + box_w, box_y + box_h),
        radius=30,
        fill=(10, 10, 10, 112),
    )

    cursor_y = box_y + padding_y
    for index, line in enumerate(lines):
        bbox = bboxes[index]
        line_w = bbox[2] - bbox[0]
        line_h = bbox[3] - bbox[1]
        x = (WIDTH - line_w) // 2
        y = cursor_y
        draw.text((x + 2, y + 2), line, font=SUBTITLE_FONT, fill=(0, 0, 0, 160))
        draw.text((x, y), line, font=SUBTITLE_FONT, fill=(255, 255, 255, 255))
        cursor_y += line_h + line_gap


def draw_badge(frame: Image.Image) -> None:
    draw = ImageDraw.Draw(frame)
    label = "奶盖和年糕的 AI 成长日记"
    bbox = draw.textbbox((0, 0), label, font=SMALL_FONT)
    label_w = bbox[2] - bbox[0]
    label_h = bbox[3] - bbox[1]
    x = 48
    y = 70
    draw.rounded_rectangle(
        (x, y, x + label_w + 36, y + label_h + 24),
        radius=28,
        fill=(255, 255, 255, 190),
    )
    draw.text((x + 18, y + 10), label, font=SMALL_FONT, fill=(33, 27, 23))


def render_cover() -> Path:
    src = Image.open(BASE_DIR / "同框标准图.png")
    canvas = cover_crop(src, 1.03, 0.50, 0.48).convert("RGBA")
    draw_gradient(canvas)
    draw = ImageDraw.Draw(canvas)
    title = "一只高冷猫\n一只社牛狗"
    lines = title.splitlines()
    y = 210
    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=TITLE_FONT)
        w = bbox[2] - bbox[0]
        draw.text(((WIDTH - w) // 2 + 3, y + 3), line, font=TITLE_FONT, fill=(0, 0, 0, 150))
        draw.text(((WIDTH - w) // 2, y), line, font=TITLE_FONT, fill=(255, 255, 255, 255))
        y += (bbox[3] - bbox[1]) + 14

    sub = "奶盖和年糕的第 1 天"
    bbox = draw.textbbox((0, 0), sub, font=SMALL_FONT)
    sw = bbox[2] - bbox[0]
    draw.rounded_rectangle(
        ((WIDTH - sw) // 2 - 20, y + 18, (WIDTH + sw) // 2 + 20, y + 18 + 58),
        radius=26,
        fill=(255, 255, 255, 205),
    )
    draw.text(((WIDTH - sw) // 2, y + 28), sub, font=SMALL_FONT, fill=(43, 35, 30))

    out = OUTPUT_DIR / "day4-video-01-cover.png"
    canvas.convert("RGB").save(out, quality=95)
    return out


def render_video() -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUTPUT_DIR / "day4-video-01.mp4"
    writer = imageio.get_writer(
        out_path,
        fps=FPS,
        codec="libx264",
        quality=8,
        macro_block_size=None,
    )

    try:
        for scene in SCENES:
            image = Image.open(scene["image"])
            frames = int(scene["duration"] * FPS)
            for frame_index in range(frames):
                progress = ease_in_out(frame_index / max(1, frames - 1))
                zoom = lerp(scene["zoom_start"], scene["zoom_end"], progress)
                focus_x = lerp(scene["pan_start"][0], scene["pan_end"][0], progress)
                focus_y = lerp(scene["pan_start"][1], scene["pan_end"][1], progress)

                frame = cover_crop(image, zoom, focus_x, focus_y).convert("RGBA")
                draw_gradient(frame)
                draw_badge(frame)
                draw_subtitle(frame, scene["subtitle"])
                writer.append_data(np.asarray(frame.convert("RGB")))
    finally:
        writer.close()

    return out_path


def write_manifest(paths: Iterable[Path]) -> Path:
    manifest = OUTPUT_DIR / "day4-video-01-output.txt"
    lines = [
        "Day 4 输出文件",
        "",
        *[str(path) for path in paths],
        "",
        "说明：",
        "- 成片为无配乐版本，方便后续在剪映中补音乐或旁白。",
        "- 封面图已单独导出，可直接用于抖音/小红书封面。",
    ]
    manifest.write_text("\n".join(lines), encoding="utf-8")
    return manifest


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    video_path = render_video()
    cover_path = render_cover()
    manifest_path = write_manifest([video_path, cover_path])
    print(video_path)
    print(cover_path)
    print(manifest_path)


if __name__ == "__main__":
    main()
