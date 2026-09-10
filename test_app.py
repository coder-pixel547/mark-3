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
