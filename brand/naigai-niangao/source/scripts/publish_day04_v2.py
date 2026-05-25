"""
奶盖和年糕 Day04 全自动发布脚本
抖音 + 小红书
"""

import os, time, sys, re
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

# ============================================================
# Day4 配置
# ============================================================
BASE = Path(r"D:\AI\kzt\brand\naigai-niangao\source")
DAY4_DIR = BASE / "07_视频成片" / "第四条视频"

VIDEO_PATH = DAY4_DIR / "Day4_年糕把最喜欢的小球送给奶盖.mp4"
COVER_PORTRAIT = DAY4_DIR / "封面_Day4_年糕送球给奶盖_竖屏_带字.png"
COVER_LANDSCAPE = DAY4_DIR / "横封面_Day4_年糕送球给奶盖_带字.png"
DOUYIN_TITLE_FILE = DAY4_DIR / "抖音标题.txt"
DOUYIN_BODY_FILE = DAY4_DIR / "抖音文案.txt"
XHS_TITLE_FILE = DAY4_DIR / "小红书标题.txt"
XHS_BODY_FILE = DAY4_DIR / "小红书文案.txt"
SCREENSHOT_DIR = DAY4_DIR / "screenshots"
RECORD_FILE = BASE / "10_数据复盘" / "Day4_发布记录.txt"

SCREENSHOT_DIR.mkdir(parents=True, exist_ok=True)
USER_DATA_DIR = BASE / ".browser_data"
USER_DATA_DIR.mkdir(parents=True, exist_ok=True)


# ============================================================
# 工具函数
# ============================================================

def read_text(fp):
    if not fp.exists():
        print(f"[WARN] 文件缺失: {fp}")
        return ""
    return fp.read_text(encoding="utf-8").strip()


def screenshot(page, name):
    path = SCREENSHOT_DIR / f"{name}.png"
    page.screenshot(path=str(path), full_page=False)
    print(f"  [截图保存] {name}.png")


def ask(msg):
    print(f"\n>>> {msg}")
    while True:
        r = input().strip().lower()
        if r in ("y", "yes"): return True
        if r in ("n", "no"): return False
        print("请输入 y 或 n:")


def write_record(content):
    """写入发布记录"""
    RECORD_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(RECORD_FILE, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"[记录] 已写入: {RECORD_FILE}")


# ============================================================
# 抖音操作
# ============================================================

