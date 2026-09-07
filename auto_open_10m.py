import os
import sys
import time
import webbrowser
import urllib.request
from datetime import datetime

# URLs to target
PUBLIC_URL = "https://profits-latex-undefined-occasion.trycloudflare.com"
LOCAL_URL = "http://localhost:8000"
INTERVAL_SECONDS = 10 * 60  # 10 minutes (600 seconds)

def run():
    print("=" * 60)
    print("  Swarify — 10-Minute Auto-Opener & Keep-Alive Tool")
    print(f"  Target Website: {PUBLIC_URL}")
    print(f"  Local Address:  {LOCAL_URL}")
    print(f"  Cadence:        Every 10 minutes ({INTERVAL_SECONDS}s)")
    print("=" * 60)
    print("Running in background... Press Ctrl+C anytime to stop.\n")

    count = 1
    while True:
        timestamp = datetime.now().strftime("%I:%M:%S %p")
        print(f"[{timestamp}] Trigger #{count}: Opening Swarify website...")

        # 1. Open the website in the default browser
        try:
            # First check if public URL responds, fallback to local URL if offline
            target = PUBLIC_URL
            try:
                with urllib.request.urlopen(PUBLIC_URL, timeout=4) as resp:
                    if resp.status != 200:
                        target = LOCAL_URL
            except Exception:
                target = LOCAL_URL

            webbrowser.open(target)
            print(f"  [✓] Opened in browser: {target}")
        except Exception as err:
            print(f"  [!] Browser open error: {err}")

        # 2. Ping local server to keep it active and warm in memory
        try:
            with urllib.request.urlopen(LOCAL_URL, timeout=5) as local_resp:
                print(f"  [✓] Local server ping: HTTP {local_resp.status} (Active)")
        except Exception as ping_err:
            print(f"  [!] Server ping note: {ping_err}")

        count += 1
        print(f"Sleeping for 10 minutes until next open...\n")
        time.sleep(INTERVAL_SECONDS)

if __name__ == "__main__":
    try:
        run()
    except KeyboardInterrupt:
        print("\nAuto-opener stopped by user.")
        sys.exit(0)
