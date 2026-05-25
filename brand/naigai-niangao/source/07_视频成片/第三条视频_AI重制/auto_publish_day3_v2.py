"""
奶盖和年糕 Day3 全自动发布脚本 v2
=============================
更稳定的版本，通过 JS 直接操作 DOM
"""

import os, time, sys, json
from datetime import datetime
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

# ============================================================
# 路径
# ============================================================
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
        ("视频", VIDEO),
        ("竖屏封面", COVER_V),
        ("横屏封面", COVER_H),
        ("抖音标题", DY_TITLE_F),
        ("抖音文案", DY_BODY_F),
        ("小红书标题", XHS_TITLE_F),
        ("小红书文案", XHS_BODY_F),
    ]
    print("\n【发布前检查】")
    ok = True
    for name, p in items:
        exists = p.exists()
        sz = p.stat().st_size if exists else 0
        s = "✅" if exists else "❌"
        if exists and sz > 1024**2:
            print(f"  {s} {name}: {p.name} ({sz/1024/1024:.1f}MB)")
        elif exists:
            print(f"  {s} {name}: {p.name} ({sz}B)")
        else:
            print(f"  {s} {name}: {p}")
            ok = False
    # 标题误用检查
    for label, fp in [("抖音", DY_TITLE_F), ("小红书", XHS_TITLE_F)]:
        if fp.exists():
            t = read(fp)
            for kw in ["Day2", "第2天", "第二天"]:
                if kw in t:
                    print(f"  ⚠️ [{label}] 标题可能误用 Day2：{t}")
                    ok = False
    if ok:
        print("  ✅ 全部通过！")
    else:
        print("\n❌ 检查未通过，请修复后重试")
    return ok


# ============================================================
# JS 工具：注入 input 文件
# ============================================================
def js_fill_input(page, path_str):
    """通过 JS 创建/获取 file input 并赋值"""
    js = f"""
    () => {{
        // 已经有 file input 的话直接用
        let fi = document.querySelector('input[type="file"]');
        if (fi) return 'found_existing';
        // 创建一个新的 file input 替代
        fi = document.createElement('input');
        fi.type = 'file';
        fi.style.position = 'fixed';
        fi.style.top = '0';
        fi.style.left = '0';
        fi.style.zIndex = '99999';
        fi.style.opacity = '0.01';
        fi.multiple = false;
        document.body.appendChild(fi);
        return 'created_new';
    }}
    """
    return page.evaluate(js)


# ============================================================
# 抖音
# ============================================================
def dy_do(page):
    print("\n" + "=" * 50)
    print("🚀 [抖音] 发布")
    print("=" * 50)

    # 1. 首页 -> 检查登录
    page.goto("https://creator.douyin.com/", wait_until="domcontentloaded")
    time.sleep(4)
    snap(page, "dy_01_home")
    if not dy_logged_in(page):
        print("⚠️ 未登录，请在浏览器手动登录后输入 y")
        if not ask("已登录?"): return False
        page.goto("https://creator.douyin.com/", wait_until="domcontentloaded")
        time.sleep(4)
        if not dy_logged_in(page):
            print("❌ 登录失败")
            return False
    print("✅ 已登录")

    # 2. 上传页
    page.goto("https://creator.douyin.com/creator-micro/content/upload", wait_until="domcontentloaded")
    time.sleep(5)
    snap(page, "dy_02_upload")

    # 3. 上传视频
    fi = page.query_selector('input[type="file"]')
    if fi:
        fi.set_input_files(str(VIDEO))
        print(f"✅ 已选择视频")
    else:
        print("⚠️ 请手动上传视频后输入 y")
        if not ask("已上传?"): return False

    print("⏳ 等待上传...")
    try:
        page.wait_for_function(
            "() => !!document.querySelector('input.semi-input-default[placeholder*=\"标题\"]')",
            timeout=180000
        )
        print("✅ 上传完成")
    except:
        print("⏳ 超时但继续")
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

    # 6. 封面
    print("\n📷 设置封面...")
    dy_cover(page)
    snap(page, "dy_04_cover")

    # 7. 音乐
    print("\n🎵 添加音乐...")
    dy_music(page)

    print("\n✅ [抖音] 准备完成")
    return True


def dy_logged_in(page):
    try:
        btns = page.query_selector_all('button:has-text("登录"), a:has-text("登录")')
        for b in btns:
            if b.is_visible(): return False
        return True
    except:
        return True


