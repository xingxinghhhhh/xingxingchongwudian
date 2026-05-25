"""
奶盖和年糕 Day3 全自动发布脚本 v3
=============================
修复：
1. 抖音添加音乐：按钮在右侧面板，视频上传后才出现
2. 小红书封面：需要悬停在封面预览区才能显示上传入口
3. 抖音发布按钮：使用更精确的选择器
"""

import os, time, sys, json
from datetime import datetime
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

ASSET_DIR = Path(r"D:\AI\kzt\brand\naigai-niangao\source\07_视频成片\第三条视频_AI重制")
RECORD_DIR = Path(r"D:\AI\kzt\brand\naigai-niangao\source\10_数据复盘")
SS_DIR = RECORD_DIR / "Day3_screenshots"
DATA_DIR = Path(r"D:\AI\kzt\brand\naigai-niangao\source\.browser_data")

VIDEO = ASSET_DIR / "Day3_奶盖偷看年糕被抓包.mp4"
COVER_V = ASSET_DIR / "封面_Day3_偷看被抓包_竖屏_带字.png"
COVER_H = ASSET_DIR / "横封面_Day3_偷看被抓包_带字.png"
DY_TITLE_F = ASSET_DIR / "抖音标题.txt"
DY_BODY_F = ASSET_DIR / "抖音文案.txt"
XHS_TITLE_F = ASSET_DIR / "小红书标题.txt"
XHS_BODY_F = ASSET_DIR / "小红书文案.txt"
RECORD_F = RECORD_DIR / "Day3_发布记录.txt"
SS_DIR.mkdir(parents=True, exist_ok=True)
RECORD_DIR.mkdir(parents=True, exist_ok=True)


def read(fp):
    return fp.read_text(encoding="utf-8").strip() if fp.exists() else ""

def snap(page, name):
    p = SS_DIR / f"{name}.png"
    page.screenshot(path=str(p), full_page=False)
    print(f"  📸 {name}")
    return p

def ask(msg):
    print(f"\n>>> {msg}")
    while True:
        r = input().strip().lower()
        if r in ("y", "yes"): return True
        if r in ("n", "no"): return False
        print("输入 y 或 n:")

def check_files():
    items = [
        ("视频", VIDEO), ("竖屏封面", COVER_V), ("横屏封面", COVER_H),
        ("抖音标题", DY_TITLE_F), ("抖音文案", DY_BODY_F),
        ("小红书标题", XHS_TITLE_F), ("小红书文案", XHS_BODY_F),
    ]
    print("\n【发布前检查】")
    ok = True
    for name, p in items:
        exists = p.exists()
        sz = p.stat().st_size if exists else 0
        s = "✅" if exists else "❌"
        if exists and sz > 1024**2:  print(f"  {s} {name}: {p.name} ({sz/1024/1024:.1f}MB)")
        elif exists:                 print(f"  {s} {name}: {p.name} ({sz}B)")
        else:                        print(f"  {s} {name}: {p}"); ok = False
    for label, fp in [("抖音", DY_TITLE_F), ("小红书", XHS_TITLE_F)]:
        if fp.exists():
            t = read(fp)
            for kw in ["Day2", "第2天", "第二天"]:
                if kw in t: print(f"  ⚠️ [{label}] 标题可能误用 Day2：{t}"); ok = False
    if ok: print("  ✅ 全部通过！")
    else:  print("\n❌ 检查未通过，请修复后重试")
    return ok


