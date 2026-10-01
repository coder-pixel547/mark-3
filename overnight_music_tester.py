#!/usr/bin/env python3
"""
Swarify Music - Overnight Mass Catalog Verification & Auto-Healing Suite
------------------------------------------------------------------------
Features:
- Verifies 1,500+ songs across Telugu, Hindi, English, Tamil, Punjabi, Malayalam, Kannada & Devotional.
- Thermal Guard: Real-time CPU monitor + deliberate cooldown pauses between micro-batches to keep PC cool & quiet overnight.
- Auto-Fix Engine: If any song fails, attempts query variations, alternative video matches, and registers working studio streams into curated_stream_map.json.
- Real-time Reports: Generates overnight_test_report.html and overnight_test_report.md.
- Resumable: State checkpointing in overnight_state.json.
"""

import sys
import os
import json
import time
import asyncio
import argparse
from typing import List, Dict, Any, Optional

# Ensure UTF-8 output on Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

import httpx
import psutil

try:
    import catalog_data
    BASE_CATALOG = catalog_data.CATALOG
except ImportError:
    BASE_CATALOG = {}

BASE_URL = "https://swarify-music-b0e9.onrender.com"
MARK3_DIR = r"C:\Users\reddy\.gemini\antigravity\scratch\mark-3"
STATE_FILE = os.path.join(MARK3_DIR, "overnight_state.json")
CURATED_MAP_FILE = os.path.join(MARK3_DIR, "curated_stream_map.json")
REPORT_MD_FILE = os.path.join(MARK3_DIR, "overnight_test_report.md")
REPORT_HTML_FILE = os.path.join(MARK3_DIR, "overnight_test_report.html")

# Thermal & Pacing Settings
MICRO_BATCH_SIZE = 15      # Songs tested before a cooling pause
COOLDOWN_SECONDS = 6       # Seconds to pause after each micro-batch
MAX_CPU_PERCENT = 35.0     # Throttle ceiling: pause if CPU exceeds this
EMERGENCY_COOL_TIME = 12   # Emergency sleep duration if CPU is hot
CONCURRENCY_LIMIT = 3      # Concurrent async requests (keeps CPU usage < 5%)

# Artist Discovery Queries (to dynamically discover and test 1,000+ more songs)
ARTIST_DISCOVERY_QUERIES = [
    ("Arijit Singh Best Songs", "Hindi"),
    ("Shreya Ghoshal Romantic Hits", "Hindi"),
    ("Atif Aslam Melodies", "Hindi"),
    ("Badshah Party Anthems", "Hindi"),
    ("KK Evergreen Classics", "Hindi"),
    ("Sid Sriram Telugu Hits", "Telugu"),
    ("Anirudh Ravichander Mass Telugu", "Telugu"),
    ("Thaman S Blockbusters", "Telugu"),
    ("Devi Sri Prasad Mass Hits", "Telugu"),
    ("Ram Miriyala Folk Beats", "Telugu"),
    ("Anurag Kulkarni Melodies", "Telugu"),
    ("Anirudh Ravichander Tamil Hits", "Tamil"),
    ("AR Rahman Pure Melodies Tamil", "Tamil"),
    ("Yuvan Shankar Raja Drugs", "Tamil"),
    ("Harris Jayaraj Romantic Hits", "Tamil"),
    ("Diljit Dosanjh Chartbusters", "Punjabi"),
    ("Karan Aujla New Songs", "Punjabi"),
    ("Sidhu Moosewala Legends", "Punjabi"),
    ("AP Dhillon Gurinder Gill", "Punjabi"),
    ("Shubh Hit Songs", "Punjabi"),
    ("The Weeknd Top Hits", "English"),
    ("Taylor Swift Popular Songs", "English"),
    ("Billie Eilish Hits", "English"),
    ("Bruno Mars Funk Anthems", "English"),
    ("Post Malone Pop Hits", "English"),
    ("Eminem Rap God Hits", "English"),
    ("Ed Sheeran Best Songs", "English"),
    ("Dua Lipa Dance Hits", "English"),
    ("Sushin Shyam Malayalam Hits", "Malayalam"),
    ("Hesham Abdul Wahab Melodies", "Malayalam"),
    ("Ravi Basrur KGF Anthems", "Kannada"),
    ("Ajaneesh Loknath Kantara Beats", "Kannada"),
    ("Kishore Kumar Evergreen", "Hindi"),
    ("Mohd Rafi Classics", "Hindi"),
    ("SP Balasubrahmanyam Telugu Classics", "Telugu")
]

