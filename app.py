import os
import re
import json
import time
import urllib.parse
import urllib.request
from typing import List, Dict, Any, Optional
import requests
import yt_dlp

from fastapi import FastAPI, Query, Request, HTTPException
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="MARK 3 Music", description="Spotify-style Ad-Free Background Music Streaming API", version="3.2")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory caches
SEARCH_CACHE: Dict[str, Dict[str, Any]] = {}
AUDIO_URL_CACHE: Dict[str, Dict[str, Any]] = {}
CACHE_TTL = 3600  # 1 hour
AUDIO_CACHE_TTL = 14400  # 4 hours

# 100% Tested & Verified High-Definition Catalog (Telugu, Hindi, English)
CURATED_TRACKS = {
    "telugu": [
        {
            "id": "g44VQxMcFH4",
            "title": "Fear Song — Devara Part 1",
            "artist": "Anirudh Ravichander, NTR",
            "duration": "2:46",
            "language": "telugu",
            "album": "Devara",
            "thumbnail": "https://i.ytimg.com/vi/g44VQxMcFH4/hqdefault.jpg"
        },
        {
            "id": "_0ak7rWPlmU",
            "title": "Chuttamalle — Devara Part 1",
            "artist": "Shilpa Rao, Anirudh Ravichander",
            "duration": "3:37",
            "language": "telugu",
            "album": "Devara",
            "thumbnail": "https://i.ytimg.com/vi/_0ak7rWPlmU/hqdefault.jpg"
        },
        {
            "id": "ybBg6V6ZErc",
            "title": "Samajavaragamana — Ala Vaikunthapurramuloo",
            "artist": "Sid Sriram, Thaman S",
            "duration": "4:34",
            "language": "telugu",
            "album": "Ala Vaikunthapurramuloo",
            "thumbnail": "https://i.ytimg.com/vi/ybBg6V6ZErc/hqdefault.jpg"
        },
        {
            "id": "2mDCVzruYzQ",
            "title": "Butta Bomma — Ala Vaikunthapurramuloo",
            "artist": "Armaan Malik, Thaman S",
            "duration": "3:18",
            "language": "telugu",
            "album": "Ala Vaikunthapurramuloo",
            "thumbnail": "https://i.ytimg.com/vi/2mDCVzruYzQ/hqdefault.jpg"
        },
        {
            "id": "EdvydlHCViY",
            "title": "Pushpa Pushpa — Pushpa 2 The Rule",
            "artist": "Devi Sri Prasad, Allu Arjun",
            "duration": "4:16",
            "language": "telugu",
            "album": "Pushpa 2",
            "thumbnail": "https://i.ytimg.com/vi/EdvydlHCViY/hqdefault.jpg"
        },
        {
            "id": "LH6c2bTM8p0",
            "title": "Sooseki (The Couple Song) — Pushpa 2",
            "artist": "Shreya Ghoshal, Devi Sri Prasad",
            "duration": "4:20",
            "language": "telugu",
            "album": "Pushpa 2",
            "thumbnail": "https://i.ytimg.com/vi/LH6c2bTM8p0/hqdefault.jpg"
        },
        {
            "id": "4_eEgJhsBMo",
            "title": "Naatu Naatu — RRR",
            "artist": "Rahul Sipligunj, Kaala Bhairava, MM Keeravani",
            "duration": "3:34",
            "language": "telugu",
            "album": "RRR",
            "thumbnail": "https://i.ytimg.com/vi/4_eEgJhsBMo/hqdefault.jpg"
        },
        {
            "id": "LPeZOE8ZIHI",
            "title": "Inkem Inkem Inkem Kaavaale — Geetha Govindam",
            "artist": "Sid Sriram, Gopi Sundar",
            "duration": "4:28",
            "language": "telugu",
            "album": "Geetha Govindam",
            "thumbnail": "https://i.ytimg.com/vi/LPeZOE8ZIHI/hqdefault.jpg"
        },
        {
            "id": "Bg8Yb9zGYyA",
            "title": "Ramuloo Ramulaa — Ala Vaikunthapurramuloo",
            "artist": "Anurag Kulkarni, Mangli",
            "duration": "4:10",
            "language": "telugu",
            "album": "Ala Vaikunthapurramuloo",
            "thumbnail": "https://i.ytimg.com/vi/Bg8Yb9zGYyA/hqdefault.jpg"
        },
        {
            "id": "u_wB6byrl5k",
            "title": "Oo Antava Mava..Oo Oo Antava — Pushpa",
            "artist": "Indravathi Chauhan, Devi Sri Prasad",
            "duration": "3:48",
            "language": "telugu",
            "album": "Pushpa: The Rise",
            "thumbnail": "https://i.ytimg.com/vi/u_wB6byrl5k/hqdefault.jpg"
        }
    ],
    "hindi": [
        {
            "id": "LIHABJUqZ7s",
            "title": "Kesariya — Brahmāstra",
            "artist": "Arijit Singh, Pritam",
            "duration": "4:28",
            "language": "hindi",
            "album": "Brahmāstra",
            "thumbnail": "https://i.ytimg.com/vi/LIHABJUqZ7s/hqdefault.jpg"
        },
        {
            "id": "Bi7sSC046dk",
            "title": "Chaleya — Jawan",
            "artist": "Arijit Singh, Shilpa Rao, Anirudh",
            "duration": "3:20",
            "language": "hindi",
            "album": "Jawan",
            "thumbnail": "https://i.ytimg.com/vi/Bi7sSC046dk/hqdefault.jpg"
        },
        {
            "id": "RLzC55ai0eo",
            "title": "Heeriye — Jasleen Royal feat. Arijit Singh",
            "artist": "Arijit Singh, Jasleen Royal",
            "duration": "3:14",
            "language": "hindi",
            "album": "Heeriye",
            "thumbnail": "https://i.ytimg.com/vi/RLzC55ai0eo/hqdefault.jpg"
        },
        {
            "id": "IJq0yyWug1k",
            "title": "Tum Hi Ho — Aashiqui 2",
            "artist": "Arijit Singh, Mithoon",
            "duration": "4:22",
            "language": "hindi",
            "album": "Aashiqui 2",
            "thumbnail": "https://i.ytimg.com/vi/IJq0yyWug1k/hqdefault.jpg"
        },
        {
            "id": "ElZfdU54Cp8",
            "title": "Apna Bana Le — Bhediya",
            "artist": "Arijit Singh, Sachin-Jigar",
            "duration": "4:21",
            "language": "hindi",
            "album": "Bhediya",
            "thumbnail": "https://i.ytimg.com/vi/ElZfdU54Cp8/hqdefault.jpg"
        },
        {
            "id": "V8zXLMIjlcw",
            "title": "O Maahi — Dunki",
            "artist": "Arijit Singh, Pritam",
            "duration": "3:53",
            "language": "hindi",
            "album": "Dunki",
            "thumbnail": "https://i.ytimg.com/vi/V8zXLMIjlcw/hqdefault.jpg"
        },
        {
            "id": "QKMTreKTpug",
            "title": "Pehle Bhi Main — Animal",
            "artist": "Vishal Mishra, Harshavardhan Rameshwar",
            "duration": "4:10",
            "language": "hindi",
            "album": "Animal",
            "thumbnail": "https://i.ytimg.com/vi/QKMTreKTpug/hqdefault.jpg"
        },
        {
            "id": "gvyUuxdRdR4",
            "title": "Raataan Lambiyan — Shershaah",
            "artist": "Jubin Nautiyal, Asees Kaur, Tanishk Bagchi",
            "duration": "3:50",
            "language": "hindi",
            "album": "Shershaah",
            "thumbnail": "https://i.ytimg.com/vi/gvyUuxdRdR4/hqdefault.jpg"
        },
        {
            "id": "muxtRRMmyhc",
            "title": "Shayad — Love Aaj Kal",
            "artist": "Arijit Singh, Pritam",
            "duration": "4:07",
            "language": "hindi",
            "album": "Love Aaj Kal",
            "thumbnail": "https://i.ytimg.com/vi/muxtRRMmyhc/hqdefault.jpg"
        },
        {
            "id": "WCShpiJ6SLU",
            "title": "Tere Pyaar Mein — Tu Jhoothi Main Makkaar",
            "artist": "Arijit Singh, Nikhita Gandhi, Pritam",
            "duration": "4:26",
            "language": "hindi",
            "album": "Tu Jhoothi Main Makkaar",
            "thumbnail": "https://i.ytimg.com/vi/WCShpiJ6SLU/hqdefault.jpg"
        }
    ],
    "english": [
        {
            "id": "fHI8X4OXluQ",
            "title": "Blinding Lights",
            "artist": "The Weeknd",
            "duration": "3:20",
            "language": "english",
            "album": "After Hours",
            "thumbnail": "https://i.ytimg.com/vi/fHI8X4OXluQ/hqdefault.jpg"
        },
        {
            "id": "JGwWNGJdvx8",
            "title": "Shape of You",
            "artist": "Ed Sheeran",
            "duration": "3:53",
            "language": "english",
            "album": "÷ (Divide)",
            "thumbnail": "https://i.ytimg.com/vi/JGwWNGJdvx8/hqdefault.jpg"
        },
        {
            "id": "ic8j13piAhQ",
            "title": "Cruel Summer",
            "artist": "Taylor Swift",
            "duration": "2:58",
            "language": "english",
            "album": "Lover",
            "thumbnail": "https://i.ytimg.com/vi/ic8j13piAhQ/hqdefault.jpg"
        },
        {
            "id": "Qb8q4ijHk_M",
            "title": "Stay",
            "artist": "The Kid LAROI, Justin Bieber",
            "duration": "2:21",
            "language": "english",
            "album": "F*CK LOVE 3",
            "thumbnail": "https://i.ytimg.com/vi/Qb8q4ijHk_M/hqdefault.jpg"
        },
        {
            "id": "H5v3kku4y6Q",
            "title": "As It Was",
            "artist": "Harry Styles",
            "duration": "2:47",
            "language": "english",
            "album": "Harry's House",
            "thumbnail": "https://i.ytimg.com/vi/H5v3kku4y6Q/hqdefault.jpg"
        },
        {
            "id": "34Na4j8AVgA",
            "title": "Starboy",
            "artist": "The Weeknd feat. Daft Punk",
            "duration": "3:50",
            "language": "english",
            "album": "Starboy",
            "thumbnail": "https://i.ytimg.com/vi/34Na4j8AVgA/hqdefault.jpg"
        },
        {
            "id": "G7KNmW9a75Y",
            "title": "Flowers",
            "artist": "Miley Cyrus",
            "duration": "3:20",
            "language": "english",
            "album": "Endless Summer Vacation",
            "thumbnail": "https://i.ytimg.com/vi/G7KNmW9a75Y/hqdefault.jpg"
        },
        {
            "id": "7wtfhZwyrcc",
            "title": "Believer",
            "artist": "Imagine Dragons",
            "duration": "3:24",
            "language": "english",
            "album": "Evolve",
            "thumbnail": "https://i.ytimg.com/vi/7wtfhZwyrcc/hqdefault.jpg"
        },
        {
            "id": "TUVcZfQe-Kw",
            "title": "Levitating",
            "artist": "Dua Lipa",
            "duration": "3:23",
            "language": "english",
            "album": "Future Nostalgia",
            "thumbnail": "https://i.ytimg.com/vi/TUVcZfQe-Kw/hqdefault.jpg"
        },
        {
            "id": "eVli-tstM5E",
            "title": "Espresso",
            "artist": "Sabrina Carpenter",
            "duration": "2:55",
            "language": "english",
            "album": "Short n' Sweet",
            "thumbnail": "https://i.ytimg.com/vi/eVli-tstM5E/hqdefault.jpg"
        }
    ]
}

