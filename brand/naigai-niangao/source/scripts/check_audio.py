"""Check video audio status"""
import ffmpeg, os

video = r"D:\AI\kzt\brand\naigai-niangao\source\output\videos\day04_奶盖和年糕第1天.mp4"
print(f"File: {os.path.basename(video)}")
print(f"Size: {os.path.getsize(video)/1024/1024:.1f} MB")

try:
    probe = ffmpeg.probe(video)
    streams = probe.get("streams", [])
    has_audio = False
    for s in streams:
        ctype = s.get("codec_type", "unknown")
        codec = s.get("codec_name", "?")
        print(f"  Stream type={ctype}, codec={codec}")
        if ctype == "audio":
            has_audio = True
            sr = s.get("sample_rate", "?")
            ch = s.get("channels", "?")
            print(f"    Sample rate={sr}, channels={ch}")
    
    fmt = probe.get("format", {})
    dur = fmt.get("duration", "?")
    print(f"Duration: {dur}s")
    print(f"Has audio: {has_audio}")
    
    if not has_audio:
        print("\n=> 没有音轨，需要添加背景音乐")
except Exception as e:
    print(f"Error: {e}")
