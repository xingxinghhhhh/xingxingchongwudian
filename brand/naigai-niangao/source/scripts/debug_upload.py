"""Debug: inspect Douyin upload page structure"""
from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    context = p.chromium.launch_persistent_context(
        user_data_dir=r"D:\AI\kzt\brand\naigai-niangao\source\.browser_data",
        channel="chrome",
        headless=True,
    )
    page = context.new_page()

    print("=== Opening Douyin Creator Upload Page ===")
    page.goto("https://creator.douyin.com/creator-micro/content/upload", wait_until="domcontentloaded")
    time.sleep(5)

    print("=== Page URL ===")
    print(page.url)

    print("\n=== Looking for file inputs ===")
    file_inputs = page.query_selector_all('input[type="file"]')
    print(f"Found {len(file_inputs)} file input(s)")
    for i, inp in enumerate(file_inputs):
        print(f"  Input {i}: id={inp.get_attribute('id')}, class={inp.get_attribute('class')}, "
              f"style={inp.get_attribute('style')}")

    print("\n=== Looking for upload-related elements ===")
    for selector in ['[class*="upload"]', '[class*="Upload"]', '[class*="drag"]', '[class*="Drag"]',
                     '[class*="import"]', '[class*="Import"]']:
        els = page.query_selector_all(selector)
        if els:
            print(f"  Selector '{selector}': found {len(els)} elements")
            for el in els[:5]:
                tag = el.evaluate("e => e.tagName")
                cls = el.get_attribute("class") or ""
                text = el.inner_text()[:80] if el.inner_text() else ""
                print(f"    <{tag}> class=\"{cls[:60]}\" text=\"{text}\"")

    print("\n=== Looking for buttons ===")
    buttons = page.query_selector_all("button")
    for btn in buttons:
        text = btn.inner_text()[:60] if btn.inner_text() else ""
        if text.strip():
            print(f'  button: "{text}"')

    print("\n=== Looking for iframes ===")
    iframes = page.query_selector_all("iframe")
    print(f"Found {len(iframes)} iframe(s)")
    for i, frame in enumerate(iframes):
        src = frame.get_attribute("src") or ""
        print(f"  iframe {i}: src={src[:100]}")

    print("\n=== Page HTML (first 5000 chars) ===")
    html = page.content()
    print(html[:5000])

    page.screenshot(path=r"D:\AI\kzt\brand\naigai-niangao\source\output\screenshots\debug_douyin.png")
    print("\nScreenshot saved")

    context.close()
