import os
import re
import json
import time
import base64
import asyncio
import random
import urllib.parse
import urllib.request
from typing import List, Dict, Any, Optional

import requests
import httpx
import yt_dlp
from dotenv import load_dotenv

from fastapi import FastAPI, Query, Request, Response, HTTPException
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

# Load environment variables
load_dotenv()

app = FastAPI(
    title="Swarify Music",
    description="Spotify-style Ad-Free Background Music Streaming API with AI Playlist Generation",
    version="4.0"
)

# GZip compression for mobile network efficiency (compresses all responses > 500 bytes)
app.add_middleware(GZipMiddleware, minimum_size=500)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request performance & latency monitoring middleware
@app.middleware("http")
async def monitor_request_performance(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    if process_time > 1.0 and not request.url.path.startswith("/api/stream"):
        safe_log(f"[Slow Request] {request.method} {request.url.path} took {process_time:.2f}s")
    return response

# Safe console logging helper for Windows cp1252 character map safety
def safe_log(msg: str):
    try:
        print(msg, flush=True)
    except Exception:
        try:
            print(msg.encode('ascii', errors='replace').decode('ascii'), flush=True)
        except Exception:
            pass

from requests.adapters import HTTPAdapter

# Connection-pooled HTTP session for high-concurrency low-latency audio streaming
STREAM_SESSION = requests.Session()
_adapter = HTTPAdapter(pool_connections=50, pool_maxsize=50, max_retries=1)
STREAM_SESSION.mount("https://", _adapter)
STREAM_SESSION.mount("http://", _adapter)
STREAM_SESSION.cookies.set("geo", "103.211.230.1%2CIN%2CTelangana%2CHyderabad%2C500028", domain=".jiosaavn.com")
STREAM_SESSION.cookies.set("DL", "english", domain=".jiosaavn.com")
STREAM_SESSION.cookies.set("mm_latlong", "17.3843%2C78.4583", domain=".jiosaavn.com")

# In-memory caches with bounded size to prevent memory leaks in 24/7 deployments
SEARCH_CACHE: Dict[str, Dict[str, Any]] = {}
AUDIO_URL_CACHE: Dict[str, Dict[str, Any]] = {}
CACHE_TTL = 3600        # 1 hour
AUDIO_CACHE_TTL = 1800  # 30 minutes (direct URL cache TTL)
MAX_CACHE_ENTRIES = 500
MAX_TITLE_MAP_ENTRIES = 2000

def trim_cache_if_needed(cache_dict: dict, max_size: int = 500):
    """Evicts oldest 20% of entries when cache exceeds capacity."""
    if len(cache_dict) > max_size:
        num_to_evict = max(1, max_size // 5)
        for k in list(cache_dict.keys())[:num_to_evict]:
            cache_dict.pop(k, None)

# ==============================================================================
# Comprehensive 7-Language Curated Music Catalog
# Covering Telugu, Hindi, English, Tamil, Punjabi, Malayalam, and Kannada
# ==============================================================================
CURATED_TRACKS: Dict[str, List[Dict[str, Any]]] = {
    "telugu": [
        {
            "id": "g44VQxMcFH4",
            "videoId": "g44VQxMcFH4",
            "title": "Fear Song — Devara Part 1",
            "artist": "Anirudh Ravichander, NTR",
            "duration": "2:46",
            "language": "telugu",
            "album": "Devara",
            "thumbnail": "https://i.ytimg.com/vi/g44VQxMcFH4/hqdefault.jpg"
        },
        {
            "id": "_0ak7rWPlmU",
            "videoId": "_0ak7rWPlmU",
            "title": "Chuttamalle — Devara Part 1",
            "artist": "Shilpa Rao, Anirudh Ravichander",
            "duration": "3:37",
            "language": "telugu",
            "album": "Devara",
            "thumbnail": "https://i.ytimg.com/vi/_0ak7rWPlmU/hqdefault.jpg"
        },
        {
            "id": "ybBg6V6ZErc",
            "videoId": "ybBg6V6ZErc",
            "title": "Samajavaragamana — Ala Vaikunthapurramuloo",
            "artist": "Sid Sriram, Thaman S",
            "duration": "4:34",
            "language": "telugu",
            "album": "Ala Vaikunthapurramuloo",
            "thumbnail": "https://i.ytimg.com/vi/ybBg6V6ZErc/hqdefault.jpg"
        },
        {
            "id": "2mDCVzruYzQ",
            "videoId": "2mDCVzruYzQ",
            "title": "Butta Bomma — Ala Vaikunthapurramuloo",
            "artist": "Armaan Malik, Thaman S",
            "duration": "3:18",
            "language": "telugu",
            "album": "Ala Vaikunthapurramuloo",
            "thumbnail": "https://i.ytimg.com/vi/2mDCVzruYzQ/hqdefault.jpg"
        },
        {
            "id": "EdvydlHCViY",
            "videoId": "EdvydlHCViY",
            "title": "Pushpa Pushpa — Pushpa 2 The Rule",
            "artist": "Devi Sri Prasad, Allu Arjun",
            "duration": "4:16",
            "language": "telugu",
            "album": "Pushpa 2",
            "thumbnail": "https://i.ytimg.com/vi/EdvydlHCViY/hqdefault.jpg"
        },
        {
            "id": "LH6c2bTM8p0",
            "videoId": "LH6c2bTM8p0",
            "title": "Sooseki (The Couple Song) — Pushpa 2",
            "artist": "Shreya Ghoshal, Devi Sri Prasad",
            "duration": "4:20",
            "language": "telugu",
            "album": "Pushpa 2",
            "thumbnail": "https://i.ytimg.com/vi/LH6c2bTM8p0/hqdefault.jpg"
        },
        {
            "id": "4_eEgJhsBMo",
            "videoId": "4_eEgJhsBMo",
            "title": "Naatu Naatu — RRR",
            "artist": "Rahul Sipligunj, Kaala Bhairava, MM Keeravani",
            "duration": "3:34",
            "language": "telugu",
            "album": "RRR",
            "thumbnail": "https://i.ytimg.com/vi/4_eEgJhsBMo/hqdefault.jpg"
        },
        {
            "id": "LPeZOE8ZIHI",
            "videoId": "LPeZOE8ZIHI",
            "title": "Kurchi Madathapetti — Guntur Kaaram",
            "artist": "Sahithi Chaganti, Sri Krishna, Thaman S",
            "duration": "3:36",
            "language": "telugu",
            "album": "Guntur Kaaram",
            "thumbnail": "https://i.ytimg.com/vi/LPeZOE8ZIHI/hqdefault.jpg"
        },
        {
            "id": "dOKQeqGNJwY",
            "videoId": "dOKQeqGNJwY",
            "title": "Inthandham — Sita Ramam",
            "artist": "SPB Charan, Vishal Chandrashekhar",
            "duration": "3:39",
            "language": "telugu",
            "album": "Sita Ramam",
            "thumbnail": "https://i.ytimg.com/vi/dOKQeqGNJwY/hqdefault.jpg"
        },
        {
            "id": "gvyUuxdRdR4",
            "videoId": "gvyUuxdRdR4",
            "title": "Adiga Adiga — Ninnu Kori",
            "artist": "Sid Sriram, Gopi Sundar",
            "duration": "3:47",
            "language": "telugu",
            "album": "Ninnu Kori",
            "thumbnail": "https://i.ytimg.com/vi/gvyUuxdRdR4/hqdefault.jpg"
        }
    ],
    "hindi": [
        {
            "id": "BddP6PYo2gs",
            "videoId": "BddP6PYo2gs",
            "title": "Kesariya — Brahmāstra",
            "artist": "Arijit Singh, Pritam, Amitabh Bhattacharya",
            "duration": "4:28",
            "language": "hindi",
            "album": "Brahmāstra",
            "thumbnail": "https://i.ytimg.com/vi/BddP6PYo2gs/hqdefault.jpg"
        },
        {
            "id": "VAdGW7QDJiU",
            "videoId": "VAdGW7QDJiU",
            "title": "Chaleya — Jawan",
            "artist": "Arijit Singh, Shilpa Rao, Anirudh",
            "duration": "3:20",
            "language": "hindi",
            "album": "Jawan",
            "thumbnail": "https://i.ytimg.com/vi/VAdGW7QDJiU/hqdefault.jpg"
        },
        {
            "id": "RLzC55ai0eo",
            "videoId": "RLzC55ai0eo",
            "title": "Heeriye",
            "artist": "Jasleen Royal feat. Arijit Singh",
            "duration": "3:14",
            "language": "hindi",
            "album": "Heeriye Single",
            "thumbnail": "https://i.ytimg.com/vi/RLzC55ai0eo/hqdefault.jpg"
        },
        {
            "id": "Ax0G_P2dSBw",
            "videoId": "Ax0G_P2dSBw",
            "title": "Apna Bana Le — Bhediya",
            "artist": "Arijit Singh, Sachin-Jigar",
            "duration": "4:21",
            "language": "hindi",
            "album": "Bhediya",
            "thumbnail": "https://i.ytimg.com/vi/Ax0G_P2dSBw/hqdefault.jpg"
        },
        {
            "id": "gvyUuxdRdR4",
            "videoId": "gvyUuxdRdR4",
            "title": "Tum Hi Ho — Aashiqui 2",
            "artist": "Arijit Singh, Mithoon",
            "duration": "4:22",
            "language": "hindi",
            "album": "Aashiqui 2",
            "thumbnail": "https://i.ytimg.com/vi/gvyUuxdRdR4/hqdefault.jpg"
        },
        {
            "id": "V7LwfY5U5WI",
            "videoId": "V7LwfY5U5WI",
            "title": "Ranjha / Raataan Lambiyan — Shershaah",
            "artist": "B Praak, Jasleen Royal, Tanishk Bagchi",
            "duration": "3:50",
            "language": "hindi",
            "album": "Shershaah",
            "thumbnail": "https://i.ytimg.com/vi/V7LwfY5U5WI/hqdefault.jpg"
        },
        {
            "id": "kJQP7kiw5Fk",
            "videoId": "kJQP7kiw5Fk",
            "title": "Despacito (Hindi Tribute)",
            "artist": "Luis Fonsi, Daddy Yankee",
            "duration": "3:48",
            "language": "hindi",
            "album": "Global Hits",
            "thumbnail": "https://i.ytimg.com/vi/kJQP7kiw5Fk/hqdefault.jpg"
        }
    ],
    "english": [
        {
            "id": "4NRXx6U8ABQ",
            "videoId": "4NRXx6U8ABQ",
            "title": "Blinding Lights",
            "artist": "The Weeknd",
            "duration": "3:20",
            "language": "english",
            "album": "After Hours",
            "thumbnail": "https://i.ytimg.com/vi/4NRXx6U8ABQ/hqdefault.jpg"
        },
        {
            "id": "H5v3kku4y6Q",
            "videoId": "H5v3kku4y6Q",
            "title": "As It Was",
            "artist": "Harry Styles",
            "duration": "2:47",
            "language": "english",
            "album": "Harry's House",
            "thumbnail": "https://i.ytimg.com/vi/H5v3kku4y6Q/hqdefault.jpg"
        },
        {
            "id": "JGwWNGJdvx8",
            "videoId": "JGwWNGJdvx8",
            "title": "Shape of You",
            "artist": "Ed Sheeran",
            "duration": "3:53",
            "language": "english",
            "album": "÷ (Divide)",
            "thumbnail": "https://i.ytimg.com/vi/JGwWNGJdvx8/hqdefault.jpg"
        },
        {
            "id": "7wtfhZwyrcc",
            "videoId": "7wtfhZwyrcc",
            "title": "Believer",
            "artist": "Imagine Dragons",
            "duration": "3:24",
            "language": "english",
            "album": "Evolve",
            "thumbnail": "https://i.ytimg.com/vi/7wtfhZwyrcc/hqdefault.jpg"
        },
        {
            "id": "TUVcZfQe-Kw",
            "videoId": "TUVcZfQe-Kw",
            "title": "Levitating",
            "artist": "Dua Lipa",
            "duration": "3:23",
            "language": "english",
            "album": "Future Nostalgia",
            "thumbnail": "https://i.ytimg.com/vi/TUVcZfQe-Kw/hqdefault.jpg"
        },
        {
            "id": "eVli-tstM5E",
            "videoId": "eVli-tstM5E",
            "title": "Espresso",
            "artist": "Sabrina Carpenter",
            "duration": "2:55",
            "language": "english",
            "album": "Short n' Sweet",
            "thumbnail": "https://i.ytimg.com/vi/eVli-tstM5E/hqdefault.jpg"
        }
    ],
    "tamil": [
        {
            "id": "1F3hm6MfR1k",
            "videoId": "1F3hm6MfR1k",
            "title": "Hukum — Thalaivar Alappara (Jailer)",
            "artist": "Anirudh Ravichander, Super Subu",
            "duration": "3:27",
            "language": "tamil",
            "album": "Jailer",
            "thumbnail": "https://i.ytimg.com/vi/1F3hm6MfR1k/hqdefault.jpg"
        },
        {
            "id": "szvt1vD0Uug",
            "videoId": "szvt1vD0Uug",
            "title": "Naa Ready — Leo",
            "artist": "Thalapathy Vijay, Anirudh Ravichander, Asal Kolaar",
            "duration": "4:08",
            "language": "tamil",
            "album": "Leo",
            "thumbnail": "https://i.ytimg.com/vi/szvt1vD0Uug/hqdefault.jpg"
        },
        {
            "id": "KUN5Uf9mObQ",
            "videoId": "KUN5Uf9mObQ",
            "title": "Arabic Kuthu — Beast",
            "artist": "Anirudh Ravichander, Jonita Gandhi",
            "duration": "4:40",
            "language": "tamil",
            "album": "Beast",
            "thumbnail": "https://i.ytimg.com/vi/KUN5Uf9mObQ/hqdefault.jpg"
        },
        {
            "id": "eYq7WapuDLU",
            "videoId": "eYq7WapuDLU",
            "title": "Enjoy Enjaami",
            "artist": "Dhee ft. Arivu, Santhosh Narayanan",
            "duration": "4:13",
            "language": "tamil",
            "album": "Enjoy Enjaami",
            "thumbnail": "https://i.ytimg.com/vi/eYq7WapuDLU/hqdefault.jpg"
        },
        {
            "id": "x6Q7c9RyMzk",
            "videoId": "x6Q7c9RyMzk",
            "title": "Rowdy Baby — Maari 2",
            "artist": "Dhanush, Dhee, Yuvan Shankar Raja",
            "duration": "4:44",
            "language": "tamil",
            "album": "Maari 2",
            "thumbnail": "https://i.ytimg.com/vi/x6Q7c9RyMzk/hqdefault.jpg"
        }
    ],
    "punjabi": [
        {
            "id": "n_FCrCQ6-bA",
            "videoId": "n_FCrCQ6-bA",
            "title": "295 — Sidhu Moose Wala",
            "artist": "Sidhu Moose Wala, The Kidd",
            "duration": "4:30",
            "language": "punjabi",
            "album": "Moosetape",
            "thumbnail": "https://i.ytimg.com/vi/n_FCrCQ6-bA/hqdefault.jpg"
        },
        {
            "id": "VNs_cCtdbPc",
            "videoId": "VNs_cCtdbPc",
            "title": "Brown Munde",
            "artist": "AP Dhillon, Gurinder Gill, Shinda Kahlon",
            "duration": "4:28",
            "language": "punjabi",
            "album": "Brown Munde",
            "thumbnail": "https://i.ytimg.com/vi/VNs_cCtdbPc/hqdefault.jpg"
        },
        {
            "id": "vX2cDW8LUWk",
            "videoId": "vX2cDW8LUWk",
            "title": "Excuses",
            "artist": "AP Dhillon, Gurinder Gill, Intense",
            "duration": "2:56",
            "language": "punjabi",
            "album": "Excuses",
            "thumbnail": "https://i.ytimg.com/vi/vX2cDW8LUWk/hqdefault.jpg"
        },
        {
            "id": "5Eqb_-j3FDA",
            "videoId": "5Eqb_-j3FDA",
            "title": "Pasoori",
            "artist": "Ali Sethi, Shae Gill",
            "duration": "3:44",
            "language": "punjabi",
            "album": "Coke Studio Season 14",
            "thumbnail": "https://i.ytimg.com/vi/5Eqb_-j3FDA/hqdefault.jpg"
        },
        {
            "id": "cl0a3i2wFcc",
            "videoId": "cl0a3i2wFcc",
            "title": "Lover — Diljit Dosanjh",
            "artist": "Diljit Dosanjh, Intense",
            "duration": "3:12",
            "language": "punjabi",
            "album": "MoonChild Era",
            "thumbnail": "https://i.ytimg.com/vi/cl0a3i2wFcc/hqdefault.jpg"
        }
    ],
    "malayalam": [
        {
            "id": "tOM-nWPcR4U",
            "videoId": "tOM-nWPcR4U",
            "title": "Illuminati — Aavesham",
            "artist": "Sushin Shyam, Dabzee",
            "duration": "3:15",
            "language": "malayalam",
            "album": "Aavesham",
            "thumbnail": "https://i.ytimg.com/vi/tOM-nWPcR4U/hqdefault.jpg"
        },
        {
            "id": "_eWvDaztcjI",
            "videoId": "_eWvDaztcjI",
            "title": "Manavalan Thug — Thallumaala",
            "artist": "Dabzee, SA, Vishnu Vijay",
            "duration": "3:30",
            "language": "malayalam",
            "album": "Thallumaala",
            "thumbnail": "https://i.ytimg.com/vi/_eWvDaztcjI/hqdefault.jpg"
        },
        {
            "id": "k8NSnBnkFXM",
            "videoId": "k8NSnBnkFXM",
            "title": "Malare — Premam",
            "artist": "Vijay Yesudas, Rajesh Murugesan",
            "duration": "4:40",
            "language": "malayalam",
            "album": "Premam",
            "thumbnail": "https://i.ytimg.com/vi/k8NSnBnkFXM/hqdefault.jpg"
        },
        {
            "id": "epAFDEJImrU",
            "videoId": "epAFDEJImrU",
            "title": "Darshana — Hridayam",
            "artist": "Hesham Abdul Wahab, Darshana Rajendran",
            "duration": "3:52",
            "language": "malayalam",
            "album": "Hridayam",
            "thumbnail": "https://i.ytimg.com/vi/epAFDEJImrU/hqdefault.jpg"
        }
    ],
    "kannada": [
        {
            "id": "3XShkcOze3s",
            "videoId": "3XShkcOze3s",
            "title": "Singara Siriye — Kantara",
            "artist": "Vijay Prakash, Ananya Bhat, B. Ajaneesh Loknath",
            "duration": "4:42",
            "language": "kannada",
            "album": "Kantara",
            "thumbnail": "https://i.ytimg.com/vi/3XShkcOze3s/hqdefault.jpg"
        },
        {
            "id": "ixg5q75VsqI",
            "videoId": "ixg5q75VsqI",
            "title": "Ra Ra Rakkamma — Vikrant Rona",
            "artist": "Sunidhi Chauhan, Nakash Aziz, B. Ajaneesh Loknath",
            "duration": "3:40",
            "language": "kannada",
            "album": "Vikrant Rona",
            "thumbnail": "https://i.ytimg.com/vi/ixg5q75VsqI/hqdefault.jpg"
        },
        {
            "id": "gQXx1MhrQxE",
            "videoId": "gQXx1MhrQxE",
            "title": "Mehabooba — KGF Chapter 2",
            "artist": "Ananya Bhat, Ravi Basrur",
            "duration": "3:38",
            "language": "kannada",
            "album": "KGF Chapter 2",
            "thumbnail": "https://i.ytimg.com/vi/gQXx1MhrQxE/hqdefault.jpg"
        },
        {
            "id": "G_9IJlbCEs4",
            "videoId": "G_9IJlbCEs4",
            "title": "Dheera Dheera — KGF Chapter 1",
            "artist": "Ananya Bhat, Ravi Basrur",
            "duration": "3:42",
            "language": "kannada",
            "album": "KGF Chapter 1",
            "thumbnail": "https://i.ytimg.com/vi/G_9IJlbCEs4/hqdefault.jpg"
        }
    ]
}

# ==============================================================================
# Helper Functions: Duration Parsing, Title Sanitization & Validation
# ==============================================================================
def parse_duration_to_seconds(dur_str: Any) -> int:
    """Parses '3:45', '1:02:15', or integer to integer seconds."""
    if not dur_str:
        return 210
    if isinstance(dur_str, (int, float)):
        return int(dur_str)
    try:
        parts = [int(p) for p in str(dur_str).strip().split(':')]
        if len(parts) == 1:
            return parts[0]
        elif len(parts) == 2:
            return parts[0] * 60 + parts[1]
        elif len(parts) == 3:
            return parts[0] * 3600 + parts[1] * 60 + parts[2]
    except Exception:
        pass
    return 210

VIDEO_TITLE_MAP: Dict[str, str] = {}
VIDEO_INFO_MAP: Dict[str, Dict[str, Any]] = {}
for _lang, _track_list in CURATED_TRACKS.items():
    for _trk in _track_list:
        _tid = _trk.get("id") or _trk.get("videoId")
        if _tid:
            VIDEO_TITLE_MAP[_tid] = f"{_trk.get('title', '')} {_trk.get('artist', '')}".strip()
            VIDEO_INFO_MAP[_tid] = {
                "title": _trk.get("title", ""),
                "artist": _trk.get("artist", ""),
                "duration": parse_duration_to_seconds(_trk.get("duration")),
                "language": _lang
            }

def clean_song_title(title: str) -> str:
    """Removes annoying marketing tags like (Official Video), [4K], cast lists, etc."""
    if not title:
        return "Unknown Title"
    # Remove pipes and movie cast noise: "Song Name | Movie | Singer | Music Director"
    if "|" in title:
        segments = [s.strip() for s in title.split("|")]
        # Usually segment 0 or 1 is the actual song title
        title = segments[0]
    
    # Remove bracketed tags
    title = re.sub(
        r'[\(\[\{](Official\s*(Video|Audio|Music\s*Video|Lyrical|4K|HD|8K)?|Full\s*(Video|Song|Audio)|Video\s*Song|Lyrical\s*Video|Teaser|Trailer)[\)\]\}]',
        '',
        title,
        flags=re.IGNORECASE
    )
    # Remove hyphens at end
    title = re.sub(r'[-–—]\s*$', '', title).strip()
    title = re.sub(r'\s+', ' ', title).strip()
    return title or "Unknown Song"

def is_valid_song_track(title: str, duration_str: str) -> bool:
    """Filters out multi-hour jukeboxes, 1-hour loops, full albums, and trailers."""
    t_lower = title.lower()
    disallowed = [
        "jukebox", "audio jukebox", "full album", "non stop", "nonstop",
        "compilation", "all songs", "1 hour", "2 hour", "3 hour", "mega mix",
        "mashup 2024", "trailer", "teaser", "dialogue promo"
    ]
    if any(d in t_lower for d in disallowed):
        return False
    
    sec = parse_duration_to_seconds(duration_str)
    # Accept individual tracks between 50 seconds and 8 minutes (480s)
    if sec < 50 or sec > 480:
        return False
    
    return True

# ==============================================================================
# Async YouTube Scraper with Fallbacks and Concurrency
# ==============================================================================
async def async_search_youtube(
    query: str,
    max_results: int = 10,
    language_hint: str = "mix",
    filter_long: bool = True
) -> List[Dict[str, Any]]:
    """High-speed asynchronous YouTube search scraper with regex fallbacks and caching."""
    cache_key = f"search:{query.strip().lower()}"
    if cache_key in SEARCH_CACHE:
        item = SEARCH_CACHE[cache_key]
        if time.time() - item["timestamp"] < CACHE_TTL:
            return item["data"]

    encoded = urllib.parse.quote(query)
    url = f"https://www.youtube.com/results?search_query={encoded}&sp=EgIQAQ%253D%253D"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
    }

    results: List[Dict[str, Any]] = []

    try:
        async with httpx.AsyncClient(headers=headers, timeout=5.5, follow_redirects=True) as client:
            resp = await client.get(url)
            html = resp.text

        # Try multiple patterns for ytInitialData
        match = re.search(r'ytInitialData\s*=\s*({.+?});(?:</script>|var\s)', html)
        if not match:
            match = re.search(r'ytInitialData\s*=\s*({.+?});', html)

        if match:
            try:
                data = json.loads(match.group(1))
            except Exception:
                # Handle possible truncation in regex capture
                raw_json = match.group(1)
                last_brace = raw_json.rfind('}')
                if last_brace != -1:
                    data = json.loads(raw_json[:last_brace + 1])
                else:
                    data = {}

            contents = (
                data.get("contents", {})
                .get("twoColumnSearchResultsRenderer", {})
                .get("primaryContents", {})
                .get("sectionListRenderer", {})
                .get("contents", [])
            )

            for section in contents:
                items = section.get("itemSectionRenderer", {}).get("contents", [])
                for item in items:
                    if "videoRenderer" in item:
                        vr = item["videoRenderer"]
                        vid_id = vr.get("videoId")
                        raw_title = vr.get("title", {}).get("runs", [{}])[0].get("text", "")
                        channel = vr.get("ownerText", {}).get("runs", [{}])[0].get("text", "Official Audio")
                        duration = vr.get("lengthText", {}).get("simpleText", "3:30")

                        if vid_id and raw_title:
                            if filter_long and not is_valid_song_track(raw_title, duration):
                                continue

                            clean_title = clean_song_title(raw_title)
                            trim_cache_if_needed(VIDEO_TITLE_MAP, max_size=MAX_TITLE_MAP_ENTRIES)
                            VIDEO_TITLE_MAP[vid_id] = f"{clean_title} {channel}".strip()
                            results.append({
                                "id": vid_id,
                                "videoId": vid_id,
                                "title": clean_title,
                                "artist": channel,
                                "duration": duration,
                                "language": language_hint,
                                "thumbnail": f"https://i.ytimg.com/vi/{vid_id}/hqdefault.jpg"
                            })
                            if len(results) >= max_results:
                                break
                if len(results) >= max_results:
                    break
    except Exception as e:
        safe_log(f"Async YouTube scrape notice for '{query}': {e}")

    if results:
        trim_cache_if_needed(SEARCH_CACHE, max_size=MAX_CACHE_ENTRIES)
        SEARCH_CACHE[cache_key] = {"timestamp": time.time(), "data": results}
    return results

def search_youtube(query: str, max_results: int = 10) -> List[Dict[str, Any]]:
    """Synchronous wrapper for search_youtube used by legacy synchronous endpoints."""
    cache_key = f"search:{query.strip().lower()}"
    if cache_key in SEARCH_CACHE:
        item = SEARCH_CACHE[cache_key]
        if time.time() - item["timestamp"] < CACHE_TTL:
            return item["data"]
    try:
        return asyncio.run(async_search_youtube(query, max_results=max_results))
    except Exception:
        return []

# ==============================================================================
# High-Fidelity Direct Audio Stream Resolution (JioSaavn CDN + yt-dlp Fallback)
# ==============================================================================
def unpad_pkcs5(data: bytes) -> bytes:
    pad_len = data[-1]
    if 1 <= pad_len <= 8:
        return data[:-pad_len]
    return data

def extract_clean_queries(title: str, artist: Optional[str] = None) -> List[str]:
    # Strip marketing and format tags: (Official Music Video), [4K], etc.
    cleaned = re.sub(
        r'[\(\[\{](Official\s*(Video|Audio|Music\s*Video|Lyrical|4K|HD|8K)?|Full\s*(Video|Song|Audio)|Video\s*Song|Lyrical\s*Video|Teaser|Trailer|Audio|Lyrics|Visualizer)[\)\]\}]',
        '',
        title,
        flags=re.IGNORECASE
    )
    cleaned = re.sub(r'\(.*?\)|\[.*?\]', '', cleaned)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()

    queries = []
    if '|' in cleaned:
        parts = [p.strip() for p in cleaned.split('|') if p.strip()]
        if len(parts) >= 2:
            queries.append(f"{parts[0]} {parts[1]}")
            queries.append(parts[0])
        elif parts:
            queries.append(parts[0])

    if '-' in cleaned or '—' in cleaned:
        sep = '—' if '—' in cleaned else '-'
        hparts = [p.strip() for p in cleaned.split(sep) if p.strip()]
        if len(hparts) >= 2:
            queries.append(f"{hparts[0]} {hparts[1]}")
            queries.append(f"{hparts[1]} {hparts[0]}")
            queries.append(hparts[0])
            queries.append(hparts[1])

    queries.append(cleaned)
    if artist:
        no_art = re.sub(re.escape(artist), '', cleaned, flags=re.IGNORECASE).strip()
        if len(no_art) > 2:
            queries.append(no_art)

    clean_qs = []
    for q in queries:
        q_str = re.sub(r'^[\s\-–—]+|[\s\-–—]+$', '', q).strip()
        if len(q_str) > 2 and (not artist or q_str.lower() != artist.strip().lower()):
            clean_qs.append(q_str)

    return list(dict.fromkeys(clean_qs))

DISQUALIFIED_SAAVN_KEYWORDS = (
    'sped up', 'speed up', 'speedup', 'nightcore', 'slowed', 'reverb',
    'cover', 'karaoke', 'instrumental', 'tribute', 'tribute to',
    'remix', 'mashup', 'tik tok', 'tiktok', 'ringtone', 'status',
    'acoustic cover', 'chipmunk', 'lofi flip', 'lo-fi flip', '8d audio'
)

def resolve_saavn_stream(
    query: str,
    expected_duration: Optional[int] = None,
    expected_artist: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """
    Resolves high-quality direct audio stream (160kbps AAC / MP4) via JioSaavn CDN
    with strict validation against sped-up remixes, covers, wrong artists, and duration drift.
    """
    if not query or not query.strip():
        return None
    try:
        from Crypto.Cipher import DES
    except ImportError:
        return None

    queries_to_try = extract_clean_queries(query, artist=expected_artist)
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.jiosaavn.com/',
        'Cookie': 'geo=103.211.230.1%2CIN%2CTelangana%2CHyderabad%2C500028; DL=english; mm_latlong=17.3843%2C78.4583'
    }
    key = b'38346591'
    cipher = DES.new(key, DES.MODE_ECB)

    query_lower = query.lower()
    disqualified = [kw for kw in DISQUALIFIED_SAAVN_KEYWORDS if kw not in query_lower]

    for q in queries_to_try:
        encoded = urllib.parse.quote(q)

        # 1. First attempt: canonical autocomplete + song.getDetails (global index, bypasses regional catalog filtering)
        try:
            ac_url = f'https://www.jiosaavn.com/api.php?__call=autocomplete.get&_marker=0&query={encoded}&ctx=android&_format=json'
            ac_resp = STREAM_SESSION.get(ac_url, headers=headers, timeout=2.5)
            if ac_resp.status_code == 200:
                ac_songs = ac_resp.json().get('songs', {}).get('data', [])
                pids = [s.get('id') for s in ac_songs[:6] if s.get('id')]
                if pids:
                    pid_str = ','.join(pids)
                    det_url = f'https://www.jiosaavn.com/api.php?__call=song.getDetails&pids={pid_str}&_format=json'
                    det_resp = STREAM_SESSION.get(det_url, headers=headers, timeout=2.5)
                    if det_resp.status_code == 200:
                        det_data = det_resp.json()
                        ac_results = [det_data[pid] for pid in pids if pid in det_data]
                        for song in ac_results:
                            song_title = (song.get('song') or '').strip().lower()
                            song_artist = (song.get('primary_artists') or song.get('singers') or song.get('music') or '').strip().lower()
                            song_dur = int(song.get('duration') or 0)

                            if any(kw in song_title for kw in disqualified):
                                continue
                            if expected_duration and expected_duration > 30 and song_dur > 0:
                                if abs(song_dur - expected_duration) > 18:
                                    continue
                            if expected_artist:
                                exp_artist_clean = expected_artist.lower().strip()
                                if exp_artist_clean not in song_artist and song_artist not in exp_artist_clean:
                                    exp_tokens = [tok for tok in exp_artist_clean.split() if len(tok) > 2]
                                    if exp_tokens and not any(tok in song_artist for tok in exp_tokens):
                                        continue
                            clean_title_toks = [t for t in re.sub(r'[^a-zA-Z0-9\s]', '', song_title).split() if len(t) > 2]
                            if clean_title_toks:
                                if not any(t in query_lower for t in clean_title_toks):
                                    continue

                            enc_url = song.get('encrypted_media_url')
                            if not enc_url:
                                continue
                            try:
                                dec = unpad_pkcs5(cipher.decrypt(base64.b64decode(enc_url))).decode('utf-8')
                                url_160 = dec.replace('_96.mp4', '_160.mp4').replace('_320.mp4', '_160.mp4')
                                head_resp = STREAM_SESSION.head(url_160, timeout=2.5)
                                if head_resp.status_code == 200:
                                    filesize = None
                                    try:
                                        filesize = int(head_resp.headers.get("Content-Length", 0))
                                    except Exception:
                                        pass
                                    duration = song_dur or None
                                    safe_log(f"[Saavn Stream Validated (Autocomplete)] query='{q}' song='{song.get('song')}' artist='{song.get('primary_artists')}' dur={duration} size={filesize}")
                                    return {
                                        "url": url_160,
                                        "headers": {},
                                        "format_id": "saavn-160k",
                                        "content_type": "audio/mp4",
                                        "duration": duration,
                                        "filesize": filesize,
                                        "ext": "mp4",
                                        "vcodec": "none",
                                        "acodec": "aac",
                                        "source": "saavn",
                                        "timestamp": time.time()
                                    }
                            except Exception:
                                continue
        except Exception:
            pass

        # 2. Second attempt: search.getResults across android and web contexts
        for ctx in ('android', 'web6dot0'):
            try:
                url = f'https://www.jiosaavn.com/api.php?__call=search.getResults&_marker=0&q={encoded}&ctx={ctx}&_format=json&p=1&n=10&geo=in&country=in&cc=in'
                resp = STREAM_SESSION.get(url, headers=headers, timeout=3.0)
                if resp.status_code != 200:
                    continue
                data = resp.json()
                results = data.get('results', [])
                if not results:
                    continue

                for song in results:
                    song_title = (song.get('song') or '').strip().lower()
                    song_artist = (song.get('primary_artists') or song.get('singers') or song.get('music') or '').strip().lower()
                    song_dur = int(song.get('duration') or 0)

                    # 1. Reject sped-up, nightcore, slowed, covers, remixes (unless query specifically requests them)
                    if any(kw in song_title for kw in disqualified):
                        continue

                    # 2. Duration check: candidate must be within +/- 18 seconds of expected duration
                    if expected_duration and expected_duration > 30 and song_dur > 0:
                        if abs(song_dur - expected_duration) > 18:
                            continue

                    # 3. Artist check: if expected_artist is known, ensure compatibility
                    if expected_artist:
                        exp_artist_clean = expected_artist.lower().strip()
                        if exp_artist_clean not in song_artist and song_artist not in exp_artist_clean:
                            exp_tokens = [tok for tok in exp_artist_clean.split() if len(tok) > 2]
                            if exp_tokens and not any(tok in song_artist for tok in exp_tokens):
                                continue

                    # 4. Title relevance check: candidate song title must share keywords with query
                    clean_title_toks = [t for t in re.sub(r'[^a-zA-Z0-9\s]', '', song_title).split() if len(t) > 2]
                    if clean_title_toks:
                        if not any(t in query_lower for t in clean_title_toks):
                            continue

                    enc_url = song.get('encrypted_media_url')
                    if not enc_url:
                        continue
                    try:
                        dec = unpad_pkcs5(cipher.decrypt(base64.b64decode(enc_url))).decode('utf-8')
                        url_160 = dec.replace('_96.mp4', '_160.mp4').replace('_320.mp4', '_160.mp4')
                        head_resp = STREAM_SESSION.head(url_160, timeout=2.5)
                        if head_resp.status_code == 200:
                            filesize = None
                            try:
                                filesize = int(head_resp.headers.get("Content-Length", 0))
                            except Exception:
                                pass
                            duration = song_dur or None
                            safe_log(f"[Saavn Stream Validated] query='{q}' song='{song.get('song')}' artist='{song.get('primary_artists')}' dur={duration} size={filesize}")
                            return {
                                "url": url_160,
                                "headers": {},
                                "format_id": "saavn-160k",
                                "content_type": "audio/mp4",
                                "duration": duration,
                                "filesize": filesize,
                                "ext": "mp4",
                                "vcodec": "none",
                                "acodec": "aac",
                                "source": "saavn",
                                "timestamp": time.time()
                            }
                    except Exception:
                        continue
            except Exception:
                continue
    return None

AUDIO_FORMAT_SELECTOR = "140/251/bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio[acodec!=none][vcodec=none]/bestaudio"
YTDL_CLIENT_ARGS = {
    'youtube': {
        'player_client': ['visionos']
    }
}
COOKIE_FILE_PATH = os.path.join(os.path.dirname(__file__), "cookies.txt")
if not os.path.exists(COOKIE_FILE_PATH) and os.environ.get("YTDL_COOKIES"):
    try:
        with open(COOKIE_FILE_PATH, "w", encoding="utf-8") as cf:
            cf.write(os.environ["YTDL_COOKIES"])
    except Exception:
        pass

def get_audio_metadata(
    video_id: str,
    search_query_hint: Optional[str] = None,
    force_refresh: bool = False,
    expected_duration: Optional[int] = None,
    expected_artist: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """Extracts direct audio stream metadata with format fallback, caching, and diagnostics."""
    if not force_refresh and video_id in AUDIO_URL_CACHE:
        item = AUDIO_URL_CACHE[video_id]
        if time.time() - item["timestamp"] < AUDIO_CACHE_TTL:
            return item

    curated_info = VIDEO_INFO_MAP.get(video_id)
    if curated_info:
        if not expected_duration:
            expected_duration = curated_info.get("duration")
        if not expected_artist:
            expected_artist = curated_info.get("artist")

    # 1. Primary: High-fidelity direct CDN resolution via JioSaavn (immune to bot checks)
    query_hint = (search_query_hint or "").strip()
    if not query_hint:
        query_hint = VIDEO_TITLE_MAP.get(video_id, "")
    if not query_hint and curated_info:
        query_hint = f"{curated_info.get('title', '')} {curated_info.get('artist', '')}".strip()

    if not query_hint:
        try:
            oembed_url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
            oe_resp = STREAM_SESSION.get(oembed_url, timeout=2.5)
            if oe_resp.status_code == 200:
                oe_data = oe_resp.json()
                t = oe_data.get("title", "")
                a = oe_data.get("author_name", "")
                query_hint = f"{t} {a}".strip()
                if not expected_artist and a:
                    expected_artist = a
                if query_hint:
                    trim_cache_if_needed(VIDEO_TITLE_MAP, max_size=MAX_TITLE_MAP_ENTRIES)
                    VIDEO_TITLE_MAP[video_id] = query_hint
                    safe_log(f"[oEmbed Title Resolved] video_id={video_id} -> '{query_hint}'")
        except Exception:
            pass

    if query_hint:
        saavn_meta = resolve_saavn_stream(
            query_hint,
            expected_duration=expected_duration,
            expected_artist=expected_artist
        )
        if saavn_meta:
            trim_cache_if_needed(AUDIO_URL_CACHE, max_size=MAX_CACHE_ENTRIES)
            AUDIO_URL_CACHE[video_id] = saavn_meta
            return saavn_meta

    # 2. Secondary: pure audio extraction with visionos/android clients
    info = None
    primary_opts = {
        'format': AUDIO_FORMAT_SELECTOR,
        'quiet': True,
        'no_warnings': True,
        'skip_download': True,
        'noplaylist': True,
        'cachedir': False,
        'socket_timeout': 5,
        'extractor_retries': 0,
        'extractor_args': YTDL_CLIENT_ARGS,
    }
    try:
        with yt_dlp.YoutubeDL(primary_opts) as ydl:
            info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
    except Exception as e:
        safe_log(f"[yt-dlp primary failed] video_id={video_id}: {e}")
    finally:
        import gc; gc.collect()

    # Guard: verify pure audio (reject video streams which cause HTML5 <audio> to crash after 2-5s)
    if info and info.get("url"):
        vcodec = str(info.get("vcodec") or "none").lower()
        if vcodec != "none":
            safe_log(f"[Rejecting Video Stream] video_id={video_id} format={info.get('format_id')} vcodec={vcodec}")
            info = None

    # 3. Fallback: if throttled or primary yielded no direct URL, retry with fallback options
    if not info or not info.get("url"):
        safe_log(f"[yt-dlp fallback] attempting player_client fallback for video_id={video_id}")
        fallback_opts = {
            'format': AUDIO_FORMAT_SELECTOR,
            'quiet': True,
            'no_warnings': True,
            'skip_download': True,
            'noplaylist': True,
            'cachedir': False,
            'socket_timeout': 5,
            'extractor_retries': 0,
            'extractor_args': {'youtube': {'player_client': ['android', 'mweb']}},
        }
        try:
            with yt_dlp.YoutubeDL(fallback_opts) as ydl:
                info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
                if info and info.get("url"):
                    vcodec = str(info.get("vcodec") or "none").lower()
                    if vcodec != "none":
                        safe_log(f"[Rejecting Video Stream in Fallback] video_id={video_id} format={info.get('format_id')} vcodec={vcodec}")
                        info = None
        except Exception as ex:
            safe_log(f"[yt-dlp multi-client failed] video_id={video_id}: {ex}")
        finally:
            import gc; gc.collect()

    if info and info.get("url"):
        ext = info.get("ext", "m4a")
        raw_acodec = str(info.get("acodec") or "").lower()
        content_type = "audio/webm" if (ext == "webm" or "opus" in raw_acodec) else "audio/mp4"
        meta = {
            "url": info["url"],
            "headers": info.get("http_headers") or {},
            "format_id": info.get("format_id", "unknown"),
            "content_type": content_type,
            "duration": info.get("duration"),
            "filesize": info.get("filesize") or info.get("filesize_approx"),
            "is_live": bool(info.get("is_live")),
            "ext": ext,
            "vcodec": info.get("vcodec"),
            "acodec": info.get("acodec"),
            "source": "youtube",
            "timestamp": time.time()
        }
        trim_cache_if_needed(AUDIO_URL_CACHE, max_size=MAX_CACHE_ENTRIES)
        AUDIO_URL_CACHE[video_id] = meta
        return meta

    # 4. Search fallback if specific video ID is completely blocked/unavailable
    try:
        fallback_query = query_hint or f"{video_id} audio song"
        search_opts = {
            'format': AUDIO_FORMAT_SELECTOR,
            'quiet': True,
            'no_warnings': True,
            'default_search': 'ytsearch1:',
            'skip_download': True,
            'noplaylist': True,
            'cachedir': False,
            'socket_timeout': 5,
            'extractor_retries': 0,
            'extractor_args': YTDL_CLIENT_ARGS,
        }
        with yt_dlp.YoutubeDL(search_opts) as ydl:
            res = ydl.extract_info(f"ytsearch1:{fallback_query}", download=False)
            if res and 'entries' in res and len(res['entries']) > 0:
                entry = res['entries'][0]
                url = entry.get('url')
                vcodec = str(entry.get("vcodec") or "none").lower()
                if url and vcodec == "none":
                    ext = entry.get("ext", "m4a")
                    raw_acodec = str(entry.get("acodec") or "").lower()
                    content_type = "audio/webm" if (ext == "webm" or "opus" in raw_acodec) else "audio/mp4"
                    meta = {
                        "url": url,
                        "headers": entry.get("http_headers") or {},
                        "format_id": entry.get("format_id", "unknown"),
                        "content_type": content_type,
                        "duration": entry.get("duration"),
                        "filesize": entry.get("filesize") or entry.get("filesize_approx"),
                        "is_live": bool(entry.get("is_live")),
                        "ext": ext,
                        "vcodec": entry.get("vcodec"),
                        "acodec": entry.get("acodec"),
                        "source": "youtube",
                        "timestamp": time.time()
                    }
                    AUDIO_URL_CACHE[video_id] = meta
                    return meta
                elif url:
                    safe_log(f"[Rejecting Search Video Stream] video_id={video_id} format={entry.get('format_id')} vcodec={vcodec}")
    except Exception as ex:
        safe_log(f"[yt-dlp search fallback failed] video_id={video_id}: {ex}")

    return None

def get_direct_audio_url(video_id: str, search_query_hint: Optional[str] = None) -> Optional[str]:
    """Returns direct audio stream URL with format fallback and caching."""
    meta = get_audio_metadata(video_id, search_query_hint)
    return meta["url"] if meta else None

# ==============================================================================
# Multi-Provider LLM Integration (OpenAI, Groq, Gemini)
# ==============================================================================
async def query_llm_for_playlist(
    prompt: str,
    languages: List[str],
    mood: str,
    era: str,
    count: int = 12
) -> Optional[List[Dict[str, str]]]:
    """Queries an LLM provider if an API key is available in environment."""
    openai_key = os.environ.get("OPENAI_API_KEY", "").strip()
    groq_key = os.environ.get("GROQ_API_KEY", "").strip()
    gemini_key = os.environ.get("GEMINI_API_KEY", "").strip()

    if not (openai_key or groq_key or gemini_key):
        return None

    lang_str = ", ".join(languages)
    system_prompt = (
        "You are an elite music DJ and playlist curator. You generate highly accurate, authentic playlists "
        "of REAL songs that were officially released. Output ONLY valid raw JSON array of objects without "
        "any markdown ticks or conversational text."
    )
    user_prompt = (
        f"Generate {count} real, popular songs matching:\n"
        f"- Languages: {lang_str}\n"
        f"- Mood/Vibe: {mood}\n"
        f"- Era: {era}\n"
        f"- Custom Request: {prompt or 'Top chartbusters'}\n\n"
        f"Distribute songs evenly across the requested languages.\n"
        f"Return ONLY a JSON array with this exact structure:\n"
        f'[{{"title": "Song Title", "artist": "Singer or Composer", "language": "{languages[0]}"}}]'
    )

    async with httpx.AsyncClient(timeout=7.0) as client:
        # 1. Try Groq (ultra-fast, generous free tier)
        if groq_key:
            try:
                resp = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"},
                    json={
                        "model": "llama-3.1-8b-instant",
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt}
                        ],
                        "temperature": 0.5,
                        "max_tokens": 1000
                    }
                )
                if resp.status_code == 200:
                    raw_content = resp.json()["choices"][0]["message"]["content"].strip()
                    cleaned = re.sub(r'^```json\s*|^```\s*|```$', '', raw_content, flags=re.MULTILINE).strip()
                    parsed = json.loads(cleaned)
                    if isinstance(parsed, list) and len(parsed) > 0:
                        safe_log(f"[LLM] Groq curated {len(parsed)} tracks successfully.")
                        return parsed
            except Exception as e:
                safe_log(f"[LLM] Groq attempt note: {e}")

        # 2. Try OpenAI
        if openai_key:
            try:
                resp = await client.post(
                    "https://api.openai.com/v1/chat/completions",
                    headers={"Authorization": f"Bearer {openai_key}", "Content-Type": "application/json"},
                    json={
                        "model": "gpt-4o-mini",
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt}
                        ],
                        "temperature": 0.6,
                        "max_tokens": 1000
                    }
                )
                if resp.status_code == 200:
                    raw_content = resp.json()["choices"][0]["message"]["content"].strip()
                    cleaned = re.sub(r'^```json\s*|^```\s*|```$', '', raw_content, flags=re.MULTILINE).strip()
                    parsed = json.loads(cleaned)
                    if isinstance(parsed, list) and len(parsed) > 0:
                        safe_log(f"[LLM] OpenAI curated {len(parsed)} tracks successfully.")
                        return parsed
            except Exception as e:
                safe_log(f"[LLM] OpenAI attempt note: {e}")

        # 3. Try Gemini
        if gemini_key:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_key}"
                resp = await client.post(
                    url,
                    headers={"Content-Type": "application/json"},
                    json={
                        "contents": [{"parts": [{"text": f"{system_prompt}\n\n{user_prompt}"}]}],
                        "generationConfig": {"temperature": 0.5, "maxOutputTokens": 1000}
                    }
                )
                if resp.status_code == 200:
                    raw_content = resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
                    cleaned = re.sub(r'^```json\s*|^```\s*|```$', '', raw_content, flags=re.MULTILINE).strip()
                    parsed = json.loads(cleaned)
                    if isinstance(parsed, list) and len(parsed) > 0:
                        safe_log(f"[LLM] Gemini curated {len(parsed)} tracks successfully.")
                        return parsed
            except Exception as e:
                safe_log(f"[LLM] Gemini attempt note: {e}")

    return None

