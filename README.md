# Swarify — Free Ad-Free Music Streaming Website

**Swarify** (*Swara + Spotify*) is a modern, 100% ad-free music listening web application featuring **Telugu, Hindi, English, Tamil, Punjabi, Malayalam, and Kannada** music libraries with background playback, lock-screen controls, playlist management, and an intelligent **AI Playlist Maker**.

---

## 🌐 Live Website

- **Public Live URL**: [https://friendship-testimony-transmitted-area.trycloudflare.com](https://friendship-testimony-transmitted-area.trycloudflare.com)
- **Local Network URL**: `http://192.168.1.10:8000`
- **Localhost**: `http://localhost:8000`

---

## ✨ Features

- **100% Ad-Free & Subscription-Free**: No video ads, audio ads, or popups.
- **✨ Intelligent AI Playlist Maker**: Generate multilingual playlists by combining languages, mood vibes, eras, and natural language prompts. Powered by multi-provider LLM support (OpenAI, Groq, Gemini) with a fast heuristic fallback engine.
- **7 Major Language Catalogs**: Full verified catalogs for **Telugu**, **Hindi**, **English**, **Tamil**, **Punjabi**, **Malayalam**, and **Kannada**.
- **Screen-Off Background Playback**: Native HTML5 audio engine plays continuously when your phone screen is locked or turned off.
- **Lock-Screen Music Widget**: Full MediaSession integration on Android, iOS, Windows, and Mac with cover art, track info, and playback buttons.
- **Speculative Track Preloading**: Pre-caches the next track's audio stream for instant, gapless playback.
- **Custom Playlists**: Create, edit, organize, and share custom playlists saved permanently to your browser.
- **Universal Live Search**: Instant song, artist, and album search with live auto-suggestions.

---

## 🧪 Running Automated Tests

Run the included pytest suite to verify all endpoints, AI playlist logic, and streaming utilities:
```bash
pytest test_app.py -v
```

---

## ☁️ Permanent 24/7 Cloud Deployment (Free)

To keep Swarify online 24/7 even when your computer is shut down:

### Deploy to Render.com (Recommended Free Tier):
1. Create a free account at [render.com](https://render.com).
2. Create a new repository on your [GitHub](https://github.com) account and push this folder:
   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/swarify.git
   git branch -M main
   git push -u origin main
   ```
3. In Render, click **New +** → **Web Service** → Select your GitHub repository.
4. Render will automatically detect `render.yaml` and configure:
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `uvicorn app:app --host 0.0.0.0 --port $PORT`
5. Click **Deploy Web Service** — in 2 minutes, you will get a permanent URL like `https://swarify.onrender.com`!
