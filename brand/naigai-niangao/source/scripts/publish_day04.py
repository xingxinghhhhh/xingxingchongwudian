"""
奶盖和年糕 Day04 全自动发布脚本 v3
==================================
"""

import os, time, sys, re
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

# ============================================================
# 配置
# ============================================================
PROJECT_DIR = Path(r"D:\AI\kzt\brand\naigai-niangao\source")
VIDEO_PATH = PROJECT_DIR / "output" / "videos" / "day04_奶盖和年糕第1天.mp4"
# 竖屏封面（用于抖音/小红书）
COVER_PATH = PROJECT_DIR / "07_视频成片" / "第一条视频" / "output" / "day4-video-01-cover.png"
DOUYIN_TITLE_FILE = PROJECT_DIR / "output" / "captions" / "douyin_title.txt"
DOUYIN_BODY_FILE = PROJECT_DIR / "output" / "captions" / "douyin_body.txt"
XHS_TITLE_FILE = PROJECT_DIR / "output" / "captions" / "xhs_title.txt"
XHS_BODY_FILE = PROJECT_DIR / "output" / "captions" / "xhs_body.txt"
SCREENSHOT_DIR = PROJECT_DIR / "output" / "screenshots"
SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
USER_DATA_DIR = PROJECT_DIR / ".browser_data"
USER_DATA_DIR.mkdir(parents=True, exist_ok=True)


def read_text(fp):
    if not fp.exists():
        print(f"[WARN] Missing: {fp}")
        return ""
    return fp.read_text(encoding="utf-8").strip()


def screenshot(page, name):
    path = SCREENSHOT_DIR / f"{name}.png"
    page.screenshot(path=str(path), full_page=False)
    print(f"  [截图] {name}")


def ask(msg):
    print(f"\n>>> {msg}")
    while True:
        r = input().strip().lower()
        if r in ("y", "yes"): return True
        if r in ("n", "no"): return False
        print("输入 y 或 n:")


# ============================================================
# 抖音
# ============================================================
def dy_run(page):
    print("\n" + "=" * 50)
    print("🚀 [抖音] 发布")
    print("=" * 50)

    # 打开
    page.goto("https://creator.douyin.com/", wait_until="domcontentloaded")
    time.sleep(3)
    screenshot(page, "dy_01_home")

    if not dy_check_login(page):
        print("\n⚠️  抖音未登录，请在浏览器中手动登录后输入 y")
        if not ask("已登录?"): return False
        page.goto("https://creator.douyin.com/", wait_until="domcontentloaded")
        time.sleep(3)
        if not dy_check_login(page):
            print("[抖音] 登录失败")
            return False
    print("[抖音] ✅ 已登录")

    # 上传页
    page.goto("https://creator.douyin.com/creator-micro/content/upload", wait_until="domcontentloaded")
    time.sleep(3)
    screenshot(page, "dy_02_upload_page")

    # 上传视频
    fi = page.query_selector('input[type="file"]')
    if fi:
        fi.set_input_files(str(VIDEO_PATH))
        print("[抖音] ✅ 视频已选择")
    else:
        print("[抖音] ⚠️ 请手动上传视频")
        if not ask("上传后输入 y"): return False

    # 等待上传完成
    print("[抖音] 等待上传...")
    time.sleep(5)
    try:
        page.wait_for_function(
            "() => document.querySelector('input.semi-input-default[placeholder*=\"标题\"]') !== null",
            timeout=180000
        )
    except:
        pass
    time.sleep(3)
    screenshot(page, "dy_03_upload_done")

    # 标题
    title = read_text(DOUYIN_TITLE_FILE)
    print(f"[抖音] 标题: {title}")
    ti = page.query_selector('input.semi-input-default[placeholder*="标题"]')
    if ti:
        ti.click(); time.sleep(0.3)
        ti.fill(""); time.sleep(0.3)
        ti.type(title, delay=30)
        print("[抖音] ✅ 标题已填")

    # 正文
    body = read_text(DOUYIN_BODY_FILE)
    print(f"[抖音] 正文 ({len(body)} 字)")
    bd = page.query_selector('div[contenteditable]')
    if bd:
        bd.click(); time.sleep(0.3)
        bd.fill(""); time.sleep(0.3)
        bd.type(body, delay=15)
        print("[抖音] ✅ 正文已填")

    # 封面
    dy_set_cover(page)

    # 背景音乐（视频无音轨，需要在抖音上加）
    dy_add_music(page)

    screenshot(page, "dy_04_ready")
    print("\n✅ [抖音] 发布前准备完成，截图已保存")
    return True