# ============================================================
# 抖音
# ============================================================
def dy_do(page):
    print("\n" + "=" * 50)
    print("🚀 [抖音] 发布")
    print("=" * 50)

    # 1. 首页 -> 登录检查
    page.goto("https://creator.douyin.com/", wait_until="domcontentloaded")
    time.sleep(4)
    snap(page, "dy_01_home")
    if not dy_logged_in(page):
        print("⚠️ 未登录，请手动登录后输入 y")
        if not ask("已登录?"): return False
        page.goto("https://creator.douyin.com/", wait_until="domcontentloaded")
        time.sleep(4)
        if not dy_logged_in(page): print("❌ 登录失败"); return False
    print("✅ 已登录")

    # 2. 跳转发布页
    page.goto("https://creator.douyin.com/creator-micro/content/upload", wait_until="domcontentloaded")
    time.sleep(5)
    snap(page, "dy_02_upload")

    # 3. 上传视频
    fi = page.query_selector('input[type="file"]')
    if fi:
        fi.set_input_files(str(VIDEO))
        print("✅ 已选择视频")
    else:
        print("⚠️ 请手动上传视频"); ask("已上传?")
    print("⏳ 等待上传...")
    try:
        page.wait_for_function(
            "() => !!document.querySelector('input.semi-input-default[placeholder*=\"标题\"]')",
            timeout=180000
        )
        print("✅ 上传完成")
    except:
        print("⏳ 超时")
    time.sleep(5)
    snap(page, "dy_03_uploaded")

    # 4. 标题
    title = read(DY_TITLE_F)
    print(f"标题: {title}")
    ti = page.query_selector('input.semi-input-default[placeholder*="标题"]')
    if ti:
        ti.click(); time.sleep(0.3)
        ti.fill(""); time.sleep(0.3)
        ti.type(title, delay=30); print("✅ 标题已填")
    else:
        print("⚠️ 请手动填标题"); ask("填后 y")

    # 5. 正文
    body = read(DY_BODY_F)
    print(f"正文({len(body)}字)")
    bd = page.query_selector('div[contenteditable]')
    if bd:
        bd.click(); time.sleep(0.3)
        bd.fill(""); time.sleep(0.3)
        bd.type(body, delay=15); print("✅ 正文已填")
    else:
        print("⚠️ 请手动填正文"); ask("填后 y")

    # 6. 封面（右侧面板，上传竖屏封面）
    print("\n📷 设置封面...")
    dy_set_cover(page)
    snap(page, "dy_04_cover")

    # 7. 添加音乐（视频上传后右侧面板的"添加音乐"按钮）
    print("\n🎵 添加背景音乐...")
    dy_add_music(page)

    print("\n✅ [抖音] 准备完成")
    return True


def dy_logged_in(page):
    try:
        btns = page.query_selector_all('button:has-text("登录"), a:has-text("登录")')
        for b in btns:
            if b.is_visible(): return False
        return True
    except: return True


def dy_set_cover(page):
    """设置抖音封面 - 右侧面板"""
    if not COVER_V.exists():
        print("竖屏封面缺失"); return

    # 尝试点击右侧"封面"区域或按钮
    clicked = False
    # 用JS遍历所有文本节点找"封面"位置
    js_find = """
    () => {
        // 找封面标签/按钮 - 可能是一个tab或按钮
        const all = document.querySelectorAll('button, div[class*="tab"], div[role="tab"], span, label');
        for (const el of all) {
            const t = el.textContent.trim();
            if (t === '封面' || t === '上传封面' || t === '修改封面') {
                if (el.offsetParent !== null) {
                    el.click();
                    return 'clicked_' + t;
                }
            }
        }
        // 可能封面在右侧面板某个区域，点击包含"封面"的父区域
        const walk = document.createTreeWalker(document.body, 4, null, false);
        let n;
        while (n = walk.nextNode()) {
            const t = n.textContent.trim();
            if (t === '封面' && n.offsetParent !== null) {
                // 尝试点击其父级的可点击元素
                let parent = n.parentElement;
                while (parent && parent !== document.body) {
                    if (parent.tagName === 'BUTTON' || parent.tagName === 'A' || parent.tagName === 'LABEL' || parent.getAttribute('role') === 'button') {
                        parent.click();
                        return 'clicked_parent_' + parent.tagName;
                    }
                    parent = parent.parentElement;
                }
                // 直接点文本本身
                n.click();
                return 'clicked_text';
            }
        }
        return 'not_found';
    }
    """
    result = page.evaluate(js_find)
    print(f"  [封面查找] {result}")
    if "not_found" in result:
        print("⚠️ 请手动在右侧面板找到「封面」区域上传竖屏封面")
        ask("封面设置后输入 y")
        return
    time.sleep(3)

    # 现在弹窗应该打开了，上传文件
    # 方法：找到已显示的文件输入框
    uploaded = False
    try:
        # 有些弹窗有多个file input，找到可见的那个
        fis = page.query_selector_all('input[type="file"]')
        for f in fis:
            try:
                is_visible = page.evaluate("el => el.offsetParent !== null", f)
                if is_visible:
                    f.set_input_files(str(COVER_V))
                    print(f"✅ 竖屏封面已上传: {COVER_V.name}")
                    uploaded = True
                    time.sleep(3)
                    break
            except:
                continue
    except:
        pass

    if not uploaded:
        print("⚠️ 请手动在弹出的窗口中选择竖屏封面")
        ask("上传封面后输入 y")

    # 点击确定/保存
    for bt in ["确定", "确认", "完成", "保存"]:
        btn = page.query_selector(f'button:has-text("{bt}")')
        if btn and btn.is_visible():
            try:
                btn.click(); time.sleep(1); print(f"✅ 已点{bt}")
                break
            except:
                continue


