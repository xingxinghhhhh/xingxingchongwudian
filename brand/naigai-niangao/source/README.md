# 奶盖和年糕自动剪辑 v1

## 先安装
Windows 上需要：
- Python 3.10+
- FFmpeg，并加入 PATH
- Python 包：`pip install pillow`

## 使用
1. 把当天图片放进 `assets/day04/`，命名为 `01_xxx.png`, `02_xxx.png`...
2. 在 `assets/day04/subtitles.txt` 里按图片顺序写字幕，一张图一行。
3. 双击 `run_day04.bat`，生成视频到 `output/videos/`。

## 命令行运行
```bash
python scripts/make_video.py --input assets/day04
```

## 输出
`output/videos/day04_奶盖和年糕第1天.mp4`

## 发布文案
发布文案在：
- `output/captions/douyin_title.txt`
- `output/captions/douyin_body.txt`
- `output/captions/xhs_title.txt`
- `output/captions/xhs_body.txt`
- `output/captions/pinned_comment.txt`
