"""
奶盖和年糕 Day3 发布 - 简洁交互版
手动步骤交给用户，自动完成能自动的部分
"""
import time, sys
from datetime import datetime
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PTimeout

# 路径
ASSET = Path(r"D:\AI\kzt\brand\naigai-niangao\source\07_视频成片\第三条视频_AI重制")
RECORD = Path(r"D:\AI\kzt\brand\naigai-niangao\source\10_数据复盘")
SS = RECORD / "Day3_screenshots"
DATA = Path(r"D:\AI\kzt\brand\naigai-niangao\source\.browser_data")
SS.mkdir(parents=True, exist_ok=True)
RECORD.mkdir(parents=True, exist_ok=True)

VIDEO = ASSET / "Day3_奶盖偷看年糕被抓包.mp4"
COVER_V = ASSET / "封面_Day3_偷看被抓包_竖屏_带字.png"
COVER_H = ASSET / "横封面_Day3_偷看被抓包_带字.png"
DY_T = ASSET / "抖音标题.txt"
DY_B = ASSET / "抖音文案.txt"
XHS_T = ASSET / "小红书标题.txt"
XHS_B = ASSET / "小红书文案.txt"
RF = RECORD / "Day3_发布记录.txt"

def rd(f): return f.read_text(encoding="utf-8").strip() if f.exists() else ""
def sp(p, n): p.screenshot(path=str(SS/f"{n}.png"), full_page=False); print(f"  📸 {n}")