def dy_add_music(page):
    """添加背景音乐 - 视频上传后右侧面板"""
    print("标准: 温柔/治愈/轻快/无歌词/萌宠日常, 音量20%")
    
    # 等待音乐按钮出现（视频上传完成后右侧出现）
    try:
        page.wait_for_function(
            "() => { const all = document.querySelectorAll('button, span, div'); for (const el of all) { if (el.textContent.trim().includes('添加音乐') && el.offsetParent !== null) return true; } return false; }",
            timeout=30000
        )
        print("✅ 音乐按钮已出现")
    except:
        print("⏳ 音乐按钮未自动出现，尝试查找...")

    # JS方式查找并点击添加音乐按钮
    js_click_music = """
    () => {
        const all = document.querySelectorAll('button, span, div');
        for (const el of all) {
            const t = el.textContent.trim();
            if ((t === '添加音乐' || t.includes('添加音乐')) && el.offsetParent !== null) {
                el.click();
                return 'clicked';
            }
        }
        return 'not_found';
    }
    """
    result = page.evaluate(js_click_music)
    print(f"  [音乐] {result}")
    
    if result == "not_found":
        print("⚠️ 未找到添加音乐按钮，请手动在右侧面板添加")
        print("  建议：搜索「温柔」或「治愈」，选择无歌词轻音乐，音量20%")
        return

    time.sleep(3)
    snap(page, "dy_music_panel")

    # 搜索框
    si = page.query_selector('input[placeholder*="搜索"], input[placeholder*="音乐名"]')
    if si:
        si.fill("温柔治愈无歌词")
        time.sleep(3)
        
        # 选第一个结果
        items = page.query_selector_all('[class*="music-item"], [class*="song-item"], li[class*="item"], div[class*="music"]')
        if items:
            try:
                items[0].click()
                print("✅ 已选择音乐")
                time.sleep(2)
            except:
                print("⚠️ 选择音乐失败")
        else:
            print("⚠️ 无搜索结果，使用推荐")

    # 音量调整（找到range滑块）
    vol = page.query_selector('input[type="range"]')
    if vol:
        try:
            vol.fill("20")
            print("✅ 音量设为20%")
        except:
            try:
                # 通过JS设置
                page.evaluate("document.querySelector('input[type=\"range\"]').value = '20';")
                page.evaluate("document.querySelector('input[type=\"range\"]').dispatchEvent(new Event('input', {bubbles: true}));")
                print("✅ 音量设为20% (JS)")
            except:
                pass

    print("✅ 音乐设置完成")


