import os
import sys
import time
import webbrowser
import urllib.request
from datetime import datetime

# Configuration - Live Public Website ONLY (No localhost)
PUBLIC_URL = "https://friendship-testimony-transmitted-area.trycloudflare.com"
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
        print(line.encode('ascii', errors='replace').decode('ascii'), flush=True)

    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass

def run():
    log("=" * 60)
    log("  Swarify - 10-Minute Auto-Opener (Live Website ONLY)")
    log(f"  Target Website: {PUBLIC_URL}")
    log(f"  Cadence:        Every 10 minutes ({INTERVAL_SECONDS}s)")
    log(f"  Log File:       {LOG_FILE}")
    log("=" * 60)
    log("Running continuously in the background...\n")

    count = 1
    while True:
        log(f"Trigger #{count}: Automatically opening live website...")

        # 1. Open the live website in the default browser (ONLY public URL)
        try:
            webbrowser.open(PUBLIC_URL)
            log(f"  [OK] Successfully opened live website: {PUBLIC_URL}")
        except Exception as err:
            log(f"  [!] Browser open error: {err}")

        # 2. Ping live website to keep public tunnel active & warm
        try:
            req = urllib.request.Request(
                PUBLIC_URL,
                headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) SwarifyKeepAlive/1.0"}
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                log(f"  [OK] Live website ping: HTTP {resp.status} (Online & Active)")
        except Exception as ping_err:
            log(f"  [!] Live website ping note: {ping_err}")

        count += 1
        log("Sleeping for 10 minutes until next automatic open...\n")
        time.sleep(INTERVAL_SECONDS)

if __name__ == "__main__":
    try:
        run()
    except KeyboardInterrupt:
        log("Auto-opener stopped by user.")
        sys.exit(0)