def clean_song_title(title: str) -> str:
    """Removes annoying tags like (Official Video), [4K], etc."""
    title = re.sub(r'[\(\[\{](Official\s*(Video|Audio|Music\s*Video|Lyrical|4K|HD)?|Full\s*Video|8K|Video\s*Song)[\)\]\}]', '', title, flags=re.IGNORECASE)
    title = re.sub(r'\s+', ' ', title).strip()
    return title

def get_direct_audio_url(video_id: str, search_query_hint: Optional[str] = None) -> Optional[str]:
    """Extracts direct audio stream URL with fast format resolution, auto-fallback, and caching."""
    if video_id in AUDIO_URL_CACHE:
        item = AUDIO_URL_CACHE[video_id]
        if time.time() - item["timestamp"] < AUDIO_CACHE_TTL:
            return item["url"]

    # Try fast audio extraction (format 140 is standard M4A audio)
    ydl_opts = {
        'format': '140/bestaudio[ext=m4a]/bestaudio/best',
        'quiet': True,
        'no_warnings': True,
        'skip_download': True
    }
    
    # 1. Try direct video ID
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
            url = info.get("url")
            if url:
                AUDIO_URL_CACHE[video_id] = {"timestamp": time.time(), "url": url}
                return url
    except Exception as e:
        print(f"Direct extract failed for {video_id}: {e}")

    # 2. Auto-fallback: search working audio if the specific video ID is blocked/unavailable
    try:
        fallback_query = search_query_hint or f"{video_id} audio song"
        fallback_opts = {
            'format': '140/bestaudio[ext=m4a]/bestaudio/best',
            'quiet': True,
            'no_warnings': True,
            'default_search': 'ytsearch1:',
            'skip_download': True
        }
        with yt_dlp.YoutubeDL(fallback_opts) as ydl:
            res = ydl.extract_info(f"ytsearch1:{fallback_query}", download=False)
            if res and 'entries' in res and len(res['entries']) > 0:
                entry = res['entries'][0]
                url = entry.get('url')
                if url:
                    AUDIO_URL_CACHE[video_id] = {"timestamp": time.time(), "url": url}
                    return url
    except Exception as ex:
        print(f"Fallback search failed for {video_id}: {ex}")

    return None

