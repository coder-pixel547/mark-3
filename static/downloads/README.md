# Swarify Music APK Downloads Directory

This directory hosts direct Android APK packages for Swarify Music.

## File Specifications:
- **Target File**: `Swarify-Music.apk`
- **Route**: `GET /download/apk`
- **MIME Type**: `application/vnd.android.package-archive`
- **Content-Disposition**: `attachment; filename="Swarify-Music.apk"`

## How to update the APK:
1. Generate your production or debug APK using **PWABuilder** (https://www.pwabuilder.com) for URL `https://swarify-music-b0e9.onrender.com`.
2. Name the generated APK file: `Swarify-Music.apk`.
3. Place `Swarify-Music.apk` directly into this folder (`static/downloads/Swarify-Music.apk`).
4. Commit & push or redeploy:
   ```bash
   git add static/downloads/Swarify-Music.apk
   git commit -m "feat(apk): add latest Swarify-Music.apk build"
   git push origin main
   ```
5. Anyone clicking **Download Android APK** on your website will immediately download the APK file with zero wait time.