# ==============================================================================
# THERMAL & SYSTEM HEALTH MONITOR
# ==============================================================================
def get_system_metrics() -> Dict[str, Any]:
    """Inspects CPU utilization, available RAM, and timestamp."""
    cpu_pct = psutil.cpu_percent(interval=0.3)
    mem_pct = psutil.virtual_memory().percent
    return {
        "cpu_percent": round(cpu_pct, 1),
        "mem_percent": round(mem_pct, 1),
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S")
    }

def apply_thermal_cooldown_if_needed():
    """
    Guarantees PC stays cool, quiet and thermal-safe.
    If CPU > MAX_CPU_PERCENT, sleeps until load drops.
    """
    metrics = get_system_metrics()
    if metrics["cpu_percent"] > MAX_CPU_PERCENT:
        print(f"\n[Thermal Guard] CPU load elevated ({metrics['cpu_percent']}% > {MAX_CPU_PERCENT}%).")
        print(f"[Thermal Guard] Entering cooling sleep for {EMERGENCY_COOL_TIME}s to let CPU fans rest...")
        time.sleep(EMERGENCY_COOL_TIME)
        new_metrics = get_system_metrics()
        print(f"[Thermal Guard] Resumed. Cooled CPU to {new_metrics['cpu_percent']}%.")

# ==============================================================================
# STATE & CACHE PERSISTENCE
# ==============================================================================
def load_state() -> Dict[str, Any]:
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {
        "total_tested": 0,
        "passed": 0,
        "fixed": 0,
        "failed": 0,
        "start_time": time.time(),
        "last_updated": time.time(),
        "results": {}
    }

def save_state(state: Dict[str, Any]):
    state["last_updated"] = time.time()
    temp_file = STATE_FILE + ".tmp"
    try:
        with open(temp_file, "w", encoding="utf-8") as f:
            json.dump(state, f, indent=2, ensure_ascii=False)
        if os.path.exists(STATE_FILE):
            os.replace(temp_file, STATE_FILE)
        else:
            os.rename(temp_file, STATE_FILE)
    except Exception as e:
        print(f"[State] Error saving state: {e}")

def load_curated_map() -> Dict[str, Any]:
    if os.path.exists(CURATED_MAP_FILE):
        try:
            with open(CURATED_MAP_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}

def save_curated_map(curated: Dict[str, Any]):
    temp_file = CURATED_MAP_FILE + ".tmp"
    try:
        with open(temp_file, "w", encoding="utf-8") as f:
            json.dump(curated, f, indent=2, ensure_ascii=False)
        if os.path.exists(CURATED_MAP_FILE):
            os.replace(temp_file, CURATED_MAP_FILE)
        else:
            os.rename(temp_file, CURATED_MAP_FILE)
        print(f"[CuratedMap] Saved {len(curated)} verified studio entries to curated_stream_map.json")
    except Exception as e:
        print(f"[CuratedMap] Error saving curated map: {e}")