def search_youtube(query: str, max_results: int = 15) -> List[Dict[str, Any]]:
    cache_key = f"search:{query.strip().lower()}"
    if cache_key in SEARCH_CACHE:
        item = SEARCH_CACHE[cache_key]
        if time.time() - item["timestamp"] < CACHE_TTL:
            return item["data"]

    encoded = urllib.parse.quote(query)
    url = f"https://www.youtube.com/results?search_query={encoded}&sp=EgIQAQ%253D%253D"
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
        }
    )

    results = []
    try:
        with urllib.request.urlopen(req, timeout=6) as resp:
            html = resp.read().decode("utf-8", errors="ignore")

        match = re.search(r'ytInitialData\s*=\s*({.+?});</script>', html)
        if match:
            data = json.loads(match.group(1))
            contents = data.get("contents", {}).get("twoColumnSearchResultsRenderer", {}).get("primaryContents", {}).get("sectionListRenderer", {}).get("contents", [])
            for section in contents:
                items = section.get("itemSectionRenderer", {}).get("contents", [])
                for item in items:
                    if "videoRenderer" in item:
                        vr = item["videoRenderer"]
                        vid_id = vr.get("videoId")
                        raw_title = vr.get("title", {}).get("runs", [{}])[0].get("text", "")
                        channel = vr.get("ownerText", {}).get("runs", [{}])[0].get("text", "Unknown Artist")
                        duration = vr.get("lengthText", {}).get("simpleText", "3:30")
                        
                        if vid_id and raw_title:
                            clean_title = clean_song_title(raw_title)
                            results.append({
                                "id": vid_id,
                                "title": clean_title or raw_title,
                                "artist": channel,
                                "duration": duration,
                                "thumbnail": f"https://i.ytimg.com/vi/{vid_id}/hqdefault.jpg"
                            })
                        if len(results) >= max_results:
                            break
                if len(results) >= max_results:
                    break
    except Exception as e:
        print(f"Error scraping YouTube: {e}")

    if results:
        SEARCH_CACHE[cache_key] = {"timestamp": time.time(), "data": results}
    return results

