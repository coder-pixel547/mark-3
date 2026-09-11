import pytest
from fastapi.testclient import TestClient
import app
from app import app as fastapi_app, clean_song_title, parse_duration_to_seconds, is_valid_song_track

client = TestClient(fastapi_app)

def test_health_check():
    """Verify health and ping routes support both GET and HEAD."""
    resp_get = client.get("/health")
    assert resp_get.status_code == 200
    assert resp_get.json() == {"status": "ok", "service": "Swarify"}

    resp_head = client.head("/health")
    assert resp_head.status_code == 200

    resp_ping = client.get("/ping")
    assert resp_ping.status_code == 200

def test_trending_catalog():
    """Verify curated trending tracks cover languages and have valid contracts."""
    resp = client.get("/api/trending?lang=all")
    assert resp.status_code == 200
    data = resp.json()
    assert "tracks" in data
    assert len(data["tracks"]) >= 10

    # Ensure each track has both id and videoId
    for track in data["tracks"][:5]:
        assert "id" in track
        assert "videoId" in track
        assert track["id"] == track["videoId"]
        assert "title" in track
        assert "artist" in track

def test_ai_playlist_post_multilang():
    """Verify AI playlist endpoint works for multi-language requests."""
    payload = {
        "languages": ["telugu", "tamil", "punjabi"],
        "mood": "energetic",
        "era": "latest",
        "prompt": "gym motivation workout pump",
        "count": 6
    }
    resp = client.post("/api/ai-playlist", json=payload)
    assert resp.status_code == 200
    data = resp.json()

    assert "title" in data
    assert "description" in data
    assert "tracks" in data
    assert len(data["tracks"]) >= 3

    # Check contract conformance
    for t in data["tracks"]:
        assert "title" in t
        assert "artist" in t
        assert "id" in t
        assert "videoId" in t
        assert t["id"] == t["videoId"]
        assert "thumbnail" in t

def test_ai_playlist_get_fallback():
    """Verify AI playlist GET fallback endpoint works."""
    resp = client.get("/api/ai-playlist?langs=hindi,english&mood=romantic&era=latest&count=6")
    assert resp.status_code == 200
    data = resp.json()
    assert "tracks" in data
    assert len(data["tracks"]) >= 3

def test_clean_song_title():
    """Verify title cleaning strips unwanted tags, pipes, and bracketed noise."""
    raw = "Fear Song | Devara Part 1 | NTR | Anirudh (Official Music Video) [4K]"
    cleaned = clean_song_title(raw)
    assert "Official Music Video" not in cleaned
    assert "[4K]" not in cleaned
    assert "Fear Song" in cleaned

def test_parse_duration():
    """Verify duration parsing."""
    assert parse_duration_to_seconds("3:30") == 210
    assert parse_duration_to_seconds("1:00:00") == 3600
    assert parse_duration_to_seconds("45") == 45

def test_is_valid_song_track():
    """Verify filtering out multi-hour jukeboxes and long compilations."""
    assert is_valid_song_track("Devara Fear Song", "3:15") is True
    assert is_valid_song_track("Telugu Hits Audio Jukebox", "1:20:00") is False
    assert is_valid_song_track("Romantic Songs Compilation", "45:00") is False
    assert is_valid_song_track("Short Sound Effect", "0:15") is False

def test_parse_duration_edge_cases():
    """Verify duration parsing edge cases and fallback safety."""
    assert parse_duration_to_seconds(None) == 210
    assert parse_duration_to_seconds("") == 210
    assert parse_duration_to_seconds("invalid") == 210
    assert parse_duration_to_seconds("0:00") == 0
    assert parse_duration_to_seconds("2:46") == 166

def test_audio_metadata_format_fallback():
    """Verify audio format selector prioritizes pure audio formats 140/251 without video fallback."""
    from app import AUDIO_FORMAT_SELECTOR, AUDIO_CACHE_TTL
    assert AUDIO_FORMAT_SELECTOR == "140/251/bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio[acodec!=none][vcodec=none]/bestaudio"
    assert AUDIO_CACHE_TTL == 1800

def test_stream_audio_partial_content():
    """Verify /api/stream/{video_id} returns HTTP 206 Partial Content with correct headers."""
    # Use a known fast-extracting track from catalog
    vid = "g44VQxMcFH4"
    resp = client.get(f"/api/stream/{vid}", headers={"Range": "bytes=0-500"})
    assert resp.status_code == 206
    headers = {k.lower(): v for k, v in resp.headers.items()}
    assert headers.get("accept-ranges") == "bytes"
    assert "content-range" in headers
    assert headers["content-range"].startswith("bytes 0-")
    assert "content-length" in headers
    assert "content-type" in headers
    assert "audio/" in headers["content-type"]

def test_stream_audio_404_json():
    """Verify stream endpoint returns 404 JSON on nonexistent or unavailable video ID."""
    resp = client.get("/api/stream/invalid_fake_vid_xyz999", headers={"Range": "bytes=0-100"})
    assert resp.status_code == 404
    data = resp.json()
    assert "error" in data
    assert data["videoId"] == "invalid_fake_vid_xyz999"

def test_pwa_manifest():
    """Verify /manifest.json is served with correct JSON content and standalone display."""
    resp = client.get("/manifest.json")
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("short_name") == "Swarify"
    assert data.get("display") == "standalone"

def test_service_worker_route():
    """Verify /sw.js is served with Service-Worker-Allowed header and no-cache policy."""
    resp = client.get("/sw.js")
    assert resp.status_code == 200
    assert "javascript" in resp.headers.get("content-type", "")
    assert resp.headers.get("service-worker-allowed") == "/"
    assert "no-cache" in resp.headers.get("cache-control", "")

