@echo off
title Swarify 10-Minute Auto-Opener
cd /d "%~dp0"
echo ========================================================
echo Starting Swarify 10-Minute Auto-Opener and Keep-Alive...
echo Target: https://graphic-wave-said-effort.trycloudflare.com
echo ========================================================
echo.
python auto_open_10m.py
pause