def dy_cover(page):
    """设置抖音封面 - 综合策略"""
    if not COVER_V.exists():
        print("竖屏封面缺失")
        return

    # 策略1: 找封面按钮点击
    clicked = False
    for sel in [
        'button:has-text("封面")',
        'div[class*="cover"] button',
        '[class*="cover-upload"]',
        '[class*="poster"]',
        'span:has-text("封面")',
    ]:
        el = page.query_selector(sel)
        if el and el.is_visible():
            try:
                el.click()
                clicked = True
                print(f"✅ 已点击封面按钮")
                time.sleep(3)
                break
            except:
                continue

    if not clicked:
        # 策略2: 用JS查找
        js = """
        () => {
            const walk = document.createTreeWalker(document.body, 4, null, false);
            const btns = [];
            let n;
            while (n = walk.nextNode()) {
                const t = n.textContent.trim();
                if (t.includes('封面') && n.offsetParent !== null) {
                    btns.push(n);
                }
            }
            // 优先找最小的文本节点（实际按钮文本）
            btns.sort((a,b) => a.textContent.length - b.textContent.length);
            return btns.length > 0;
        }
        """
        has_btn = page.evaluate(js)
        if has_btn:
            # 用JS点击
            page.evaluate("""
                () => {
                    const walk = document.createTreeWalker(document.body, 4, null, false);
                    let n, best = null;
                    while (n = walk.nextNode()) {
                        const t = n.textContent.trim();
                        if (t === '封面' && n.offsetParent !== null) {
                            best = n; break;
                        }
                    }
                    if (best) best.closest('button')?.click() || best.parentElement?.click();
                }
            """)
            time.sleep(3)
            clicked = True
            print("✅ JS点击封面按钮")

    if not clicked:
        print("⚠️ 请手动点击封面按钮")
        print("📌 在右侧面板找到「封面」区域，选择上传竖屏封面")
        ask("设置封面后输入 y")
        return

    # 上传封面文件
    time.sleep(2)
    fi = page.query_selector('input[type="file"]')
    if fi:
        fi.set_input_files(str(COVER_V))
        print(f"✅ 已上传竖屏封面")
        time.sleep(3)
        # 确认
        for btn_text in ["确定", "确认", "完成", "保存"]:
            btn = page.query_selector(f'button:has-text("{btn_text}")')
            if btn and btn.is_visible():
                try:
                    btn.click()
                    time.sleep(1)
                    print(f"✅ 已点击「{btn_text}」")
                    break
                except:
                    continue
    else:
        # 用JS找file input
        fi2 = page.evaluate("""
            () => {
                const fis = document.querySelectorAll('input[type="file"]');
                // 找到已经弹出dialog中的file input
                for (let f of fis) {
                    if (f.offsetParent !== null) return f;
                }
                return null;
            }
        """)
        if fi2:
            fi2.set_input_files(str(COVER_V))
            print(f"✅ 上传竖屏封面(JS)")
            time.sleep(3)
        else:
            print("⚠️ 请手动在弹窗中上传竖屏封面")
            ask("上传后输入 y")


def dy_music(page):
    """添加背景音乐"""
    print("标准: 温柔/治愈/轻快/无歌词/萌宠日常, 音量20%")
    try:
        btn = page.query_selector('button:has-text("添加音乐"), button:has-text("选择音乐"), button:has-text("配乐")')
        if btn and btn.is_visible():
            btn.click()
            print("✅ 已打开音乐面板")
            time.sleep(3)
            snap(page, "dy_music_panel")

            # 搜索
            si = page.query_selector('input[placeholder*="搜索"], input[placeholder*="音乐名"]')
            if si:
                si.fill("温柔治愈无歌词")
                time.sleep(2)
                # 选择第一个结果
                items = page.query_selector_all(
                    '[class*="music-item"], [class*="song-item"], '
                    'li[class*="item"], [class*="search-result"] > div'
                )
                if items:
                    items[0].click()
                    print("✅ 已选择音乐")
                    time.sleep(1)
                else:
                    print("无搜索结果，使用推荐")
            else:
                print("无搜索框，使用推荐列表")

            # 音量调整
            vol = page.query_selector(
                'input[type="range"], [class*="volume"] input[type="range"]'
            )
            if vol:
                vol.fill("20")
                print("✅ 音量设为20%")
            print("✅ 音乐设置完成")
        else:
            print("未自动找到音乐按钮，发布时请手动添加")
    except Exception as e:
        print(f"音乐异常: {e}")


