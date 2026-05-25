from __future__ import annotations

from pathlib import Path

import imageio.v2 as imageio
import numpy as np
from PIL import Image, ImageDraw, ImageFont


WIDTH = 1080
HEIGHT = 1920
FPS = 25

BASE_DIR = Path(__file__).resolve().parent
ASSET_DIR = BASE_DIR / "素材图"

VIDEO_OUT = BASE_DIR / "Day3_奶盖以为没人发现它在偷看年糕.mp4"
VERTICAL_COVER_OUT = BASE_DIR / "封面_Day3_奶盖偷看被抓包_竖屏.png"
HORIZONTAL_COVER_OUT = BASE_DIR / "横封面_Day3_奶盖偷看被抓包_横屏.png"

FONT_CANDIDATES = [
    Path(r"C:\Windows\Fonts\msyhbd.ttc"),
    Path(r"C:\Windows\Fonts\msyh.ttc"),
    Path(r"C:\Windows\Fonts\simhei.ttf"),
]


SCENES = [
    {
        "image": ASSET_DIR / "01_奶盖在高处看年糕.png",
        "duration": 3.0,
        "subtitle": "奶盖总说，\n自己不关心年糕。",
        "zoom_start": 1.00,
        "zoom_end": 1.07,
        "focus_start": (0.46, 0.34),
        "focus_end": (0.45, 0.32),
    },
    {
        "image": ASSET_DIR / "02_年糕在下面玩球.png",
        "duration": 3.0,
        "subtitle": "但只要年糕一动，\n它就开始观察。",
        "zoom_start": 1.02,
        "zoom_end": 1.10,
        "focus_start": (0.50, 0.48),
        "focus_end": (0.52, 0.46),
    },
    {
        "image": ASSET_DIR / "03_年糕抬头看奶盖.png",
        "duration": 3.0,
        "subtitle": "年糕一抬头，\n它又装作没看见。",
        "zoom_start": 1.00,
        "zoom_end": 1.08,
        "focus_start": (0.50, 0.45),
        "focus_end": (0.48, 0.43),
    },
    {
        "image": ASSET_DIR / "04_奶盖装作没看见.png",
        "duration": 3.0,
        "subtitle": "嘴硬的小猫，\n真的很会演。",
        "zoom_start": 1.02,
        "zoom_end": 1.11,
        "focus_start": (0.50, 0.46),
        "focus_end": (0.47, 0.45),
    },
    {
        "image": ASSET_DIR / "05_年糕叼球靠近奶盖.png",
        "duration": 3.0,
        "subtitle": "可眼神已经\n把它出卖了。",
        "zoom_start": 1.00,
        "zoom_end": 1.07,
        "focus_start": (0.50, 0.48),
        "focus_end": (0.52, 0.47),
    },
    {
        "image": ASSET_DIR / "06_窗边同框结尾.png",
        "duration": 3.0,
        "subtitle": "你们说，\n奶盖是不是开始在意年糕了？",
        "zoom_start": 1.00,
        "zoom_end": 1.08,
        "focus_start": (0.50, 0.45),
        "focus_end": (0.49, 0.43),
    },
]


def load_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for path in FONT_CANDIDATES:
        if path.exists():
            return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default()


FONT_BADGE = load_font(34)
FONT_SUBTITLE = load_font(50)
FONT_TITLE = load_font(82)
FONT_TITLE_BIG = load_font(96)
FONT_PILL = load_font(38)


def ease(t: float) -> float:
    return 3 * t * t - 2 * t * t * t


def lerp(start: float, end: float, t: float) -> float:
    return start + (end - start) * t


def cover_crop(image: Image.Image, width: int, height: int, zoom: float, focus: tuple[float, float]) -> Image.Image:
    src = image.convert("RGB")
    scale = max(width / src.width, height / src.height) * zoom
    resized = src.resize((int(src.width * scale), int(src.height * scale)), Image.Resampling.LANCZOS)

    max_left = max(0, resized.width - width)
    max_top = max(0, resized.height - height)
    left = int(max_left * focus[0])
    top = int(max_top * focus[1])
    left = max(0, min(left, max_left))
    top = max(0, min(top, max_top))
    return resized.crop((left, top, left + width, top + height))


def add_bottom_gradient(frame: Image.Image, width: int, height: int) -> None:
    overlay = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    for step in range(180):
        alpha = int(step / 179 * 150)
        y = int(height * 0.58 + step * (height * 0.42 / 180))
        draw.rectangle((0, y, width, height), fill=(18, 14, 12, alpha))
    frame.alpha_composite(overlay)


def draw_badge(draw: ImageDraw.ImageDraw, text: str, xy: tuple[int, int]) -> None:
    x, y = xy
    box = draw.textbbox((0, 0), text, font=FONT_BADGE)
    w = box[2] - box[0]
    h = box[3] - box[1]
    draw.rounded_rectangle((x, y, x + w + 34, y + h + 22), radius=24, fill=(255, 255, 255, 204))
    draw.text((x + 17, y + 9), text, font=FONT_BADGE, fill=(43, 35, 30))