# ==============================================================================
# Heuristic Multi-Language Music Generation Engine
# (Guarantees zero downtime, instant results, and high accuracy)
# ==============================================================================
MOOD_MAP: Dict[str, Dict[str, str]] = {
    "romantic": {"adj": "Soulful Love Melodies", "term": "love romantic melody songs"},
    "energetic": {"adj": "High Voltage Beats", "term": "fast gym workout bass dance songs"},
    "chill": {"adj": "Lo-Fi Calm Vibes", "term": "chill lofi relaxing acoustic songs"},
    "party": {"adj": "Club & Mass Bangers", "term": "party mass dance remix songs"},
    "late_night": {"adj": "Midnight Drive", "term": "late night highway drive car songs"},
    "sad": {"adj": "Heartbreak & Melancholy", "term": "sad heartbreak emotional acoustic songs"},
    "acoustic": {"adj": "Unplugged Strings", "term": "acoustic guitar unplugged live songs"},
    "devotional": {"adj": "Spiritual Peace", "term": "devotional morning peaceful prayer songs"}
}

ERA_MAP: Dict[str, str] = {
    "latest": "2023 2024 2025",
    "2010s": "2010s hits",
    "2000s": "2000s golden nostalgia",
    "90s": "90s evergreen classic",
    "all_time": "all time top blockbuster"
}

