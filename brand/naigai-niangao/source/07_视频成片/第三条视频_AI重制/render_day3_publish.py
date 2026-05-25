from __future__ import annotations

import sys
from pathlib import Path

sys.path.append(r"D:\AI\kzt\.video_deps")

import imageio.v2 as imageio
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont


WIDTH = 1080
HEIGHT = 1920
FPS = 25

BASE_DIR = Path(__file__).resolve().parent
VIDEO_OUT = BASE_DIR / "Day3_奶盖偷看年糕被抓包.mp4"

SCENES = [
    {
        "image": BASE_DIR / "scene_01_奶盖偷看.png",
        "duration": 4.5,
        "subtitle": "奶盖总说，\n自己不关心年糕。",
        "zoom": (1.02, 1.10),
        "focus": ((0.50, 0.35), (0.48, 0.32)),
    },
    {
        "image": BASE_DIR / "scene_02_年糕玩球.png",
        "duration": 4.5,
        "subtitle": "但只要年糕一动，\n它就会偷偷看过去。",
        "zoom": (1.02, 1.11),
        "focus": ((0.50, 0.48), (0.52, 0.46)),
    },
    {
        "image": BASE_DIR / "scene_03_偷看被抓包.png",
        "duration": 4.5,
        "subtitle": "年糕一抬头，\n它又装作没看见。",
        "zoom": (1.00, 1.08),
        "focus": ((0.49, 0.42), (0.48, 0.39)),
    },
    {
        "image": BASE_DIR / "scene_04_温馨靠近.png",
        "duration": 4.5,
        "subtitle": "嘴硬的小猫，\n真的很会演。",
        "zoom": (1.02, 1.10),
        "focus": ((0.50, 0.44), (0.50, 0.42)),
    },
]

FONT_BOLD = Path(r"C:\Windows\Fonts\msyhbd.ttc")
FONT_REGULAR = Path(r"C:\Windows\Fonts\msyh.ttc")


def font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(path), size=size)


FONT_BADGE = font(FONT_REGULAR, 34)
FONT_SUBTITLE = font(FONT_BOLD, 54)


def ease(t: float) -> float:
    return 3 * t * t - 2 * t * t * t


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


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


def add_readability_layers(frame: Image.Image) -> None:
    overlay = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    for i in range(220):
        alpha = int(135 * (i / 219))
        y = int(HEIGHT * 0.58 + i * (HEIGHT * 0.42 / 220))
        draw.line((0, y, WIDTH, y), fill=(20, 15, 12, alpha))

    for i in range(150):
        alpha = int(68 * (1 - i / 149))
        draw.line((0, i, WIDTH, i), fill=(20, 15, 12, alpha))

    frame.alpha_composite(overlay)


def draw_badge(draw: ImageDraw.ImageDraw) -> None:
    text = "奶盖和年糕的 AI 成长日记"
    x, y = 48, 64
    box = draw.textbbox((0, 0), text, font=FONT_BADGE)
    tw = box[2] - box[0]
    th = box[3] - box[1]
    draw.rounded_rectangle((x, y, x + tw + 34, y + th + 24), radius=24, fill=(255, 255, 255, 205))
    draw.text((x + 17, y + 10), text, font=FONT_BADGE, fill=(67, 48, 36))


def draw_subtitle(frame: Image.Image, text: str) -> None:
    draw = ImageDraw.Draw(frame)
    lines = text.splitlines()
    boxes = [draw.textbbox((0, 0), line, font=FONT_SUBTITLE, stroke_width=2) for line in lines]
    widths = [box[2] - box[0] for box in boxes]
    heights = [box[3] - box[1] for box in boxes]
    gap = 16
    pad_x = 48
    pad_y = 30
    content_w = max(widths)
    content_h = sum(heights) + gap * (len(lines) - 1)
    panel_w = min(WIDTH - 96, content_w + pad_x * 2)
    panel_h = content_h + pad_y * 2
    panel_x = (WIDTH - panel_w) // 2
    panel_y = HEIGHT - panel_h - 176

    shadow = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle((panel_x + 4, panel_y + 5, panel_x + panel_w + 4, panel_y + panel_h + 5), radius=34, fill=(0, 0, 0, 75))
    shadow = shadow.filter(ImageFilter.GaussianBlur(4))
    frame.alpha_composite(shadow)

    draw.rounded_rectangle((panel_x, panel_y, panel_x + panel_w, panel_y + panel_h), radius=34, fill=(18, 14, 12, 128))

    y = panel_y + pad_y
    for index, line in enumerate(lines):
        x = (WIDTH - widths[index]) // 2
        draw.text((x + 2, y + 2), line, font=FONT_SUBTITLE, fill=(0, 0, 0, 155), stroke_width=2, stroke_fill=(0, 0, 0, 80))
        draw.text((x, y), line, font=FONT_SUBTITLE, fill=(255, 255, 255, 255), stroke_width=2, stroke_fill=(72, 50, 36, 210))
        y += heights[index] + gap


def render() -> None:
    for scene in SCENES:
        if not scene["image"].exists():
            raise FileNotFoundError(scene["image"])

    writer = imageio.get_writer(
        VIDEO_OUT,
        fps=FPS,
        codec="libx264",
        quality=8,
        pixelformat="yuv420p",
        macro_block_size=None,
    )
    try:
        for scene in SCENES:
            source = Image.open(scene["image"])
            frame_count = int(scene["duration"] * FPS)
            for i in range(frame_count):
                t = ease(i / max(1, frame_count - 1))
                zoom = lerp(scene["zoom"][0], scene["zoom"][1], t)
                focus = (
                    lerp(scene["focus"][0][0], scene["focus"][1][0], t),
                    lerp(scene["focus"][0][1], scene["focus"][1][1], t),
                )
                frame = cover_crop(source, WIDTH, HEIGHT, zoom, focus).convert("RGBA")
                add_readability_layers(frame)
                draw = ImageDraw.Draw(frame)
                draw_badge(draw)
                draw_subtitle(frame, scene["subtitle"])
                writer.append_data(np.asarray(frame.convert("RGB")))
    finally:
        writer.close()


if __name__ == "__main__":
    render()
    print(VIDEO_OUT)
