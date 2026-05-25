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
VIDEO_OUT = BASE_DIR / "Day4_年糕把最喜欢的小球送给奶盖.mp4"
VERTICAL_COVER_OUT = BASE_DIR / "封面_Day4_年糕送球给奶盖_竖屏_带字.png"
HORIZONTAL_COVER_OUT = BASE_DIR / "横封面_Day4_年糕送球给奶盖_带字.png"

SCENES = [
    {
        "image": BASE_DIR / "scene_01_年糕叼球.png",
        "duration": 4.5,
        "subtitle": "年糕今天，\n叼来了自己最喜欢的小球。",
        "zoom": (1.02, 1.10),
        "focus": ((0.50, 0.44), (0.52, 0.42)),
    },
    {
        "image": BASE_DIR / "scene_02_年糕送球.png",
        "duration": 4.5,
        "subtitle": "它小心翼翼地，\n推到了奶盖面前。",
        "zoom": (1.00, 1.08),
        "focus": ((0.50, 0.46), (0.50, 0.43)),
    },
    {
        "image": BASE_DIR / "scene_03_奶盖收下小球.png",
        "duration": 4.5,
        "subtitle": "奶盖嘴上没说，\n爪子却已经伸过去了。",
        "zoom": (1.02, 1.10),
        "focus": ((0.50, 0.45), (0.49, 0.42)),
    },
    {
        "image": BASE_DIR / "scene_04_小球在中间.png",
        "duration": 4.5,
        "subtitle": "这颗小球，\n好像把它们拉近了一点。",
        "zoom": (1.02, 1.09),
        "focus": ((0.50, 0.46), (0.50, 0.43)),
    },
]

FONT_BOLD = Path(r"C:\Windows\Fonts\msyhbd.ttc")
FONT_REGULAR = Path(r"C:\Windows\Fonts\msyh.ttc")


def font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(path), size=size)


FONT_BADGE = font(FONT_REGULAR, 34)
FONT_SUBTITLE = font(FONT_BOLD, 52)
FONT_COVER_BIG = font(FONT_BOLD, 86)
FONT_COVER_MID = font(FONT_REGULAR, 38)


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
    left = max(0, min(int(max_left * focus[0]), max_left))
    top = max(0, min(int(max_top * focus[1]), max_top))
    return resized.crop((left, top, left + width, top + height))


def add_layers(frame: Image.Image) -> None:
    overlay = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    w, h = frame.size
    for i in range(int(h * 0.42)):
        alpha = int(145 * (i / max(1, int(h * 0.42) - 1)))
        y = int(h * 0.58) + i
        draw.line((0, y, w, y), fill=(20, 15, 12, alpha))
    for i in range(int(h * 0.18)):
        alpha = int(72 * (1 - i / max(1, int(h * 0.18) - 1)))
        draw.line((0, i, w, i), fill=(20, 15, 12, alpha))
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
    panel_w = min(WIDTH - 96, max(widths) + pad_x * 2)
    panel_h = sum(heights) + gap * (len(lines) - 1) + pad_y * 2
    panel_x = (WIDTH - panel_w) // 2
    panel_y = HEIGHT - panel_h - 176

    shadow = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.rounded_rectangle((panel_x + 4, panel_y + 5, panel_x + panel_w + 4, panel_y + panel_h + 5), radius=34, fill=(0, 0, 0, 75))
    shadow = shadow.filter(ImageFilter.GaussianBlur(4))
    frame.alpha_composite(shadow)

    draw.rounded_rectangle((panel_x, panel_y, panel_x + panel_w, panel_y + panel_h), radius=34, fill=(18, 14, 12, 128))
    y = panel_y + pad_y
    for i, line in enumerate(lines):
        x = (WIDTH - widths[i]) // 2
        draw.text((x + 2, y + 2), line, font=FONT_SUBTITLE, fill=(0, 0, 0, 155), stroke_width=2, stroke_fill=(0, 0, 0, 80))
        draw.text((x, y), line, font=FONT_SUBTITLE, fill=(255, 255, 255, 255), stroke_width=2, stroke_fill=(72, 50, 36, 210))
        y += heights[i] + gap


def render_video() -> None:
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
                add_layers(frame)
                draw = ImageDraw.Draw(frame)
                draw_badge(draw)
                draw_subtitle(frame, scene["subtitle"])
                writer.append_data(np.asarray(frame.convert("RGB")))
    finally:
        writer.close()


def draw_centered(draw: ImageDraw.ImageDraw, lines: list[str], font_obj: ImageFont.FreeTypeFont, y: int, width: int) -> int:
    for line in lines:
        box = draw.textbbox((0, 0), line, font=font_obj, stroke_width=3)
        tw = box[2] - box[0]
        th = box[3] - box[1]
        x = (width - tw) // 2
        draw.text((x + 4, y + 5), line, font=font_obj, fill=(0, 0, 0, 145), stroke_width=4, stroke_fill=(0, 0, 0, 120))
        draw.text((x, y), line, font=font_obj, fill=(255, 255, 255, 255), stroke_width=3, stroke_fill=(70, 47, 34, 220))
        y += th + 20
    return y


def render_cover(src: Path, out: Path, size: tuple[int, int], focus: tuple[float, float], title: list[str], sub: str) -> None:
    canvas = cover_crop(Image.open(src), size[0], size[1], 1.04, focus).convert("RGBA")
    add_layers(canvas)
    draw = ImageDraw.Draw(canvas)
    y = int(size[1] * 0.075)
    y = draw_centered(draw, title, FONT_COVER_BIG if size[1] > size[0] else font(FONT_BOLD, 68), y, size[0])
    box = draw.textbbox((0, 0), sub, font=FONT_COVER_MID)
    tw = box[2] - box[0]
    th = box[3] - box[1]
    x = (size[0] - tw) // 2
    pad_x = 26
    pad_y = 12
    draw.rounded_rectangle((x - pad_x, y + 8, x + tw + pad_x, y + th + pad_y + 8), radius=26, fill=(255, 255, 255, 205))
    draw.text((x, y + 12), sub, font=FONT_COVER_MID, fill=(83, 58, 42))
    canvas.convert("RGB").save(out, quality=95)


def render_covers() -> None:
    render_cover(
        BASE_DIR / "scene_03_奶盖收下小球.png",
        VERTICAL_COVER_OUT,
        (1080, 1920),
        (0.50, 0.42),
        ["奶盖收下了", "年糕的小球"],
        "嘴硬小猫又被看穿了",
    )
    render_cover(
        BASE_DIR / "scene_03_奶盖收下小球.png",
        HORIZONTAL_COVER_OUT,
        (1672, 941),
        (0.50, 0.45),
        ["奶盖收下了年糕的小球"],
        "第 4 天：靠近一点点",
    )


if __name__ == "__main__":
    render_video()
    render_covers()
    print(VIDEO_OUT)
    print(VERTICAL_COVER_OUT)
    print(HORIZONTAL_COVER_OUT)
