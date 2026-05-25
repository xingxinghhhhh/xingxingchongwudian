@echo off
cd /d %~dp0
python scripts\make_video.py --input assets/day04
pause
