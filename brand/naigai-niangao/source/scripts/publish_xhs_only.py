"""奶盖和年糕 Day1 小红书发布"""
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

PROJECT_DIR = Path(r"D:\AI\kzt\brand\naigai-niangao\source")
VIDEO_DIR = PROJECT_DIR / "07_视频成片" / "第一条视频" / "output"
VIDEO_PATH = None
for f in VIDEO_DIR.glob("*.mp4"):
    VIDEO_PATH = f
    break
COVER_PATH = VIDEO_DIR / "day4-video-01-cover.png"

XHS_TITLE = "奶盖和年糕的第1天｜一只高冷猫和一只社牛狗"
XHS_BODY = """今天是奶盖和年糕正式出现的第1天。

奶盖：一只表面高冷、其实很会偷偷观察的小猫。
年糕：一只热情、粘人、每天都想贴贴的小狗。

一个慢热，一个直球。
一个假装不在意，一个永远主动靠近。

从今天开始，记录它们一起长大的日子。
一起云养它们吧。

你们觉得奶盖会什么时候接受年糕？

#云养宠物 #AI宠物 #萌宠日常 #猫狗双全 #宠物日记 #治愈系"""

SCREENSHOT_DIR = PROJECT_DIR / "output" / "screenshots"
SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
USER_DATA_DIR = PROJECT_DIR / ".browser_data"
USER_DATA_DIR.mkdir(parents=True, exist_ok=True)


def ss(page, name):
    p = SCREENSHOT_DIR / f"{name}.png"
    page.screenshot(path=str(p), full_page=False)
    print(f"  [截图] {name}")


def ask(msg):
    print(f"\n>>> {msg}")
    while True:
        r = input().strip().lower()
        if r in ("y", "yes"): return True
        if r in ("n", "no"): return False
        print("输入 y 或 n:")