def dy_check_login(page):
    try:
        btns = page.query_selector_all('button:has-text("登录"), a:has-text("登录")')
        avatar = page.query_selector('[class*="avatar"]')
        if btns and any(b.is_visible() for b in btns) and not avatar:
            return False
        return True
    except:
        return True


def dy_set_cover(page):
    """上传自定义封面"""
    if not COVER_PATH.exists():
        print("[抖音] ⚠️ 无封面文件")
        return
    try:
        # 找含"封面"文字的按钮或区域
        btns = page.query_selector_all('button, [class*="cover"], [class*="poster"]')
        found = False
        for btn in btns:
            txt = btn.inner_text().strip() if btn.inner_text() else ""
            cls = (btn.get_attribute("class") or "").lower()
            if "封面" in txt or "cover" in cls or "poster" in cls:
                try:
                    btn.click()
                    print("[抖音] 已点击封面按钮")
                    time.sleep(2)
                    found = True
                    break
                except:
                    continue
        if not found:
            print("[抖音] ⚠️ 请手动设置封面（右侧面板可上传封面）")

        # 找封面上传 input
        ci = page.query_selector('[class*="cover"] input[type="file"], [class*="poster"] input[type="file"]')
        if ci:
            ci.set_input_files(str(COVER_PATH))
            print(f"[抖音] ✅ 封面已上传: {COVER_PATH.name}")
            time.sleep(3)
            # 点确认
            for btn in page.query_selector_all("button"):
                txt = btn.inner_text().strip()
                if txt in ("确定", "确认", "完成", "保存"):
                    btn.click()
                    time.sleep(1)
                    break
        else:
            print("[抖音] ⚠️ 未找到封面上传控件")
    except Exception as e:
        print(f"[抖音] ⚠️ 封面设置异常: {e}")


def dy_add_music(page):
    """添加背景音乐"""
    print("[抖音] 尝试添加背景音乐...")
    try:
        # 找"添加音乐"或"选择音乐"按钮
        btns = page.query_selector_all("button, [class*=\"music\"] button, [class*=\"audio\"] button")
        music_btn = None
        for btn in btns:
            txt = btn.inner_text().strip() if btn.inner_text() else ""
            if any(kw in txt for kw in ["添加音乐", "选择音乐", "音乐", "配乐", "背景音乐", "推荐音乐"]):
                music_btn = btn
                break

        if music_btn:
            music_btn.click()
            print("[抖音] ✅ 已点击添加音乐")
            time.sleep(3)
            screenshot(page, "dy_music_panel")

            # 尝试选择一个推荐的音乐（第一个）
            music_items = page.query_selector_all('[class*="music-item"], [class*="music-card"], [class*="song-item"], li, [class*="recommend"]')
            if music_items:
                music_items[0].click()
                print("[抖音] ✅ 已选择第一首推荐音乐")
                time.sleep(2)
            else:
                print("[抖音] ⚠️ 请手动选择背景音乐")
                if not ask("选择音乐后输入 y"):
                    return
        else:
            print("[抖音] ⚠️ 未自动找到添加音乐按钮")
            print("[抖音] 发布时请手动添加背景音乐（视频无音轨）")
    except Exception as e:
        print(f"[抖音] ⚠️ 添加音乐异常: {e}")