async def generate_ai_playlist_heuristic(
    languages: List[str],
    mood: str,
    era: str = "latest",
    prompt: str = "",
    count: int = 12
) -> Dict[str, Any]:
    """Asynchronously generates an intelligent multi-language playlist with 100% reliability."""
    clean_langs = [l.strip().lower() for l in languages if l.strip()]
    if not clean_langs:
        clean_langs = ["telugu"]

    mood_meta = MOOD_MAP.get(mood.lower(), {"adj": "Sonic Horizon", "term": "hit songs"})
    mood_label = mood_meta["adj"]
    era_term = ERA_MAP.get(era.lower(), "latest")

    # Construct engaging playlist title
    if len(clean_langs) == 1:
        lang_name = clean_langs[0].capitalize()
        if lang_name == "Telugu": lang_name = "Tollywood"
        elif lang_name == "Hindi": lang_name = "Bollywood"
        elif lang_name == "Tamil": lang_name = "Kollywood"
        title = f"{lang_name}: {mood_label}"
    elif len(clean_langs) == 2:
        title = f"{clean_langs[0].capitalize()} x {clean_langs[1].capitalize()}: {mood_label}"
    else:
        title = f"Multilingual {mood_label} Mix"

    desc = f"Handcrafted {mood} vibes in {', '.join([l.capitalize() for l in clean_langs])}."
    if prompt:
        desc += f" Inspired by: \"{prompt}\""

    tracks_per_lang = max(2, (count // len(clean_langs)) + 1)

    # Prepare concurrent search tasks
    tasks = []
    for lang in clean_langs:
        query_tokens = [lang]
        if prompt:
            # Add user guidance if present
            query_tokens.append(prompt)
        query_tokens.append(mood_meta["term"])
        query_tokens.append(era_term)
        search_query = " ".join(query_tokens)
        tasks.append(async_search_youtube(search_query, max_results=tracks_per_lang + 3, language_hint=lang))

    # Execute all language searches concurrently in parallel
    search_results_lists = await asyncio.gather(*tasks, return_exceptions=True)

    all_tracks: List[Dict[str, Any]] = []
    seen_ids = set()

    for idx, res in enumerate(search_results_lists):
        lang = clean_langs[idx] if idx < len(clean_langs) else "mix"
        if isinstance(res, list):
            for t in res:
                if t["id"] not in seen_ids:
                    seen_ids.add(t["id"])
                    t["language"] = lang
                    t["videoId"] = t["id"] # Standardize contract
                    all_tracks.append(t)

    # If search returned insufficient tracks, supplement seamlessly from curated catalogs
    if len(all_tracks) < count:
        for lang in clean_langs:
            for t in CURATED_TRACKS.get(lang, []):
                if t["id"] not in seen_ids:
                    seen_ids.add(t["id"])
                    t_copy = dict(t)
                    t_copy["videoId"] = t_copy["id"]
                    all_tracks.append(t_copy)

    # Interleave tracks across languages for smooth bilingual/multilingual variety
    interleaved: List[Dict[str, Any]] = []
    lang_buckets: Dict[str, List[Dict[str, Any]]] = {l: [] for l in clean_langs}
    for t in all_tracks:
        l = t.get("language", clean_langs[0])
        if l in lang_buckets:
            lang_buckets[l].append(t)
        else:
            lang_buckets[clean_langs[0]].append(t)

    max_bucket_size = max([len(b) for b in lang_buckets.values()] or [0])
    for i in range(max_bucket_size):
        for l in clean_langs:
            if i < len(lang_buckets[l]):
                interleaved.append(lang_buckets[l][i])

    final_tracks = interleaved[:count]
    if len(final_tracks) < count and all_tracks:
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

# ==============================================================================
# Master AI Playlist Coordinator: LLM + Search Mapping + Heuristic Fallback
# ==============================================================================
async def create_ai_playlist_unified(
    languages: List[str],
    mood: str,
    era: str = "latest",
    prompt: str = "",
    count: int = 12
) -> Dict[str, Any]:
    """Unifies LLM intelligence with search mapping and guaranteed heuristic fallback."""
    clean_langs = [l.strip().lower() for l in languages if l.strip()]
    if not clean_langs:
        clean_langs = ["telugu", "hindi"]

    # 1. Attempt LLM curation
    llm_recommendations = await query_llm_for_playlist(prompt, clean_langs, mood, era, count)

    if llm_recommendations and len(llm_recommendations) > 0:
        safe_log(f"[AI] Mapping {len(llm_recommendations)} LLM-recommended songs to YouTube...")
        # Search YouTube for each recommended song in parallel
        tasks = []
        for item in llm_recommendations:
            track_title = item.get("title", "")
            track_artist = item.get("artist", "")
            track_lang = item.get("language", clean_langs[0])
            search_query = f"{track_title} {track_artist} song"
            tasks.append(async_search_youtube(search_query, max_results=1, language_hint=track_lang))

        mapped_results = await asyncio.gather(*tasks, return_exceptions=True)
        resolved_tracks: List[Dict[str, Any]] = []
        seen_ids = set()

        for idx, res in enumerate(mapped_results):
            if isinstance(res, list) and len(res) > 0:
                t = res[0]
                if t["id"] not in seen_ids:
                    seen_ids.add(t["id"])
                    # Use clean title/artist from LLM if available
                    t["title"] = llm_recommendations[idx].get("title") or t["title"]
                    t["artist"] = llm_recommendations[idx].get("artist") or t["artist"]
                    t["videoId"] = t["id"]
                    resolved_tracks.append(t)

        if len(resolved_tracks) >= min(4, count // 2):
            mood_label = MOOD_MAP.get(mood.lower(), {}).get("adj", "Mix")
            title = f"{' + '.join([l.capitalize() for l in clean_langs])}: {mood_label}"
            desc = f"Curated by AI based on {mood} vibes in {', '.join([l.capitalize() for l in clean_langs])}."
            if prompt: desc += f" Inspired by: \"{prompt}\""
            return {
                "title": title,
                "description": desc,
                "languages": clean_langs,
                "mood": mood,
                "era": era,
                "prompt": prompt,
                "tracks": resolved_tracks[:count]
            }

    # 2. Seamless Heuristic Fallback
    safe_log("[AI] Generating playlist via High-Speed Heuristic Engine...")
    return await generate_ai_playlist_heuristic(clean_langs, mood, era, prompt, count)

# ==============================================================================
# API Routes
# ==============================================================================
@app.post("/api/ai-playlist")
async def api_create_ai_playlist(request: Request):
    """Generates an AI playlist from JSON request body."""
    try:
        data = await request.json()
    except Exception:
        data = {}

    languages = data.get("languages", ["telugu", "hindi"])
    mood = data.get("mood", "romantic")
    era = data.get("era", "latest")
    prompt = data.get("prompt", "")
    count = int(data.get("count", 12))

    return await create_ai_playlist_unified(languages, mood, era, prompt, count)

@app.get("/api/ai-playlist")
async def api_get_ai_playlist(
    langs: str = Query("telugu,hindi", description="Comma separated languages"),
    mood: str = Query("romantic"),
    era: str = Query("latest"),
    prompt: str = Query(""),
    count: int = Query(12)
):
    """GET fallback for AI playlist generation."""
    lang_list = [l.strip() for l in langs.split(",") if l.strip()]
    return await create_ai_playlist_unified(lang_list, mood, era, prompt, count)

@app.get("/api/trending")
def get_trending(response: Response, lang: str = Query("all", description="telugu | hindi | english | tamil | punjabi | all")):
    """Returns trending chartbusters with support for all major languages and HTTP caching."""
    response.headers["Cache-Control"] = "public, max-age=3600, stale-while-revalidate=86400"
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
async def search(response: Response, q: str = Query(..., min_length=1, description="Search query for song, artist or album")):
    """Asynchronous instant YouTube song search with HTTP caching."""
    response.headers["Cache-Control"] = "public, max-age=3600, stale-while-revalidate=86400"
    results = await async_search_youtube(q, max_results=15, filter_long=True)
    return {"query": q, "results": results}

@app.get("/api/suggestions")
async def suggestions(response: Response, q: str = Query(..., min_length=1)):
    """Auto-suggestions as user types with HTTP caching."""
    response.headers["Cache-Control"] = "public, max-age=1800, stale-while-revalidate=86400"
    encoded = urllib.parse.quote(q)
    url = f"https://suggestqueries.google.com/complete/search?client=youtube&ds=yt&q={encoded}"
    try:
        async with httpx.AsyncClient(headers={"User-Agent": "Mozilla/5.0"}, timeout=3.0) as client:
            resp = await client.get(url)
            text = resp.text
            match = re.search(r'\[.*\]', text)
            if match:
                data = json.loads(match.group(0))
                if len(data) > 1 and isinstance(data[1], list):
                    sugs = [item[0] for item in data[1] if isinstance(item, list) and len(item) > 0]
                    return {"suggestions": sugs[:8]}
    except Exception as e:
        safe_log(f"Suggestions error: {e}")
    return {"suggestions": []}

@app.get("/api/debug-extract/{video_id}")
def debug_extract(video_id: str, use_cookies: bool = False):
    import traceback
    logs = []
    cookie_file = COOKIE_FILE_PATH if (use_cookies and os.path.exists(COOKIE_FILE_PATH)) else None
    cookie_exists = bool(os.path.exists(COOKIE_FILE_PATH))
    cookie_size = os.path.getsize(COOKIE_FILE_PATH) if cookie_exists else 0
    env_cookie = bool(os.environ.get("YTDL_COOKIES"))

    for client_name in ['visionos', 'android', 'android_vr', 'mweb', 'tv', 'web_embedded']:
        opts = {
            'format': 'bestaudio/best',
            'quiet': True,
            'no_warnings': True,
            'skip_download': True,
            'noplaylist': True,
            'extractor_args': {'youtube': {'player_client': [client_name]}}
        }
        if cookie_file:
            opts['cookiefile'] = cookie_file
        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
                formats = info.get('formats', [])
                audio_fmts = [f for f in formats if f.get('vcodec') == 'none' and f.get('acodec') != 'none']
                logs.append({
                    "client": client_name,
                    "success": True,
                    "has_url": bool(info.get('url')),
                    "vcodec": info.get('vcodec'),
                    "format_id": info.get('format_id'),
                    "audio_formats": len(audio_fmts)
                })
        except Exception as e:
            logs.append({"client": client_name, "success": False, "error": str(e)[:150]})
    return {
        "video_id": video_id,
        "cookie_file_exists": cookie_exists,
        "cookie_file_size": cookie_size,
        "env_cookie_present": env_cookie,
        "used_cookies": bool(cookie_file),
        "logs": logs
    }

@app.get("/api/debug-trace/{video_id}")
def debug_trace(video_id: str, title: Optional[str] = None):
    t0 = time.time()
    steps = []
    
    curated_info = VIDEO_INFO_MAP.get(video_id)
    steps.append({"step": "curated_lookup", "curated": curated_info, "elapsed": time.time() - t0})
    
    query_hint = (title or "").strip()
    if not query_hint:
        query_hint = VIDEO_TITLE_MAP.get(video_id, "")
    if not query_hint and curated_info:
        query_hint = f"{curated_info.get('title', '')} {curated_info.get('artist', '')}".strip()
    steps.append({"step": "query_hint", "query_hint": query_hint, "elapsed": time.time() - t0})
    
    exp_dur = curated_info.get("duration") if curated_info else None
    exp_art = curated_info.get("artist") if curated_info else None
    saavn_t0 = time.time()
    saavn_res = resolve_saavn_stream(query_hint, expected_duration=exp_dur, expected_artist=exp_art)
    
    # Candidate probe for diagnostics
    raw_probe = []
    if not saavn_res:
        try:
            probe_url = f'https://www.jiosaavn.com/api.php?__call=search.getResults&_marker=0&q={urllib.parse.quote(query_hint)}&ctx=android&_format=json&p=1&n=5&geo=in&country=in&cc=in'
            pr = STREAM_SESSION.get(probe_url, headers={'User-Agent': 'Mozilla/5.0', 'Cookie': 'geo=103.211.230.1%2CIN%2CTelangana%2CHyderabad%2C500028; DL=english; mm_latlong=17.3843%2C78.4583'}, timeout=2.5)
            if pr.status_code == 200:
                pdata = pr.json()
                for s in pdata.get('results', [])[:5]:
                    raw_probe.append({
                        "song": s.get("song"),
                        "artist": s.get("primary_artists"),
                        "duration": s.get("duration"),
                        "has_enc": bool(s.get("encrypted_media_url"))
                    })
        except Exception as probe_ex:
            raw_probe.append({"error": str(probe_ex)[:100]})

    steps.append({
        "step": "saavn",
        "has_result": bool(saavn_res),
        "source": saavn_res.get("source") if saavn_res else None,
        "duration": saavn_res.get("duration") if saavn_res else None,
        "raw_probe": raw_probe,
        "elapsed": time.time() - saavn_t0
    })

    # yt-dlp test probe with 4s timeout and 0 retries
    ytdl_t0 = time.time()
    ytdl_res = None
    ytdl_err = None
    try:
        opts = {
            'format': AUDIO_FORMAT_SELECTOR,
            'quiet': True,
            'no_warnings': True,
            'skip_download': True,
            'noplaylist': True,
            'cachedir': False,
            'socket_timeout': 4,
            'extractor_retries': 0,
            'extractor_args': YTDL_CLIENT_ARGS,
        }
        with yt_dlp.YoutubeDL(opts) as ydl:
            inf = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
            if inf and inf.get("url"):
                ytdl_res = {
                    "format_id": inf.get("format_id"),
                    "vcodec": inf.get("vcodec"),
                    "acodec": inf.get("acodec"),
                    "duration": inf.get("duration"),
                    "has_url": bool(inf.get("url"))
                }
    except Exception as e:
        ytdl_err = str(e)[:200]
    finally:
        import gc; gc.collect()

    steps.append({
        "step": "yt_dlp",
        "has_result": bool(ytdl_res),
        "info": ytdl_res,
        "error": ytdl_err,
        "elapsed": time.time() - ytdl_t0
    })

    return {
        "video_id": video_id,
        "total_time": time.time() - t0,
        "steps": steps
    }

@app.get("/api/audio-info/{video_id}")
def get_audio_info(
    video_id: str,
    title: Optional[str] = None,
    dur: Optional[str] = None,
    artist: Optional[str] = None
):
    """Returns direct audio stream URL and proxied stream URL."""
    expected_dur = parse_duration_to_seconds(dur) if dur else None
    meta = get_audio_metadata(video_id, title, expected_duration=expected_dur, expected_artist=artist)
    if not meta:
        return JSONResponse(status_code=404, content={"error": "Audio stream not found", "videoId": video_id})
    return {
        "video_id": video_id,
        "videoId": video_id,
        "audio_url": meta["url"],
        "stream_url": f"/api/stream/{video_id}",
        "content_type": meta.get("content_type", "audio/mp4"),
        "duration": meta.get("duration"),
        "filesize": meta.get("filesize")
    }

@app.get("/api/stream/{video_id}")
def stream_audio(
    video_id: str,
    request: Request,
    title: Optional[str] = None,
    dur: Optional[str] = None,
    artist: Optional[str] = None
):
    """
    Direct inline audio stream proxy with HTTP 206 Partial Content, Range headers,
    resilient chunk streaming, and clean client disconnect handling.
    """
    expected_dur = parse_duration_to_seconds(dur) if dur else None
    meta = get_audio_metadata(video_id, title, expected_duration=expected_dur, expected_artist=artist)
    if not meta or not meta.get("url"):
        safe_log(f"[Stream 404] Audio stream metadata not found for video_id={video_id}")
        return JSONResponse(
            status_code=404,
            content={"error": "Audio stream not found", "videoId": video_id, "detail": "Unable to extract audio formats"}
        )

    range_header = request.headers.get("range")
    req_headers = dict(meta.get("headers", {}))
    if range_header:
        req_headers["Range"] = range_header

    upstream_resp = None
    try:
        # Stream with connection-pooled STREAM_SESSION
        upstream_resp = STREAM_SESSION.get(
            meta["url"],
            headers=req_headers,
            stream=True,
            timeout=(6.0, None)
        )
        # If upstream expired (403/410), force refresh cache once
        if upstream_resp.status_code in (403, 410):
            safe_log(f"[Stream Expired] Upstream HTTP {upstream_resp.status_code} for {video_id}, re-extracting fresh URL...")
            AUDIO_URL_CACHE.pop(video_id, None)
            meta = get_audio_metadata(video_id, title, force_refresh=True, expected_duration=expected_dur, expected_artist=artist)
            if not meta or not meta.get("url"):
                return JSONResponse(status_code=404, content={"error": "Audio stream expired and re-extraction failed", "videoId": video_id})
            req_headers = dict(meta.get("headers", {}))
            if range_header:
                req_headers["Range"] = range_header
            upstream_resp = STREAM_SESSION.get(meta["url"], headers=req_headers, stream=True, timeout=(6.0, None))
    except Exception as ex:
        safe_log(f"[Stream Connection Error] video_id={video_id}: {ex}")
        try:
            AUDIO_URL_CACHE.pop(video_id, None)
            meta = get_audio_metadata(video_id, title, force_refresh=True, expected_duration=expected_dur, expected_artist=artist)
            if meta and meta.get("url"):
                req_headers = dict(meta.get("headers", {}))
                if range_header:
                    req_headers["Range"] = range_header
                upstream_resp = STREAM_SESSION.get(meta["url"], headers=req_headers, stream=True, timeout=(6.0, None))
        except Exception:
            pass

    if upstream_resp is None or upstream_resp.status_code >= 400:
        status_code = upstream_resp.status_code if upstream_resp else 502
        safe_log(f"[Stream Upstream Failed] video_id={video_id} status={status_code}")
        return JSONResponse(status_code=status_code, content={"error": "Failed to stream audio", "videoId": video_id})

    # Determine container & Content-Type
    ext = meta.get("ext", "m4a").lower()
    raw_ct = (upstream_resp.headers.get("Content-Type") or meta.get("content_type") or "").lower()
    if "webm" in ext or "webm" in raw_ct or "opus" in raw_ct:
        content_type = "audio/webm"
    else:
        content_type = "audio/mp4"

    res_status = upstream_resp.status_code
    res_headers = {
        "Content-Type": content_type,
        "Accept-Ranges": "bytes",
        "Content-Disposition": "inline",
        "Cache-Control": "public, max-age=1800",
    }

    # RFC 7233 compliant Content-Range handling:
    # 206 Partial Content MUST have Content-Range header.
    if "Content-Range" in upstream_resp.headers:
        res_headers["Content-Range"] = upstream_resp.headers["Content-Range"]
        res_status = 206
    elif range_header:
        cl_val = upstream_resp.headers.get("Content-Length") or meta.get("filesize")
        if cl_val:
            try:
                cl = int(cl_val)
                # Synthesize Content-Range if starting from byte 0
                if range_header.strip() in ("bytes=0-", "bytes=0"):
                    res_headers["Content-Range"] = f"bytes 0-{cl - 1}/{cl}"
                    res_status = 206
            except Exception:
                pass

    # Forward Content-Length
    if "Content-Length" in upstream_resp.headers:
        res_headers["Content-Length"] = upstream_resp.headers["Content-Length"]
    elif meta.get("filesize"):
        res_headers["Content-Length"] = str(meta["filesize"])

    format_id = meta.get("format_id", "unknown")
    safe_log(
        f"[Stream Start] video_id={video_id} format={format_id} "
        f"upstream_status={upstream_resp.status_code} res_status={res_status} "
        f"range={range_header} content_type={content_type} "
        f"content_length={res_headers.get('Content-Length')}"
    )

    def iterfile():
        bytes_streamed = 0
        try:
            for chunk in upstream_resp.iter_content(chunk_size=64 * 1024):
                if chunk:
                    bytes_streamed += len(chunk)
                    yield chunk
            safe_log(f"[Stream Finished] video_id={video_id} format={format_id} total_bytes={bytes_streamed}")
        except (BrokenPipeError, ConnectionResetError) as e:
            safe_log(f"[Client Disconnected] video_id={video_id} after {bytes_streamed} bytes: {e}")
        except Exception as ex:
            if type(ex).__name__ in ("ClientDisconnected", "ConnectionResetError", "BrokenPipeError"):
                safe_log(f"[Client Disconnected] video_id={video_id} after {bytes_streamed} bytes: {ex}")
            else:
                safe_log(f"[Stream Exception] video_id={video_id} after {bytes_streamed} bytes: {ex}")
        finally:
            try:
                upstream_resp.close()
            except Exception:
                pass

    return StreamingResponse(
        iterfile(),
        status_code=res_status,
        headers=res_headers
    )

# Serve static directory
STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(STATIC_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

@app.api_route("/", methods=["GET", "HEAD"])
def serve_index():
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "Swarify Music API is running."}

@app.get("/manifest.json")
def serve_manifest():
    manifest_path = os.path.join(STATIC_DIR, "manifest.json")
    if os.path.exists(manifest_path):
        return FileResponse(manifest_path, media_type="application/manifest+json")
    return JSONResponse(status_code=404, content={"error": "manifest not found"})

@app.get("/sw.js")
def serve_service_worker():
    sw_path = os.path.join(STATIC_DIR, "sw.js")
    if os.path.exists(sw_path):
        return FileResponse(
            sw_path,
            media_type="application/javascript",
            headers={
                "Service-Worker-Allowed": "/",
                "Cache-Control": "no-cache, no-store, must-revalidate"
            }
        )
    return JSONResponse(status_code=404, content={"error": "service worker not found"})

@app.api_route("/health", methods=["GET", "HEAD"])
@app.api_route("/ping", methods=["GET", "HEAD"])
def health_check():
    return {"status": "ok", "service": "Swarify"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("app:app", host="0.0.0.0", port=port, reload=True)