@app.get("/api/trending")
def get_trending(lang: str = Query("all", description="telugu | hindi | english | all")):
    lang = lang.lower().strip()
    if lang == "all":
        all_tracks = []
        t = CURATED_TRACKS.get("telugu", [])
        h = CURATED_TRACKS.get("hindi", [])
        e = CURATED_TRACKS.get("english", [])
        max_len = max(len(t), len(h), len(e))
        for i in range(max_len):
            if i < len(t): all_tracks.append(t[i])
            if i < len(h): all_tracks.append(h[i])
            if i < len(e): all_tracks.append(e[i])
        return {"language": "all", "tracks": all_tracks}
    elif lang in CURATED_TRACKS:
        return {"language": lang, "tracks": CURATED_TRACKS[lang]}
    else:
        search_query = f"{lang} latest hit songs audio"
        tracks = search_youtube(search_query, max_results=12)
        return {"language": lang, "tracks": tracks}

@app.get("/api/search")
def search(q: str = Query(..., min_length=1, description="Search query for song, artist or album")):
    results = search_youtube(q)
    return {"query": q, "results": results}

@app.get("/api/suggestions")
def suggestions(q: str = Query(..., min_length=1)):
    encoded = urllib.parse.quote(q)
    url = f"https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&q={encoded}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=3) as resp:
            text = resp.read().decode("latin1")
            match = re.search(r'\[.*\]', text)
            if match:
                data = json.loads(match.group(0))
                if len(data) > 1 and isinstance(data[1], list):
                    sugs = [item[0] for item in data[1] if isinstance(item, list) and len(item) > 0]
                    return {"suggestions": sugs[:8]}
    except Exception as e:
        print("Suggestions error:", e)
