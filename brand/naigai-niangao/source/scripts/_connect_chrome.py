"""Try to connect to existing Chrome via CDP"""
import os, sys, json, subprocess, time, re

# First, find the Chrome with the user data dir
user_data_dir = r"D:\AI\kzt\brand\naigai-niangao\source\.browser_data"

# Check if we can find Chrome's CDP endpoint
# The Chrome was started with --remote-debugging-pipe
# Let's try to find any Chrome with remote debugging port
result = subprocess.run(
    ['powershell', '-Command', 
     'Get-CimInstance Win32_Process -Filter "Name=\'chrome.exe\'" | Select-Object -ExpandProperty CommandLine'],
    capture_output=True, text=True, timeout=10
)

for line in result.stdout.strip().split('\n'):
    if 'remote-debugging-port=' in line.lower():
        m = re.search(r'--remote-debugging-port=(\d+)', line)
        if m:
            port = m.group(1)
            print(f"FOUND CDP port: {port}")
            sys.exit(0)

if user_data_dir.replace('\\', '/') in result.stdout.replace('\\\\', '\\'):
    print("Found Chrome with matching user data dir")
    
# Check if any debug port files exist
debug_file = os.path.join(user_data_dir, 'chrome_debug.log')
if os.path.exists(debug_file):
    with open(debug_file) as f:
        content = f.read()
        m = re.search(r'port (\d+)', content)
        if m:
            print(f"Debug port from log: {m.group(1)}")

print("No remote debugging port found on existing Chrome")
print("Will need to restart with new Chrome instance")