def dy_confirm(page):
    print("\n" + "=" * 50)
    print('⏳ [抖音] 请在飞书回复 "确认发布抖音"')
    print("或在此输入 y/n")
    print("=" * 50)
    if not ask("确认发布?"):
        print("[抖音] 已取消")
        return False
    try:
        btns = page.query_selector_all("button")
        pb = None
        for btn in btns:
            txt = btn.inner_text().strip() if btn.inner_text() else ""
            if txt in ("发布", "高清发布") or txt == "发布":
                pb = btn
                break
        if pb:
            pb.click()
            print("[抖音] ✅ 已点击发布")
        else:
            print("[抖音] ⚠️ 请手动点击发布按钮（蓝色发布按钮）后输入 y")
            ask("发布后输入 y")
    except Exception as e:
        print(f"[抖音] ⚠️ 异常: {e}")

    time.sleep(5)
    screenshot(page, "dy_05_done")
    print("[抖音] ✅ 发布完成!")
    print(f"URL: {page.url}")
    return True


# ============================================================
# 小红书
# ============================================================
def xhs_run(page):
    print("\n" + "=" * 50)
    print("🚀 [小红书] 发布")
    print("=" * 50)

    page.goto("https://creator.xiaohongshu.com/publish/publish", wait_until="domcontentloaded")
    time.sleep(5)
    screenshot(page, "xhs_01_publish")

    if xhs_check_login(page):
        print("[小红书] ✅ 已登录")
    else:
        print("\n⚠️  小红书未登录，请手动登录后输入 y")
        if not ask("已登录?"): return False
        page.goto("https://creator.xiaohongshu.com/publish/publish", wait_until="domcontentloaded")
        time.sleep(5)
        if not xhs_check_login(page):
            print("[小红书] 登录失败")
            return False

    # 上传
    fi = page.query_selector('input[type="file"]')
    if fi:
        fi.set_input_files(str(VIDEO_PATH))
        print("[小红书] ✅ 视频已选择")
    else:
        # 尝试点击上传区
        up = page.query_selector('[class*="upload"], [class*="drag"], [class*="add"]')
        if up:
            up.click()
            time.sleep(2)
            fi = page.query_selector('input[type="file"]')
            if fi:
                fi.set_input_files(str(VIDEO_PATH))
            else:
                print("[小红书] ⚠️ 请手动上传")
                if not ask("上传后输入 y"): return False
        else:
            print("[小红书] ⚠️ 请手动上传")
            if not ask("上传后输入 y"): return False

    print("[小红书] 等待上传...")
    time.sleep(10)
    try:
        page.wait_for_function(
            "() => document.querySelector('input[placeholder*=\"标题\"]') !== null",
            timeout=180000
        )
        print("[小红书] ✅ 上传完成")
    except:
        pass
    time.sleep(3)
    screenshot(page, "xhs_02_upload_done")

    # 标题
    title = read_text(XHS_TITLE_FILE)
    print(f"[小红书] 标题: {title}")
    ti = page.query_selector('input[placeholder*="标题"]')
    if ti:
        ti.click(); time.sleep(0.3)
        ti.fill(""); time.sleep(0.3)
        ti.type(title, delay=30)
        print("[小红书] ✅ 标题已填")

    # 正文
    body = read_text(XHS_BODY_FILE)
    print(f"[小红书] 正文 ({len(body)} 字)")
    bd = page.query_selector('[class*="content"] div[contenteditable], div[class*="ql-editor"], div[class*="editor"]')
    if bd:
        bd.click(); time.sleep(0.3)
        bd.fill(""); time.sleep(0.3)
        bd.type(body, delay=15)
        print("[小红书] ✅ 正文已填")

    # 封面
    xhs_set_cover(page)

    screenshot(page, "xhs_03_ready")
    print("\n✅ [小红书] 发布前准备完成")
    return True


def xhs_check_login(page):
    try:
        lb = page.query_selector('button:has-text("登录"), button:has-text("登 录")')
        if lb and lb.is_visible():
            return False
        if "login" in page.url.lower():
            return False
        return True
    except:
        return False


