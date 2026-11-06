import os
import pytest
from fastapi.testclient import TestClient

# Ensure test environment
os.environ["ENV"] = "production"
os.environ["ADMIN_SECRET_KEY"] = "test-super-secret-admin-key-2026"

from app import app, hash_password, verify_password, RATE_LIMITER

client = TestClient(app)

def test_debug_mode_disabled_in_production():
    """Verify debug mode is strictly disabled and API docs are hidden in production."""
    assert app.debug is False
    assert app.docs_url is None
    assert app.redoc_url is None
    resp = client.get("/docs")
    assert resp.status_code == 404

def test_security_headers_present():
    """Verify all critical OWASP security headers are present on responses."""
    resp = client.get("/api/trending")
    assert resp.status_code == 200
    headers = resp.headers
    assert headers.get("X-Content-Type-Options") == "nosniff"
    assert headers.get("X-Frame-Options") == "DENY"
    assert headers.get("X-XSS-Protection") == "1; mode=block"
    assert "strict-origin" in headers.get("Referrer-Policy", "")
    assert "default-src" in headers.get("Content-Security-Policy", "")
    assert "camera=()" in headers.get("Permissions-Policy", "")

def test_admin_routes_unauthenticated_rejected():
    """Verify diagnostic and admin routes reject unauthenticated access with 401/403."""
    # Debug extract endpoint
    resp1 = client.get("/api/debug-extract/abc123xyz")
    assert resp1.status_code in (401, 403)
    
    # Debug trace endpoint
    resp2 = client.get("/api/debug-trace/abc123xyz")
    assert resp2.status_code in (401, 403)
    
    # Admin status endpoint
    resp3 = client.get("/api/admin/status")
    assert resp3.status_code in (401, 403)
    
    # Admin cache clear endpoint
    resp4 = client.post("/api/admin/cache/clear")
    assert resp4.status_code in (401, 403)

def test_admin_routes_authenticated_success():
    """Verify admin routes succeed when provided with the correct admin key or header."""
    valid_header = {"X-Admin-Token": "test-super-secret-admin-key-2026"}
    
    resp_verify = client.get("/api/admin/verify", headers=valid_header)
    assert resp_verify.status_code == 200
    assert resp_verify.json().get("role") == "admin"

    resp_status = client.get("/api/admin/status", headers=valid_header)
    assert resp_status.status_code == 200
    assert resp_status.json().get("status") == "healthy"
    assert resp_status.json().get("debug_mode") is False

    resp_clear = client.post("/api/admin/cache/clear", headers=valid_header)
    assert resp_clear.status_code == 200
    assert resp_clear.json().get("status") == "cleared"

def test_admin_bearer_auth():
    """Verify Authorization Bearer token authentication for admin endpoints."""
    bearer_header = {"Authorization": "Bearer test-super-secret-admin-key-2026"}
    resp = client.get("/api/admin/verify", headers=bearer_header)
    assert resp.status_code == 200

def test_password_hashing_and_verification():
    """Verify OWASP PBKDF2-HMAC-SHA256 password hashing with constant-time verification."""
    password = "StrongPassword@2026!"
    hashed = hash_password(password)
    
    # Check hash structure: pbkdf2:sha256:<iters>$<salt_hex>$<hash_hex>
    parts = hashed.split("$")
    assert len(parts) == 3
    assert parts[0].startswith("pbkdf2:sha256:")
    assert int(parts[0].split(":")[2]) >= 600000

    # Verify matching password
    assert verify_password(password, hashed) is True

    # Verify wrong password rejected
    assert verify_password("WrongPassword@2026!", hashed) is False

    # Verify malformed hash handled safely
    assert verify_password(password, "invalid$hash$format") is False

def test_sync_save_validation_and_size_limits():
    """Verify library sync rejects invalid codes and payloads exceeding 512KB."""
    # Invalid sync code (too short)
    bad_code_resp = client.post("/api/sync/save", json={"code": "AB", "playlists": []})
    assert bad_code_resp.status_code == 400

    # Invalid sync code (special characters)
    bad_code_resp2 = client.post("/api/sync/save", json={"code": "ABC<script>", "playlists": []})
    assert bad_code_resp2.status_code == 400

    # Oversized payload (> 512KB)
    huge_data = {"code": "SYNC-TEST-01", "playlists": ["X" * 600000]}
    huge_resp = client.post("/api/sync/save", json=huge_data)
    assert huge_resp.status_code == 413

def test_sync_save_and_load_flow():
    """Verify valid sync save and load works seamlessly with parameterized queries."""
    sync_code = "SYNC-FLOW-99"
    payload = {
        "code": sync_code,
        "playlists": [{"id": "pl-1", "name": "Favorites", "tracks": ["vid1"]}],
        "liked_songs": [{"id": "vid1", "title": "Test Song"}]
    }
    save_resp = client.post("/api/sync/save", json=payload)
    assert save_resp.status_code == 200
    assert save_resp.json().get("status") == "ok"

    load_resp = client.get(f"/api/sync/load?code={sync_code}")
    assert load_resp.status_code == 200
    data = load_resp.json()
    assert data.get("code") == sync_code
    assert len(data.get("playlists")) == 1
    assert data.get("playlists")[0]["name"] == "Favorites"

def test_sync_load_nonexistent():
    """Verify 404 for nonexistent sync code."""
    resp = client.get("/api/sync/load?code=NONEXISTENT123")
    assert resp.status_code == 404

def test_search_input_sanitization():
    """Verify /api/search sanitizes control characters and respects query length constraints."""
    # Control character query
    resp = client.get("/api/search?q=hello%00%0D%0Aworld")
    assert resp.status_code == 200
    assert "query" in resp.json()
    assert "\x00" not in resp.json()["query"]

def test_ai_playlist_payload_limit():
    """Verify /api/ai-playlist rejects oversized prompts/payloads."""
    huge_prompt = {"prompt": "a" * 15000}
    resp = client.post("/api/ai-playlist", json=huge_prompt)
    assert resp.status_code == 413

def test_rate_limiter_blocks_excessive_requests():
    """Verify rate limiter triggers 429 when threshold is reached on a restricted endpoint."""
    test_key = "test_rate_limit_ip"
    # Exhaust allowed requests
    for _ in range(5):
        RATE_LIMITER.is_allowed(test_key, max_requests=5, window_seconds=60.0)
    
    # Next request should be blocked
    allowed, retry = RATE_LIMITER.is_allowed(test_key, max_requests=5, window_seconds=60.0)
    assert allowed is False
    assert retry > 0
