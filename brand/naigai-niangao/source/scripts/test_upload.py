"""Test: upload video to Douyin via hidden file input"""
from playwright.sync_api import sync_playwright
import time

VIDEO_PATH = r"D:\AI\kzt\brand\naigai-niangao\source\output\videos\day04_奶盖和年糕第1天.mp4"

with sync_playwright() as p:
    context = p.chromium.launch_persistent_context(
        user_data_dir=r"D:\AI\kzt\brand\naigai-niangao\source\.browser_data",
        channel="chrome",
        headless=False,
    )
    page = context.new_page()

    print("=== Opening Douyin Upload Page ===")
    page.goto("https://creator.douyin.com/creator-micro/content/upload", wait_until="domcontentloaded")
    time.sleep(3)

    # Find the hidden file input
    file_inputs = page.query_selector_all('input[type="file"]')
    print(f"Found {len(file_inputs)} file input(s)")

    if file_inputs:
        # Try to set the file on the hidden input
        print(f"Attempting to upload: {VIDEO_PATH}")
        try:
            file_inputs[0].set_input_files(VIDEO_PATH)
            print("File set successfully!")
        except Exception as e:
            print(f"set_input_files failed: {e}")
            # Try to make it visible first
            page.evaluate("""(input) => {
                input.style.cssText = 'display:block; width:200px; height:50px; position:fixed; top:10px; left:10px; z-index:99999';
            }""", file_inputs[0])
            time.sleep(1)
            try:
                file_inputs[0].set_input_files(VIDEO_PATH)
                print("File set successfully (after making visible)!")
            except Exception as e2:
                print(f"Still failed: {e2}")

    print("\nWaiting for upload to process...")
    time.sleep(15)

    # Check page state after upload
    print("\n=== Page after upload attempt ===")
    # Look for progress indicators or upload completion
    upload_done = page.query_selector('[class*="success"], [class*="complete"], .upload-finish')
    if upload_done:
        print(f"Upload completed! Text: {upload_done.inner_text()[:100]}")

    # Try to find title input
    title_inputs = page.query_selector_all('[placeholder*="标题"], [placeholder*="title"], input[class*="title"], textarea[class*="title"]')
    print(f"Found {len(title_inputs)} title input(s)")
    for ti in title_inputs:
        ph = ti.get_attribute("placeholder") or ""
        cls = ti.get_attribute("class") or ""
        print(f"  placeholder='{ph}' class='{cls[:60]}'")

    # Try to find description input
    desc_inputs = page.query_selector_all('[class*="desc"] textarea, [class*="desc"] div[contenteditable], [placeholder*="描述"], [placeholder*="文案"]')
    print(f"Found {len(desc_inputs)} description input(s)")

    # Also dump common selectors
    print("\n=== Common contenteditable / input fields ===")
    for sel in ["input", "textarea", "div[contenteditable]"]:
        els = page.query_selector_all(sel)
        if els:
            print(f"  {sel}: {len(els)} found")
            for el in els[:10]:
                ph = el.get_attribute("placeholder") or ""
                cls = el.get_attribute("class") or ""
                txt = el.inner_text()[:40] if el.inner_text() else ""
                if ph or txt.strip():
                    print(f"    placeholder='{ph}' class='{cls[:50]}' text='{txt}'")

    page.screenshot(path=r"D:\AI\kzt\brand\naigai-niangao\source\output\screenshots\debug_upload_result.png")
    print("\nScreenshot saved")

    input("\nPress Enter to close browser...")
    context.close()