def xhs_set_cover(page):
    if not COVER_PATH.exists():
        print("[小红书] ⚠️ 无封面文件")
        return
    try:
        btns = page.query_selector_all("button")
        for btn in btns:
            txt = btn.inner_text().strip()
            if "封面" in txt:
                btn.click()
                time.sleep(2)
                break
        else:
            print("[小红书] ⚠️ 未找到封面按钮")
            return

        ci = page.query_selector('[class*="cover"] input[type="file"]')
        if ci:
            ci.set_input_files(str(COVER_PATH))
            print(f"[小红书] ✅ 封面已上传: {COVER_PATH.name}")
            time.sleep(2)
            for btn in page.query_selector_all("button"):
                txt = btn.inner_text().strip()
                if txt in ("确定", "确认", "完成", "保存"):
                    btn.click()
                    time.sleep(1)
                    break
        else:
            print("[小红书] ⚠️ 未找到封面上传控件")
    except Exception as e:
        print(f"[小红书] ⚠️ 封面异常: {e}")


def xhs_confirm(page):
    print("\n" + "=" * 50)
    print('⏳ [小红书] 请在飞书回复 "确认发布小红书"')
    print("或在此输入 y/n")
    print("=" * 50)
    if not ask("确认发布?"):
        print("[小红书] 已取消")
        return False
    try:
        btns = page.query_selector_all("button")
        pb = None
        for btn in btns:
            txt = btn.inner_text().strip() if btn.inner_text() else ""
            if txt in ("发布", "发布笔记"):
                pb = btn
                break
        if pb:
            pb.click()
            print("[小红书] ✅ 已点击发布")
        else:
            print("[小红书] ⚠️ 请手动点击发布按钮后输入 y")
            ask("发布后输入 y")
    except Exception as e:
        print(f"[小红书] ⚠️ 异常: {e}")

    time.sleep(5)
    screenshot(page, "xhs_04_done")
    print("[小红书] ✅ 发布完成!")
    print(f"URL: {page.url}")
    return True


# ============================================================
# 主流程
# ============================================================
def main():
    print("=" * 50)
    print("🐱🐶 奶盖和年糕 Day04 发布")
    print("=" * 50)

    checks = [
        ("视频", VIDEO_PATH),
        ("封面(竖屏)", COVER_PATH),
        ("抖音标题", DOUYIN_TITLE_FILE),
        ("抖音正文", DOUYIN_BODY_FILE),
        ("小红书标题", XHS_TITLE_FILE),
        ("小红书正文", XHS_BODY_FILE),
    ]
    ok = True
    for name, path in checks:
        e = path.exists()
        print(f"  {'✅' if e else '❌'} {name}")
        if not e: ok = False
    if not ok:
        print("\n❌ 文件缺失，终止")
        return

    print("\n[系统] 启动 Chrome...(浏览器会保持打开)")
    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=str(USER_DATA_DIR),
            channel="chrome",
            headless=False,
            args=["--start-maximized", "--disable-blink-features=AutomationControlled"],
        )
        page = context.pages[0] if context.pages else context.new_page()

        try:
            if not dy_run(page):
                context.close(); return
            dy_confirm(page)

            print("\n" + "=" * 50)
            print("⏸️  准备发布小红书")
            if not ask("继续?"):
                context.close(); return

            if not xhs_run(page):
                context.close(); return
            xhs_confirm(page)

            print("\n" + "=" * 50)
            print("🎉 全部发布完成!")
            print(f"截图: {SCREENSHOT_DIR}")
            print("=" * 50)

        except KeyboardInterrupt:
            print("\n[系统] 中断")
        except Exception as e:
            print(f"\n[系统] ❌ {e}")
            import traceback; traceback.print_exc()
            screenshot(page, "error")
        finally:
            print("\n浏览器保持打开，关闭窗口或按 Enter 退出...")
            input()


if __name__ == "__main__":
    main()
