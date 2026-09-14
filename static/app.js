// MARK 3 Music Player Application — Native Background Audio, MediaSession & Playlist Management
(function() {
  'use strict';

  function safeLoadStorage(key, fallback = []) {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  // Application State
  const state = {
    queue: [],
    originalQueue: [],
    currentIndex: -1,
    isPlaying: false,
    isShuffle: false,
    repeatMode: 'off', // 'off' | 'all' | 'one'
    volume: 80,
    isMuted: false,
    likedSongs: safeLoadStorage('mark3_liked', []).map(t => ({
      ...t,
      id: t.id || t.videoId,
      videoId: t.videoId || t.id
    })).filter(t => Boolean(t.id)),
    playlists: safeLoadStorage('mark3_playlists', []).map(p => ({
      ...p,
      tracks: (p.tracks || []).map(t => ({
        ...t,
        id: t.id || t.videoId,
        videoId: t.videoId || t.id
      })).filter(t => Boolean(t.id))
    })),
    activeView: 'home',
    activeLangChip: 'all',
    activePlaylistId: null,
    selectedTrackForPlaylist: null,
    allTelugu: [],
    allHindi: [],
    allEnglish: []
  };

  let activeOnPlayingListener = null;

  // Seed starter playlist if none exists
  if (state.playlists.length === 0) {
    state.playlists = [
      {
        id: 'pl_favorites_telugu',
        name: 'Tollywood Top Picks',
        description: 'Selected Telugu chartbusters for quick listening',
        createdAt: Date.now(),
        tracks: []
      }
    ];
    localStorage.setItem('mark3_playlists', JSON.stringify(state.playlists));
  }

  // DOM Elements
  const el = {
    nativeAudio: document.getElementById('native-audio'),
    // Nav
    navItems: document.querySelectorAll('.nav-item'),
    likedCount: document.getElementById('liked-count'),
    queueNavCount: document.getElementById('queue-nav-count'),
    filterChips: document.querySelectorAll('.chip'),
    // Playlists Nav
    btnOpenCreatePlaylist: document.getElementById('btn-open-create-playlist'),
    playlistNavList: document.getElementById('playlist-nav-list'),
    // Search
    searchInput: document.getElementById('search-input'),
    clearSearchBtn: document.getElementById('clear-search-btn'),
    suggestionsDropdown: document.getElementById('suggestions-dropdown'),
    // Main View
    mainView: document.getElementById('main-view'),
    heroBanner: document.getElementById('hero-banner'),
    heroTitle: document.getElementById('hero-title'),
    heroDesc: document.getElementById('hero-desc'),
    heroPlayAllBtn: document.getElementById('hero-play-all-btn'),
    heroShuffleBtn: document.getElementById('hero-shuffle-btn'),
    songsContainer: document.getElementById('songs-container'),
    teluguGrid: document.getElementById('telugu-grid'),
    hindiGrid: document.getElementById('hindi-grid'),
    englishGrid: document.getElementById('english-grid'),
    teluguSection: document.getElementById('telugu-section'),
    hindiSection: document.getElementById('hindi-section'),
    englishSection: document.getElementById('english-section'),
    // Player Controls
    playerThumb: document.getElementById('player-thumb'),
    playerTitle: document.getElementById('player-title'),
    playerArtist: document.getElementById('player-artist'),
    playerLikeBtn: document.getElementById('player-like-btn'),
    playerAddPlaylistBtn: document.getElementById('player-add-playlist-btn'),
    playingIndicator: document.getElementById('playing-indicator-overlay'),
    btnPlay: document.getElementById('btn-play'),
    playIcon: document.getElementById('play-icon'),
    pauseIcon: document.getElementById('pause-icon'),
    btnPrev: document.getElementById('btn-prev'),
    btnNext: document.getElementById('btn-next'),
    btnShuffle: document.getElementById('btn-shuffle'),
    btnRepeat: document.getElementById('btn-repeat'),
    repeatIndicator: document.querySelector('.repeat-one-indicator'),
    currentTime: document.getElementById('current-time'),
    totalDuration: document.getElementById('total-duration'),
    progressWrapper: document.getElementById('progress-wrapper'),
    progressFill: document.getElementById('progress-fill'),
    progressThumb: document.getElementById('progress-thumb'),
    // Right Controls
    audioVisualizer: document.getElementById('audio-visualizer'),
    btnToggleQueue: document.getElementById('btn-toggle-queue'),
    btnMute: document.getElementById('btn-mute'),
    volHighIcon: document.getElementById('vol-high-icon'),
    volMuteIcon: document.getElementById('vol-mute-icon'),
    volumeSlider: document.getElementById('volume-slider'),
    // Queue Drawer
    queueDrawer: document.getElementById('queue-drawer'),
    closeQueueBtn: document.getElementById('close-queue-btn'),
    queueList: document.getElementById('queue-list'),
    toast: document.getElementById('toast'),
    // Modals
    createPlaylistModal: document.getElementById('create-playlist-modal'),
    closeCreatePlModal: document.getElementById('close-create-pl-modal'),
    cancelCreatePlBtn: document.getElementById('cancel-create-pl-btn'),
    confirmCreatePlBtn: document.getElementById('confirm-create-pl-btn'),
    plNameInput: document.getElementById('pl-name-input'),
    plDescInput: document.getElementById('pl-desc-input'),
    addToPlaylistModal: document.getElementById('add-to-playlist-modal'),
    closeAddToPlModal: document.getElementById('close-add-to-pl-modal'),
    addToPlSongTitle: document.getElementById('add-to-pl-song-title'),
    modalPlList: document.getElementById('modal-pl-list'),
    btnQuickCreatePl: document.getElementById('btn-quick-create-pl'),
    // Spotify Import Modal
    btnOpenSpotifyImport: document.getElementById('btn-open-spotify-import'),
    spotifyImportModal: document.getElementById('spotify-import-modal'),
    closeSpotifyModal: document.getElementById('close-spotify-modal'),
    cancelSpotifyBtn: document.getElementById('cancel-spotify-btn'),
    confirmSpotifyImportBtn: document.getElementById('confirm-spotify-import-btn'),
    spotifyUrlInput: document.getElementById('spotify-url-input'),
    btnPasteSpotify: document.getElementById('btn-paste-spotify'),
    spotifyImportStatus: document.getElementById('spotify-import-status'),
    spotifyStatusText: document.getElementById('spotify-status-text'),
    // Mobile Controls & Full-Screen Sheet
    playerTrackInfo: document.getElementById('player-track-info'),
    mobileMiniProgressFill: document.getElementById('mobile-mini-progress-fill'),
    mobileBottomNav: document.getElementById('mobile-bottom-nav'),
    mobileNowPlayingSheet: document.getElementById('mobile-now-playing-sheet'),
    btnCollapseMobilePlayer: document.getElementById('btn-collapse-mobile-player'),
    sheetAlbumName: document.getElementById('sheet-header-album'),
    sheetBtnQueue: document.getElementById('sheet-btn-queue'),
    sheetThumb: document.getElementById('sheet-thumb'),
    sheetTitle: document.getElementById('sheet-title'),
    sheetArtist: document.getElementById('sheet-artist'),
    sheetLikeBtn: document.getElementById('sheet-like-btn'),
    sheetProgressWrapper: document.getElementById('sheet-progress-wrapper'),
    sheetProgressFill: document.getElementById('sheet-progress-fill'),
    sheetProgressThumb: document.getElementById('sheet-progress-thumb'),
    sheetCurrentTime: document.getElementById('sheet-current-time'),
    sheetTotalDuration: document.getElementById('sheet-total-duration'),
    sheetBtnShuffle: document.getElementById('sheet-btn-shuffle'),
    sheetBtnPrev: document.getElementById('sheet-btn-prev'),
    sheetBtnPlay: document.getElementById('sheet-btn-play'),
    sheetPlayIcon: document.getElementById('sheet-play-icon'),
    sheetPauseIcon: document.getElementById('sheet-pause-icon'),
    sheetBtnNext: document.getElementById('sheet-btn-next'),
    sheetBtnRepeat: document.getElementById('sheet-btn-repeat'),
    sheetBtnAddPlaylist: document.getElementById('sheet-btn-add-playlist')
  };

  // Toast Helper
  let toastTimeout;
  function showToast(msg) {
    if (toastTimeout) clearTimeout(toastTimeout);
    el.toast.textContent = msg;
    el.toast.classList.remove('hidden');
    toastTimeout = setTimeout(() => {
      el.toast.classList.add('hidden');
    }, 2800);
  }

  // Format Seconds to M:SS with NaN and Infinity protection
  function formatTime(seconds) {
    if (!seconds || isNaN(seconds) || !Number.isFinite(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  // Parse Duration String (e.g. "3:45" or 195) to Seconds
  function parseDurationToSeconds(durStr) {
    if (!durStr) return 210;
    if (typeof durStr === 'number' && Number.isFinite(durStr) && durStr > 0) return Math.floor(durStr);
    const parts = String(durStr).split(':').map(Number);
    if (parts.length === 1 && !isNaN(parts[0]) && parts[0] > 0) return parts[0];
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) return parts[0] * 60 + parts[1];
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return 210;
  }

  // Resolve Effective Song Duration with Finite Fallback
  function getEffectiveDuration() {
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      return audio.duration;
    }
    const curTrack = state.queue[state.currentIndex];
    if (curTrack && curTrack.duration) {
      const parsed = parseDurationToSeconds(curTrack.duration);
      if (parsed > 0) return parsed;
    }
    return 210; // 3:30 sensible fallback
  }

  // ==========================================
  // 1. Native HTML5 Audio Setup (Spotify Style)
  // ==========================================
  const audio = el.nativeAudio;
  audio.preload = "metadata";
  audio.volume = state.volume / 100;

  audio.addEventListener('play', () => {
    state.isPlaying = true;
    audio.playbackRate = 1.0;
    audio.defaultPlaybackRate = 1.0;
    if ('preservesPitch' in audio) audio.preservesPitch = true;
    updatePlayPauseUI(true);
    updateMediaSessionPosition();
  });

  audio.addEventListener('ratechange', () => {
    if (audio.playbackRate !== 1.0) {
      console.warn(`[PlaybackRate Guard] Enforcing 1.0x playback rate (was ${audio.playbackRate})`);
      audio.playbackRate = 1.0;
      audio.defaultPlaybackRate = 1.0;
      if ('preservesPitch' in audio) audio.preservesPitch = true;
    }
  });

  audio.addEventListener('pause', () => {
    state.isPlaying = false;
    updatePlayPauseUI(false);
  });

  audio.addEventListener('timeupdate', () => {
    const current = audio.currentTime || 0;
    const total = getEffectiveDuration();
    const fmtCurrent = formatTime(current);
    const durRaw = state.queue[state.currentIndex]?.duration;
    const fallbackFmt = typeof durRaw === 'number' ? formatTime(durRaw) : (durRaw || formatTime(total));
    const fmtTotal = (Number.isFinite(audio.duration) && audio.duration > 0)
      ? formatTime(audio.duration)
      : fallbackFmt;

    el.currentTime.textContent = fmtCurrent;
    el.totalDuration.textContent = fmtTotal;
    if (el.sheetCurrentTime) el.sheetCurrentTime.textContent = fmtCurrent;
    if (el.sheetTotalDuration) el.sheetTotalDuration.textContent = fmtTotal;

    if (total > 0) {
      const percent = Math.min(100, Math.max(0, (current / total) * 100));
      el.progressFill.style.width = `${percent}%`;
      if (el.mobileMiniProgressFill) el.mobileMiniProgressFill.style.width = `${percent}%`;
      if (el.sheetProgressFill) el.sheetProgressFill.style.width = `${percent}%`;
    }
  });

  function onDurationUpdate() {
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      const fmt = formatTime(audio.duration);
      el.totalDuration.textContent = fmt;
      if (el.sheetTotalDuration) el.sheetTotalDuration.textContent = fmt;
    } else {
      const cur = state.queue[state.currentIndex];
      if (cur && cur.duration) {
        const fmtCur = typeof cur.duration === 'number' ? formatTime(cur.duration) : cur.duration;
        el.totalDuration.textContent = fmtCur;
        if (el.sheetTotalDuration) el.sheetTotalDuration.textContent = fmtCur;
      }
    }
  }

  audio.addEventListener('loadedmetadata', onDurationUpdate);
  audio.addEventListener('durationchange', onDurationUpdate);

  audio.addEventListener('waiting', () => {
    console.log('[Audio Event: waiting] buffering...');
    if (el.playingIndicator) el.playingIndicator.classList.remove('hidden');
  });

  audio.addEventListener('canplay', () => {
    console.log('[Audio Event: canplay] audio ready');
    if (el.playingIndicator) el.playingIndicator.classList.add('hidden');
    audio.playbackRate = 1.0;
    audio.defaultPlaybackRate = 1.0;
  });

  audio.addEventListener('stalled', () => {
    console.warn('[Audio Event: stalled] network buffering...');
  });

  audio.addEventListener('playing', () => {
    console.log('[Audio Event: playing]');
    if (el.playingIndicator) el.playingIndicator.classList.add('hidden');
    audio.playbackRate = 1.0;
    audio.defaultPlaybackRate = 1.0;
    state.isPlaying = true;
    updatePlayPauseUI(true);
  });

  audio.addEventListener('ended', () => {
    handleTrackEnded();
  });

  audio.addEventListener('error', (e) => {
    const err = audio.error;
    const code = err ? err.code : 'UNKNOWN';
    const message = err ? err.message : (e?.message || 'Media resource failed');
    console.error(`[Audio Error] code=${code} message="${message}"`, err);

    const curTrack = state.queue[state.currentIndex];
    if (!curTrack) return;
    const trackId = curTrack.id || curTrack.videoId;

    if (!curTrack._retryAttempted) {
      curTrack._retryAttempted = true;
      console.warn(`[Audio Error] Retrying "${curTrack.title}" with search title hint...`);
      const hint = encodeURIComponent(`${curTrack.title} ${curTrack.artist || ''}`.trim());
      const durSec = getTrackDurationSeconds(curTrack);
      const durParam = durSec ? `&dur=${durSec}` : '';
      const artistParam = curTrack.artist ? `&artist=${encodeURIComponent(curTrack.artist)}` : '';
      audio.src = `/api/stream/${trackId}?title=${hint}${durParam}${artistParam}`;
      audio.playbackRate = 1.0;
      audio.defaultPlaybackRate = 1.0;
      audio.load();
      audio.play().catch(playErr => console.warn('Retry play caught:', playErr));
      return;
    }

    showToast(`⚠️ Could not stream "${curTrack.title}". Skipping to next...`, 3000);
    setTimeout(() => {
      playNext(true);
    }, 1500);
  });

  // ==========================================
  // 2. MediaSession API (Lock-Screen Controls!)
  // ==========================================
  function setupMediaSession(track) {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: track.album || 'Swarify',
        artwork: [
          { src: track.thumbnail, sizes: '96x96', type: 'image/jpeg' },
          { src: track.thumbnail, sizes: '128x128', type: 'image/jpeg' },
          { src: track.thumbnail, sizes: '192x192', type: 'image/jpeg' },
          { src: track.thumbnail, sizes: '256x256', type: 'image/jpeg' },
          { src: track.thumbnail, sizes: '512x512', type: 'image/jpeg' }
        ]
      });

      navigator.mediaSession.setActionHandler('play', () => {
        togglePlayPause();
      });

      navigator.mediaSession.setActionHandler('pause', () => {
        togglePlayPause();
      });

      navigator.mediaSession.setActionHandler('previoustrack', () => {
        playPrev();
      });

      navigator.mediaSession.setActionHandler('nexttrack', () => {
        playNext();
      });

      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) {
          try {
            audio.currentTime = details.seekTime;
            updateMediaSessionPosition();
          } catch (_) {}
        }
      });

      navigator.mediaSession.setActionHandler('seekforward', () => {
        try {
          audio.currentTime = Math.min(audio.duration || 9999, (audio.currentTime || 0) + 10);
          updateMediaSessionPosition();
        } catch (_) {}
      });

      navigator.mediaSession.setActionHandler('seekbackward', () => {
        try {
          audio.currentTime = Math.max(0, (audio.currentTime || 0) - 10);
          updateMediaSessionPosition();
        } catch (_) {}
      });
    }
  }

  function updateMediaSessionPosition() {
    if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
      if (Number.isFinite(audio.duration) && audio.duration > 0 && Number.isFinite(audio.currentTime)) {
        try {
          navigator.mediaSession.setPositionState({
            duration: Math.max(0, audio.duration),
            playbackRate: audio.playbackRate || 1,
            position: Math.min(Math.max(0, audio.currentTime), audio.duration)
          });
        } catch (e) {
          // Silently ignore browser-level position state rejections
        }
      }
    }
  }

  // Battery & Background Optimization (Pause UI intervals & animations when document.hidden)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      // Pause visualizer animation to conserve mobile battery
      if (el.audioVisualizer) {
        el.audioVisualizer.classList.add('paused');
      }
      if (ytProgressInterval) {
        stopYtProgressTracking();
      }
    } else {
      // Resume visualizer if actively playing
      if (state.isPlaying && el.audioVisualizer) {
        el.audioVisualizer.classList.remove('paused');
      }
      updateMediaSessionPosition();
    }
  });

  // Offline & Online Network Detection
  function updateOnlineStatus() {
    const banner = document.getElementById('offline-banner');
    if (!banner) return;
    if (navigator.onLine) {
      banner.classList.add('hidden');
    } else {
      banner.classList.remove('hidden');
      showToast('You are currently offline. Library is still playable.');
    }
  }
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  setTimeout(updateOnlineStatus, 300);

  // PWA Service Worker Registration
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then((reg) => {
          console.log('[Swarify PWA] Service Worker registered:', reg.scope);
        })
        .catch((err) => {
          console.warn('[Swarify PWA] Service Worker registration failed:', err);
        });
    });
  }



  function getTrackDurationSeconds(track) {
    if (!track || !track.duration) return null;
    if (typeof track.duration === 'number' && track.duration > 0) {
      return Math.round(track.duration);
    }
    if (typeof track.duration === 'string' && track.duration.includes(':')) {
      const parts = track.duration.split(':').map(Number);
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) return parts[0] * 60 + parts[1];
      if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return null;
  }

  function isChannelOrLabel(name) {
    if (!name) return false;
    const s = name.toLowerCase().trim();
    return /^(t-series|sony music|zee music|aditya music|lahari|saregama|tips|speed records|dan music|7clouds|vevo|times music|geetha arts|mythri|dharma|yrf|yash raj)/i.test(s)
      || /\b(music|records|company|channel|media|entertainment|production|studio|official|audios)\b/i.test(s);
  }

  function getCleanTrackHintAndArtist(track) {
    const rawTitle = (track.title || '').trim();
    const rawArtist = (track.artist || '').trim();
    // Clean bracketed marketing noise like (Official Video), [4K], etc.
    const cleanTitle = rawTitle.replace(/[\(\[\{].*?[\)\]\}]/g, '').replace(/[-–—|:]+/g, ' ').replace(/\s+/g, ' ').trim();
    const isLabel = isChannelOrLabel(rawArtist);
    const cleanArtist = isLabel ? '' : rawArtist;
    const cleanHint = cleanArtist ? `${cleanTitle} ${cleanArtist}`.trim() : (cleanTitle || rawTitle);
    return {
      hint: encodeURIComponent(cleanHint),
      artistParam: cleanArtist ? `&artist=${encodeURIComponent(cleanArtist)}` : ''
    };
  }

  function preloadNextTrackSpeculative() {
    if (state.queue.length <= 1) return;
    const nextIdx = (state.currentIndex + 1) % state.queue.length;
    const nextTrack = state.queue[nextIdx];
    if (nextTrack) {
      const nextId = nextTrack.id || nextTrack.videoId;
      if (nextId) {
        const { hint, artistParam } = getCleanTrackHintAndArtist(nextTrack);
        const durSec = getTrackDurationSeconds(nextTrack);
        const durParam = durSec ? `&dur=${durSec}` : '';
        fetch(`/api/audio-info/${nextId}?title=${hint}${durParam}${artistParam}`).catch(() => {});
      }
    }
  }

  // ==========================================
  // 4. Playback Controllers
  // ==========================================
  function loadAndPlayTrack(track, addToQueue = true) {
    if (!track) return;
    track.id = track.id || track.videoId;
    track.videoId = track.videoId || track.id;
    if (!track.id) return;

    if (addToQueue) {
      const existingIdx = state.queue.findIndex(t => (t.id || t.videoId) === track.id);
      if (existingIdx !== -1) {
        state.currentIndex = existingIdx;
      } else {
        state.queue.push(track);
        state.currentIndex = state.queue.length - 1;
      }
    }

    updateCurrentTrackUI(track);
    updateQueueUI();
    setupMediaSession(track);

    if (activeOnPlayingListener) {
      audio.removeEventListener('playing', activeOnPlayingListener);
      activeOnPlayingListener = null;
    }

    const currentTrackId = track.id;
    activeOnPlayingListener = () => {
      audio.removeEventListener('playing', activeOnPlayingListener);
      activeOnPlayingListener = null;
      if (state.queue[state.currentIndex]?.id !== currentTrackId) return;
      if (el.playingIndicator) el.playingIndicator.classList.add('hidden');
      showToast(`Now Playing: ${track.title} 🎵`);
      preloadNextTrackSpeculative();
    };
    audio.addEventListener('playing', activeOnPlayingListener);

    try {
      const { hint, artistParam } = getCleanTrackHintAndArtist(track);
      const durSec = getTrackDurationSeconds(track);
      const durParam = durSec ? `&dur=${durSec}` : '';
      const streamUrl = `/api/stream/${track.id}?title=${hint}${durParam}${artistParam}`;
      audio.preload = "auto";
      audio.src = streamUrl;
      audio.playbackRate = 1.0;
      audio.defaultPlaybackRate = 1.0;
      if ('preservesPitch' in audio) audio.preservesPitch = true;
      audio.load();
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          if (err.name === 'NotAllowedError') {
            console.warn('[Autoplay Restriction] User interaction required to start audio.');
            updatePlayPauseUI(false);
            showToast('Tap play to start listening ▶');
          } else if (err.name === 'AbortError') {
            // Rapid track skip: user skipped before previous track finished loading (normal)
          } else {
            console.warn('Audio play error:', err);
          }
        });
      }
    } catch (err) {
      console.warn('Direct stream failed:', err);
    }
  }

  function togglePlayPause() {
    if (state.currentIndex === -1) {
      if (state.queue.length > 0) {
        playTrackAtIndex(0);
      } else if (state.allTelugu.length > 0) {
        setQueueAndPlay(state.allTelugu, 0);
      }
      return;
    }

    if (audio.paused) {
      audio.play().catch(e => console.warn('Play interrupted:', e));
    } else {
      audio.pause();
    }
  }

  function playNext(auto = false) {
    if (state.queue.length === 0) return;
    
    if (state.isShuffle) {
      const nextIdx = Math.floor(Math.random() * state.queue.length);
      playTrackAtIndex(nextIdx);
      return;
    }

    if (state.currentIndex + 1 < state.queue.length) {
      playTrackAtIndex(state.currentIndex + 1);
    } else if (state.repeatMode === 'all' || auto) {
      playTrackAtIndex(0);
    } else {
      state.isPlaying = false;
      updatePlayPauseUI(false);
    }
  }

  function playPrev() {
    if (state.queue.length === 0) return;
    try {
      if ((audio.currentTime || 0) > 4) {
        audio.currentTime = 0;
        updateMediaSessionPosition();
        return;
      }
    } catch (_) {}
    if (state.currentIndex > 0) {
      playTrackAtIndex(state.currentIndex - 1);
    } else {
      playTrackAtIndex(state.queue.length - 1);
    }
  }

  function playTrackAtIndex(index) {
    if (index < 0 || index >= state.queue.length) return;
    state.currentIndex = index;
    loadAndPlayTrack(state.queue[index], false);
  }

  function setQueueAndPlay(tracks, startIndex = 0) {
    if (!tracks || tracks.length === 0) return;
    state.queue = [...tracks];
    state.originalQueue = [...tracks];
    playTrackAtIndex(startIndex);
  }

  function handleTrackEnded() {
    if (state.repeatMode === 'one') {
      try { audio.currentTime = 0; } catch (_) {}
      audio.play().catch(e => console.warn('Repeat play caught:', e));
    } else {
      playNext(true);
    }
  }

  // ==========================================
  // 5. UI Updates & Controls
  // ==========================================
  function updatePlayPauseUI(isPlaying) {
    if (isPlaying) {
      el.playIcon.classList.add('hidden');
      el.pauseIcon.classList.remove('hidden');
      if (el.sheetPlayIcon) el.sheetPlayIcon.classList.add('hidden');
      if (el.sheetPauseIcon) el.sheetPauseIcon.classList.remove('hidden');
      el.playingIndicator.classList.remove('hidden');
      el.audioVisualizer.classList.add('active');
    } else {
      el.playIcon.classList.remove('hidden');
      el.pauseIcon.classList.add('hidden');
      if (el.sheetPlayIcon) el.sheetPlayIcon.classList.remove('hidden');
      if (el.sheetPauseIcon) el.sheetPauseIcon.classList.add('hidden');
      el.playingIndicator.classList.add('hidden');
      el.audioVisualizer.classList.remove('active');
    }
  }

  function updateCurrentTrackUI(track) {
    const title = track.title || 'Unknown Title';
    const artist = track.artist || 'Swarify';
    const thumbUrl = track.thumbnail || `https://i.ytimg.com/vi/${track.id}/hqdefault.jpg`;
    const rawDur = track.duration || '3:30';
    const dur = typeof rawDur === 'number' ? formatTime(rawDur) : rawDur;

    el.playerTitle.textContent = title;
    el.playerArtist.textContent = artist;
    el.playerThumb.src = thumbUrl;
    el.totalDuration.textContent = dur;

    // Mobile Sheet sync
    if (el.sheetTitle) el.sheetTitle.textContent = title;
    if (el.sheetArtist) el.sheetArtist.textContent = artist;
    if (el.sheetThumb) el.sheetThumb.src = thumbUrl;
    if (el.sheetTotalDuration) el.sheetTotalDuration.textContent = dur;
    if (el.sheetAlbumName) el.sheetAlbumName.textContent = track.album || (track.language ? `${track.language.toUpperCase()} Hits` : 'Swarify Chartbusters');

    const isLiked = state.likedSongs.some(t => t.id === track.id);
    if (isLiked) {
      el.playerLikeBtn.classList.add('active');
      el.playerLikeBtn.querySelector('svg').style.fill = '#ef4444';
      el.playerLikeBtn.querySelector('svg').style.stroke = '#ef4444';
      if (el.sheetLikeBtn) {
        el.sheetLikeBtn.classList.add('active');
        el.sheetLikeBtn.querySelector('svg').style.fill = '#ef4444';
        el.sheetLikeBtn.querySelector('svg').style.stroke = '#ef4444';
      }
    } else {
      el.playerLikeBtn.classList.remove('active');
      el.playerLikeBtn.querySelector('svg').style.fill = 'none';
      el.playerLikeBtn.querySelector('svg').style.stroke = 'currentColor';
      if (el.sheetLikeBtn) {
        el.sheetLikeBtn.classList.remove('active');
        el.sheetLikeBtn.querySelector('svg').style.fill = 'none';
        el.sheetLikeBtn.querySelector('svg').style.stroke = 'currentColor';
      }
    }
  }

  // Universal Seeker Scrubber (Click & Clean Release Seek)
  function setupScrubber(wrapper, fillElements) {
    if (!wrapper) return;
    let isDragging = false;
    let pendingFraction = 0;

    function getFraction(e) {
      const clientX = (e.touches && e.touches.length > 0)
        ? e.touches[0].clientX
        : (e.changedTouches && e.changedTouches.length > 0 ? e.changedTouches[0].clientX : e.clientX);
      const rect = wrapper.getBoundingClientRect();
      if (!rect.width) return 0;
      const clickX = clientX - rect.left;
      return Math.max(0, Math.min(1, clickX / rect.width));
    }

    function applyVisualProgress(fraction) {
      fillElements.forEach(f => {
        if (f) f.style.width = `${fraction * 100}%`;
      });
      const total = getEffectiveDuration();
      if (total > 0 && Number.isFinite(total)) {
        const previewSec = fraction * total;
        el.currentTime.textContent = formatTime(previewSec);
        if (el.sheetCurrentTime) el.sheetCurrentTime.textContent = formatTime(previewSec);
      }
    }

    function commitSeek(fraction) {
      const total = getEffectiveDuration();
      if (total > 0 && Number.isFinite(total)) {
        try {
          audio.currentTime = fraction * total;
          updateMediaSessionPosition();
        } catch (_) {}
      }
      applyVisualProgress(fraction);
    }

    // Direct Click: instant commit
    wrapper.addEventListener('click', (e) => {
      const fraction = getFraction(e);
      commitSeek(fraction);
    });

    // Touch Drag: update visual ONLY while moving; commit audio.currentTime ONCE on release!
    wrapper.addEventListener('touchstart', (e) => {
      isDragging = true;
      pendingFraction = getFraction(e);
      applyVisualProgress(pendingFraction);
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (!isDragging) return;
      pendingFraction = getFraction(e);
      applyVisualProgress(pendingFraction);
    }, { passive: true });

    const endDrag = (e) => {
      if (!isDragging) return;
      isDragging = false;
      if (e) pendingFraction = getFraction(e);
      commitSeek(pendingFraction);
    };

    window.addEventListener('touchend', endDrag);
    window.addEventListener('touchcancel', () => {
      isDragging = false;
    });
  }

  setupScrubber(el.progressWrapper, [el.progressFill, el.mobileMiniProgressFill]);
  if (el.sheetProgressWrapper) {
    setupScrubber(el.sheetProgressWrapper, [el.sheetProgressFill, el.progressFill, el.mobileMiniProgressFill]);
  }

  // Volume Slider
  el.volumeSlider.addEventListener('input', function(e) {
    const val = parseInt(e.target.value, 10);
    state.volume = val;
    state.isMuted = val === 0;
    audio.volume = val / 100;
    updateVolumeUI();
  });

  el.btnMute.addEventListener('click', function() {
    state.isMuted = !state.isMuted;
    if (state.isMuted) {
      audio.muted = true;
    } else {
      audio.muted = false;
      audio.volume = (state.volume || 50) / 100;
    }
    updateVolumeUI();
  });

  function updateVolumeUI() {
    if (state.isMuted || state.volume === 0) {
      el.volHighIcon.classList.add('hidden');
      el.volMuteIcon.classList.remove('hidden');
    } else {
      el.volHighIcon.classList.remove('hidden');
      el.volMuteIcon.classList.add('hidden');
    }
  }

  // Shuffle & Repeat
  el.btnShuffle.addEventListener('click', function() {
    state.isShuffle = !state.isShuffle;
    el.btnShuffle.classList.toggle('active', state.isShuffle);
    showToast(state.isShuffle ? 'Shuffle turned ON' : 'Shuffle turned OFF');
  });

  el.btnRepeat.addEventListener('click', function() {
    if (state.repeatMode === 'off') {
      state.repeatMode = 'all';
      el.btnRepeat.classList.add('active');
      el.repeatIndicator.classList.add('hidden');
      showToast('Repeat ALL tracks');
    } else if (state.repeatMode === 'all') {
      state.repeatMode = 'one';
      el.btnRepeat.classList.add('active');
      el.repeatIndicator.classList.remove('hidden');
      showToast('Repeat ONE track');
    } else {
      state.repeatMode = 'off';
      el.btnRepeat.classList.remove('active');
      el.repeatIndicator.classList.add('hidden');
      showToast('Repeat OFF');
    }
  });


  // Mobile Sheet Expand & Collapse with Touch Gesture Swipe-Down to Dismiss
  function openMobilePlayerSheet() {
    if (window.innerWidth <= 768 && el.mobileNowPlayingSheet) {
      el.mobileNowPlayingSheet.style.transform = '';
      el.mobileNowPlayingSheet.classList.remove('hidden');
    }
  }

  function closeMobilePlayerSheet() {
    if (el.mobileNowPlayingSheet) {
      el.mobileNowPlayingSheet.style.transform = '';
      el.mobileNowPlayingSheet.classList.add('hidden');
    }
  }

  // Touch Gestures: Swipe-Down to Dismiss Mobile Sheet
  if (el.mobileNowPlayingSheet) {
    let touchStartY = 0;
    let touchCurrentY = 0;
    let isDraggingSheet = false;

    el.mobileNowPlayingSheet.addEventListener('touchstart', (e) => {
      // Only drag if scrolled at top of the sheet or touching the drag handle/header
      if (el.mobileNowPlayingSheet.scrollTop <= 0 || e.target.closest('#sheet-drag-pill') || e.target.closest('.sheet-header')) {
        touchStartY = e.touches[0].clientY;
        touchCurrentY = touchStartY;
        isDraggingSheet = true;
        el.mobileNowPlayingSheet.style.transition = 'none';
      }
    }, { passive: true });

    el.mobileNowPlayingSheet.addEventListener('touchmove', (e) => {
      if (!isDraggingSheet) return;
      touchCurrentY = e.touches[0].clientY;
      const deltaY = touchCurrentY - touchStartY;
      if (deltaY > 0) {
        // Dragging downward
        el.mobileNowPlayingSheet.style.transform = `translateY(${deltaY}px)`;
      }
    }, { passive: true });

    el.mobileNowPlayingSheet.addEventListener('touchend', () => {
      if (!isDraggingSheet) return;
      isDraggingSheet = false;
      el.mobileNowPlayingSheet.style.transition = 'transform 0.32s cubic-bezier(0.32, 0.72, 0, 1)';
      const deltaY = touchCurrentY - touchStartY;
      if (deltaY > 80) {
        // Swipe threshold reached: dismiss sheet
        closeMobilePlayerSheet();
      } else {
        // Snap back to open position
        el.mobileNowPlayingSheet.style.transform = 'translateY(0)';
      }
    }, { passive: true });
  }

  if (el.playerTrackInfo) {
    el.playerTrackInfo.addEventListener('click', (e) => {
      if (e.target.closest('.like-btn') || e.target.closest('.add-pl-btn')) return;
      openMobilePlayerSheet();
    });
  }

  if (el.btnCollapseMobilePlayer) {
    el.btnCollapseMobilePlayer.addEventListener('click', closeMobilePlayerSheet);
  }

  // Mobile Sheet Controls
  if (el.sheetBtnPlay) el.sheetBtnPlay.addEventListener('click', togglePlayPause);
  if (el.sheetBtnNext) el.sheetBtnNext.addEventListener('click', () => playNext());
  if (el.sheetBtnPrev) el.sheetBtnPrev.addEventListener('click', playPrev);

  if (el.sheetBtnShuffle) {
    el.sheetBtnShuffle.addEventListener('click', function() {
      state.isShuffle = !state.isShuffle;
      el.btnShuffle.classList.toggle('active', state.isShuffle);
      el.sheetBtnShuffle.classList.toggle('active', state.isShuffle);
      showToast(state.isShuffle ? 'Shuffle ON' : 'Shuffle OFF');
    });
  }

  if (el.sheetBtnRepeat) {
    el.sheetBtnRepeat.addEventListener('click', function() {
      el.btnRepeat.click();
      el.sheetBtnRepeat.classList.toggle('active', state.repeatMode !== 'off');
    });
  }

  if (el.sheetLikeBtn) {
    el.sheetLikeBtn.addEventListener('click', function() {
      if (state.currentIndex === -1 || !state.queue[state.currentIndex]) return;
      toggleLikeTrack(state.queue[state.currentIndex]);
    });
  }

  if (el.sheetBtnAddPlaylist) {
    el.sheetBtnAddPlaylist.addEventListener('click', function() {
      if (state.currentIndex === -1 || !state.queue[state.currentIndex]) return;
      openAddToPlaylistModal(state.queue[state.currentIndex]);
    });
  }



  if (el.sheetBtnQueue) {
    el.sheetBtnQueue.addEventListener('click', function() {
      closeMobilePlayerSheet();
      el.btnToggleQueue.click();
    });
  }

  // Mobile Bottom Navigation Tabs
  document.querySelectorAll('.mobile-nav-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.mobile-nav-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const view = tab.dataset.view;
      if (view) switchView(view);
    });
  });

  // Liked Songs
  function toggleLikeTrack(track) {
    if (!track) return;
    const tid = track.id || track.videoId;
    if (!tid) return;
    track.id = tid;
    track.videoId = tid;

    const idx = state.likedSongs.findIndex(t => (t.id || t.videoId) === tid);
    if (idx !== -1) {
      state.likedSongs.splice(idx, 1);
      showToast('Removed from Liked Songs');
    } else {
      state.likedSongs.push(track);
      showToast('Added to Liked Songs ❤️');
    }
    localStorage.setItem('mark3_liked', JSON.stringify(state.likedSongs));
    updateLikedCountUI();

    if (state.activeView === 'liked') {
      renderLikedView();
    }
    const curId = state.queue[state.currentIndex]?.id || state.queue[state.currentIndex]?.videoId;
    if (curId === tid) {
      updateCurrentTrackUI(track);
    }
    document.querySelectorAll(`.card-btn-icon[data-song-id="${tid}"]`).forEach(btn => {
      btn.classList.toggle('liked', idx === -1);
    });
  }

  el.playerLikeBtn.addEventListener('click', function() {
    if (state.currentIndex === -1 || !state.queue[state.currentIndex]) return;
    toggleLikeTrack(state.queue[state.currentIndex]);
  });

  function updateLikedCountUI() {
    el.likedCount.textContent = state.likedSongs.length;
  }

  // ==========================================
  // 6. Custom Playlist System
  // ==========================================
  function savePlaylists() {
    localStorage.setItem('mark3_playlists', JSON.stringify(state.playlists));
    updatePlaylistsSidebar();
  }

  function createPlaylist(name, description = '') {
    if (!name.trim()) {
      showToast('Please provide a playlist name');
      return;
    }
    const newPl = {
      id: 'pl_' + Date.now(),
      name: name.trim(),
      description: description.trim(),
      createdAt: Date.now(),
      tracks: []
    };
    state.playlists.push(newPl);
    savePlaylists();
    showToast(`Playlist "${newPl.name}" created! 📁`);

    // If initiated from "Add to Playlist" modal, automatically add the selected track
    if (state.selectedTrackForPlaylist) {
      addTrackToPlaylist(newPl.id, state.selectedTrackForPlaylist);
      state.selectedTrackForPlaylist = null;
    }

    viewPlaylist(newPl.id);
  }

  function deletePlaylist(playlistId) {
    const pl = state.playlists.find(p => p.id === playlistId);
    if (!pl) return;
    if (confirm(`Are you sure you want to delete "${pl.name}"?`)) {
      state.playlists = state.playlists.filter(p => p.id !== playlistId);
      savePlaylists();
      showToast(`Deleted "${pl.name}"`);
      switchView('home');
    }
  }

  function addTrackToPlaylist(playlistId, track) {
    const pl = state.playlists.find(p => p.id === playlistId);
    if (!pl || !track) return;
    const tid = track.id || track.videoId;
    if (!tid) return;
    track.id = tid;
    track.videoId = tid;

    if (pl.tracks.some(t => (t.id || t.videoId) === tid)) {
      showToast(`Song already in "${pl.name}"`);
      return;
    }

    pl.tracks.push(track);
    savePlaylists();
    showToast(`Added to "${pl.name}" 🎵`);

    if (state.activeView === 'playlist' && state.activePlaylistId === playlistId) {
      renderPlaylistView(playlistId);
    }
  }

  function removeTrackFromPlaylist(playlistId, trackId) {
    const pl = state.playlists.find(p => p.id === playlistId);
    if (!pl || !trackId) return;

    pl.tracks = pl.tracks.filter(t => (t.id || t.videoId) !== trackId);
    savePlaylists();
    showToast('Removed from playlist');

    if (state.activeView === 'playlist' && state.activePlaylistId === playlistId) {
      renderPlaylistView(playlistId);
    }
  }

  function updatePlaylistsSidebar() {
    el.playlistNavList.innerHTML = '';
    state.playlists.forEach(pl => {
      const item = document.createElement('button');
      item.className = `playlist-nav-item ${state.activeView === 'playlist' && state.activePlaylistId === pl.id ? 'active' : ''}`;
      item.innerHTML = `
        <span class="pl-nav-title">${pl.name}</span>
        <span class="pl-track-count">${pl.tracks.length}</span>
      `;
      item.addEventListener('click', () => {
        viewPlaylist(pl.id);
      });
      el.playlistNavList.appendChild(item);
    });
  }

  function viewPlaylist(playlistId) {
    state.activeView = 'playlist';
    state.activePlaylistId = playlistId;

    el.navItems.forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.playlist-nav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.mobile-nav-tab').forEach(t => t.classList.toggle('active', t.dataset.view === 'liked'));
    updatePlaylistsSidebar();

    renderPlaylistView(playlistId);
  }

  function renderPlaylistView(playlistId) {
    const pl = state.playlists.find(p => p.id === playlistId);
    if (!pl) {
      switchView('home');
      return;
    }

    el.teluguSection.classList.add('hidden');
    el.hindiSection.classList.add('hidden');
    el.englishSection.classList.add('hidden');

    el.heroBanner.classList.remove('hidden');
    el.heroTitle.textContent = pl.name;
    el.heroDesc.textContent = pl.description || `${pl.tracks.length} songs in this playlist`;

    const prevSection = document.getElementById('custom-view-section');
    if (prevSection) prevSection.remove();
    const prevSearch = document.getElementById('search-results-section');
    if (prevSearch) prevSearch.remove();

    const section = document.createElement('div');
    section.className = 'content-section';
    section.id = 'custom-view-section';
    section.innerHTML = `
      <div class="section-header">
        <div class="section-title-group">
          <h2>Playlist Tracks</h2>
          <span class="section-subtitle">${pl.tracks.length} tracks</span>
        </div>
        <button class="btn-danger" id="btn-delete-active-pl">Delete Playlist</button>
      </div>
      <div class="song-grid" id="playlist-grid"></div>
    `;
    el.songsContainer.appendChild(section);

    document.getElementById('btn-delete-active-pl').addEventListener('click', () => {
      deletePlaylist(playlistId);
    });

    const grid = document.getElementById('playlist-grid');
    if (pl.tracks.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; padding: 40px 0; text-align: center;">
          <p style="color: var(--text-dim); margin-bottom: 16px;">This playlist is empty! Search for Telugu, Hindi, or English songs and click the playlist button to add them.</p>
          <button class="btn-primary" id="btn-go-search" style="display: inline-flex; margin: 0 auto;">Search Songs</button>
        </div>
      `;
      document.getElementById('btn-go-search')?.addEventListener('click', () => {
        el.searchInput.focus();
      });
      return;
    }

    pl.tracks.forEach((track, idx) => {
      const card = createSongCard(track, idx, pl.tracks, true, playlistId);
      grid.appendChild(card);
    });

    el.heroPlayAllBtn.onclick = () => setQueueAndPlay(pl.tracks, 0);
    el.heroShuffleBtn.onclick = () => {
      state.isShuffle = true;
      el.btnShuffle.classList.add('active');
      setQueueAndPlay(pl.tracks, Math.floor(Math.random() * pl.tracks.length));
    };
  }

  // Modals Controller
  function openCreatePlaylistModal() {
    el.plNameInput.value = '';
    el.plDescInput.value = '';
    el.createPlaylistModal.classList.remove('hidden');
    setTimeout(() => el.plNameInput.focus(), 50);
  }

  function closeCreatePlaylistModal() {
    el.createPlaylistModal.classList.add('hidden');
  }

  el.btnOpenCreatePlaylist.addEventListener('click', openCreatePlaylistModal);
  el.closeCreatePlModal.addEventListener('click', closeCreatePlaylistModal);
  el.cancelCreatePlBtn.addEventListener('click', closeCreatePlaylistModal);

  el.confirmCreatePlBtn.addEventListener('click', () => {
    const name = el.plNameInput.value;
    const desc = el.plDescInput.value;
    if (name.trim()) {
      createPlaylist(name, desc);
      closeCreatePlaylistModal();
    } else {
      showToast('Please enter a playlist name');
    }
  });

  el.plNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      el.confirmCreatePlBtn.click();
    }
  });

  // Spotify Modal Controller
  function openSpotifyModal() {
    if (el.spotifyImportModal) {
      if (el.spotifyUrlInput) el.spotifyUrlInput.value = '';
      if (el.spotifyImportStatus) el.spotifyImportStatus.classList.add('hidden');
      if (el.confirmSpotifyImportBtn) el.confirmSpotifyImportBtn.disabled = false;
      el.spotifyImportModal.classList.remove('hidden');
      setTimeout(() => {
        if (el.spotifyUrlInput) el.spotifyUrlInput.focus();
      }, 60);
    }
  }

  function closeSpotifyModal() {
    if (el.spotifyImportModal) {
      el.spotifyImportModal.classList.add('hidden');
    }
    if (el.spotifyImportStatus) el.spotifyImportStatus.classList.add('hidden');
    if (el.confirmSpotifyImportBtn) el.confirmSpotifyImportBtn.disabled = false;
  }

  async function importSpotifyPlaylist(rawUrl) {
    const url = (rawUrl || '').trim();
    if (!url) {
      showToast('Please paste a Spotify playlist or album URL');
      return;
    }

    if (el.spotifyImportStatus) el.spotifyImportStatus.classList.remove('hidden');
    if (el.spotifyStatusText) el.spotifyStatusText.textContent = 'Importing tracks from Spotify...';
    if (el.confirmSpotifyImportBtn) el.confirmSpotifyImportBtn.disabled = true;

    try {
      const resp = await fetch('/api/spotify/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      const data = await resp.json();
      if (!resp.ok || data.error) {
        showToast(data.error || 'Failed to import playlist');
        return;
      }

      const importedPl = {
        id: data.id || ('pl_spotify_' + Date.now()),
        name: data.name || 'Spotify Playlist',
        description: data.description || 'Imported from Spotify',
        cover: data.cover || '',
        createdAt: Date.now(),
        tracks: (data.tracks || []).map(t => ({
          ...t,
          id: t.id,
          videoId: t.id
        }))
      };

      const existingIndex = state.playlists.findIndex(p => p.id === importedPl.id);
      if (existingIndex >= 0) {
        state.playlists[existingIndex] = importedPl;
      } else {
        state.playlists.push(importedPl);
      }

      savePlaylists();
      closeSpotifyModal();
      showToast(`Imported "${importedPl.name}" (${importedPl.tracks.length} tracks)! 🟢`);
      viewPlaylist(importedPl.id);
    } catch (err) {
      console.error('Spotify import error:', err);
      showToast('Connection error importing Spotify playlist');
    } finally {
      if (el.spotifyImportStatus) el.spotifyImportStatus.classList.add('hidden');
      if (el.confirmSpotifyImportBtn) el.confirmSpotifyImportBtn.disabled = false;
    }
  }

  if (el.btnOpenSpotifyImport) el.btnOpenSpotifyImport.addEventListener('click', openSpotifyModal);
  if (el.closeSpotifyModal) el.closeSpotifyModal.addEventListener('click', closeSpotifyModal);
  if (el.cancelSpotifyBtn) el.cancelSpotifyBtn.addEventListener('click', closeSpotifyModal);

  if (el.confirmSpotifyImportBtn) {
    el.confirmSpotifyImportBtn.addEventListener('click', () => {
      if (el.spotifyUrlInput) importSpotifyPlaylist(el.spotifyUrlInput.value);
    });
  }

  if (el.spotifyUrlInput) {
    el.spotifyUrlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (el.confirmSpotifyImportBtn) el.confirmSpotifyImportBtn.click();
      }
    });
  }

  if (el.btnPasteSpotify) {
    el.btnPasteSpotify.addEventListener('click', async () => {
      try {
        const clipText = await navigator.clipboard.readText();
        if (clipText && el.spotifyUrlInput) {
          el.spotifyUrlInput.value = clipText.trim();
          showToast('Link pasted from clipboard! 📋');
          el.spotifyUrlInput.focus();
        }
      } catch (err) {
        showToast('Clipboard access unavailable. Please paste manually (Ctrl+V).');
      }
    });
  }

  if (el.spotifyImportModal) {
    el.spotifyImportModal.addEventListener('click', (e) => {
      if (e.target === el.spotifyImportModal) closeSpotifyModal();
    });
  }

  function openAddToPlaylistModal(track) {
    state.selectedTrackForPlaylist = track;
    el.addToPlSongTitle.textContent = `Add "${track.title}" to:`;
    el.modalPlList.innerHTML = '';

    if (state.playlists.length === 0) {
      el.modalPlList.innerHTML = '<p style="color: var(--text-dim); padding: 12px 0;">No playlists created yet. Create one below!</p>';
    } else {
      state.playlists.forEach(pl => {
        const hasTrack = pl.tracks.some(t => t.id === track.id);
        const item = document.createElement('div');
        item.className = 'modal-pl-item';
        item.innerHTML = `
          <div>
            <div class="modal-pl-name">${pl.name}</div>
            <div class="modal-pl-tracks-count">${pl.tracks.length} songs</div>
          </div>
          <button class="btn-primary" style="padding: 6px 14px; font-size: 0.8rem;">
            ${hasTrack ? '✓ Added' : '+ Add'}
          </button>
        `;
        item.addEventListener('click', () => {
          addTrackToPlaylist(pl.id, track);
          closeAddToPlaylistModal();
        });
        el.modalPlList.appendChild(item);
      });
    }

    el.addToPlaylistModal.classList.remove('hidden');
  }

  function closeAddToPlaylistModal() {
    el.addToPlaylistModal.classList.add('hidden');
    state.selectedTrackForPlaylist = null;
  }

  el.closeAddToPlModal.addEventListener('click', closeAddToPlaylistModal);

  el.btnQuickCreatePl.addEventListener('click', () => {
    closeAddToPlaylistModal();
    openCreatePlaylistModal();
  });

  el.playerAddPlaylistBtn.addEventListener('click', () => {
    if (state.currentIndex === -1 || !state.queue[state.currentIndex]) {
      showToast('No song currently playing');
      return;
    }
    openAddToPlaylistModal(state.queue[state.currentIndex]);
  });

  // Queue Drawer
  function updateQueueUI() {
    el.queueNavCount.textContent = state.queue.length;
    el.queueList.innerHTML = '';
    if (state.queue.length === 0) {
      el.queueList.innerHTML = '<p style="color: var(--text-dim); text-align: center; margin-top: 40px;">Queue is empty</p>';
      return;
    }

    state.queue.forEach((track, i) => {
      const item = document.createElement('div');
      item.className = `queue-item ${i === state.currentIndex ? 'active' : ''}`;
      item.innerHTML = `
        <img class="queue-thumb" src="${track.thumbnail}" alt="" loading="lazy" decoding="async" />
        <div class="queue-info">
          <div class="queue-title">${track.title}</div>
          <div class="queue-artist">${track.artist}</div>
        </div>
        <button class="queue-remove-btn" title="Remove" data-index="${i}">&times;</button>
      `;

      item.addEventListener('click', (e) => {
        if (e.target.classList.contains('queue-remove-btn')) return;
        playTrackAtIndex(i);
      });

      item.querySelector('.queue-remove-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        removeTrackFromQueue(i);
      });

      el.queueList.appendChild(item);
    });
  }

  function removeTrackFromQueue(index) {
    if (index === state.currentIndex) {
      playNext();
    }
    state.queue.splice(index, 1);
    if (index < state.currentIndex) {
      state.currentIndex--;
    }
    updateQueueUI();
  }

  el.btnToggleQueue.addEventListener('click', () => {
    el.queueDrawer.classList.toggle('hidden');
    el.btnToggleQueue.classList.toggle('active', !el.queueDrawer.classList.contains('hidden'));
  });

  el.closeQueueBtn.addEventListener('click', () => {
    el.queueDrawer.classList.add('hidden');
    el.btnToggleQueue.classList.remove('active');
  });



  // ==========================================
  // 7. Song Card Generator
  // ==========================================
  function createSongCard(track, index, listRef, isPlaylistView = false, playlistId = null) {
    const card = document.createElement('div');
    card.className = 'song-card';
    const isLiked = state.likedSongs.some(t => t.id === track.id);

    card.innerHTML = `
      <div class="card-thumb-wrapper">
        <img src="${track.thumbnail}" alt="${track.title}" loading="lazy" decoding="async" />
        <span class="card-duration-tag">${typeof track.duration === 'number' ? formatTime(track.duration) : (track.duration || '3:30')}</span>
        <button class="card-play-btn" title="Play">
          <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg>
        </button>
      </div>
      <div class="card-info">
        <div class="card-title" title="${track.title}">${track.title}</div>
        <div class="card-artist" title="${track.artist}">${track.artist}</div>
      </div>
      <div class="card-actions">
        <button class="card-btn-icon ${isLiked ? 'liked' : ''}" data-song-id="${track.id}" title="Like">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
        </button>
        <button class="card-btn-icon add-playlist-btn" title="Add to Playlist">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 11H5M19 16H5M11 6H5M19 6h-4"></path></svg>
        </button>
        ${isPlaylistView ? `
          <button class="card-btn-icon remove-pl-track-btn" title="Remove from this playlist">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        ` : `
          <button class="card-btn-icon add-queue-btn" title="Add to Queue">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          </button>
        `}
      </div>
    `;

    card.addEventListener('click', (e) => {
      if (e.target.closest('.card-btn-icon')) return;
      setQueueAndPlay(listRef, index);
    });

    card.querySelector('.card-btn-icon[data-song-id]').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleLikeTrack(track);
    });

    card.querySelector('.add-playlist-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      openAddToPlaylistModal(track);
    });

    if (isPlaylistView) {
      card.querySelector('.remove-pl-track-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        removeTrackFromPlaylist(playlistId, track.id);
      });
    } else {
      card.querySelector('.add-queue-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        state.queue.push(track);
        updateQueueUI();
        showToast(`Added to queue: ${track.title}`);
      });
    }

    return card;
  }

  // Initial Catalog Loader
  async function loadInitialCatalog() {
    try {
      const safeFetchTrending = async (lang) => {
        try {
          const res = await fetch(`/api/trending?lang=${lang}`);
          if (res.ok) return await res.json();
          return { tracks: [] };
        } catch {
          return { tracks: [] };
        }
      };

      const [telRes, hinRes, engRes] = await Promise.all([
        safeFetchTrending('telugu'),
        safeFetchTrending('hindi'),
        safeFetchTrending('english')
      ]);

      state.allTelugu = telRes.tracks || [];
      state.allHindi = hinRes.tracks || [];
      state.allEnglish = engRes.tracks || [];

      // Seed starter playlist if empty
      const starterPl = state.playlists.find(p => p.id === 'pl_favorites_telugu');
      if (starterPl && starterPl.tracks.length === 0 && state.allTelugu.length > 0) {
        starterPl.tracks = state.allTelugu.slice(0, 4);
        savePlaylists();
      }

      renderHomeGrids();
    } catch (err) {
      console.error('Failed to load initial songs:', err);
      showToast('Could not load songs. Check server connection.');
    }
  }

  function renderHomeGrids() {
    el.teluguGrid.innerHTML = '';
    el.hindiGrid.innerHTML = '';
    el.englishGrid.innerHTML = '';

    state.allTelugu.forEach((track, idx) => {
      el.teluguGrid.appendChild(createSongCard(track, idx, state.allTelugu));
    });

    state.allHindi.forEach((track, idx) => {
      el.hindiGrid.appendChild(createSongCard(track, idx, state.allHindi));
    });

    state.allEnglish.forEach((track, idx) => {
      el.englishGrid.appendChild(createSongCard(track, idx, state.allEnglish));
    });
  }

  // Search & Suggestions with 250ms Debounce & AbortController
  let searchDebounce;
  let currentSearchAbortController = null;
  let currentSuggestionsAbortController = null;

  el.searchInput.addEventListener('input', function() {
    const query = el.searchInput.value.trim();
    el.clearSearchBtn.classList.toggle('hidden', query.length === 0);

    if (query.length === 0) {
      el.suggestionsDropdown.classList.add('hidden');
      if (currentSuggestionsAbortController) {
        currentSuggestionsAbortController.abort();
        currentSuggestionsAbortController = null;
      }
      return;
    }

    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      fetchSuggestions(query);
    }, 250);
  });

  el.searchInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      const q = el.searchInput.value.trim();
      if (q) {
        clearTimeout(searchDebounce);
        el.suggestionsDropdown.classList.add('hidden');
        performSearch(q);
      }
    }
  });

  el.clearSearchBtn.addEventListener('click', function() {
    el.searchInput.value = '';
    el.clearSearchBtn.classList.add('hidden');
    el.suggestionsDropdown.classList.add('hidden');
    if (currentSearchAbortController) {
      currentSearchAbortController.abort();
      currentSearchAbortController = null;
    }
    switchView('home');
  });

  async function fetchSuggestions(query) {
    if (currentSuggestionsAbortController) {
      currentSuggestionsAbortController.abort();
    }
    currentSuggestionsAbortController = new AbortController();
    try {
      const res = await fetch(`/api/suggestions?q=${encodeURIComponent(query)}`, {
        signal: currentSuggestionsAbortController.signal
      });
      const data = await res.json();
      if (data.suggestions && data.suggestions.length > 0) {
        renderSuggestions(data.suggestions);
      } else {
        el.suggestionsDropdown.classList.add('hidden');
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        el.suggestionsDropdown.classList.add('hidden');
      }
    } finally {
      currentSuggestionsAbortController = null;
    }
  }

  function renderSuggestions(sugs) {
    el.suggestionsDropdown.innerHTML = '';
    sugs.forEach(text => {
      const item = document.createElement('div');
      item.className = 'suggestion-item';
      item.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
        <span>${text}</span>
      `;
      item.addEventListener('click', () => {
        el.searchInput.value = text;
        el.suggestionsDropdown.classList.add('hidden');
        performSearch(text);
      });
      el.suggestionsDropdown.appendChild(item);
    });
    el.suggestionsDropdown.classList.remove('hidden');
  }

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-container')) {
      el.suggestionsDropdown.classList.add('hidden');
    }
  });

  function renderSearchSkeletons(query) {
    let existingSearch = document.getElementById('search-results-section');
    if (!existingSearch) {
      existingSearch = document.createElement('div');
      existingSearch.className = 'content-section';
      existingSearch.id = 'search-results-section';
      el.songsContainer.prepend(existingSearch);
    }
    existingSearch.classList.remove('hidden');
    existingSearch.innerHTML = `
      <div class="section-header">
        <div class="section-title-group">
          <h2>Searching for "${query}"...</h2>
          <span class="section-subtitle">Finding top music tracks</span>
        </div>
      </div>
      <div class="song-grid">
        ${Array.from({ length: 8 }).map(() => `
          <div class="skeleton-card">
            <div class="skeleton-thumb-box shimmer"></div>
            <div class="skeleton-info">
              <div class="skeleton-line shimmer"></div>
              <div class="skeleton-line shimmer short"></div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
    el.teluguSection.classList.add('hidden');
    el.hindiSection.classList.add('hidden');
    el.englishSection.classList.add('hidden');
  }

  async function performSearch(query) {
    if (currentSearchAbortController) {
      currentSearchAbortController.abort();
    }
    currentSearchAbortController = new AbortController();

    // Render skeleton placeholders immediately for zero layout shift (CLS)
    renderSearchSkeletons(query);

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`, {
        signal: currentSearchAbortController.signal
      });
      const data = await res.json();
      const results = data.results || [];
      renderSearchResultsView(query, results);
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Search failed:', err);
        showToast('Search failed. Please try again.');
      }
    } finally {
      currentSearchAbortController = null;
    }
  }

  function renderSearchResultsView(query, results) {
    el.teluguSection.classList.add('hidden');
    el.hindiSection.classList.add('hidden');
    el.englishSection.classList.add('hidden');

    el.heroTitle.textContent = `Search: "${query}"`;
    el.heroDesc.textContent = `Found ${results.length} songs. Click any track to stream instantly.`;
    
    const prevSection = document.getElementById('custom-view-section');
    if (prevSection) prevSection.remove();
    const prevSearch = document.getElementById('search-results-section');
    if (prevSearch) prevSearch.remove();

    const searchSection = document.createElement('div');
    searchSection.className = 'content-section';
    searchSection.id = 'search-results-section';
    searchSection.innerHTML = `
      <div class="section-header">
        <div class="section-title-group">
          <h2>Search Results</h2>
          <span class="section-subtitle">${results.length} songs found</span>
        </div>
      </div>
      <div class="song-grid" id="search-grid"></div>
    `;

    el.songsContainer.appendChild(searchSection);
    const searchGrid = document.getElementById('search-grid');

    if (results.length === 0) {
      searchGrid.innerHTML = '<p style="color: var(--text-dim); grid-column: 1/-1; padding: 40px 0;">No songs found. Try a different artist or title.</p>';
      return;
    }

    results.forEach((track, idx) => {
      searchGrid.appendChild(createSongCard(track, idx, results));
    });

    el.heroPlayAllBtn.onclick = () => setQueueAndPlay(results, 0);
    el.heroShuffleBtn.onclick = () => {
      state.isShuffle = true;
      el.btnShuffle.classList.add('active');
      const randIdx = Math.floor(Math.random() * results.length);
      setQueueAndPlay(results, randIdx);
    };
  }

  // Views & Tabs
  function switchView(viewName) {
    state.activeView = viewName;
    state.activePlaylistId = null;

    el.navItems.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.view === viewName);
    });
    document.querySelectorAll('.playlist-nav-item').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelectorAll('.mobile-nav-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.view === viewName);
    });

    const prevSection = document.getElementById('custom-view-section');
    if (prevSection) prevSection.remove();
    const prevSearch = document.getElementById('search-results-section');
    if (prevSearch) prevSearch.remove();

    if (viewName === 'home') {
      el.heroBanner.classList.remove('hidden');
      el.heroTitle.textContent = 'Telugu, Hindi & Global Hits';
      el.heroDesc.textContent = 'Stream top Tollywood, Bollywood & International chartbusters ad-free with background playback.';
      el.teluguSection.classList.remove('hidden');
      el.hindiSection.classList.remove('hidden');
      el.englishSection.classList.remove('hidden');

      const allCombined = [...state.allTelugu, ...state.allHindi, ...state.allEnglish];
      el.heroPlayAllBtn.onclick = () => setQueueAndPlay(allCombined, 0);
      el.heroShuffleBtn.onclick = () => {
        state.isShuffle = true;
        el.btnShuffle.classList.add('active');
        const randIdx = Math.floor(Math.random() * allCombined.length);
        setQueueAndPlay(allCombined, randIdx);
      };
    } else if (viewName === 'telugu') {
      el.heroBanner.classList.remove('hidden');
      el.heroTitle.textContent = 'Telugu Blockbuster Hits (తెలుగు)';
      el.heroDesc.textContent = 'Devara, Pushpa 2, Ala Vaikunthapurramuloo, RRR, Anirudh, Thaman, DSP and more.';
      el.teluguSection.classList.remove('hidden');
      el.hindiSection.classList.add('hidden');
      el.englishSection.classList.add('hidden');

      el.heroPlayAllBtn.onclick = () => setQueueAndPlay(state.allTelugu, 0);
      el.heroShuffleBtn.onclick = () => {
        state.isShuffle = true;
        el.btnShuffle.classList.add('active');
        setQueueAndPlay(state.allTelugu, Math.floor(Math.random() * state.allTelugu.length));
      };
    } else if (viewName === 'hindi') {
      el.heroBanner.classList.remove('hidden');
      el.heroTitle.textContent = 'Bollywood Top Hits (हिंदी)';
      el.heroDesc.textContent = 'Arijit Singh, Pritam, Shreya Ghoshal, Sachin-Jigar and romantic melodies.';
      el.teluguSection.classList.add('hidden');
      el.hindiSection.classList.remove('hidden');
      el.englishSection.classList.add('hidden');

      el.heroPlayAllBtn.onclick = () => setQueueAndPlay(state.allHindi, 0);
      el.heroShuffleBtn.onclick = () => {
        state.isShuffle = true;
        el.btnShuffle.classList.add('active');
        setQueueAndPlay(state.allHindi, Math.floor(Math.random() * state.allHindi.length));
      };
    } else if (viewName === 'english') {
      el.heroBanner.classList.remove('hidden');
      el.heroTitle.textContent = 'Global English Chartbusters';
      el.heroDesc.textContent = 'The Weeknd, Taylor Swift, Ed Sheeran, Harry Styles, Dua Lipa and Billboard Top 50.';
      el.teluguSection.classList.add('hidden');
      el.hindiSection.classList.add('hidden');
      el.englishSection.classList.remove('hidden');

      el.heroPlayAllBtn.onclick = () => setQueueAndPlay(state.allEnglish, 0);
      el.heroShuffleBtn.onclick = () => {
        state.isShuffle = true;
        el.btnShuffle.classList.add('active');
        setQueueAndPlay(state.allEnglish, Math.floor(Math.random() * state.allEnglish.length));
      };
    } else if (viewName === 'liked') {
      renderLikedView();
    } else if (viewName === 'queue-view') {
      el.queueDrawer.classList.remove('hidden');
      el.btnToggleQueue.classList.add('active');
    }
  }

  function renderLikedView() {
    el.teluguSection.classList.add('hidden');
    el.hindiSection.classList.add('hidden');
    el.englishSection.classList.add('hidden');

    el.heroBanner.classList.remove('hidden');
    el.heroTitle.textContent = 'Your Liked Songs ❤️';
    el.heroDesc.textContent = `${state.likedSongs.length} favorites saved to your local library.`;

    const prevSection = document.getElementById('custom-view-section');
    if (prevSection) prevSection.remove();

    const section = document.createElement('div');
    section.className = 'content-section';
    section.id = 'custom-view-section';
    section.innerHTML = `
      <div class="section-header">
        <div class="section-title-group">
          <h2>Favorites Collection</h2>
          <span class="section-subtitle">Persisted locally in your browser</span>
        </div>
      </div>
      <div class="song-grid" id="liked-grid"></div>
    `;
    el.songsContainer.appendChild(section);

    const likedGrid = document.getElementById('liked-grid');
    if (state.likedSongs.length === 0) {
      likedGrid.innerHTML = '<p style="color: var(--text-dim); grid-column: 1/-1; padding: 40px 0;">No liked songs yet! Click the heart icon on any track to add it here.</p>';
      return;
    }

    state.likedSongs.forEach((track, idx) => {
      likedGrid.appendChild(createSongCard(track, idx, state.likedSongs));
    });

    el.heroPlayAllBtn.onclick = () => setQueueAndPlay(state.likedSongs, 0);
    el.heroShuffleBtn.onclick = () => {
      state.isShuffle = true;
      el.btnShuffle.classList.add('active');
      setQueueAndPlay(state.likedSongs, Math.floor(Math.random() * state.likedSongs.length));
    };
  }

  el.navItems.forEach(btn => {
    btn.addEventListener('click', () => {
      switchView(btn.dataset.view);
    });
  });

  el.filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
      el.filterChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const lang = chip.dataset.lang;
      state.activeLangChip = lang;

      if (lang === 'all') switchView('home');
      else if (lang === 'telugu') switchView('telugu');
      else if (lang === 'hindi') switchView('hindi');
      else if (lang === 'english') switchView('english');
    });
  });

  document.querySelectorAll('.btn-view-all').forEach(btn => {
    btn.addEventListener('click', () => {
      switchView(btn.dataset.target);
    });
  });

  // Global Keyboard Shortcuts
  document.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.code === 'Space') {
      e.preventDefault();
      togglePlayPause();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      try {
        const total = getEffectiveDuration();
        audio.currentTime = Math.min(total || 9999, (audio.currentTime || 0) + 5);
        updateMediaSessionPosition();
      } catch (_) {}
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      try {
        audio.currentTime = Math.max(0, (audio.currentTime || 0) - 5);
        updateMediaSessionPosition();
      } catch (_) {}
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const newVol = Math.min(100, state.volume + 5);
      el.volumeSlider.value = newVol;
      el.volumeSlider.dispatchEvent(new Event('input'));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const newVol = Math.max(0, state.volume - 5);
      el.volumeSlider.value = newVol;
      el.volumeSlider.dispatchEvent(new Event('input'));
    } else if (e.key.toLowerCase() === 'n') {
      playNext();
    } else if (e.key.toLowerCase() === 'p') {
      playPrev();
    } else if (e.key.toLowerCase() === 'm') {
      el.btnMute.click();
    }
  });

  el.btnPlay.addEventListener('click', togglePlayPause);
  el.btnNext.addEventListener('click', () => playNext());
  el.btnPrev.addEventListener('click', playPrev);

  // 10-Minute Auto Keep-Alive & Wake Lock
  let wakeLock = null;
  async function requestWakeLock() {
    if ('wakeLock' in navigator) {
      try {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      } catch (_) {}
    }
  }

  audio.addEventListener('play', () => {
    requestWakeLock();
  });

  // Initialize
  updateLikedCountUI();
  updatePlaylistsSidebar();
  loadInitialCatalog();
})();
