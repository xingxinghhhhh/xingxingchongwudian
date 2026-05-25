"""
奶盖和年糕 Day3 - 小红书发布专用
"""
import time
from datetime import datetime
from pathlib import Path
from playwright.sync_api import sync_playwright

ASSET = Path(r"D:\AI\kzt\brand\naigai-niangao\source\07_视频成片\第三条视频_AI重制")
RECORD = Path(r"D:\AI\kzt\brand\naigai-niangao\source\10_数据复盘")
SS = RECORD / "Day3_screenshots"
DATA = Path(r"D:\AI\kzt\brand\naigai-niangao\source\.browser_data")
SS.mkdir(parents=True, exist_ok=True)
RECORD.mkdir(parents=True, exist_ok=True)

VIDEO = ASSET / "Day3_奶盖偷看年糕被抓包.mp4"
COVER_V = ASSET / "封面_Day3_偷看被抓包_竖屏_带字.png"
COVER_H = ASSET / "横封面_Day3_偷看被抓包_带字.png"
XHS_TITLE = ASSET / "小红书标题.txt"
XHS_BODY = ASSET / "小红书文案.txt"
RECORD_FILE = RECORD / "Day3_发布记录.txt"

def read(f): return f.read_text(encoding="utf-8").strip() if f.exists() else ""
def snap(p, n): p.screenshot(path=str(SS/f"{n}.png"), full_page=False); print(f"  📸 {n}")

