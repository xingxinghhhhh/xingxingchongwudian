"""Debug: inspect Xiaohongshu publish page using REAL Chrome profile"""
from playwright.sync_api import sync_playwright
import time
import os

# Use the real Chrome user data directory
REAL_USER_DATA = os.path.expandvars(r"%LOCALAPPDATA%\Google\Chrome\User Data")

with sync_playwright() as p:
    context = p.chromium.launch_persistent_context(
        user_data_dir=REAL_USER_DATA,
        channel="chrome",
        headless=True,
    )
    page = context.new_page()

    print("=== Opening Xiaohongshu Creator Publish Page ===")
    page.goto("https://creator.xiaohongshu.com/publish/publish", wait_until="domcontentloaded")
    time.sleep(5)

    print("=== Page URL ===")
    print(page.url)

    # Check if logged in
    has_login_btn = page.query_selector('button:has-text("登录"), button:has-text("登 录")')
    print(f"\nHas login button: {has_login_btn is not None}")

    if has_login_btn:
        print("NOT LOGGED IN - Still showing login page")
        page.screenshot(path=r"D:\AI\kzt\brand\naigai-niangao\source\output\screenshots\debug_xhs_login.png")
    else:
        print("LOGGED IN! Analyzing page structure...")

        # Check for file upload
        file_inputs = page.query_selector_all('input[type="file"]')
        print(f"File inputs: {len(file_inputs)}")

        # Upload/drag areas
        for sel in ['[class*="upload"]', '[class*="drag"]', '[class*="media"]', '[class*="video"]']:
            els = page.query_selector_all(sel)
            if els:
                print(f"\n  Selector '{sel}': {len(els)} elements")
                for el in els[:5]:
                    tag = el.evaluate("e => e.tagName")
                    cls = el.get_attribute("class") or ""
                    text = el.inner_text()[:80] if el.inner_text() else ""
                    print(f"    <{tag}> class=\"{cls[:60]}\" text=\"{text[:60]}\"")

        # Buttons
        buttons = page.query_selector_all("button")
        print("\n=== Buttons ===")
        for btn in buttons:
            text = btn.inner_text()[:60] if btn.inner_text() else ""
            if text.strip():
                print(f'  "{text}"')

        # Inputs/content
        print("\n=== Text inputs ===")
        for sel in ["input", "textarea", "div[contenteditable]"]:
            els = page.query_selector_all(sel)
            if els:
                for el in els[:15]:
                    ph = el.get_attribute("placeholder") or ""
                    cls = el.get_attribute("class") or ""
                    rid = el.get_attribute("id") or ""
                    if ph or rid:
                        print(f"  [{sel}] id='{rid[:30]}' placeholder='{ph[:30]}' class='{cls[:40]}'")

        page.screenshot(path=r"D:\AI\kzt\brand\naigai-niangao\source\output\screenshots\debug_xhs_publish.png")

    print("\nDone")
    context.close()
