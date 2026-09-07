# MARK 3 — Free Ad-Free Music Streaming Website

A free, 100% ad-free music listening web application built with **FastAPI** and a modern dark-mode frontend. It streams songs in **Telugu**, **Hindi**, and **English** (along with instant worldwide search) without audio hosting costs, subscription paywalls, or third-party advertising.

---

## 🌟 Key Features

- **Ad-Free Music Playback**: Pure music streaming with zero banner ads, popups, or audio ad interruptions.
- **Multilingual Catalogs**:
  - **Telugu Hits (తెలుగు)**: Tollywood blockbusters from *Devara*, *Pushpa 2*, *Ala Vaikunthapurramuloo*, *RRR*, Anirudh, Thaman, DSP, Sid Sriram, and Keeravani.
  - **Hindi Hits (हिंदी)**: Bollywood chartbusters from Arijit Singh, Shreya Ghoshal, Pritam, Sachin-Jigar, *Brahmāstra*, *Jawan*, *Dunki*, and *Animal*.
  - **English Hits**: Billboard Top 50, The Weeknd, Taylor Swift, Ed Sheeran, Harry Styles, Dua Lipa, and Sabrina Carpenter.
- **Live Search & Auto-Suggestions**: Type any artist, movie, or song title to get instant search suggestions and tracks.
- **Full Player Controls**:
  - Play / Pause (or press `Space`)
  - Scrubber / Seek Bar (or press `←` / `→` arrow keys)
  - Next / Previous (`N` / `P` keys)
  - Shuffle & Repeat (Repeat All / Repeat One)
  - Volume Slider & Mute toggle (`M` key)
  - Animated Audio Equalizer Visualizer
  - Mini Video Dock toggle (switch between pure audio mode and watching the music video)
- **Library & Local Persistence**:
  - **Liked Songs (❤️)**: Save favorites directly to your browser's `localStorage` — saved permanently across sessions.
  - **Queue Drawer**: View upcoming tracks and manage your current playlist queue.

---

## 🚀 How to Run Locally

1. Open PowerShell or Command Prompt in this folder:
   ```bash
   cd C:\Users\reddy\.gemini\antigravity\scratch\mark-3
   ```

2. Start the web server:
   ```bash
   python -m uvicorn app:app --host 127.0.0.1 --port 8000
   ```

3. Open your browser and go to:
   ```
   http://localhost:8000
   ```

---

## 📁 Project Structure

```
mark-3/
├── app.py              # FastAPI server (search, trending feeds, suggestions API)
├── requirements.txt    # Python dependencies (fastapi, uvicorn, requests)
├── README.md           # Documentation and instructions
└── static/
    ├── index.html      # Single-page music streaming web app
    ├── styles.css      # Dark-mode styling, responsive layout, animations
    └── app.js          # Player engine, queue, YouTube API integration, favorites
```

---

## 🌐 Deploying to the Web (Free Online Website)

When you are ready to publish MARK 3 to the public internet:
1. **Render.com (Recommended Free Tier)**:
   - Push this folder to a GitHub repository.
   - Connect the repo to [Render](https://render.com) as a **Web Service**.
   - Build command: `pip install -r requirements.txt`
   - Start command: `uvicorn app:app --host 0.0.0.0 --port $PORT`
2. **Railway.app / Koyeb**:
   - Deploy directly from GitHub with automatic Python detection.