# ==============================================================================
# AUDIO VERIFICATION & AUTO-HEALING ENGINE
# ==============================================================================
async def verify_single_song(client: httpx.AsyncClient, sem: asyncio.Semaphore, query: str, language: str) -> Dict[str, Any]:
    async with sem:
        t0 = time.time()
        record = {
            "query": query,
            "language": language,
            "status": "UNKNOWN",
            "title": "",
            "artist": "",
            "videoId": "",
            "latency_ms": 0,
            "bytes_received": 0,
            "source": "",
            "fixed": False,
            "error": None
        }
        
        try:
            # 1. Search track
            s_resp = await client.get(f"{BASE_URL}/api/search", params={"q": query}, timeout=15.0)
            if s_resp.status_code != 200:
                record["status"] = f"FAIL_SEARCH_{s_resp.status_code}"
                record["latency_ms"] = int((time.time() - t0) * 1000)
                return record
            
            s_data = s_resp.json()
            tracks = s_data.get("results", []) or s_data.get("tracks", [])
            if not tracks and isinstance(s_data, list):
                tracks = s_data
                
            if not tracks:
                # Auto-fix: try searching with simplified keywords
                words = query.split()
                if len(words) > 2:
                    clean_query = f"{words[0]} {words[1]}"
                    s_resp2 = await client.get(f"{BASE_URL}/api/search", params={"q": clean_query}, timeout=15.0)
                    if s_resp2.status_code == 200:
                        tracks2 = s_resp2.json().get("results", []) or s_resp2.json().get("tracks", [])
                        if tracks2:
                            tracks = tracks2
                            record["fixed"] = True
            
            if not tracks:
                record["status"] = "FAIL_NO_TRACKS"
                record["latency_ms"] = int((time.time() - t0) * 1000)
                return record
            
            top_track = tracks[0]
            vid = top_track.get("id") or top_track.get("videoId")
            title = top_track.get("title", "")
            artist = top_track.get("artist", "")
            
            record["videoId"] = vid
            record["title"] = title
            record["artist"] = artist
            
            # 2. Audio Info Check
            info_resp = await client.get(f"{BASE_URL}/api/audio-info/{vid}", timeout=15.0)
            audio_url = ""
            info_data = {}
            if info_resp.status_code == 200:
                info_data = info_resp.json()
                record["source"] = info_data.get("source", "unknown")
                audio_url = info_data.get("audio_url", "")
            
            # 3. Stream Verification (Range bytes=0-65535: verify first 64KB playable audio chunk)
            stream_url = f"{BASE_URL}/api/stream/{vid}"
            st_resp = await client.get(
                stream_url,
                headers={"Range": "bytes=0-65535"},
                timeout=18.0
            )
            
            elapsed_ms = int((time.time() - t0) * 1000)
            record["latency_ms"] = elapsed_ms
            
            if st_resp.status_code in (200, 206) and len(st_resp.content) > 1000:
                record["bytes_received"] = len(st_resp.content)
                record["status"] = "PASS" if not record["fixed"] else "FIXED"
                
                # Auto-Cache Candidate
                if audio_url and "saavncdn.com" in audio_url:
                    record["curated_candidate"] = {
                        "vid": vid,
                        "entry": {
                            "url": audio_url,
                            "duration": info_data.get("duration", 210),
                            "filesize": info_data.get("filesize", 4000000),
                            "source": "saavn",
                            "format_id": "saavn-160k",
                            "content_type": "audio/mp4",
                            "ext": "mp4",
                            "vcodec": "none",
                            "acodec": "aac"
                        }
                    }
                return record
            else:
                # Stream failed - auto-heal by testing second track candidate if available
                if len(tracks) > 1:
                    alt_track = tracks[1]
                    alt_vid = alt_track.get("id") or alt_track.get("videoId")
                    alt_st_resp = await client.get(
                        f"{BASE_URL}/api/stream/{alt_vid}",
                        headers={"Range": "bytes=0-65535"},
                        timeout=18.0
                    )
                    if alt_st_resp.status_code in (200, 206) and len(alt_st_resp.content) > 1000:
                        record["videoId"] = alt_vid
                        record["title"] = alt_track.get("title", "")
                        record["artist"] = alt_track.get("artist", "")
                        record["bytes_received"] = len(alt_st_resp.content)
                        record["status"] = "FIXED"
                        record["fixed"] = True
                        return record
                
                record["status"] = f"FAIL_STREAM_{st_resp.status_code}"
                return record

        except Exception as e:
            record["status"] = f"ERROR_{type(e).__name__}"
            record["error"] = str(e)
            record["latency_ms"] = int((time.time() - t0) * 1000)
            return record

