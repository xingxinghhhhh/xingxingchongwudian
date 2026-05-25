"""小红书发布 - 简洁稳定版"""
import time, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = Path(r"D:\AI\kzt\brand\naigai-niangao\source")
VIDEO = BASE / "07_视频成片" / "第一条视频" / "output" / "day4-video-01.mp4"
COVER = BASE / "07_视频成片" / "第一条视频" / "output" / "day4-video-01-cover.png"
SS_DIR = BASE / "output" / "screenshots"
SS_DIR.mkdir(parents=True, exist_ok=True)
DATA_DIR = BASE / ".browser_data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

TITLE = "奶盖和年糕的第1天｜一只高冷猫和一只社牛狗"
BODY = """今天是奶盖和年糕正式出现的第1天。

奶盖：一只表面高冷、其实很会偷偷观察的小猫。
年糕：一只热情、粘人、每天都想贴贴的小狗。

一个慢热，一个直球。
一个假装不在意，一个永远主动靠近。

从今天开始，记录它们一起长大的日子。
一起云养它们吧。

你们觉得奶盖会什么时候接受年糕？

#云养宠物 #AI宠物 #萌宠日常 #猫狗双全 #宠物日记 #治愈系"""


def sp(page, name):
    page.screenshot(path=str(SS_DIR / f"{name}.png"), full_page=False)
    print(f"  📸 {name}")


def ask(msg):
    print(f"\n>>> {msg}")
    while True:
        r = input().strip().lower()
        if r in ("y", "yes"): return True
        if r in ("n", "no"): return False
        print("输入 y/n:")


def main():
    print("=" * 50)
    print("🐱 [小红书] 奶盖和年糕 Day1")
    print("=" * 50)
    print(f"视频: {VIDEO.name}")
    print(f"封面: {COVER.name if COVER.exists() else '❌ 无'}")

    print("\n[启动 Chrome] 请使用刚刚打开的浏览器窗口")
    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=str(DATA_DIR),
            channel="chrome",
            headless=False,
            args=["--start-maximized"],
        )
        page = context.pages[0] if context.pages else context.new_page()

        try:
            # === Step 1: 打开发布页 ===
            print("[1/7] 打开小红书发布页...")
            page.goto("https://creator.xiaohongshu.com/publish/publish", timeout=60000)
            time.sleep(5)
            sp(page, "01_page")

            # === Step 2: 检查登录 ===
            lb = page.query_selector('button:has-text("登录")')
            if lb and lb.is_visible():
                sp(page, "02_nologin")
                print("\n⚠️  未登录！请在浏览器窗口手动登录后输入 y")
                if not ask("已登录?"):
                    context.close()
                    return
                time.sleep(3)
                sp(page, "03_after_login")

            print("[小红书] ✅ 已登录")

            # === Step 3: 上传视频 ===
            print(f"[2/7] 上传视频: {VIDEO.name}")
            fi = page.query_selector('input[type="file"]')
            if fi:
                fi.set_input_files(str(VIDEO))
                print("  ✅ 文件已选，等待上传...")
            else:
                print("  ⚠️ 未自动找到上传控件")
                print("  请在浏览器中手动上传视频，完成后输入 y")
                if not ask("已上传?"):
                    context.close()
                    return

            # 等待上传完成
            print("  等待上传（最长3分钟）...")
            try:
                page.wait_for_function(
                    "() => { const el = document.querySelector('input[placeholder*=\"标题\"]'); return el && el.offsetParent !== null; }",
                    timeout=180000
                )
                print("  ✅ 上传完成")
            except:
                print("  上传等待结束（可能还在处理）")
                time.sleep(10)

            sp(page, "04_upload_done")

            # === Step 4: 填写标题 ===
            print(f"[3/7] 标题: {TITLE}")
            ti = page.query_selector('input[placeholder*="标题"]')
            if ti:
                ti.click()
                time.sleep(0.5)
                ti.fill("")
                time.sleep(0.5)
                for ch in TITLE:
                    ti.type(ch, delay=20)
                print("  ✅ 标题已填")
            else:
                print("  ⚠️ 请手动填写标题")

            # === Step 5: 填写正文 ===
            print(f"[4/7] 正文: {len(BODY)} 字")
            bd = page.query_selector('div.ql-editor, div[contenteditable]')
            if bd:
                bd.click()
                time.sleep(0.5)
                bd.fill("")
                time.sleep(0.5)
                for ch in BODY:
                    bd.type(ch, delay=5)
                print("  ✅ 正文已填")
            else:
                print("  ⚠️ 请手动填写正文")

            # === Step 6: 设置封面 ===
            print(f"[5/7] 封面: {COVER.name if COVER.exists() else '从视频选帧'}")
            if COVER.exists():
                btns = page.query_selector_all("button, [role=button]")
                for btn in btns:
                    try:
                        txt = btn.inner_text().strip() if btn.inner_text() else ""
                        if "封面" in txt:
                            btn.click()
                            time.sleep(2)
                            ci = page.query_selector('[class*="cover"] input[type="file"]')
                            if ci:
                                ci.set_input_files(str(COVER))
                                print("  ✅ 封面已上传")
                                time.sleep(2)
                            else:
                                print("  ⚠️ 请手动在弹窗中上传封面")
                            break
                    except:
                        continue
                else:
                    print("  ⚠️ 请手动设置封面")

            # === Step 7: 截图确认 ===
            sp(page, "05_ready")
            print("\n" + "=" * 50)
            print("✅ 发布前准备完成")
            print('请检查浏览器中的内容')
            print('回复 "确认发布小红书" 或在此输入 y')
            print("=" * 50)

            if not ask("确认发布?"):
                print("已取消")
                context.close()
                return

            # 发布
            print("[6/7] 点击发布...")
            btns = page.query_selector_all("button")
            for btn in btns:
                try:
                    txt = btn.inner_text().strip() if btn.inner_text() else ""
                    if txt in ("发布", "发布笔记"):
                        btn.click()
                        print("  ✅ 已点击发布")
                        break
                except:
                    continue
            else:
                print("  ⚠️ 请手动点击发布按钮")
                ask("发布后输入 y")

            time.sleep(5)
            sp(page, "06_done")

            print("\n" + "=" * 50)
            print("🎉 发布完成!")
            print(f"页面: {page.url}")
            print(f"截图: {SS_DIR}")
            print("=" * 50)

        except Exception as e:
            print(f"\n❌ 异常: {e}")
            import traceback
            traceback.print_exc()
            sp(page, "error")
        finally:
            print("\n浏览器保持打开。按 Enter 退出...")
            input()
            context.close()


main()
