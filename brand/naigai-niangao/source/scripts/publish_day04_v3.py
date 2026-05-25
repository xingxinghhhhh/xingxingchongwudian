"""
奶盖和年糕 Day04 全自动发布脚本 v3
抖音 + 小红书 - 改进版，更稳健的封面和音乐处理
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

WAIT_TIMEOUT = 180000  # 3 min


def read_text(fp):
    if not fp.exists():
        print(f"[WARN] 文件缺失: {fp}")
        return ""
    return fp.read_text(encoding="utf-8").strip()


def screenshot(page, name):
    path = SCREENSHOT_DIR / f"{name}.png"
    page.screenshot(path=str(path), full_page=False)
    print(f"  [截图] {name}.png")


def write_record(dy_ok, xhs_ok, dy_url="", xhs_url=""):
    from datetime import datetime
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    record = f"""Day4 发布记录
====================
发布时间: {now}

【抖音】
标题: {read_text(DOUYIN_TITLE_FILE)}
状态: {'✅ 已发布' if dy_ok else '❌ 失败/取消'}
链接: {dy_url or '手动发布'}
截图: {SCREENSHOT_DIR / 'dy_05_done.png' if dy_ok else '无'}

【小红书】
标题: {read_text(XHS_TITLE_FILE)}
状态: {'✅ 已发布' if xhs_ok else '❌ 失败/取消'}
链接: {xhs_url or '手动发布'}
截图: {SCREENSHOT_DIR / 'xhs_04_done.png' if xhs_ok else '无'}
"""
    RECORD_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(RECORD_FILE, "w", encoding="utf-8") as f:
        f.write(record)
    print(f"[记录] 已写入: {RECORD_FILE}")


def click_visible(page, selector, name="元素", timeout=8000):
    """点击可见元素，支持多种定位方式"""
    try:
        el = page.wait_for_selector(selector, timeout=timeout)
        if el and el.is_visible():
            el.click()
            time.sleep(1)
            print(f"  [{name}] 已点击")
            return True
    except:
        pass
    return False


def click_by_text(page, texts, name="文本按钮", timeout=5000):
    """按文本内容点击按钮"""
    for text in texts:
        try:
            btn = page.get_by_text(text, exact=False).first
            if btn.is_visible(timeout=timeout):
                btn.click()
                time.sleep(1)
                print(f"  [{name}] 已点击 '{text}'")
                return True
        except:
            continue
    return False


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
    if "login" in page.url.lower():
        print("\n🔑 抖音未登录，请在浏览器中手动登录")
        input("已登录? (输入 y 继续): ")
        page.goto("https://creator.douyin.com/", wait_until="domcontentloaded")
        time.sleep(3)
        if "login" in page.url.lower():
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
        input("上传后输入 y: ")

    # 等待上传完成
    print("[抖音] 等待视频上传...")
    time.sleep(10)
    try:
        page.wait_for_function(
            "() => document.querySelector('input.semi-input-default[placeholder*=\"标题\"]') !== null",
            timeout=WAIT_TIMEOUT
        )
        print("[抖音] ✅ 上传完成")
    except:
        print("[抖音] ⚠️ 等待上传超时")
    time.sleep(3)
    screenshot(page, "dy_03_upload_done")

    # 填写标题
    title = read_text(DOUYIN_TITLE_FILE)
    print(f"[抖音] 标题: {title}")
    try:
        ti = page.wait_for_selector('input.semi-input-default[placeholder*="标题"]', timeout=10000)
        if ti:
            ti.click(); time.sleep(0.3)
            ti.fill(""); time.sleep(0.3)
            ti.type(title, delay=30)
            print("[抖音] ✅ 标题已填写")
    except:
        print("[抖音] ⚠️ 未找到标题输入框，请手动填写")

    # 填写正文
    body = read_text(DOUYIN_BODY_FILE)
    print(f"[抖音] 正文 ({len(body)} 字)")
    try:
        bd = page.wait_for_selector('div[contenteditable]', timeout=5000)
        if bd:
            bd.click(); time.sleep(0.3)
            bd.fill(""); time.sleep(0.3)
            bd.type(body, delay=15)
            print("[抖音] ✅ 正文已填写")
    except:
        print("[抖音] ⚠️ 未找到正文输入框，请手动填写")

    # 设置封面
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
    """上传自定义封面 - 多策略"""
    if not COVER_PORTRAIT.exists():
        print("[抖音] ⚠️ 竖屏封面文件缺失")
        return

    print("[抖音] 设置封面...")

    # 策略1: 点击封面区域打开编辑器
    cover_selectors = [
        'button:has-text("编辑封面")',
        '[class*="cover-upload"]',
        '[class*="poster-upload"]',
        '[class*="poster"]',
        'button:has-text("封面")',
        '[class*="cover"]',
    ]
    for sel in cover_selectors:
        try:
            el = page.query_selector(sel)
            if el and el.is_visible():
                el.click()
                print(f"  [封面] 点击: {sel}")
                time.sleep(2)
                break
        except:
            continue

    time.sleep(2)

    # 策略2: 在打开的弹窗中找文件上传控件
    file_input_selectors = [
        'input[type="file"]',
        '.semi-modal input[type="file"]',
        '[class*="cover"] input[type="file"]',
        '[class*="poster"] input[type="file"]',
        '[class*="upload"] input[type="file"]',
    ]

    uploaded = False
    for sel in file_input_selectors:
        try:
            fi = page.query_selector(sel)
            if fi:
                fi.set_input_files(str(COVER_PORTRAIT))
                print(f"[抖音] ✅ 竖封面上传: {COVER_PORTRAIT.name}")
                time.sleep(3)
                uploaded = True
                break
        except:
            continue

    if not uploaded:
        # 策略3: 使用setInputFiles
        try:
            fi = page.query_selector('[class*="semi"] input[type="file"]')
            if fi:
                fi.set_input_files(str(COVER_PORTRAIT))
                print(f"[抖音] ✅ 竖封面上传 (semi): {COVER_PORTRAIT.name}")
                time.sleep(3)
                uploaded = True
        except:
            pass

    if uploaded:
        # 点确定/完成
        for text in ["确定", "确认", "完成", "保存"]:
            try:
                btn = page.get_by_text(text, exact=False).first
                if btn.is_visible(timeout=2000):
                    btn.click()
                    time.sleep(1)
                    print(f"  [封面] 已点击 '{text}'")
                    break
            except:
                continue

        # 设置横封面
        print("[抖音] 设置横封面...")
        try:
            btn = page.get_by_text("设置横封面", exact=False).first
            if btn.is_visible(timeout=3000):
                btn.click()
                time.sleep(2)
                print("[抖音] ✅ 已打开横封面设置")

                # 上传横封面
                for sel in file_input_selectors:
                    try:
                        fi = page.query_selector(sel)
                        if fi:
                            fi.set_input_files(str(COVER_LANDSCAPE))
                            print(f"[抖音] ✅ 横封面上传: {COVER_LANDSCAPE.name}")
                            time.sleep(3)
                            break
                    except:
                        continue

                # 点完成
                for text in ["确定", "确认", "完成", "保存"]:
                    try:
                        btn = page.get_by_text(text, exact=False).first
                        if btn.is_visible(timeout=2000):
                            btn.click()
                            time.sleep(1)
                            print(f"  [封面] 已点击 '{text}'")
                            break
                    except:
                        continue
        except:
            print("[抖音] ⚠️ 未找到'设置横封面'按钮，竖封面可能已够用")
    else:
        print("[抖音] ⚠️ 请手动上传封面")


def dy_add_music(page):
    """添加背景音乐"""
    print("[抖音] 添加背景音乐...")

    # 尝试多个选择器找到添加音乐按钮
    music_btn_selectors = [
        'button:has-text("添加音乐")',
        'button:has-text("选择音乐")',
        'button:has-text("配乐")',
        '[class*="music"] button',
        '[class*="audio"] button',
        'div:has-text("添加音乐")',
        'span:has-text("添加音乐")',
    ]

    found = False
    for sel in music_btn_selectors:
        try:
            el = page.query_selector(sel)
            if el and el.is_visible():
                el.click()
                print(f"  [音乐] 已点击: {sel}")
                time.sleep(3)
                found = True
                break
        except:
            continue

    if found:
        # 截图音乐面板
        screenshot(page, "dy_music_panel")

        # 选择第一首推荐音乐
        try:
            items = page.query_selector_all('[class*="music-item"], [class*="music-card"], [class*="song-item"]')
            if items and len(items) > 0:
                items[0].click()
                print("[抖音] ✅ 已选择推荐音乐")
                time.sleep(2)

                # 尝试调整音量
                try:
                    vol = page.query_selector('input[type="range"]')
                    if vol:
                        vol.fill("20")
                        print("[抖音] ✅ 音量设为 20%")
                except:
                    pass

                time.sleep(1)
                # 点确定
                for text in ["确定", "确认", "完成", "保存", "使用"]:
                    try:
                        btn = page.get_by_text(text, exact=False).first
                        if btn.is_visible(timeout=2000):
                            btn.click()
                            time.sleep(1)
                            print(f"  [音乐] 已点击 '{text}'")
                            break
                    except:
                        continue
            else:
                print("[抖音] ⚠️ 未找到音乐列表，请手动选择温柔治愈类音乐")
        except:
            print("[抖音] ⚠️ 选择音乐异常，请手动添加")
    else:
        print("[抖音] ⚠️ 未找到添加音乐按钮，发布时请手动添加")


def dy_confirm(page):
    print("\n" + "=" * 50)
    print('⏳ 确认发布抖音')
    print("=" * 50)
    r = input("确认发布抖音? (y/n): ").strip().lower()
    if r != "y":
        print("[抖音] 已取消")
        return False

    # 尝试点击发布按钮
    publish_btn_selectors = [
        'button:has-text("发布")',
        'button:has-text("高清发布")',
        'button:has-text("发布视频")',
        '[class*="publish"] button',
    ]

    clicked = False
    for sel in publish_btn_selectors:
        try:
            btn = page.query_selector(sel)
            if btn and btn.is_visible():
                btn.click()
                print(f"[抖音] ✅ 已点击发布: {sel}")
                clicked = True
                break
        except:
            continue

    if not clicked:
        print("[抖音] ⚠️ 请手动点击发布按钮")
        input("发布后输入 y: ")

    time.sleep(5)
    screenshot(page, "dy_05_done")
    print("[抖音] ✅ 发布完成!")
    
    # 尝试获取发布成功后的页面URL
    time.sleep(3)
    print(f"[抖音] 当前页面: {page.url}")
    return True


# ============================================================
# 小红书操作
# ============================================================

def xhs_run(page):
    print("\n" + "=" * 50)
    print("📕 [小红书] 开始发布")
    print("=" * 50)

    page.goto("https://creator.xiaohongshu.com/publish/publish", wait_until="domcontentloaded")
    time.sleep(5)
    screenshot(page, "xhs_01_publish")

    # 检查登录
    if "login" in page.url.lower():
        print("\n🔑 小红书未登录，请手动登录")
        input("已登录? (输入 y 继续): ")
        page.goto("https://creator.xiaohongshu.com/publish/publish", wait_until="domcontentloaded")
        time.sleep(5)
        if "login" in page.url.lower():
            print("[小红书] ❌ 登录失败")
            return False
    print("[小红书] ✅ 已登录")

    # 上传视频
    fi = page.query_selector('input[type="file"]')
    if fi:
        fi.set_input_files(str(VIDEO_PATH))
        print("[小红书] ✅ 视频已选择")
    else:
        print("[小红书] ⚠️ 请手动上传视频")
        input("上传后输入 y: ")

    print("[小红书] 等待视频上传...")
    time.sleep(10)
    try:
        page.wait_for_function(
            "() => document.querySelector('input[placeholder*=\"标题\"]') !== null",
            timeout=WAIT_TIMEOUT
        )
        print("[小红书] ✅ 上传完成")
    except:
        pass
    time.sleep(3)
    screenshot(page, "xhs_02_upload_done")

    # 填写标题
    title = read_text(XHS_TITLE_FILE)
    print(f"[小红书] 标题: {title}")
    try:
        ti = page.wait_for_selector('input[placeholder*="标题"]', timeout=10000)
        if ti:
            ti.click(); time.sleep(0.3)
            ti.fill(""); time.sleep(0.3)
            ti.type(title, delay=30)
            print("[小红书] ✅ 标题已填写")
    except:
        print("[小红书] ⚠️ 未找到标题输入框，请手动填写")

    # 填写正文
    body = read_text(XHS_BODY_FILE)
    print(f"[小红书] 正文 ({len(body)} 字)")
    try:
        bd = page.wait_for_selector(
            'div[contenteditable], [class*="ql-editor"], [class*="editor"] div[contenteditable]',
            timeout=5000
        )
        if bd:
            bd.click(); time.sleep(0.3)
            bd.fill(""); time.sleep(0.3)
            bd.type(body, delay=15)
            print("[小红书] ✅ 正文已填写")
    except:
        print("[小红书] ⚠️ 未找到正文输入框，请手动填写")

    # 设置封面
    xhs_set_cover(page)

    screenshot(page, "xhs_03_ready")
    print("\n✅ [小红书] 发布前准备完成")
    return True


def xhs_set_cover(page):
    """设置小红书封面"""
    if not COVER_PORTRAIT.exists():
        print("[小红书] ⚠️ 竖屏封面文件缺失")
        return

    print("[小红书] 设置封面...")

    # 找封面设置按钮
    cover_selectors = [
        'button:has-text("封面")',
        '[class*="cover"] button',
        'div:has-text("封面")',
        '[class*="poster"]',
    ]

    for sel in cover_selectors:
        try:
            el = page.query_selector(sel)
            if el and el.is_visible():
                el.click()
                time.sleep(2)
                print(f"  [封面] 已点击: {sel}")
                break
        except:
            continue

    time.sleep(2)

    # 上传封面
    fi = page.query_selector('input[type="file"]')
    if fi:
        fi.set_input_files(str(COVER_PORTRAIT))
        print(f"[小红书] ✅ 封面上传: {COVER_PORTRAIT.name}")
        time.sleep(3)

        # 点确定
        for text in ["确定", "确认", "完成", "保存"]:
            try:
                btn = page.get_by_text(text, exact=False).first
                if btn.is_visible(timeout=2000):
                    btn.click()
                    time.sleep(1)
                    print(f"  [封面] 已点击 '{text}'")
                    break
            except:
                continue
    else:
        print("[小红书] ⚠️ 请手动上传封面")


def xhs_confirm(page):
    print("\n" + "=" * 50)
    print('⏳ 确认发布小红书')
    print("=" * 50)
    r = input("确认发布小红书? (y/n): ").strip().lower()
    if r != "y":
        print("[小红书] 已取消")
        return False

    publish_btn_selectors = [
        'button:has-text("发布")',
        'button:has-text("发布笔记")',
        '[class*="publish"] button',
    ]

    clicked = False
    for sel in publish_btn_selectors:
        try:
            btn = page.query_selector(sel)
            if btn and btn.is_visible():
                btn.click()
                print(f"[小红书] ✅ 已点击发布: {sel}")
                clicked = True
                break
        except:
            continue

    if not clicked:
        print("[小红书] ⚠️ 请手动点击发布按钮")
        input("发布后输入 y: ")

    time.sleep(5)
    screenshot(page, "xhs_04_done")
    print("[小红书] ✅ 发布完成!")
    time.sleep(3)
    print(f"[小红书] 当前页面: {page.url}")
    return True


# ============================================================
# 主流程
# ============================================================

def main():
    print("=" * 60)
    print("🐱🐶 奶盖和年糕 Day4 全自动发布 v3")
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
                dy_url = page.url if dy_success else ""

            # ======== 小红书 ========
            print("\n" + "=" * 50)
            r = input("\n准备发布小红书，继续? (y/n): ").strip().lower()
            if r == "y":
                if xhs_run(page):
                    xhs_success = xhs_confirm(page)
                    xhs_url = page.url if xhs_success else ""
            else:
                print("[小红书] 已跳过")

            # ======== 结果 ========
            print("\n" + "=" * 60)
            print("📊 发布结果")
            print("=" * 60)
            print(f"  抖音: {'✅ 成功' if dy_success else '❌ 失败/取消'}")
            print(f"  小红书: {'✅ 成功' if xhs_success else '❌ 失败/取消'}")

            write_record(dy_success, xhs_success, dy_url, xhs_url)

            print(f"\n  截图目录: {SCREENSHOT_DIR}")
            print(f"  发布记录: {RECORD_FILE}")

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