def dy_run(page):
    print("\n" + "=" * 50)
    print("🚀 [抖音] 开始发布")
    print("=" * 50)

    # 打开创作者中心
    page.goto("https://creator.douyin.com/", wait_until="domcontentloaded")
    time.sleep(3)
    screenshot(page, "dy_01_home")

    # 检查登录
    if not dy_check_login(page):
        print("\n⚠️  抖音未登录，请在浏览器中手动登录")
        if not ask("已登录?"): return False
        page.goto("https://creator.douyin.com/", wait_until="domcontentloaded")
        time.sleep(3)
        if not dy_check_login(page):
            print("[抖音] ❌ 登录失败")
            return False
    print("[抖音] ✅ 已登录")

    # 前往上传页
    page.goto("https://creator.douyin.com/creator-micro/content/upload", wait_until="domcontentloaded")
    time.sleep(3)
    screenshot(page, "dy_02_upload_page")

    # 上传视频
    fi = page.query_selector('input[type="file"]')
    if fi:
        fi.set_input_files(str(VIDEO_PATH))
        print("[抖音] ✅ 视频已选择")
    else:
        print("[抖音] ⚠️ 未找到文件上传控件，请手动上传")
        if not ask("上传后输入 y"): return False

    # 等待上传完成
    print("[抖音] 等待视频上传...")
    time.sleep(10)
    try:
        page.wait_for_function(
            "() => document.querySelector('input.semi-input-default[placeholder*=\"标题\"]') !== null",
            timeout=180000
        )
    except:
        pass
    time.sleep(3)
    screenshot(page, "dy_03_upload_done")

    # 填写标题
    title = read_text(DOUYIN_TITLE_FILE)
    print(f"[抖音] 标题: {title}")
    ti = page.query_selector('input.semi-input-default[placeholder*="标题"]')
    if ti:
        ti.click(); time.sleep(0.3)
        ti.fill(""); time.sleep(0.3)
        ti.type(title, delay=30)
        print("[抖音] ✅ 标题已填写")
    else:
        print("[抖音] ⚠️ 未找到标题输入框，请手动填写")

    # 填写正文
    body = read_text(DOUYIN_BODY_FILE)
    print(f"[抖音] 正文 ({len(body)} 字)")
    bd = page.query_selector('div[contenteditable]')
    if bd:
        bd.click(); time.sleep(0.3)
        bd.fill(""); time.sleep(0.3)
        bd.type(body, delay=15)
        print("[抖音] ✅ 正文已填写")
    else:
        print("[抖音] ⚠️ 未找到正文输入框，请手动填写")

    # 设置封面（竖屏优先）
    dy_set_cover(page)

    # 添加背景音乐
    dy_add_music(page)

    screenshot(page, "dy_04_ready")
    print("\n✅ [抖音] 发布前准备完成，请检查截图")
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
    cover = COVER_PORTRAIT
    if not cover.exists():
        print("[抖音] ⚠️ 竖屏封面文件缺失")
        return

    try:
        # 点击封面区域
        cover_btn = page.query_selector('[class*="cover-upload"], [class*="poster-upload"], button:has-text("编辑封面")')
        if not cover_btn:
            cover_btn = page.query_selector('[class*="cover"]')
        if cover_btn:
            cover_btn.click()
            print("[抖音] 已打开封面编辑")
            time.sleep(2)

        # 上传封面
        ci = page.query_selector(
            '[class*="cover"] input[type="file"], [class*="poster"] input[type="file"], .semi-modal input[type="file"]'
        )
        if ci:
            ci.set_input_files(str(cover))
            print(f"[抖音] ✅ 封面上传: {cover.name}")
            time.sleep(3)
            # 确认
            for btn in page.query_selector_all("button"):
                txt = btn.inner_text().strip()
                if txt in ("确定", "确认", "完成", "保存"):
                    btn.click()
                    time.sleep(1)
                    break
        else:
            print("[抖音] ⚠️ 未找到封面上传控件，请手动上传封面")
    except Exception as e:
        print(f"[抖音] ⚠️ 封面设置异常: {e}")


def dy_add_music(page):
    """添加背景音乐"""
    print("[抖音] 添加背景音乐...")
    try:
        music_btns = page.query_selector_all("button, [class*=\"music\"] button, [class*=\"audio\"] button")
        for btn in music_btns:
            txt = btn.inner_text().strip() if btn.inner_text() else ""
            if any(kw in txt for kw in ["添加音乐", "选择音乐", "配乐", "背景音乐"]):
                btn.click()
                print("[抖音] ✅ 已打开音乐面板")
                time.sleep(3)
                screenshot(page, "dy_music_panel")

                # 选择第一首推荐音乐（温柔治愈类）
                items = page.query_selector_all('[class*="music-item"], [class*="music-card"], [class*="song-item"]')
                if items:
                    items[0].click()
                    print("[抖音] ✅ 已选择推荐音乐")
                    # 音量调整
                    vol = page.query_selector('input[type="range"], [class*="volume"] input')
                    if vol:
                        vol.fill("20")
                        print("[抖音] ✅ 音量设为 20%")
                    time.sleep(2)
                else:
                    print("[抖音] ⚠️ 请手动选择温柔治愈类音乐")
                    ask("选择音乐后输入 y")
                break
        else:
            print("[抖音] ⚠️ 未找到添加音乐按钮，发布时请手动添加")
    except Exception as e:
        print(f"[抖音] ⚠️ 添加音乐异常: {e}")