def dy_publish(page):
    print("\n" + "=" * 50)
    print("⏳ 请检查抖音内容无误后确认发布")
    print("=" * 50)
    if not ask("确认发布抖音？"):
        print("❌ 已取消"); return False, None

    # 找发布按钮 - 多种策略
    published = False
    # 策略1: 查找发布按钮
    for btn_text in ["发布", "高清发布"]:
        btns = page.query_selector_all(f'button:has-text("{btn_text}")')
        for btn in btns:
            try:
                if btn.is_visible():
                    # 确保是主要的发布按钮（不是弹窗里的）
                    class_attr = btn.get_attribute("class") or ""
                    if "semi" in class_attr or "primary" in class_attr or not published:
                        btn.click()
                        print(f"✅ 已点击「{btn_text}」")
                        published = True
                        time.sleep(10)
                        snap(page, "dy_05_done")
                        print(f"URL: {page.url}")
                        return True, page.url
            except:
                continue

    if not published:
        print("⚠️ 未自动找到发布按钮")
        print("📌 页面右下角的蓝色「发布」按钮")
        if ask("手动点击发布后输入 y"):
            snap(page, "dy_05_done")
            return True, page.url
    return False, None


# ============================================================
# 小红书
# ============================================================
def xhs_do(page):
    print("\n" + "=" * 50)
    print("🚀 [小红书] 发布")
    print("=" * 50)

    page.goto("https://creator.xiaohongshu.com/publish/publish", wait_until="domcontentloaded")
    time.sleep(6)
    snap(page, "xhs_01_page")

    if not xhs_logged_in(page):
        print("⚠️ 未登录"); ask("已登录?")
        page.goto("https://creator.xiaohongshu.com/publish/publish", wait_until="domcontentloaded")
        time.sleep(6)
        if not xhs_logged_in(page): print("❌ 登录失败"); return False
    print("✅ 已登录")

    # 上传
    fi = page.query_selector('input[type="file"]')
    if fi:
        fi.set_input_files(str(VIDEO))
        print("✅ 已选择视频")
    else:
        for sel in ['[class*="upload"]', '[class*="drag"]', '[class*="add"]']:
            el = page.query_selector(sel)
            if el and el.is_visible():
                el.click(); time.sleep(2)
                fi = page.query_selector('input[type="file"]')
                if fi: fi.set_input_files(str(VIDEO)); print("✅ 已选择视频"); break
        else:
            print("⚠️ 请手动上传视频"); ask("上传后 y")

    print("⏳ 等待上传...")
    try:
        page.wait_for_function(
            "() => !!document.querySelector('input[placeholder*=\"标题\"]')", timeout=180000
        )
        print("✅ 上传完成")
    except: pass
    time.sleep(5)
    snap(page, "xhs_02_uploaded")

    # 标题
    title = read(XHS_TITLE_F)
    print(f"标题: {title}")
    ti = page.query_selector('input[placeholder*="标题"]')
    if ti:
        ti.click(); time.sleep(0.3); ti.fill(""); time.sleep(0.3)
        ti.type(title, delay=30); print("✅ 标题已填")
    else:
        print("⚠️ 请手动填标题"); ask("填后 y")

    # 正文
    body = read(XHS_BODY_F)
    print(f"正文({len(body)}字)")
    for sel in ['div[contenteditable]', 'div.ql-editor', '[class*="editor"] div[contenteditable]']:
        bd = page.query_selector(sel)
        if bd:
            bd.click(); time.sleep(0.3); bd.fill(""); time.sleep(0.3)
            bd.type(body, delay=15); print("✅ 正文已填"); break
    else:
        print("⚠️ 请手动填正文"); ask("填后 y")

    # 封面（需要悬停在视频封面上）
    print("\n📷 设置封面 - 悬停后上传...")
    xhs_set_cover(page)

    # 音乐
    print("\n🎵 添加音乐...")
    xhs_add_music(page)

    print("\n✅ [小红书] 准备完成")
    return True


def xhs_logged_in(page):
    try:
        lb = page.query_selector('button:has-text("登录")')
        if lb and lb.is_visible(): return False
        if "login" in page.url.lower(): return False
        return True
    except: return True


