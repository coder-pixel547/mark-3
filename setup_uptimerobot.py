import os
import sys
import json
import urllib.request
import urllib.parse

PUBLIC_URL = "https://graphic-wave-said-effort.trycloudflare.com"

def create_monitor(api_key: str, friendly_name: str = "Swarify Music Stream", url: str = PUBLIC_URL):
    api_endpoint = "https://api.uptimerobot.com/v2/newMonitor"
    
    payload = {
        "api_key": api_key.strip(),
        "format": "json",
        "type": "1",          # 1 = HTTP(s)
        "url": url.strip(),
        "friendly_name": friendly_name,
        "interval": "300"      # 300 seconds = 5 minutes
    }
    
    data = urllib.parse.urlencode(payload).encode("utf-8")
    req = urllib.request.Request(
        api_endpoint,
        data=data,
        headers={
            "content-type": "application/x-www-form-urlencoded",
            "cache-control": "no-cache"
        }
    )
    
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            res_data = json.loads(resp.read().decode("utf-8"))
            if res_data.get("stat") == "ok":
                monitor = res_data.get("monitor", {})
                print("[SUCCESS] UptimeRobot monitor created successfully!")
                print(f"  Monitor ID:   {monitor.get('id')}")
                print(f"  Name:         {friendly_name}")
                print(f"  URL:          {url}")
                print("  Interval:     Every 5 minutes (300 seconds)")
                return True
            else:
                print(f"[ERROR] UptimeRobot API returned error: {res_data}")
                return False
    except Exception as e:
        print(f"[ERROR] Failed to connect to UptimeRobot API: {e}")
        return False

if __name__ == "__main__":
    key = sys.argv[1] if len(sys.argv) > 1 else input("Enter your UptimeRobot API Key: ")
    if key.strip():
        create_monitor(key.strip())
    else:
        print("No API key provided.")