def main():
    print("="*50)
    print("🐱 小红书 Day3 发布")
    print(f"   {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*50)

    # 检查
    for n, f in [("视频",VIDEO),("竖屏封面",COVER_V),("小红书标题",XHS_TITLE),("小红书文案",XHS_BODY)]:
        print(f"  {'✅' if f.exists() else '❌'} {n}")

    print("\n🚀 启动 Chrome...")
    with sync_playwright() as pw:
        ctx = pw.chromium.launch_persistent_context(
            user_data_dir=str(DATA),
            channel="chrome",
            headless=False,
            args=["--start-maximized", "--disable-blink-features=AutomationControlled"],
        )
        page = ctx.pages[0] if ctx.pages else ctx.new_page()

        try:
            # 打开小红书发布页
            print("\n📄 打开小红书发布页...")
            page.goto("https://creator.xiaohongshu.com/publish/publish", wait_until="domcontentloaded")
            time.sleep(6)
            snap(page, "xhs_01_page")
            
            # 检查登录
            lb = page.query_selector('button:has-text("登录")')
            if lb and lb.is_visible():
                print("⚠️ 未登录，请在浏览器中手动登录")
                input("登录后按 Enter 继续...")
            
            print("✅ 已登录")

            # 上传视频
            print("\n📹 上传视频...")
            fi = page.query_selector('input[type="file"]')
            if fi:
                fi.set_input_files(str(VIDEO))
                print("  ✅ 已选择视频，等待上传...")
            else:
                print("  ⚠️ 请手动上传视频"); input("上传后按 Enter 继续...")

            # 等待上传完成
            try:
                page.wait_for_function(
                    "() => !!document.querySelector('input[placeholder*=\"标题\"]')", timeout=180000
                )
                print("  ✅ 上传完成")
            except:
                print("  ⏳ 等待超时")
            time.sleep(5)
            snap(page, "xhs_02_uploaded")

            # 标题
            title = read(XHS_TITLE)
            print(f"\n📝 标题: {title}")
            ti = page.query_selector('input[placeholder*="标题"]')
            if ti:
                ti.click(); time.sleep(0.3); ti.fill(""); time.sleep(0.3)
                ti.type(title, delay=30); print("  ✅ 标题已填")
            else:
                print("  ⚠️ 请手动填标题"); input("填后按 Enter 继续...")

            # 正文
            body = read(XHS_BODY)
            print(f"\n📝 正文({len(body)}字)")
            for s in ['div[contenteditable]', 'div.ql-editor']:
                bd = page.query_selector(s)
                if bd:
                    bd.click(); time.sleep(0.3); bd.fill(""); time.sleep(0.3)
                    bd.type(body, delay=15); print("  ✅ 正文已填"); break
            else:
                print("  ⚠️ 请手动填正文"); input("填后按 Enter 继续...")

            # 封面 - 悬停后上传
            print("\n🖼️ 设置封面（鼠标悬停后上传）...")
            
            # 尝试用JS找到封面预览区并触发hover
            js_hover = """
            () => {
                // 找视频封面预览图（上传后左侧的视频缩略图）
                const imgs = document.querySelectorAll('img');
                for (const img of imgs) {
                    const r = img.getBoundingClientRect();
                    // 封面预览区通常是 150-400px 左右的方形区域
                    if (r.width > 100 && r.width < 500 && r.height > 100 && r.height < 500) {
                        const p = img.parentElement;
                        if (p) {
                            // 触发 mouseenter
                            p.dispatchEvent(new MouseEvent('mouseenter', {bubbles: true}));
                            return { found: true, x: r.left + r.width/2, y: r.top + r.height/2 };
                        }
                    }
                }
                return { found: false };
            }
            """
            result = page.evaluate(js_hover)
            
            if result.get("found"):
                print(f"  ✅ 已悬停封面预览区")
                time.sleep(2)
                snap(page, "xhs_cover_hover")
                
                # 找出现的"上传封面"/"修改封面"按钮
                uploaded = False
                js_click = """
                () => {
                    const all = document.querySelectorAll('button, span, div');
                    for (const el of all) {
                        const t = el.textContent.trim();
                        if ((t === '上传封面' || t.includes('上传封面') || t.includes('修改封面') || t.includes('更换封面')) && el.offsetParent !== null) {
                            el.click();
                            return 'clicked';
                        }
                    }
                    return 'not_found';
                }
                """
                click_r = page.evaluate(js_click)
                print(f"  [封面上传按钮] {click_r}")
                
                if 'clicked' in click_r:
                    time.sleep(2)
                    fi = page.query_selector('input[type="file"]')
                    if fi:
                        fi.set_input_files(str(COVER_V))
                        print(f"  ✅ 已上传竖屏封面: {COVER_V.name}")
                        time.sleep(3)
                        # 确认
                        for bt in ["确定", "确认", "完成", "保存"]:
                            btn = page.query_selector(f'button:has-text("{bt}")')
                            if btn and btn.is_visible():
                                try:
                                    btn.click(); time.sleep(1); print(f"  ✅ 点击{bt}")
                                    uploaded = True
                                    break
                                except: continue
                        if not uploaded:
                            print("  ⚠️ 请手动确认封面")
                            input("确认后按 Enter...")
                    else:
                        print("  ⚠️ 请手动选择竖屏封面上传")
                        input("上传后按 Enter...")
                else:
                    print("  ⚠️ 未找到上传按钮，请手动操作")
                    print("  📌 鼠标悬停在左侧封面预览区 → 点击「上传封面」")
                    print(f"     选择文件: {COVER_V.name}")
                    input("完成后按 Enter 继续...")
            else:
                print("  ⚠️ 未找到封面预览区，请手动设置封面")
                print("  📌 鼠标悬停在左侧封面缩略图上 → 点击「上传封面」")
                print(f"     选择文件: {COVER_V.name}")
                input("完成后按 Enter 继续...")
            
            snap(page, "xhs_03_cover")

            # 音乐（可选）
            print("\n🎵 音乐设置（可选）...")
            try:
                for btn in page.query_selector_all("button"):
                    t = btn.inner_text().strip() if btn.inner_text() else ""
                    if "音乐" in t:
                        btn.click(); time.sleep(2)
                        si = page.query_selector('input[placeholder*="搜索"]')
                        if si:
                            si.fill("温柔治愈"); time.sleep(2)
                            items = page.query_selector_all('[class*="music-item"], [class*="song-item"]')
                            if items: items[0].click(); print("  ✅ 已选音乐")
                        break
            except: pass
            print("  音乐非必需，可手动添加或跳过")
            input("  完成后按 Enter 继续...")

            # 发布
            print("\n✅ 请检查小红书内容：视频 | 封面 | 标题 | 正文")
            print("确认无误后，手动点击「发布笔记」按钮")
            input("发布后按 Enter 继续...")
            snap(page, "xhs_04_done")
            print("✅ 小红书发布完成！")
            xhs_url = page.url

            # 保存记录
            ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            dy_title = read(ASSET / "抖音标题.txt")
            xhs_title = read(XHS_TITLE)
            txt = f"""Day3 发布记录
====================
发布时间: {ts}

【抖音】
标题: {dy_title}
状态: ✅ 已发布（手动）
链接: 手动发布

【小红书】
标题: {xhs_title}
状态: ✅ 已发布
链接: {xhs_url}
截图: {SS}
"""
            RECORD_FILE.write_text(txt, encoding="utf-8")
            print(f"\n📝 记录已保存: {RECORD_FILE}")
            print("\n🎉 Day3 全部发布完成！")

        except KeyboardInterrupt:
            print("\n⚠️ 中断")
        except Exception as e:
            print(f"\n❌ {e}")
            import traceback; traceback.print_exc()
            try: snap(page, "error")
            except: pass
        finally:
            print("\n浏览器保持打开。关闭窗口退出")
            input()

if __name__ == "__main__":
    main()