def run():
    print("="*60)
    print("🐱🐶 奶盖和年糕 Day3 发布")
    print(f"   {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*60)

    # 文件检查
    ok = True
    for name, fp in [("视频",VIDEO),("竖屏封面",COVER_V),("横屏封面",COVER_H),
                     ("抖音标题",DY_T),("抖音文案",DY_B),("小红书标题",XHS_T),("小红书文案",XHS_B)]:
        e = fp.exists()
        print(f"  {'✅' if e else '❌'} {name}")
        if not e: ok = False
    if not ok: print("❌ 文件缺失"); input("按Enter退出"); return

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
            # ==================== 抖音 ====================
            print("\n" + "="*50)
            print("【抖音】发布")
            print("="*50)

            # 抖音首页 - 检查登录
            page.goto("https://creator.douyin.com/", wait_until="domcontentloaded")
            time.sleep(4)
            sp(page, "dy_01_home")
            print("\n⚠️ 请在浏览器中确认是否已登录抖音")
            print("如果看到登录页面，请手动登录")
            input("  登录完成后按 Enter 继续...")

            # 上传页
            page.goto("https://creator.douyin.com/creator-micro/content/upload", wait_until="domcontentloaded")
            time.sleep(4)
            sp(page, "dy_02_upload")

            # 上传视频
            fi = page.query_selector('input[type="file"]')
            if fi:
                fi.set_input_files(str(VIDEO))
                print("✅ 视频已选择，等待上传...")
            else:
                print("⚠️ 请手动上传视频后按Enter")
                input()

            # 等待上传
            try:
                page.wait_for_function(
                    "() => !!document.querySelector('input.semi-input-default[placeholder*=\"标题\"]')",
                    timeout=180000
                )
                print("✅ 上传完成")
            except:
                print("⏳ 等待结束")
            time.sleep(3)
            sp(page, "dy_03_uploaded")

            # 标题
            title = rd(DY_T)
            print(f"\n标题: {title}")
            ti = page.query_selector('input.semi-input-default[placeholder*="标题"]')
            if ti:
                ti.click(); time.sleep(0.3); ti.fill(""); time.sleep(0.3)
                ti.type(title, delay=30); print("✅ 标题已填")
            else:
                print("⚠️ 请手动填写标题后按Enter"); input()

            # 正文
            body = rd(DY_B)
            print(f"\n正文({len(body)}字):")
            print(body[:60] + "...")
            bd = page.query_selector('div[contenteditable]')
            if bd:
                bd.click(); time.sleep(0.3); bd.fill(""); time.sleep(0.3)
                bd.type(body, delay=15); print("✅ 正文已填")
            else:
                print("⚠️ 请手动填写正文后按Enter"); input()

            # 封面 - 手动操作
            print("\n📷 【手动操作】请在右侧面板设置封面")
            print(f"   上传: {COVER_V.name}")
            print("   如果弹出选项，选第一个")
            input("   设置完成后按 Enter 继续...")
            sp(page, "dy_04_cover")

            # 音乐 - 手动或自动
            print("\n🎵 添加音乐（可选）")
            try:
                btn = page.query_selector('button:has-text("添加音乐"), button:has-text("配乐")')
                if btn and btn.is_visible():
                    btn.click(); time.sleep(2); sp(page, "dy_music")
                    si = page.query_selector('input[placeholder*="搜索"], input[placeholder*="音乐名"]')
                    if si:
                        si.fill("温柔治愈"); time.sleep(2)
                        items = page.query_selector_all('[class*="music-item"], [class*="song-item"]')
                        if items:
                            items[0].click(); print("✅ 已选第一首音乐")
                            time.sleep(1)
                            # 调音量
                            vol = page.query_selector('input[type="range"]')
                            if vol:
                                try: vol.fill("20")
                                except: pass
                            print("✅ 音乐已设置")
            except:
                pass
            print("⚠️ 如果音乐没自动设置好，请手动在右侧面板添加")
            print("   建议：温柔治愈无歌词，音量20%")
            input("   完成后按 Enter 继续...")

            # 发布
            print("\n✅ 抖音准备就绪！请检查浏览器中的内容")
            print("   视频 | 封面 | 标题 | 正文 | 音乐")
            print("   如果无误，请手动点击右下角的蓝色「发布」按钮")
            input("   发布后按 Enter 继续...")
            sp(page, "dy_05_done")
            print("✅ 抖音发布完成")
            dy_url = page.url

            # ==================== 小红书 ====================
            print("\n" + "="*50)
            print("【小红书】发布")
            print("="*50)
            input("准备好后按 Enter 开始小红书发布...")

            page.goto("https://creator.xiaohongshu.com/publish/publish", wait_until="domcontentloaded")
            time.sleep(6)
            sp(page, "xhs_01_page")
            print("\n⚠️ 请在浏览器中确认登录状态")
            input("   确认后按 Enter 继续...")

            # 上传视频
            fi = page.query_selector('input[type="file"]')
            if fi:
                fi.set_input_files(str(VIDEO))
                print("✅ 视频已选择，等待上传...")
            else:
                print("⚠️ 请手动上传视频后按Enter"); input()

            try:
                page.wait_for_function(
                    "() => !!document.querySelector('input[placeholder*=\"标题\"]')", timeout=180000
                )
                print("✅ 上传完成")
            except: pass
            time.sleep(5)
            sp(page, "xhs_02_uploaded")

            # 标题
            title = rd(XHS_T)
            print(f"\n标题: {title}")
            ti = page.query_selector('input[placeholder*="标题"]')
            if ti:
                ti.click(); time.sleep(0.3); ti.fill(""); time.sleep(0.3)
                ti.type(title, delay=30); print("✅ 标题已填")
            else:
                print("⚠️ 请手动填写标题后按Enter"); input()

            # 正文
            body = rd(XHS_B)
            print(f"\n正文({len(body)}字)")
            for s in ['div[contenteditable]', 'div.ql-editor']:
                bd = page.query_selector(s)
                if bd:
                    bd.click(); time.sleep(0.3); bd.fill(""); time.sleep(0.3)
                    bd.type(body, delay=15); print("✅ 正文已填"); break
            else:
                print("⚠️ 请手动填写正文后按Enter"); input()

            # 封面 - 悬停操作
            print("\n📷 【手动操作】设置小红书封面")
            print("   鼠标悬停在视频封面缩略图上")
            print("   点击出现的「上传封面」/「修改封面」")
            print(f"   选择文件: {COVER_V.name}")
            input("   设置完成后按 Enter 继续...")
            sp(page, "xhs_03_cover")

            # 音乐
            print("\n🎵 音乐（可选，非必需）")
            try:
                for btn in page.query_selector_all("button"):
                    if "音乐" in (btn.inner_text() or ""):
                        btn.click(); time.sleep(2)
                        si = page.query_selector('input[placeholder*="搜索"]')
                        if si: si.fill("温柔治愈"); time.sleep(2)
                        items = page.query_selector_all('[class*="music-item"]')
                        if items: items[0].click(); print("✅ 已选音乐")
                        break
            except: pass
            print("   如果没自动添加，可以在右侧手动选")
            input("   完成后按 Enter 继续...")

            # 发布
            print("\n✅ 小红书准备就绪！请检查内容")
            print("   如果无误，请手动点击「发布笔记」按钮")
            input("   发布后按 Enter 继续...")
            sp(page, "xhs_04_done")
            print("✅ 小红书发布完成")
            xhs_url = page.url

            # 保存记录
            ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            txt = f"""Day3 发布记录
====================
发布时间: {ts}

【抖音】
标题: {rd(DY_T)}
状态: ✅ 已发布
链接: {dy_url}
截图: {SS}

【小红书】
标题: {rd(XHS_T)}
状态: ✅ 已发布
链接: {xhs_url}
截图: {SS}
"""
            RF.write_text(txt, encoding="utf-8")
            print(f"\n📝 记录已保存: {RF}")

            print("\n" + "="*60)
            print("🎉 Day3 发布完成！")
            print("="*60)

        except KeyboardInterrupt:
            print("\n⚠️ 已中断")
        except Exception as e:
            print(f"\n❌ 异常: {e}")
            import traceback; traceback.print_exc()
            try: sp(page, "error")
            except: pass
        finally:
            print("\n浏览器保持打开，按 Ctrl+C 或关闭窗口退出")
            input()

if __name__ == "__main__":
    run()
