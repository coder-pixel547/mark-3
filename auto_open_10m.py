import os
import sys
import time
import webbrowser
import urllib.request
from datetime import datetime

# Configuration
PUBLIC_URL = "https://graphic-wave-said-effort.trycloudflare.com"
LOCAL_URL = "http://localhost:8000"
INTERVAL_SECONDS = 10 * 60  # 10 minutes (600 seconds)
LOG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "auto_open.log")

# Force UTF-8 on Windows console if supported
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

def log(message: str):
    timestamp = datetime.now().strftime("%Y-%m-%d %I:%M:%S %p")
    line = f"[{timestamp}] {message}"
    try:
        print(line, flush=True)
    except Exception:
        # Fallback to ascii safe print
        print(line.encode('ascii', errors='replace').decode('ascii'), flush=True)

    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass

def run():
    log("=" * 60)
    log("  Swarify - 10-Minute Auto-Opener & Keep-Alive Started")
    log(f"  Target Website: {PUBLIC_URL}")
    log(f"  Local Address:  {LOCAL_URL}")
    log(f"  Cadence:        Every 10 minutes ({INTERVAL_SECONDS}s)")
    log(f"  Log File:       {LOG_FILE}")
    log("=" * 60)
    log("Running continuously in the background...\n")

    count = 1
    while True:
        log(f"Trigger #{count}: Automatically opening Swarify website...")

        # 1. Open the website in the default browser
        target = PUBLIC_URL
        try:
            req = urllib.request.Request(PUBLIC_URL, headers={"User-Agent": "SwarifyAutoOpener/1.0"})
            with urllib.request.urlopen(req, timeout=5) as resp:
                if resp.status == 200:
                    target = PUBLIC_URL
                else:
                    target = LOCAL_URL
        except Exception:
            target = LOCAL_URL

        try:
            webbrowser.open(target)
            log(f"  [OK] Successfully opened in browser: {target}")
        except Exception as err:
            log(f"  [!] Browser open error: {err}")

        # 2. Ping local server to keep backend alive & active in memory
        try:
            with urllib.request.urlopen(LOCAL_URL, timeout=5) as local_resp:
                log(f"  [OK] Local server ping: HTTP {local_resp.status} (Active)")
        except Exception as ping_err:
            log(f"  [!] Server ping note: {ping_err}")

        count += 1
        log("Sleeping for 10 minutes until next automatic open...\n")
        time.sleep(INTERVAL_SECONDS)

if __name__ == "__main__":
    try:
        run()
    except KeyboardInterrupt:
        log("Auto-opener stopped by user.")
        sys.exit(0)