def dy_publish(page):
    print("\n" + "=" * 50)
    print("⏳ 请检查抖音视频/封面/标题/正文是否正确")
    print("确认无误后输入 y 发布")
    print("=" * 50)
    if not ask("确认发布抖音？"):
        print("❌ 已取消")
        return False, None

    for btn in page.query_selector_all("button"):
        t = btn.inner_text().strip() if btn.inner_text() else ""
        if t in ("发布", "高清发布"):
            try:
                btn.click()
                print("✅ 已点击发布")
                time.sleep(10)
                snap(page, "dy_05_done")
                print(f"URL: {page.url}")
                return True, page.url
            except:
                continue
    print("⚠️ 请手动点击发布按钮")
    ask("发布后输入 y")
    snap(page, "dy_05_done")
    return True, page.url


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
        print("⚠️ 未登录，请手动登录后输入 y")
        if not ask("已登录?"): return False
        page.goto("https://creator.xiaohongshu.com/publish/publish", wait_until="domcontentloaded")
        time.sleep(6)
        if not xhs_logged_in(page):
            print("❌ 登录失败")
            return False
    print("✅ 已登录")

    # 上传
    fi = page.query_selector('input[type="file"]')
    if fi:
        fi.set_input_files(str(VIDEO))
        print(f"✅ 已选择视频")
    else:
        # 尝试点上传区
        for sel in ['[class*="upload"]', '[class*="drag"]', '[class*="add"]']:
            el = page.query_selector(sel)
            if el and el.is_visible():
                el.click()
                time.sleep(2)
                fi = page.query_selector('input[type="file"]')
                if fi:
                    fi.set_input_files(str(VIDEO))
                    print("✅ 已选择视频")
                    break
        else:
            print("⚠️ 请手动上传视频"); ask("上传后输入 y")

    print("⏳ 等待上传...")
    try:
        page.wait_for_function(
            "() => !!document.querySelector('input[placeholder*=\"标题\"]')",
            timeout=180000
        )
        print("✅ 上传完成")
    except:
        pass
    time.sleep(5)
    snap(page, "xhs_02_uploaded")

    # 标题
    title = read(XHS_TITLE_F)
    print(f"标题: {title}")
    ti = page.query_selector('input[placeholder*="标题"]')
    if ti:
        ti.click(); time.sleep(0.3)
        ti.fill(""); time.sleep(0.3)
        ti.type(title, delay=30); print("✅ 标题已填")
    else:
        print("⚠️ 请手动填标题"); ask("填后 y")

    # 正文
    body = read(XHS_BODY_F)
    print(f"正文({len(body)}字)")
    for sel in ['div[contenteditable]', 'div.ql-editor', '[class*="editor"] div[contenteditable]']:
        bd = page.query_selector(sel)
        if bd:
            bd.click(); time.sleep(0.3)
            bd.fill(""); time.sleep(0.3)
            bd.type(body, delay=15); print("✅ 正文已填")
            break
    else:
        print("⚠️ 请手动填正文"); ask("填后 y")

    # 封面
    print("\n📷 设置封面...")
    xhs_cover(page)

    # 音乐
    print("\n🎵 添加音乐...")
    xhs_music(page)

    print("\n✅ [小红书] 准备完成")
    return True


def xhs_logged_in(page):
    try:
        lb = page.query_selector('button:has-text("登录")')
        if lb and lb.is_visible(): return False
        if "login" in page.url.lower(): return False
        return True
    except:
        return True


def xhs_cover(page):
    if not COVER_V.exists():
        print("竖屏封面缺失")
        return
    btns = page.query_selector_all("button")
    for btn in btns:
        t = btn.inner_text().strip() if btn.inner_text() else ""
        if t == "封面" or "设置封面" in t:
            try:
                btn.click()
                time.sleep(2)
                print("✅ 已点击封面")
                break
            except:
                continue
    else:
        print("⚠️ 请手动设置封面"); ask("设置后输入 y"); return

    fi = page.query_selector('[class*="cover"] input[type="file"]')
    if fi:
        fi.set_input_files(str(COVER_V))
        print("✅ 竖屏封面上传")
        time.sleep(2)
        for btn in page.query_selector_all("button"):
            t = btn.inner_text().strip() if btn.inner_text() else ""
            if t in ("确定", "确认", "完成", "保存"):
                try:
                    btn.click(); time.sleep(1); break
                except:
                    continue
    else:
        print("⚠️ 请手动在弹窗上传竖屏封面"); ask("上传后输入 y")


def xhs_music(page):
    try:
        for btn in page.query_selector_all("button, [class*='music']"):
            t = btn.inner_text().strip() if btn.inner_text() else ""
            if "音乐" in t or "配乐" in t:
                btn.click()
                time.sleep(2)
                si = page.query_selector('input[placeholder*="搜索"]')
                if si:
                    si.fill("温柔治愈")
                    time.sleep(2)
                    items = page.query_selector_all('[class*="music-item"], [class*="song-item"], li')
                    if items:
                        items[0].click(); print("✅ 已选音乐")
                else:
                    items = page.query_selector_all('[class*="music"] button, [class*="song"]')
                    if items:
                        items[0].click(); print("✅ 已选推荐音乐")
                break
        else:
            print("未找到音乐选项（小红书音乐非必需）")
    except Exception as e:
        print(f"音乐异常: {e}")


def xhs_publish(page):
    print("\n" + "=" * 50)
    print("⏳ 请检查小红书笔记/封面/标题/正文")
    print("确认无误后输入 y 发布")
    print("=" * 50)
    if not ask("确认发布小红书？"):
        print("❌ 已取消")
        return False, None

    for btn in page.query_selector_all("button"):
        t = btn.inner_text().strip() if btn.inner_text() else ""
        if t in ("发布", "发布笔记"):
            try:
                btn.click()
                print("✅ 已点击发布")
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
    print("🐱🐶 奶盖和年糕 Day3 全自动发布 v2")
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