def xhs_set_cover(page):
    """小红书封面 - 悬停在预览区后上传"""
    if not COVER_V.exists():
        print("竖屏封面缺失"); return

    # 找封面预览图（视频上传后的封面缩略图区域）
    cover_set = False
    
    # JS方式：找到封面预览区，触发hover，找上传按钮
    js_hover = """
    () => {
        // 找封面预览区域 - 通常包含一个图片显示视频的第一帧
        const imgs = document.querySelectorAll('img');
        for (const img of imgs) {
            const rect = img.getBoundingClientRect();
            // 封面预览图通常在左侧，是一个方形区域
            if (rect.width > 100 && rect.width < 500 && rect.height > 100 && rect.height < 500) {
                const parent = img.parentElement;
                if (parent) {
                    // 触发hover事件
                    const evt = new MouseEvent('mouseenter', { bubbles: true, cancelable: true });
                    parent.dispatchEvent(evt);
                    return { found: true, x: rect.left + rect.width/2, y: rect.top + rect.height/2, w: rect.width, h: rect.height };
                }
            }
        }
        return { found: false };
    }
    """
    result = page.evaluate(js_hover)
    
    if result.get("found"):
        print(f"  ✅ 找到封面预览区 ({result['w']:.0f}x{result['h']:.0f})，已触发悬停")
        time.sleep(2)
        snap(page, "xhs_cover_hovered")
        
        # 现在应该能看到"上传封面"或"修改封面"的按钮了
        # 尝试各种选择器
        js_click_upload = """
        () => {
            const all = document.querySelectorAll('button, span, div');
            for (const el of all) {
                const t = el.textContent.trim();
                if ((t.includes('上传封面') || t.includes('修改封面') || t.includes('更换封面')) && el.offsetParent !== null) {
                    el.click();
                    return 'clicked_' + t;
                }
            }
            return 'not_found';
        }
        """
        result2 = page.evaluate(js_click_upload)
        print(f"  [封面上传按钮] {result2}")
        
        if "clicked" in result2:
            time.sleep(2)
            # 上传封面
            fi = page.query_selector('input[type="file"]')
            if fi:
                fi.set_input_files(str(COVER_V))
                print(f"  ✅ 竖屏封面上传: {COVER_V.name}")
                time.sleep(3)
                # 确认
                for bt in ["确定", "确认", "完成", "保存"]:
                    btn = page.query_selector(f'button:has-text("{bt}")')
                    if btn and btn.is_visible():
                        try:
                            btn.click(); time.sleep(1); print(f"  ✅ {bt}")
                            cover_set = True
                            break
                        except: continue
                if not cover_set:
                    print("  ⚠️ 请手动在弹出的窗口中确认封面")
                    ask("封面确认后输入 y")
            else:
                print("  ⚠️ 请手动选择竖屏封面文件上传")
                ask("上传封面后输入 y")
        else:
            print("  ⚠️ 上传封面按钮未出现，请手动操作")
            ask("手动设置封面后输入 y")
    else:
        print("  ⚠️ 未找到封面预览区")
        # 备用：尝试找包含class为cover的元素
        els = page.query_selector_all('[class*="cover"]')
        if els:
            print(f"  找到 {len(els)} 个class含cover的元素")
            els[0].hover()
            time.sleep(2)
            # 尝试点击出现的按钮
            btns = page.query_selector_all('button:visible')
            for b in btns:
                t = b.inner_text().strip()
                if "封面" in t:
                    b.click(); time.sleep(2); break
        print("  ⚠️ 请手动上传封面（竖屏封面优先）")
        ask("封面设置后输入 y")


