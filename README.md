# Swarify — Free Ad-Free Music Streaming Website

**Swarify** (*Swara + Spotify*) is a modern, 100% ad-free music listening web application featuring **Telugu**, **Hindi**, and **English** music libraries with background playback, lock-screen controls, and playlist management.

---

## 🌐 Live Website

- **Public Live URL**: [https://graphic-wave-said-effort.trycloudflare.com](https://graphic-wave-said-effort.trycloudflare.com)
- **Local Network URL**: `http://192.168.1.10:8000`
- **Localhost**: `http://localhost:8000`

---

## ✨ Features

- **100% Ad-Free & Subscription-Free**: No video ads, audio ads, or popups.
- **Telugu, Hindi & English Catalogs**: Tollywood hits (*Devara*, *Pushpa 2*, *RRR*), Bollywood melodies (*Kesariya*, *Chaleya*, Arijit Singh), and Global chartbusters (*The Weeknd*, *Taylor Swift*).
- **Screen-Off Background Playback**: Native HTML5 audio engine plays continuously when your phone screen is locked or turned off.
- **Lock-Screen Music Widget**: Full MediaSession integration on Android, iOS, Windows, and Mac with cover art, track info, and playback buttons.
- **Custom Playlists**: Create, edit, and organize custom playlists saved permanently to your browser.
- **Universal Live Search**: Instant song, artist, and album search with live auto-suggestions.

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