def main():
    print("=" * 50)
    print("🐱🐶 [小红书] 奶盖和年糕 Day1 发布")
    print("=" * 50)

    if not VIDEO_PATH:
        print("❌ 未找到视频文件")
        return
    print(f"  ✅ 视频: {VIDEO_PATH.name}")
    print(f"  ✅ 封面: {COVER_PATH.name if COVER_PATH.exists() else '未找到'}")
    print(f"  📝 标题: {XHS_TITLE}")
    print(f"  📝 正文: {len(XHS_BODY)} 字")

    print("\n[系统] 启动 Chrome 浏览器...")
    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=str(USER_DATA_DIR),
            channel="chrome",
            headless=False,
            args=["--start-maximized", "--disable-blink-features=AutomationControlled"],
        )
        page = context.pages[0] if context.pages else context.new_page()

        try:
            # 1. 打开小红书创作者中心
            print("\n[小红书] 打开创作者中心...")
            page.goto("https://creator.xiaohongshu.com/publish/publish", wait_until="domcontentloaded")
            time.sleep(5)
            ss(page, "xhs_01_page")

            # 2. 检查登录
            lb = page.query_selector('button:has-text("登录"), button:has-text("登 录")')
            if lb and lb.is_visible():
                ss(page, "xhs_not_logged_in")
                print("\n⚠️  小红书未登录，请在浏览器中手动登录")
                if not ask("登录完成后输入 y"):
                    context.close()
                    return
                page.goto("https://creator.xiaohongshu.com/publish/publish", wait_until="domcontentloaded")
                time.sleep(5)
                lb = page.query_selector('button:has-text("登录"), button:has-text("登 录")')
                if lb and lb.is_visible():
                    print("❌ 登录失败，终止")
                    context.close()
                    return
            print("[小红书] ✅ 已登录")

            # 3. 上传视频
            print(f"\n[小红书] 上传视频: {VIDEO_PATH.name}")
            fi = page.query_selector('input[type="file"]')
            if fi:
                fi.set_input_files(str(VIDEO_PATH))
                print("[小红书] ✅ 视频已选择，等待上传...")
            else:
                up = page.query_selector('[class*="upload"], [class*="drag"], [class*="add"]')
                if up:
                    up.click()
                    time.sleep(2)
                    fi = page.query_selector('input[type="file"]')
                    if fi:
                        fi.set_input_files(str(VIDEO_PATH))
                    else:
                        print("[小红书] ⚠️ 请手动上传视频")
                        if not ask("上传后输入 y"): return
                else:
                    print("[小红书] ⚠️ 请手动上传视频")
                    if not ask("上传后输入 y"): return

            # 等待上传
            print("[小红书] 等待上传完成...")
            time.sleep(10)
            try:
                page.wait_for_function(
                    "() => document.querySelector('input[placeholder*=\"标题\"]') !== null",
                    timeout=180000
                )
                print("[小红书] ✅ 上传完成")
            except:
                print("[小红书] 上传等待结束，继续...")
            time.sleep(3)
            ss(page, "xhs_02_upload_done")

            # 4. 填写标题
            print(f"\n[小红书] 填写标题: {XHS_TITLE}")
            ti = page.query_selector('input[placeholder*="标题"]')
            if ti:
                ti.click()
                time.sleep(0.5)
                ti.fill("")
                time.sleep(0.5)
                ti.type(XHS_TITLE, delay=30)
                print("[小红书] ✅ 标题已填")
            else:
                print("[小红书] ⚠️ 未找到标题框，请手动填写")

            # 5. 填写正文
            print(f"[小红书] 填写正文 ({len(XHS_BODY)} 字)")
            bd = page.query_selector('[class*="ql-editor"], div[contenteditable], [class*="editor"] div[contenteditable]')
            if bd:
                bd.click()
                time.sleep(0.5)
                bd.fill("")
                time.sleep(0.5)
                bd.type(XHS_BODY, delay=10)
                print("[小红书] ✅ 正文已填")
            else:
                print("[小红书] ⚠️ 未找到正文框，请手动填写")

            # 6. 设置封面
            if COVER_PATH.exists():
                print(f"\n[小红书] 设置封面: {COVER_PATH.name}")
                btns = page.query_selector_all("button")
                found = False
                for btn in btns:
                    txt = btn.inner_text().strip() if btn.inner_text() else ""
                    if "封面" in txt:
                        try:
                            btn.click()
                            time.sleep(2)
                            print("[小红书] 已点击封面按钮")
                            found = True
                            break
                        except:
                            continue
                if found:
                    ci = page.query_selector('[class*="cover"] input[type="file"]')
                    if ci:
                        ci.set_input_files(str(COVER_PATH))
                        print("[小红书] ✅ 封面已上传")
                        time.sleep(2)
                        for btn in page.query_selector_all("button"):
                            txt = btn.inner_text().strip() if btn.inner_text() else ""
                            if txt in ("确定", "确认", "完成", "保存"):
                                btn.click()
                                time.sleep(1)
                                break
                    else:
                        print("[小红书] ⚠️ 请手动上传封面图片")
                else:
                    print("[小红书] ⚠️ 请手动设置封面")
            else:
                print("[小红书] ⚠️ 无封面文件，请从视频中选择帧")

            # 7. 发布前截图确认
            print("\n[小红书] 发布前截图...")
            ss(page, "xhs_03_ready")

            print("\n" + "=" * 50)
            print("✅ 发布前准备完成，已截图")
            print('请在飞书回复 "确认发布小红书" 或在此输入 y')
            print("=" * 50)
            if not ask("确认发布?"):
                print("[小红书] 已取消")
                context.close()
                return

            # 8. 点击发布
            print("[小红书] 点击发布...")
            btns = page.query_selector_all("button")
            pb = None
            for btn in btns:
                txt = btn.inner_text().strip() if btn.inner_text() else ""
                if txt in ("发布", "发布笔记", "发布图文"):
                    pb = btn
                    break
            if pb:
                pb.click()
                print("[小红书] ✅ 已点击发布")
            else:
                print("[小红书] ⚠️ 请手动点击发布按钮")
                ask("发布后输入 y")

            time.sleep(5)
            ss(page, "xhs_04_done")

            print("\n" + "=" * 50)
            print("🎉 [小红书] 发布完成!")
            print(f"URL: {page.url}")
            print(f"截图: {SCREENSHOT_DIR}")
            print("=" * 50)

        except KeyboardInterrupt:
            print("\n[系统] 中断")
        except Exception as e:
            print(f"\n[系统] ❌ 异常: {e}")
            import traceback
            traceback.print_exc()
            ss(page, "xhs_error")
        finally:
            print("\n浏览器保持打开。关闭窗口或按 Enter 退出...")
            input()
            context.close()


if __name__ == "__main__":
    main()