def dy_confirm(page):
    print("\n" + "=" * 50)
    print('⏳ 确认发布抖音')
    print("=" * 50)
    if not ask("确认发布抖音?"):
        print("[抖音] 已取消")
        return False

    try:
        btns = page.query_selector_all("button")
        pb = None
        for btn in btns:
            txt = btn.inner_text().strip() if btn.inner_text() else ""
            if txt in ("发布", "高清发布"):
                pb = btn
                break
        if pb:
            pb.click()
            print("[抖音] ✅ 已点击发布")
        else:
            print("[抖音] ⚠️ 请手动点击发布按钮")
            ask("发布后输入 y")
    except Exception as e:
        print(f"[抖音] ⚠️ 异常: {e}")

    time.sleep(5)
    screenshot(page, "dy_05_done")
    print("[抖音] ✅ 发布完成!")
    return True


# ============================================================
# 小红书操作
# ============================================================

def xhs_run(page):
    print("\n" + "=" * 50)
    print("🚀 [小红书] 开始发布")
    print("=" * 50)

    page.goto("https://creator.xiaohongshu.com/publish/publish", wait_until="domcontentloaded")
    time.sleep(5)
    screenshot(page, "xhs_01_publish")

    # 检查登录
    if not xhs_check_login(page):
        print("\n⚠️  小红书未登录，请手动登录")
        if not ask("已登录?"): return False
        page.goto("https://creator.xiaohongshu.com/publish/publish", wait_until="domcontentloaded")
        time.sleep(5)
        if not xhs_check_login(page):
            print("[小红书] ❌ 登录失败")
            return False
    print("[小红书] ✅ 已登录")

    # 上传视频
    fi = page.query_selector('input[type="file"]')
    if fi:
        fi.set_input_files(str(VIDEO_PATH))
        print("[小红书] ✅ 视频已选择")
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
                if not ask("上传后输入 y"): return False
        else:
            print("[小红书] ⚠️ 请手动上传视频")
            if not ask("上传后输入 y"): return False

    print("[小红书] 等待视频上传...")
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

    # 填写标题
    title = read_text(XHS_TITLE_FILE)
    print(f"[小红书] 标题: {title}")
    ti = page.query_selector('input[placeholder*="标题"]')
    if ti:
        ti.click(); time.sleep(0.3)
        ti.fill(""); time.sleep(0.3)
        ti.type(title, delay=30)
        print("[小红书] ✅ 标题已填写")

    # 填写正文
    body = read_text(XHS_BODY_FILE)
    print(f"[小红书] 正文 ({len(body)} 字)")
    bd = page.query_selector(
        'div[contenteditable], [class*="ql-editor"], [class*="editor"] div[contenteditable]'
    )
    if bd:
        bd.click(); time.sleep(0.3)
        bd.fill(""); time.sleep(0.3)
        bd.type(body, delay=15)
        print("[小红书] ✅ 正文已填写")

    # 设置封面
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
    cover = COVER_PORTRAIT
    if not cover.exists():
        print("[小红书] ⚠️ 竖屏封面文件缺失")
        return
    try:
        btns = page.query_selector_all("button, [class*=\"cover\"]")
        for btn in btns:
            txt = btn.inner_text().strip() if btn.inner_text() else ""
            if "封面" in txt:
                btn.click()
                time.sleep(2)
                break
        else:
            print("[小红书] ⚠️ 未找到封面设置按钮")
            return

        ci = page.query_selector('[class*="cover"] input[type="file"]')
        if ci:
            ci.set_input_files(str(cover))
            print(f"[小红书] ✅ 封面上传: {cover.name}")
            time.sleep(2)
            for btn in page.query_selector_all("button"):
                txt = btn.inner_text().strip()
                if txt in ("确定", "确认", "完成", "保存"):
                    btn.click()
                    time.sleep(1)
                    break
        else:
            print("[小红书] ⚠️ 请手动上传封面")
    except Exception as e:
        print(f"[小红书] ⚠️ 封面异常: {e}")