def xhs_add_music(page):
    """小红书音乐"""
    try:
        for btn in page.query_selector_all("button, [class*='music']"):
            t = btn.inner_text().strip() if btn.inner_text() else ""
            if "音乐" in t or "配乐" in t:
                btn.click(); time.sleep(2)
                si = page.query_selector('input[placeholder*="搜索"]')
                if si:
                    si.fill("温柔治愈"); time.sleep(2)
                    items = page.query_selector_all('[class*="music-item"], [class*="song-item"], li')
                    if items: items[0].click(); print("✅ 已选音乐")
                else:
                    items = page.query_selector_all('[class*="music"] button, [class*="song"]')
                    if items: items[0].click(); print("✅ 已选推荐音乐")
                break
        else:
            print("未找到音乐选项（小红书音乐非必需）")
    except Exception as e:
        print(f"音乐异常: {e}")


def xhs_publish(page):
    print("\n" + "=" * 50)
    print("⏳ 请检查小红书内容无误后确认发布")
    print("=" * 50)
    if not ask("确认发布小红书？"):
        print("❌ 已取消"); return False, None

    # 找发布按钮
    for btn_text in ["发布", "发布笔记"]:
        btns = page.query_selector_all(f'button:has-text("{btn_text}")')
        for btn in btns:
            try:
                if btn.is_visible():
                    btn.click()
                    print(f"✅ 已点击「{btn_text}」")
                    time.sleep(10)
                    snap(page, "xhs_04_done")
                    return True, page.url
            except:
                continue

    print("⚠️ 请手动点击发布按钮")
    ask("发布后输入 y")
    snap(page, "xhs_04_done")
    return True, page.url


# ============================================================
# 记录
# ============================================================
def save(dy_r, xhs_r):
    ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    dy_t = read(DY_TITLE_F)
    xhs_t = read(XHS_TITLE_F)
    txt = f"""Day3 发布记录
====================
发布时间: {ts}

【抖音】
标题: {dy_t}
状态: {"✅ 已发布" if dy_r[0] else "❌ 失败/取消"}
链接: {dy_r[1] or "N/A"}
截图: {SS_DIR}

【小红书】
标题: {xhs_t}
状态: {"✅ 已发布" if xhs_r[0] else "❌ 失败/取消"}
链接: {xhs_r[1] or "N/A"}
截图: {SS_DIR}

---
自动发布 by OpenClaw AI (2026-05-23)
"""
    RECORD_F.write_text(txt, encoding="utf-8")
    print(f"\n📝 记录保存: {RECORD_F}")


# ============================================================
# 主流程
# ============================================================
def main():
    print("=" * 60)
    print("🐱🐶 奶盖和年糕 Day3 全自动发布 v3")
    print(f"   发布时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)

    if not check_files():
        input("\n按 Enter 退出..."); return

    print("\n[系统] 启动 Chrome（使用已存登录状态）...")
    with sync_playwright() as p:
        ctx = p.chromium.launch_persistent_context(
            user_data_dir=str(DATA_DIR),
            channel="chrome",
            headless=False,
            args=["--start-maximized", "--disable-blink-features=AutomationControlled"],
        )
        page = ctx.pages[0] if ctx.pages else ctx.new_page()

        dy_r = (False, None)
        xhs_r = (False, None)
        try:
            if dy_do(page):
                dy_r = dy_publish(page)

            print("\n" + "=" * 50)
            if ask("\n继续发布小红书？"):
                if xhs_do(page):
                    xhs_r = xhs_publish(page)
            else:
                print("⏭️ 跳过小红书")

            save(dy_r, xhs_r)
            print("\n" + "=" * 60)
            print("🎉 Day3 发布任务完成！")
            print(f"   抖音: {'✅' if dy_r[0] else '⏭️/❌'}")
            print(f"   小红书: {'✅' if xhs_r[0] else '⏭️/❌'}")
            print(f"   记录: {RECORD_F}")
            print("=" * 60)

        except KeyboardInterrupt:
            print("\n⚠️ 中断"); save(dy_r, xhs_r)
        except Exception as e:
            print(f"\n❌ {e}")
            import traceback; traceback.print_exc()
            try: snap(page, "error")
            except: pass
            save(dy_r, xhs_r)
        finally:
            print("\n浏览器保持打开。关闭窗口或按 Enter 退出...")
            input()
            ctx.close()


if __name__ == "__main__":
    main()