MOOD_TITLES = {
    "romantic": ["Midnight Melodies", "Monsoon Romance", "Soulful Love Notes", "Golden Serenade"],
    "energetic": ["High Voltage Beats", "Mass Energy Surge", "Power Anthem Workout", "Adrenaline Rush"],
    "chill": ["Sunset Lo-Fi Chill", "Velvet Coffee Vibes", "Acoustic Breeze", "Late Night Drift"],
    "party": ["Dancefloor Blast", "Club Hit Explosion", "Desi Party Mash", "Non-Stop Groove"],
    "sad": ["Heartbreak Echoes", "Melancholy Rain", "Deep Solitude", "Emotional Strings"],
    "drive": ["Neon Highway Cruise", "Midnight Road Trip", "Night Drive Vibe", "Asphalt Drift"],
    "focus": ["Deep Focus Flow", "Instrumental Horizon", "Calm Mind Waves", "Study Beats"]
}

def generate_ai_playlist_logic(languages: List[str], mood: str, era: str = "latest", prompt: str = "", count: int = 12):
    import random
    mood = mood.lower().strip()
    clean_langs = [l.strip().lower() for l in languages if l.strip()]
    if not clean_langs:
        clean_langs = ["telugu"]

    mood_adj = random.choice(MOOD_TITLES.get(mood, ["Sound Journey", "Sonic Wave", "Vibe Horizon"]))
    if len(clean_langs) == 1:
        lang_cap = clean_langs[0].capitalize()
        if lang_cap == "Telugu": lang_cap = "Tollywood"
        elif lang_cap == "Hindi": lang_cap = "Bollywood"
        title = f"{lang_cap} {mood_adj}"
    elif len(clean_langs) == 2:
        title = f"{clean_langs[0].capitalize()} x {clean_langs[1].capitalize()}: {mood_adj}"
    else:
        title = f"Multi-Language {mood_adj}"

    desc = f"AI-crafted {mood} playlist across {', '.join([l.capitalize() for l in clean_langs])}"
    if prompt:
        desc += f" • Inspired by: {prompt}"

    tracks_per_lang = max(3, count // len(clean_langs) + 1)
    all_tracks = []
    seen_ids = set()

    for lang in clean_langs:
        era_term = ""
        if era == "latest": era_term = "2024 2025"
        elif era == "2010s": era_term = "2010s hits"
        elif era == "classics": era_term = "90s 2000s classics"

        query_parts = [lang, mood]
        if prompt:
            query_parts.append(prompt)
        if era_term:
            query_parts.append(era_term)
        query_parts.append("songs audio")
        
        search_q = " ".join(query_parts)
        results = search_youtube(search_q, max_results=tracks_per_lang + 2)
        
        for t in results:
            if t["id"] not in seen_ids:
                seen_ids.add(t["id"])
                t["language"] = lang
                all_tracks.append(t)
                if len(all_tracks) >= count * 2:
                    break

    if len(all_tracks) < count:
        for lang in clean_langs:
            for t in CURATED_TRACKS.get(lang, []):
                if t["id"] not in seen_ids:
                    seen_ids.add(t["id"])
                    all_tracks.append(t)

    random.shuffle(all_tracks)
    final_tracks = all_tracks[:count]

    return {
        "title": title,
        "description": desc,
        "languages": clean_langs,
        "mood": mood,
        "era": era,
        "prompt": prompt,
        "tracks": final_tracks
    }

@app.post("/api/ai-playlist")
async def api_create_ai_playlist(request: Request):
    try:
        data = await request.json()
    except Exception:
        data = {}
    langs = data.get("languages", ["telugu", "hindi"])
    mood = data.get("mood", "romantic")
    era = data.get("era", "latest")
    prompt = data.get("prompt", "")
    count = int(data.get("count", 12))
    return generate_ai_playlist_logic(langs, mood, era, prompt, count)

@app.get("/api/ai-playlist")
def api_get_ai_playlist(
    langs: str = Query("telugu,hindi", description="Comma separated languages"),
    mood: str = Query("romantic"),
    era: str = Query("latest"),
    prompt: str = Query(""),
    count: int = Query(12)
):
    lang_list = [l.strip() for l in langs.split(",") if l.strip()]
    return generate_ai_playlist_logic(lang_list, mood, era, prompt, count)

@app.get("/api/audio-info/{video_id}")
def get_audio_info(video_id: str, title: Optional[str] = None):
    """Returns direct audio stream URL and proxied stream URL."""
    audio_url = get_direct_audio_url(video_id, title)
    if not audio_url:
        raise HTTPException(status_code=404, detail="Audio stream not found")
    return {
        "video_id": video_id,
        "audio_url": audio_url,
        "stream_url": f"/api/stream/{video_id}"
    }

@app.get("/api/stream/{video_id}")
def stream_audio(video_id: str, request: Request, title: Optional[str] = None):
    """Direct inline audio stream proxy with HTTP 206 Partial Content and Range headers."""
    audio_url = get_direct_audio_url(video_id, title)
    if not audio_url:
        raise HTTPException(status_code=404, detail="Audio stream not found")

    req_headers = {}
    range_header = request.headers.get("range")
    if range_header:
        req_headers["Range"] = range_header

    try:
        upstream_resp = requests.get(audio_url, headers=req_headers, stream=True, timeout=12)
        
        def iterfile():
            try:
                for chunk in upstream_resp.iter_content(chunk_size=64 * 1024):
                    if chunk:
                        yield chunk
            except Exception as ex:
                print(f"Stream iter error: {ex}")

        res_headers = {
            "Content-Type": upstream_resp.headers.get("Content-Type", "audio/mp4"),
            "Accept-Ranges": "bytes",
            "Content-Disposition": "inline",
            "Cache-Control": "public, max-age=7200",
        }
        if "Content-Range" in upstream_resp.headers:
            res_headers["Content-Range"] = upstream_resp.headers["Content-Range"]
        if "Content-Length" in upstream_resp.headers:
            res_headers["Content-Length"] = upstream_resp.headers["Content-Length"]

        return StreamingResponse(
            iterfile(),
            status_code=upstream_resp.status_code,
            headers=res_headers
        )
    except Exception as e:
        print(f"Streaming error for {video_id}: {e}")
        raise HTTPException(status_code=502, detail="Failed to stream audio")

# Serve static directory
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(STATIC_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.get("/")
def serve_index():
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "MARK 3 Music API is running."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