def xhs_confirm(page):
    print("\n" + "=" * 50)
    print('⏳ 确认发布小红书')
    print("=" * 50)
    if not ask("确认发布小红书?"):
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
            print("[小红书] ⚠️ 请手动点击发布按钮")
            ask("发布后输入 y")
    except Exception as e:
        print(f"[小红书] ⚠️ 异常: {e}")

    time.sleep(5)
    screenshot(page, "xhs_04_done")
    print("[小红书] ✅ 发布完成!")
    return True


# ============================================================
# 主流程
# ============================================================

def main():
    print("=" * 60)
    print("🐱🐶 奶盖和年糕 Day4 全自动发布")
    print(f"视频: {VIDEO_PATH.name}")
    print("=" * 60)

    # 检查文件
    checks = [
        ("视频", VIDEO_PATH),
        ("竖屏封面", COVER_PORTRAIT),
        ("横屏封面", COVER_LANDSCAPE),
        ("抖音标题", DOUYIN_TITLE_FILE),
        ("抖音正文", DOUYIN_BODY_FILE),
        ("小红书标题", XHS_TITLE_FILE),
        ("小红书正文", XHS_BODY_FILE),
    ]
    ok = True
    for name, path in checks:
        e = path.exists()
        print(f"  {'✅' if e else '❌'} {name}: {path.name if e else path}")
        if not e: ok = False
    if not ok:
        print("\n❌ 文件缺失，终止发布")
        return

    print("\n[系统] 启动 Chrome...")
    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=str(USER_DATA_DIR),
            channel="chrome",
            headless=False,
            args=["--start-maximized", "--disable-blink-features=AutomationControlled"],
        )
        page = context.pages[0] if context.pages else context.new_page()

        dy_success = False
        xhs_success = False
        dy_url = ""
        xhs_url = ""

        try:
            # ======== 抖音 ========
            if dy_run(page):
                dy_success = dy_confirm(page)

            # ======== 小红书 ========
            print("\n" + "=" * 50)
            if not ask("\n准备发布小红书，继续?"):
                print("[小红书] 已跳过")
            else:
                if xhs_run(page):
                    xhs_success = xhs_confirm(page)

            # ======== 结果 ========
            print("\n" + "=" * 60)
            print("📊 发布结果")
            print("=" * 60)
            print(f"  抖音: {'✅ 成功' if dy_success else '❌ 失败/取消'}")
            print(f"  小红书: {'✅ 成功' if xhs_success else '❌ 失败/取消'}")
            print(f"  截图目录: {SCREENSHOT_DIR}")

            # 写入发布记录
            from datetime import datetime
            now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            record = f"""Day4 发布记录
====================
发布时间: {now}

【抖音】
标题: {read_text(DOUYIN_TITLE_FILE)}
状态: {'✅ 已发布' if dy_success else '❌ 失败/取消'}
链接: {dy_url or '手动发布'}
截图: {SCREENSHOT_DIR / "dy_05_done.png" if dy_success else '无'}

【小红书】
标题: {read_text(XHS_TITLE_FILE)}
状态: {'✅ 已发布' if xhs_success else '❌ 失败/取消'}
链接: {xhs_url or page.url if xhs_success else '无'}
截图: {SCREENSHOT_DIR / "xhs_04_done.png" if xhs_success else '无'}
"""
            write_record(record)

        except KeyboardInterrupt:
            print("\n[系统] 用户中断")
        except Exception as e:
            print(f"\n[系统] ❌ 错误: {e}")
            import traceback; traceback.print_exc()
            screenshot(page, "error")
        finally:
            print("\n浏览器保持打开。关闭窗口或按 Enter 退出...")
            input()


if __name__ == "__main__":
    main()