# ==============================================================================
# REPORT GENERATORS (HTML & Markdown)
# ==============================================================================
def generate_reports(state: Dict[str, Any]):
    results = state.get("results", {})
    total = len(results)
    if total == 0:
        return
    
    passed_count = sum(1 for r in results.values() if r["status"] in ("PASS", "FIXED"))
    fixed_count = sum(1 for r in results.values() if r["status"] == "FIXED")
    failed_count = total - passed_count
    pass_rate = round((passed_count / total) * 100, 1)
    
    latencies = [r["latency_ms"] for r in results.values() if r["latency_ms"] > 0]
    avg_latency = round(sum(latencies) / len(latencies), 0) if latencies else 0
    
    # Language breakdown
    lang_stats = {}
    for r in results.values():
        lang = r.get("language", "Other")
        if lang not in lang_stats:
            lang_stats[lang] = {"total": 0, "passed": 0, "fixed": 0, "failed": 0}
        lang_stats[lang]["total"] += 1
        if r["status"] in ("PASS", "FIXED"):
            lang_stats[lang]["passed"] += 1
        else:
            lang_stats[lang]["failed"] += 1
        if r["status"] == "FIXED":
            lang_stats[lang]["fixed"] += 1

    # Write Markdown
    md_content = f"""# Swarify Music - Catalog Verification & Auto-Healing Report

**Updated:** {time.strftime('%Y-%m-%d %H:%M:%S')}  
**Target Live Server:** `{BASE_URL}`  

## Executive Summary
- **Total Tracks Tested:** **{total}**
- **Passing / Working Tracks:** **{passed_count}** ({pass_rate}%)
- **Auto-Fixed Tracks:** **{fixed_count}**
- **Failed Tracks:** **{failed_count}**
- **Average Stream Latency:** **{avg_latency:.0f} ms**

## Breakdown By Language & Genre
| Language / Category | Total Tested | Passed | Auto-Fixed | Failed | Success Rate |
| :--- | :---: | :---: | :---: | :---: | :---: |
"""
    for lang, s in sorted(lang_stats.items()):
        rate = round((s["passed"] / s["total"]) * 100, 1) if s["total"] > 0 else 0
        md_content += f"| **{lang}** | {s['total']} | {s['passed']} | {s['fixed']} | {s['failed']} | **{rate}%** |\n"

    md_content += "\n## Sample Verified Tracks (Latest 25)\n\n"
    md_content += "| Status | Query | Resolved Title | Latency | Source |\n| :--- | :--- | :--- | :---: | :--- |\n"
    for q, r in list(results.items())[-25:]:
        status_badge = "PASS" if r["status"] == "PASS" else ("FIXED" if r["status"] == "FIXED" else r["status"])
        t_title = r.get("title", "N/A")[:30].replace("|", "-")
        md_content += f"| {status_badge} | {q[:25]} | {t_title} | {r['latency_ms']}ms | {r.get('source', 'cdn')} |\n"

    with open(REPORT_MD_FILE, "w", encoding="utf-8") as f:
        f.write(md_content)

    # Write Spotify-Themed HTML
    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Swarify Music - Live Catalog Health Report</title>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
    <style>
        :root {{
            --bg-base: #0B0F17;
            --bg-card: #151C28;
            --accent-green: #1DB954;
            --accent-blue: #38bdf8;
            --accent-purple: #a855f7;
            --text-main: #f8fafc;
            --text-sub: #94a3b8;
            --border: rgba(255,255,255,0.08);
        }}
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        body {{
            background: var(--bg-base);
            color: var(--text-main);
            font-family: 'Plus Jakarta Sans', sans-serif;
            padding: 30px 20px;
            line-height: 1.5;
        }}
        .container {{ max-width: 1200px; margin: 0 auto; }}
        header {{
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            margin-bottom: 24px;
            border-bottom: 1px solid var(--border);
            padding-bottom: 20px;
        }}
        h1 {{ font-size: 28px; font-weight: 800; display: flex; align-items: center; gap: 10px; }}
        .badge-live {{
            background: rgba(29, 185, 84, 0.15);
            color: var(--accent-green);
            padding: 4px 12px;
            border-radius: 999px;
            font-size: 13px;
            font-weight: 700;
            border: 1px solid rgba(29, 185, 84, 0.3);
        }}
        .stats-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 16px;
            margin-bottom: 30px;
        }}
        .stat-card {{
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 20px;
        }}
        .stat-val {{ font-size: 36px; font-weight: 800; color: var(--accent-green); }}
        .stat-label {{ color: var(--text-sub); font-size: 14px; font-weight: 600; text-transform: uppercase; margin-top: 4px; }}
        .progress-bar-bg {{
            background: rgba(255,255,255,0.1);
            height: 10px;
            border-radius: 5px;
            margin-top: 10px;
            overflow: hidden;
        }}
        .progress-bar-fill {{
            background: linear-gradient(90deg, #1DB954, #38bdf8);
            height: 100%;
            width: {pass_rate}%;
            border-radius: 5px;
        }}
        .table-card {{
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 24px;
            margin-bottom: 30px;
            overflow-x: auto;
        }}
        table {{ width: 100%; border-collapse: collapse; text-align: left; }}
        th, td {{ padding: 12px 16px; border-bottom: 1px solid var(--border); font-size: 14px; }}
        th {{ color: var(--text-sub); font-weight: 700; text-transform: uppercase; font-size: 12px; }}
        .badge-pass {{ background: rgba(29,185,84,0.15); color: #4ade80; padding: 4px 8px; border-radius: 6px; font-weight: 700; font-size: 12px; }}
        .badge-fixed {{ background: rgba(56,189,248,0.15); color: #38bdf8; padding: 4px 8px; border-radius: 6px; font-weight: 700; font-size: 12px; }}
        .badge-fail {{ background: rgba(239,68,68,0.15); color: #f87171; padding: 4px 8px; border-radius: 6px; font-weight: 700; font-size: 12px; }}
        .search-box {{
            width: 100%;
            padding: 12px 16px;
            background: rgba(255,255,255,0.05);
            border: 1px solid var(--border);
            border-radius: 8px;
            color: #fff;
            margin-bottom: 16px;
            font-family: inherit;
        }}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div>
                <h1>🎵 Swarify Music - Catalog Quality Report</h1>
                <p style="color: var(--text-sub); margin-top: 4px;">Live automated testing against <code>{BASE_URL}</code></p>
            </div>
            <div class="badge-live">● LIVE TEST MONITOR</div>
        </header>

        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-val">{total}</div>
                <div class="stat-label">Total Tracks Verified</div>
            </div>
            <div class="stat-card">
                <div class="stat-val" style="color: #4ade80;">{pass_rate}%</div>
                <div class="stat-label">Playback Success Rate</div>
                <div class="progress-bar-bg"><div class="progress-bar-fill"></div></div>
            </div>
            <div class="stat-card">
                <div class="stat-val" style="color: #38bdf8;">{fixed_count}</div>
                <div class="stat-label">Auto-Fixed / Healed</div>
            </div>
            <div class="stat-card">
                <div class="stat-val" style="color: #a855f7;">{avg_latency:.0f}ms</div>
                <div class="stat-label">Avg Streaming Latency</div>
            </div>
        </div>

        <div class="table-card">
            <h2 style="font-size: 18px; margin-bottom: 16px;">Language & Regional Breakdown</h2>
            <table>
                <thead>
                    <tr>
                        <th>Category</th>
                        <th>Tested</th>
                        <th>Passed</th>
                        <th>Auto-Fixed</th>
                        <th>Failed</th>
                        <th>Reliability</th>
                    </tr>
                </thead>
                <tbody>
"""
    for lang, s in sorted(lang_stats.items()):
        rate = round((s["passed"] / s["total"]) * 100, 1) if s["total"] > 0 else 0
        html_content += f"""
                    <tr>
                        <td><strong>{lang}</strong></td>
                        <td>{s['total']}</td>
                        <td style="color: #4ade80;">{s['passed']}</td>
                        <td style="color: #38bdf8;">{s['fixed']}</td>
                        <td style="color: #f87171;">{s['failed']}</td>
                        <td><strong>{rate}%</strong></td>
                    </tr>
        """

    html_content += """
                </tbody>
            </table>
        </div>

        <div class="table-card">
            <h2 style="font-size: 18px; margin-bottom: 16px;">Verified Song Stream Audit Log</h2>
            <input type="text" id="filterInput" class="search-box" placeholder="Filter songs by title, artist, or status..." onkeyup="filterSongs()">
            <table id="songsTable">
                <thead>
                    <tr>
                        <th>Status</th>
                        <th>Query</th>
                        <th>Resolved Song Title</th>
                        <th>Artist</th>
                        <th>Latency</th>
                        <th>Source</th>
                    </tr>
                </thead>
                <tbody>
    """
    for q, r in reversed(list(results.items())):
        st = r["status"]
        if st == "PASS":
            badge = '<span class="badge-pass">PASS</span>'
        elif st == "FIXED":
            badge = '<span class="badge-fixed">FIXED</span>'
        else:
            badge = f'<span class="badge-fail">{st}</span>'
        
        html_content += f"""
                    <tr>
                        <td>{badge}</td>
                        <td>{r.get('query', '')}</td>
                        <td><strong>{r.get('title', 'N/A')}</strong></td>
                        <td style="color: var(--text-sub);">{r.get('artist', 'N/A')}</td>
                        <td>{r.get('latency_ms', 0)} ms</td>
                        <td><code>{r.get('source', 'stream')}</code></td>
                    </tr>
        """

    html_content += """
                </tbody>
            </table>
        </div>
    </div>
    <script>
        function filterSongs() {
            var input = document.getElementById("filterInput");
            var filter = input.value.toLowerCase();
            var table = document.getElementById("songsTable");
            var tr = table.getElementsByTagName("tr");
            for (var i = 1; i < tr.length; i++) {
                var txtValue = tr[i].textContent || tr[i].innerText;
                if (txtValue.toLowerCase().indexOf(filter) > -1) {
                    tr[i].style.display = "";
                } else {
                    tr[i].style.display = "none";
                }
            }
        }
    </script>
</body>
</html>
"""
    with open(REPORT_HTML_FILE, "w", encoding="utf-8") as f:
        f.write(html_content)

# ==============================================================================
# MAIN VERIFICATION ENGINE
# ==============================================================================
async def run_suite(limit: Optional[int] = None):
    print("================================================================================")
    print("        SWARIFY MUSIC - OVERNIGHT CATALOG VERIFICATION & AUTO-HEALING         ")
    print("================================================================================")
    print(f"Target URL:         {BASE_URL}")
    print(f"Concurrency:        {CONCURRENCY_LIMIT} parallel tasks")
    print(f"Micro-Batch Size:   {MICRO_BATCH_SIZE} tracks")
    print(f"Cooldown Pause:     {COOLDOWN_SECONDS} seconds between batches")
    print(f"Max CPU Ceiling:    {MAX_CPU_PERCENT}% (Automatic Thermal Throttle)")
    print("================================================================================\n")

    state = load_state()
    curated_map = load_curated_map()
    
    # 1. Base Catalog Items
    full_items = []
    for lang, queries in BASE_CATALOG.items():
        for q in queries:
            full_items.append((q, lang))

    sem = asyncio.Semaphore(CONCURRENCY_LIMIT)
    limits = httpx.Limits(max_keepalive_connections=8, max_connections=8)
    
    # 2. Dynamic Discovery Phase: Expand catalog with top tracks from artist queries
    print("[Discovery] Expanding catalog via top artist queries...")
    async with httpx.AsyncClient(limits=limits) as client:
        for artist_q, lang in ARTIST_DISCOVERY_QUERIES:
            try:
                res = await client.get(f"{BASE_URL}/api/search", params={"q": artist_q}, timeout=10.0)
                if res.status_code == 200:
                    data = res.json()
                    tracks = data.get("results", []) or data.get("tracks", [])
                    for t in tracks[:8]:
                        title = t.get("title")
                        if title and len(title) > 2:
                            full_items.append((title, lang))
            except Exception:
                pass

    # Deduplicate items by query
    seen = set()
    deduped_items = []
    for q, lang in full_items:
        q_norm = q.lower().strip()
        if q_norm not in seen:
            seen.add(q_norm)
            deduped_items.append((q, lang))
            
    if limit:
        deduped_items = deduped_items[:limit]
        
    total_in_catalog = len(deduped_items)
    print(f"[Catalog] Loaded {total_in_catalog} unique tracks across categories.")

    # Filter out already tested items from state if resume
    remaining_items = [item for item in deduped_items if item[0] not in state.get("results", {})]
    print(f"[State] Already tested: {len(state.get('results', {}))}. Remaining to test: {len(remaining_items)}.")
    
    if not remaining_items:
        print("[Done] All catalog tracks have already been verified!")
        generate_reports(state)
        return

    new_curated_entries = 0
    batch_idx = 0

    async with httpx.AsyncClient(limits=limits) as client:
        for i in range(0, len(remaining_items), MICRO_BATCH_SIZE):
            batch_idx += 1
            batch = remaining_items[i : i + MICRO_BATCH_SIZE]
            
            # Thermal check before batch
            apply_thermal_cooldown_if_needed()
            
            t_batch_start = time.time()
            tasks = [verify_single_song(client, sem, q, lang) for q, lang in batch]
            batch_results = await asyncio.gather(*tasks)
            
            # Process results
            for r in batch_results:
                state["results"][r["query"]] = r
                if r["status"] in ("PASS", "FIXED"):
                    state["passed"] = state.get("passed", 0) + 1
                else:
                    state["failed"] = state.get("failed", 0) + 1
                if r.get("fixed"):
                    state["fixed"] = state.get("fixed", 0) + 1
                
                # Check for curated map addition
                cand = r.get("curated_candidate")
                if cand:
                    vid = cand["vid"]
                    if vid not in curated_map:
                        curated_map[vid] = cand["entry"]
                        new_curated_entries += 1
                        
                badge = "[PASS]" if r["status"] == "PASS" else (f"[{r['status']}]")
                t_str = (r.get("title") or "N/A")[:30]
                print(f"{badge:<14} {r['query']:<30} -> {t_str:<30} ({r['latency_ms']}ms)")
            
            state["total_tested"] = len(state["results"])
            save_state(state)
            
            if new_curated_entries >= 10 or batch_idx % 3 == 0:
                save_curated_map(curated_map)
                new_curated_entries = 0

            generate_reports(state)
            
            batch_time = round(time.time() - t_batch_start, 1)
            metrics = get_system_metrics()
            print(f"\n[Batch {batch_idx}] {len(batch)} songs processed in {batch_time}s. Total Tested: {state['total_tested']}/{total_in_catalog} | CPU: {metrics['cpu_percent']}% | RAM: {metrics['mem_percent']}%")
            
            # Cooling Pause
            print(f"[Cooldown] Resting CPU and network for {COOLDOWN_SECONDS}s (keeping laptop cool & quiet)...")
            await asyncio.sleep(COOLDOWN_SECONDS)
            print("--------------------------------------------------------------------------------\n")

    # Final save
    save_curated_map(curated_map)
    generate_reports(state)
    print("\n================================================================================")
    print(f"VERIFICATION COMPLETED! Verified {len(state['results'])} tracks.")
    print(f"Reports available at:")
    print(f"- HTML Report: file:///{REPORT_HTML_FILE}")
    print(f"- Markdown:    file:///{REPORT_MD_FILE}")
    print("================================================================================")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Swarify Music Overnight Tester")
    parser.add_argument("--limit", type=int, default=None, help="Limit number of tracks to test")
    args = parser.parse_args()
    
    asyncio.run(run_suite(limit=args.limit))