def draw_subtitle(frame: Image.Image, subtitle: str) -> None:
    draw = ImageDraw.Draw(frame)
    lines = subtitle.splitlines()
    line_boxes = [draw.textbbox((0, 0), line, font=FONT_SUBTITLE) for line in lines]
    line_widths = [box[2] - box[0] for box in line_boxes]
    line_heights = [box[3] - box[1] for box in line_boxes]
    line_gap = 14
    pad_x = 48
    pad_y = 30
    text_w = max(line_widths)
    text_h = sum(line_heights) + line_gap * (len(lines) - 1)
    box_w = min(WIDTH - 96, text_w + pad_x * 2)
    box_h = text_h + pad_y * 2
    box_x = (WIDTH - box_w) // 2
    box_y = HEIGHT - box_h - 170

    draw.rounded_rectangle((box_x, box_y, box_x + box_w, box_y + box_h), radius=32, fill=(12, 10, 9, 126))
    cursor_y = box_y + pad_y
    for i, line in enumerate(lines):
        x = (WIDTH - line_widths[i]) // 2
        draw.text((x + 2, cursor_y + 2), line, font=FONT_SUBTITLE, fill=(0, 0, 0, 150))
        draw.text((x, cursor_y), line, font=FONT_SUBTITLE, fill=(255, 255, 255, 255))
        cursor_y += line_heights[i] + line_gap


def render_video() -> None:
    writer = imageio.get_writer(
        VIDEO_OUT,
        fps=FPS,
        codec="libx264",
        quality=8,
        macro_block_size=None,
    )

    try:
        for scene in SCENES:
            image = Image.open(scene["image"])
            frame_count = int(scene["duration"] * FPS)
            for frame_index in range(frame_count):
                t = ease(frame_index / max(1, frame_count - 1))
                zoom = lerp(scene["zoom_start"], scene["zoom_end"], t)
                focus = (
                    lerp(scene["focus_start"][0], scene["focus_end"][0], t),
                    lerp(scene["focus_start"][1], scene["focus_end"][1], t),
                )
                frame = cover_crop(image, WIDTH, HEIGHT, zoom, focus).convert("RGBA")
                add_bottom_gradient(frame, WIDTH, HEIGHT)
                draw = ImageDraw.Draw(frame)
                draw_badge(draw, "奶盖和年糕的 AI 成长日记", (48, 66))
                draw_subtitle(frame, scene["subtitle"])
                writer.append_data(np.asarray(frame.convert("RGB")))
    finally:
        writer.close()


def draw_centered_text(draw: ImageDraw.ImageDraw, lines: list[str], font: ImageFont.ImageFont, start_y: int, width: int) -> int:
    y = start_y
    for line in lines:
        box = draw.textbbox((0, 0), line, font=font)
        tw = box[2] - box[0]
        th = box[3] - box[1]
        x = (width - tw) // 2
        draw.text((x + 3, y + 3), line, font=font, fill=(0, 0, 0, 126))
        draw.text((x, y), line, font=font, fill=(255, 255, 255, 255))
        y += th + 18
    return y


def render_vertical_cover() -> None:
    image = Image.open(ASSET_DIR / "03_年糕抬头看奶盖.png")
    canvas = cover_crop(image, 1080, 1920, 1.02, (0.49, 0.42)).convert("RGBA")
    add_bottom_gradient(canvas, 1080, 1920)
    draw = ImageDraw.Draw(canvas)
    draw_badge(draw, "奶盖和年糕的第 3 天", (58, 86))
    y = draw_centered_text(draw, ["奶盖偷看", "被抓包了"], FONT_TITLE, 180, 1080)
    pill = "嘴硬猫的证据"
    box = draw.textbbox((0, 0), pill, font=FONT_PILL)
    pw = box[2] - box[0]
    ph = box[3] - box[1]
    px = (1080 - pw) // 2
    py = y + 12
    draw.rounded_rectangle((px - 22, py, px + pw + 22, py + ph + 18), radius=24, fill=(255, 255, 255, 214))
    draw.text((px, py + 7), pill, font=FONT_PILL, fill=(48, 39, 34))
    canvas.convert("RGB").save(VERTICAL_COVER_OUT, quality=95)


def render_horizontal_cover() -> None:
    image = Image.open(ASSET_DIR / "03_年糕抬头看奶盖.png")
    canvas = cover_crop(image, 1920, 1080, 1.02, (0.50, 0.42)).convert("RGBA")
    overlay = Image.new("RGBA", (1920, 1080), (0, 0, 0, 0))
    draw_overlay = ImageDraw.Draw(overlay)
    for x in range(1920):
        alpha = int(max(0, (x - 760) / 1160) * 92)
        if alpha:
            draw_overlay.line((x, 0, x, 1080), fill=(18, 14, 12, min(alpha, 92)))
    canvas.alpha_composite(overlay)
    draw = ImageDraw.Draw(canvas)
    draw_badge(draw, "奶盖和年糕的第 3 天", (1050, 122))
    title_y = 250
    for line in ["奶盖偷看", "被抓包了"]:
        box = draw.textbbox((0, 0), line, font=FONT_TITLE_BIG)
        draw.text((1050 + 3, title_y + 3), line, font=FONT_TITLE_BIG, fill=(0, 0, 0, 128))
        draw.text((1050, title_y), line, font=FONT_TITLE_BIG, fill=(255, 255, 255, 255))
        title_y += (box[3] - box[1]) + 18
    pill = "嘴硬猫的证据"
    box = draw.textbbox((0, 0), pill, font=FONT_PILL)
    pw = box[2] - box[0]
    ph = box[3] - box[1]
    draw.rounded_rectangle((1052, title_y + 16, 1052 + pw + 34, title_y + 16 + ph + 18), radius=24, fill=(255, 255, 255, 214))
    draw.text((1069, title_y + 23), pill, font=FONT_PILL, fill=(48, 39, 34))
    canvas.convert("RGB").save(HORIZONTAL_COVER_OUT, quality=95)


def main() -> None:
    render_video()
    render_vertical_cover()
    render_horizontal_cover()
    print(VIDEO_OUT)
    print(VERTICAL_COVER_OUT)
    print(HORIZONTAL_COVER_OUT)


if __name__ == "__main__":
    main()
