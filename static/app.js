// MARK 3 Music Player Application — Native Background Audio, MediaSession & Playlist Management
(function() {
  'use strict';

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
    likedSongs: JSON.parse(localStorage.getItem('mark3_liked') || '[]'),
    playlists: JSON.parse(localStorage.getItem('mark3_playlists') || '[]'),
    activeView: 'home',
    activeLangChip: 'all',
    activePlaylistId: null,
    selectedTrackForPlaylist: null,
    audioMode: 'native', // 'native' for background audio | 'video' for video dock
    ytPlayer: null,
    isPlayerReady: false,
    isVideoDockVisible: false,
    allTelugu: [],
    allHindi: [],
    allEnglish: [],
    aiWizard: {
      step: 1,
      selectedLangs: new Set(['telugu', 'hindi']),
      selectedMood: 'romantic',
      selectedEra: 'latest',
      count: 12,
      customPrompt: '',
      generatedPlaylist: null
    }
  };

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
    btnToggleVideo: document.getElementById('btn-toggle-video'),
    btnToggleQueue: document.getElementById('btn-toggle-queue'),
    btnMute: document.getElementById('btn-mute'),
    volHighIcon: document.getElementById('vol-high-icon'),
    volMuteIcon: document.getElementById('vol-mute-icon'),
    volumeSlider: document.getElementById('volume-slider'),
    // Video Dock & Queue Drawer
    videoDock: document.getElementById('video-dock'),
    dockCloseBtn: document.getElementById('dock-close-btn'),
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
    // AI Playlist Creator
    btnOpenAiCreator: document.getElementById('btn-open-ai-creator'),
    heroAiBtn: document.getElementById('hero-ai-btn'),
    aiPlaylistModal: document.getElementById('ai-playlist-modal'),
    closeAiModal: document.getElementById('close-ai-modal'),
    wizardProgress: document.getElementById('wizard-progress'),
    wizardStep1: document.getElementById('wizard-step-1'),
    wizardStep2: document.getElementById('wizard-step-2'),
    wizardStep3: document.getElementById('wizard-step-3'),
    wizardStepLoading: document.getElementById('wizard-step-loading'),
    wizardStepResult: document.getElementById('wizard-step-result'),
    btnNextToStep2: document.getElementById('btn-next-to-step-2'),
    btnBackToStep1: document.getElementById('btn-back-to-step-1'),
    btnNextToStep3: document.getElementById('btn-next-to-step-3'),
    btnBackToStep2: document.getElementById('btn-back-to-step-2'),
    btnGenerateAi: document.getElementById('btn-generate-ai'),
    aiLoadingStatus: document.getElementById('ai-loading-status'),
    resultPlTitle: document.getElementById('result-pl-title'),
    resultPlDesc: document.getElementById('result-pl-desc'),
    resultLangsBadge: document.getElementById('result-langs-badge'),
    resultCountBadge: document.getElementById('result-count-badge'),
    resultTracksPreview: document.getElementById('result-tracks-preview'),
    btnAiPlayNow: document.getElementById('btn-ai-play-now'),
    btnAiSavePlaylist: document.getElementById('btn-ai-save-playlist'),
    btnAiSharePlaylist: document.getElementById('btn-ai-share-playlist'),
    btnAiTweak: document.getElementById('btn-ai-tweak'),
    aiCustomPrompt: document.getElementById('ai-custom-prompt'),
    langSelectedCounter: document.getElementById('lang-selected-counter'),
    // Mobile Controls & Full-Screen Sheet
    playerTrackInfo: document.getElementById('player-track-info'),
    mobileMiniProgressFill: document.getElementById('mobile-mini-progress-fill'),
    mobileBottomNav: document.getElementById('mobile-bottom-nav'),
    mobileNavAiBtn: document.getElementById('mobile-nav-ai-btn'),
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
    sheetBtnAddPlaylist: document.getElementById('sheet-btn-add-playlist'),
    sheetBtnToggleVideo: document.getElementById('sheet-btn-toggle-video')
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

  // Parse Duration String (e.g. "3:45") to Seconds
  function parseDurationToSeconds(durStr) {
    if (!durStr) return 210;
    const parts = String(durStr).split(':').map(Number);
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
    if (state.audioMode === 'native') {
      state.isPlaying = true;
      updatePlayPauseUI(true);
      updateMediaSessionPosition();
    }
  });

  audio.addEventListener('pause', () => {
    if (state.audioMode === 'native') {
      state.isPlaying = false;
      updatePlayPauseUI(false);
    }
  });

  audio.addEventListener('timeupdate', () => {
    const current = audio.currentTime || 0;
    const total = getEffectiveDuration();
    const fmtCurrent = formatTime(current);
    const fmtTotal = (Number.isFinite(audio.duration) && audio.duration > 0)
      ? formatTime(audio.duration)
      : (state.queue[state.currentIndex]?.duration || formatTime(total));

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
        el.totalDuration.textContent = cur.duration;
        if (el.sheetTotalDuration) el.sheetTotalDuration.textContent = cur.duration;
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
  });

  let stalledTimeout = null;
  audio.addEventListener('stalled', () => {
    const err = audio.error;
    console.warn(`[Audio Event: stalled] network stalled. error.code=${err?.code || 'none'} message="${err?.message || ''}"`);
    if (stalledTimeout) clearTimeout(stalledTimeout);
    stalledTimeout = setTimeout(() => {
      const curTrack = state.queue[state.currentIndex];
      if (curTrack && (audio.paused || audio.readyState < 2)) {
        console.warn(`[Audio Stalled] Prolonged stall for "${curTrack.title}"`);
        if (!curTrack._stalledRetry) {
          curTrack._stalledRetry = true;
          showToast(`Reconnecting stream for "${curTrack.title}"...`, 2000);
          audio.load();
          audio.play().catch(() => {});
        } else {
          showToast(`This track is unavailable, skipping…`, 3500);
          playNext(true);
        }
      }
    }, 8000);
  });

  audio.addEventListener('playing', () => {
    if (stalledTimeout) clearTimeout(stalledTimeout);
  });

  audio.addEventListener('ended', () => {
    handleTrackEnded();
  });

  audio.addEventListener('error', (e) => {
    const err = audio.error;
    const code = err ? err.code : 'UNKNOWN';
    const message = err ? err.message : (e?.message || 'Media resource failed');
    console.error(`[Audio Error] code=${code} message="${message}"`, err);

    if (streamTimeout) clearTimeout(streamTimeout);

    const curTrack = state.queue[state.currentIndex];
    if (!curTrack) return;
    const trackId = curTrack.id || curTrack.videoId;

    // Do not auto-skip on the first error; retry once by re-requesting /api/stream/{id} before giving up
    if (!curTrack._retryAttempted) {
      curTrack._retryAttempted = true;
      console.warn(`[Audio Error] Retrying stream once for "${curTrack.title}" (${trackId})...`);
      showToast(`Retrying stream for "${curTrack.title}"...`, 2000);
      try {
        const streamUrl = `/api/stream/${trackId}?title=${encodeURIComponent(curTrack.title)}&retry=1&t=${Date.now()}`;
        audio.src = streamUrl;
        audio.load();
        audio.play().catch(playErr => {
          console.warn('[Audio Retry Play Error]', playErr);
        });
        return;
      } catch (retryErr) {
        console.error('[Audio Retry Setup Error]', retryErr);
      }
    }

    // If retry already failed or track unavailable, show user-facing toast before advancing
    showToast(`This track is unavailable, skipping…`, 3500);

    // Skip to next available track
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
          if (state.audioMode === 'video' && state.ytPlayer && typeof state.ytPlayer.seekTo === 'function') {
            state.ytPlayer.seekTo(details.seekTime, true);
            updateYtProgress();
          } else {
            audio.currentTime = details.seekTime;
            updateMediaSessionPosition();
          }
        }
      });

      navigator.mediaSession.setActionHandler('seekforward', () => {
        if (state.audioMode === 'video' && state.ytPlayer && typeof state.ytPlayer.getCurrentTime === 'function') {
          const cur = state.ytPlayer.getCurrentTime() || 0;
          state.ytPlayer.seekTo(cur + 10, true);
          updateYtProgress();
        } else {
          audio.currentTime = Math.min(audio.duration || 9999, audio.currentTime + 10);
          updateMediaSessionPosition();
        }
      });

      navigator.mediaSession.setActionHandler('seekbackward', () => {
        if (state.audioMode === 'video' && state.ytPlayer && typeof state.ytPlayer.getCurrentTime === 'function') {
          const cur = state.ytPlayer.getCurrentTime() || 0;
          state.ytPlayer.seekTo(Math.max(0, cur - 10), true);
          updateYtProgress();
        } else {
          audio.currentTime = Math.max(0, audio.currentTime - 10);
          updateMediaSessionPosition();
        }
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
      if (state.isPlaying && state.audioMode === 'video') {
        startYtProgressTracking();
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

  // ==========================================
  // 3. YouTube Secondary Engine (Video Dock & Direct Fallback)
  // ==========================================
  let pendingYtVideoId = null;
  let ytProgressInterval = null;

  function startYtProgressTracking() {
    stopYtProgressTracking();
    updateYtProgress();
    ytProgressInterval = setInterval(updateYtProgress, 250);
  }

  function stopYtProgressTracking() {
    if (ytProgressInterval) {
      clearInterval(ytProgressInterval);
      ytProgressInterval = null;
    }
  }

  function updateYtProgress() {
    if (!state.ytPlayer || typeof state.ytPlayer.getCurrentTime !== 'function') return;

    let current = 0;
    let duration = 0;
    try {
      current = state.ytPlayer.getCurrentTime() || 0;
      duration = state.ytPlayer.getDuration() || 0;
    } catch (e) {
      return;
    }

    // Fallback to track duration if ytPlayer duration not yet available
    if (!Number.isFinite(duration) || duration <= 0) {
      const curTrack = state.queue[state.currentIndex];
      if (curTrack && curTrack.duration) {
        duration = parseDurationToSeconds(curTrack.duration);
      }
    }

    const fmtCurrent = formatTime(current);
    const fmtTotal = (Number.isFinite(duration) && duration > 0)
      ? formatTime(duration)
      : (state.queue[state.currentIndex]?.duration || '0:00');

    el.currentTime.textContent = fmtCurrent;
    el.totalDuration.textContent = fmtTotal;
    if (el.sheetCurrentTime) el.sheetCurrentTime.textContent = fmtCurrent;
    if (el.sheetTotalDuration) el.sheetTotalDuration.textContent = fmtTotal;

    if (duration > 0) {
      const percent = Math.min(100, Math.max(0, (current / duration) * 100));
      el.progressFill.style.width = `${percent}%`;
      if (el.mobileMiniProgressFill) el.mobileMiniProgressFill.style.width = `${percent}%`;
      if (el.sheetProgressFill) el.sheetProgressFill.style.width = `${percent}%`;
    }

    // Update MediaSession lock-screen position state
    if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
      if (Number.isFinite(duration) && duration > 0) {
        try {
          navigator.mediaSession.setPositionState({
            duration: duration,
            playbackRate: 1,
            position: Math.min(current, duration)
          });
        } catch (e) {}
      }
    }
  }

  window.onYouTubeIframeAPIReady = function() {
    state.ytPlayer = new YT.Player('yt-player', {
      height: '100%',
      width: '100%',
      playerVars: {
        autoplay: 0,
        controls: 1,
        rel: 0,
        modestbranding: 1,
        playsinline: 1,
        origin: window.location.origin
      },
      events: {
        onReady: () => {
          state.isPlayerReady = true;
          console.log('[YouTube Player] Ready');
          if (pendingYtVideoId && state.audioMode === 'video') {
            playViaYouTube(pendingYtVideoId);
          }
        },
        onStateChange: onYouTubeStateChange,
        onError: onYouTubeError
      }
    });
  };

  function onYouTubeStateChange(event) {
    if (state.audioMode === 'video') {
      if (event.data === YT.PlayerState.PLAYING) {
        state.isPlaying = true;
        updatePlayPauseUI(true);
        startYtProgressTracking();
        if (streamTimeout) clearTimeout(streamTimeout);
        if (el.playingIndicator) el.playingIndicator.classList.remove('hidden');
        if (el.audioVisualizer) el.audioVisualizer.classList.add('active');
      } else if (event.data === YT.PlayerState.PAUSED) {
        state.isPlaying = false;
        updatePlayPauseUI(false);
        stopYtProgressTracking();
        if (el.playingIndicator) el.playingIndicator.classList.add('hidden');
        if (el.audioVisualizer) el.audioVisualizer.classList.remove('active');
      } else if (event.data === YT.PlayerState.ENDED) {
        stopYtProgressTracking();
        handleTrackEnded();
      } else if (event.data === YT.PlayerState.BUFFERING) {
        if (el.playingIndicator) el.playingIndicator.classList.remove('hidden');
      }
    }
  }

  function onYouTubeError(event) {
    console.warn('[YouTube Player Error] code=', event.data);
    stopYtProgressTracking();
    const curTrack = state.queue[state.currentIndex];
    const trackName = curTrack ? curTrack.title : 'Track';
    showToast(`⚠️ "${trackName}" cannot be played. Skipping to next...`, 3000);
    setTimeout(() => {
      playNext(true);
    }, 1000);
  }

  let streamTimeout = null;

  function playViaYouTube(videoId) {
    state.audioMode = 'video';
    audio.pause();
    pendingYtVideoId = videoId;

    if (state.ytPlayer && state.isPlayerReady && typeof state.ytPlayer.loadVideoById === 'function') {
      try {
        state.ytPlayer.loadVideoById(videoId);
        state.ytPlayer.playVideo();
        state.isPlaying = true;
        updatePlayPauseUI(true);
        startYtProgressTracking();
        const curTrack = state.queue[state.currentIndex];
        if (curTrack) showToast(`Now Playing: ${curTrack.title} 🎵`);
      } catch (err) {
        console.error('Error starting YouTube playback:', err);
      }
    } else {
      console.log('YouTube player initializing, queued video:', videoId);
    }
  }

  function preloadNextTrackSpeculative() {
    if (state.queue.length <= 1) return;
    const nextIdx = (state.currentIndex + 1) % state.queue.length;
    const nextTrack = state.queue[nextIdx];
    if (nextTrack) {
      const nextId = nextTrack.id || nextTrack.videoId;
      if (nextId) {
        fetch(`/api/audio-info/${nextId}?title=${encodeURIComponent(nextTrack.title)}`).catch(() => {});
      }
    }
  }

  // ==========================================
  // 4. Playback Controllers
  // ==========================================
  async function loadAndPlayTrack(track, addToQueue = true) {
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

    if (streamTimeout) clearTimeout(streamTimeout);

    if (state.isVideoDockVisible) {
      playViaYouTube(track.id);
      return;
    }

    state.audioMode = 'native';
    stopYtProgressTracking();
    if (state.ytPlayer && state.isPlayerReady) {
      try { state.ytPlayer.pauseVideo(); } catch (e) {}
    }

    let started = false;
    const onPlaying = () => {
      started = true;
      if (streamTimeout) clearTimeout(streamTimeout);
      audio.removeEventListener('playing', onPlaying);
      showToast(`Now Playing: ${track.title} 🎵`);
      preloadNextTrackSpeculative();
    };
    audio.addEventListener('playing', onPlaying);

    // Allow adequate time for initial stream extraction & buffering (10s)
    streamTimeout = setTimeout(() => {
      if (!started && !state.isPlaying) {
        console.warn('Stream buffering timeout, attempting YouTube fallback...');
        audio.removeEventListener('playing', onPlaying);
        if (state.audioMode !== 'video' && !track._triedYtFallback) {
          track._triedYtFallback = true;
          showToast(`Switching to backup player for "${track.title}"...`, 2500);
          playViaYouTube(track.id);
        } else {
          showToast(`⚠️ Buffering timeout for "${track.title}". Skipping...`, 3000);
          playNext(true);
        }
      }
    }, 10000);

    try {
      const streamUrl = `/api/stream/${track.id}?title=${encodeURIComponent(track.title)}`;
      audio.preload = "metadata";
      audio.src = streamUrl;
      audio.load();
      const playPromise = audio.play();
      if (playPromise !== undefined) {
        await playPromise.catch((err) => {
          if (err.name === 'NotAllowedError') {
            console.warn('[iOS Autoplay Restriction] User interaction required to start audio.');
            updatePlayPauseUI(false);
            showToast('Tap play to start listening ▶');
          } else {
            throw err;
          }
        });
      }
    } catch (err) {
      console.warn('Direct stream failed, falling back to YouTube player:', err);
      if (streamTimeout) clearTimeout(streamTimeout);
      audio.removeEventListener('playing', onPlaying);
      track._triedYtFallback = true;
      playViaYouTube(track.id);
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

    if (state.audioMode === 'video') {
      if (state.ytPlayer && state.isPlayerReady) {
        if (state.isPlaying) {
          state.ytPlayer.pauseVideo();
          state.isPlaying = false;
          updatePlayPauseUI(false);
          stopYtProgressTracking();
        } else {
          state.ytPlayer.playVideo();
          state.isPlaying = true;
          updatePlayPauseUI(true);
          startYtProgressTracking();
        }
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
    if (state.audioMode === 'video') {
      const curTime = (state.ytPlayer && typeof state.ytPlayer.getCurrentTime === 'function') ? state.ytPlayer.getCurrentTime() : 0;
      if (curTime > 4) {
        state.ytPlayer.seekTo(0, true);
        updateYtProgress();
        return;
      }
    } else {
      if (audio.currentTime > 4) {
        audio.currentTime = 0;
        return;
      }
    }
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
      if (state.audioMode === 'video') {
        if (state.ytPlayer) {
          state.ytPlayer.seekTo(0);
          state.ytPlayer.playVideo();
        }
      } else {
        audio.currentTime = 0;
        audio.play();
      }
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
    const dur = track.duration || '3:30';

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

  // Seeker Scrubber
  el.progressWrapper.addEventListener('click', function(e) {
    const rect = el.progressWrapper.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const fraction = Math.max(0, Math.min(1, clickX / rect.width));

    if (state.audioMode === 'video') {
      if (state.ytPlayer && typeof state.ytPlayer.getDuration === 'function') {
        const dur = state.ytPlayer.getDuration() || getEffectiveDuration();
        state.ytPlayer.seekTo(fraction * dur, true);
        updateYtProgress();
      }
    } else {
      const total = getEffectiveDuration();
      if (total > 0 && Number.isFinite(total)) {
        audio.currentTime = fraction * total;
        updateMediaSessionPosition();
      }
    }
    el.progressFill.style.width = `${fraction * 100}%`;
  });

  // Volume Slider
  el.volumeSlider.addEventListener('input', function(e) {
    const val = parseInt(e.target.value, 10);
    state.volume = val;
    state.isMuted = val === 0;
    audio.volume = val / 100;
    if (state.ytPlayer && state.isPlayerReady) {
      state.ytPlayer.setVolume(val);
    }
    updateVolumeUI();
  });

  el.btnMute.addEventListener('click', function() {
    state.isMuted = !state.isMuted;
    if (state.isMuted) {
      audio.muted = true;
      if (state.ytPlayer) state.ytPlayer.mute();
    } else {
      audio.muted = false;
      audio.volume = (state.volume || 50) / 100;
      if (state.ytPlayer) {
        state.ytPlayer.unMute();
        state.ytPlayer.setVolume(state.volume || 50);
      }
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

  // Mobile Sheet Scrubber
  if (el.sheetProgressWrapper) {
    el.sheetProgressWrapper.addEventListener('click', function(e) {
      const rect = el.sheetProgressWrapper.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const fraction = Math.max(0, Math.min(1, clickX / rect.width));

      if (state.audioMode === 'video') {
        if (state.ytPlayer && typeof state.ytPlayer.getDuration === 'function') {
          const dur = state.ytPlayer.getDuration() || getEffectiveDuration();
          state.ytPlayer.seekTo(fraction * dur, true);
          updateYtProgress();
        }
      } else {
        const total = getEffectiveDuration();
        if (total > 0 && Number.isFinite(total)) {
          audio.currentTime = fraction * total;
          updateMediaSessionPosition();
        }
      }
      if (el.sheetProgressFill) el.sheetProgressFill.style.width = `${fraction * 100}%`;
      if (el.mobileMiniProgressFill) el.mobileMiniProgressFill.style.width = `${fraction * 100}%`;
      el.progressFill.style.width = `${fraction * 100}%`;
    });
  }

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

  if (el.sheetBtnToggleVideo) {
    el.sheetBtnToggleVideo.addEventListener('click', function() {
      el.btnToggleVideo.click();
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

  if (el.mobileNavAiBtn) {
    el.mobileNavAiBtn.addEventListener('click', () => {
      openAiModal();
    });
  }

  // Liked Songs
  function toggleLikeTrack(track) {
    const idx = state.likedSongs.findIndex(t => t.id === track.id);
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
    if (state.queue[state.currentIndex]?.id === track.id) {
      updateCurrentTrackUI(track);
    }
    document.querySelectorAll(`.card-btn-icon[data-song-id="${track.id}"]`).forEach(btn => {
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
    if (!pl) return;

    if (pl.tracks.some(t => t.id === track.id)) {
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
    if (!pl) return;

    pl.tracks = pl.tracks.filter(t => t.id !== trackId);
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

  // ==========================================
  // 6b. AI Playlist Creator Wizard System
  // ==========================================
  function openAiModal() {
    setWizardStep(1);
    el.aiPlaylistModal.classList.remove('hidden');
    updateLangCounterUI();
  }

  function closeAiModal() {
    el.aiPlaylistModal.classList.add('hidden');
  }

  function setWizardStep(step) {
    state.aiWizard.step = step;

    // Hide all step containers
    el.wizardStep1.classList.add('hidden');
    el.wizardStep2.classList.add('hidden');
    el.wizardStep3.classList.add('hidden');
    el.wizardStepLoading.classList.add('hidden');
    el.wizardStepResult.classList.add('hidden');

    if (step === 1) el.wizardStep1.classList.remove('hidden');
    else if (step === 2) el.wizardStep2.classList.remove('hidden');
    else if (step === 3) el.wizardStep3.classList.remove('hidden');
    else if (step === 'loading') el.wizardStepLoading.classList.remove('hidden');
    else if (step === 4 || step === 'result') el.wizardStepResult.classList.remove('hidden');

    // Update progress bar UI
    const progressSteps = el.wizardProgress.querySelectorAll('.wizard-step');
    progressSteps.forEach(s => {
      const sNum = parseInt(s.dataset.step, 10);
      s.classList.remove('active', 'completed');
      if (typeof step === 'number') {
        if (sNum < step) s.classList.add('completed');
        else if (sNum === step) s.classList.add('active');
      } else if (step === 'loading' || step === 'result') {
        if (sNum <= 3) s.classList.add('completed');
        if (sNum === 4) s.classList.add('active');
      }
    });
  }

  function updateLangCounterUI() {
    const count = state.aiWizard.selectedLangs.size;
    el.langSelectedCounter.textContent = count === 1 ? '1 language selected' : `${count} languages selected`;
    el.btnNextToStep2.disabled = count === 0;
    el.btnNextToStep2.style.opacity = count === 0 ? '0.4' : '1';
    el.btnNextToStep2.style.pointerEvents = count === 0 ? 'none' : 'auto';
  }

  // Open & Close Triggers
  if (el.btnOpenAiCreator) el.btnOpenAiCreator.addEventListener('click', openAiModal);
  if (el.heroAiBtn) el.heroAiBtn.addEventListener('click', openAiModal);
  if (el.closeAiModal) el.closeAiModal.addEventListener('click', closeAiModal);

  // Close on outside click
  el.aiPlaylistModal.addEventListener('click', (e) => {
    if (e.target === el.aiPlaylistModal) closeAiModal();
  });

  // Step 1: Language selection cards
  document.querySelectorAll('#lang-grid .lang-card').forEach(card => {
    card.addEventListener('click', () => {
      const lang = card.dataset.lang;
      if (state.aiWizard.selectedLangs.has(lang)) {
        if (state.aiWizard.selectedLangs.size > 1) {
          state.aiWizard.selectedLangs.delete(lang);
          card.classList.remove('selected');
        } else {
          showToast('Select at least one language');
        }
      } else {
        state.aiWizard.selectedLangs.add(lang);
        card.classList.add('selected');
      }
      updateLangCounterUI();
    });
  });

  // Quick Language Presets
  document.querySelectorAll('.btn-preset-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const presetLangs = btn.dataset.preset.split(',').map(s => s.trim());
      state.aiWizard.selectedLangs = new Set(presetLangs);
      document.querySelectorAll('#lang-grid .lang-card').forEach(c => {
        c.classList.toggle('selected', presetLangs.includes(c.dataset.lang));
      });
      updateLangCounterUI();
      showToast(`Preset: ${presetLangs.join(' + ').toUpperCase()}`);
    });
  });

  // Step 1 -> Step 2
  el.btnNextToStep2.addEventListener('click', () => {
    if (state.aiWizard.selectedLangs.size === 0) {
      showToast('Please select at least one language');
      return;
    }
    setWizardStep(2);
  });

  // Step 2: Mood Selection cards
  document.querySelectorAll('#mood-grid .mood-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('#mood-grid .mood-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      state.aiWizard.selectedMood = card.dataset.mood;
    });
  });

  // Step 2 Navigation
  el.btnBackToStep1.addEventListener('click', () => setWizardStep(1));
  el.btnNextToStep3.addEventListener('click', () => setWizardStep(3));

  // Step 3: Era options
  document.querySelectorAll('#era-options .era-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#era-options .era-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.aiWizard.selectedEra = chip.dataset.era;
    });
  });

  // Step 3: Count options
  document.querySelectorAll('#count-options .count-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('#count-options .count-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.aiWizard.count = parseInt(chip.dataset.count, 10) || 12;
    });
  });

  // Step 3: Quick Prompt Suggestion Chips
  document.querySelectorAll('#prompt-chips-row .prompt-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const pText = chip.dataset.prompt;
      if (el.aiCustomPrompt) {
        el.aiCustomPrompt.value = pText;
        state.aiWizard.customPrompt = pText;
        showToast(`Selected prompt: ${chip.textContent.trim()}`);
      }
    });
  });

  // Step 3 Navigation
  el.btnBackToStep2.addEventListener('click', () => setWizardStep(2));

  // Step 3 -> Generate AI Playlist
  el.btnGenerateAi.addEventListener('click', async () => {
    state.aiWizard.customPrompt = el.aiCustomPrompt ? el.aiCustomPrompt.value.trim() : '';
    setWizardStep('loading');

    const langsArr = Array.from(state.aiWizard.selectedLangs);
    const langNames = langsArr.map(l => l.charAt(0).toUpperCase() + l.slice(1)).join(', ');

    // Dynamic loading messages
    const loadingMsgs = [
      `Searching trending & classic ${langNames} tracks...`,
      `Filtering for ${state.aiWizard.selectedMood} vibe & emotional flow...`,
      `Balancing multilingual crossfade & tempo...`,
      `Finalizing your custom streamable mix...`
    ];
    let msgIdx = 0;
    if (el.aiLoadingStatus) el.aiLoadingStatus.textContent = loadingMsgs[0];
    const msgInterval = setInterval(() => {
      msgIdx = (msgIdx + 1) % loadingMsgs.length;
      if (el.aiLoadingStatus) el.aiLoadingStatus.textContent = loadingMsgs[msgIdx];
    }, 1200);

    try {
      const resp = await fetch('/api/ai-playlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          languages: langsArr,
          mood: state.aiWizard.selectedMood,
          era: state.aiWizard.selectedEra,
          prompt: state.aiWizard.customPrompt,
          count: state.aiWizard.count
        })
      });

      clearInterval(msgInterval);

      if (!resp.ok) {
        throw new Error(`Server returned ${resp.status}`);
      }

      const data = await resp.json();
      // Normalize track contracts
      if (Array.isArray(data.tracks)) {
        data.tracks.forEach(t => {
          t.id = t.id || t.videoId;
          t.videoId = t.videoId || t.id;
        });
      }
      state.aiWizard.generatedPlaylist = data;
      renderAiPlaylistResult(data);
      setWizardStep(4);
    } catch (err) {
      clearInterval(msgInterval);
      console.error('Error generating AI playlist:', err);
      showToast('AI Playlist generation failed. Retrying with fallback...');
      
      // Attempt fallback via GET endpoint
      try {
        const getResp = await fetch(`/api/ai-playlist?langs=${langsArr.join(',')}&mood=${state.aiWizard.selectedMood}&era=${state.aiWizard.selectedEra}&count=${state.aiWizard.count}&prompt=${encodeURIComponent(state.aiWizard.customPrompt)}`);
        if (getResp.ok) {
          const fallbackData = await getResp.json();
          if (Array.isArray(fallbackData.tracks)) {
            fallbackData.tracks.forEach(t => {
              t.id = t.id || t.videoId;
              t.videoId = t.videoId || t.id;
            });
          }
          state.aiWizard.generatedPlaylist = fallbackData;
          renderAiPlaylistResult(fallbackData);
          setWizardStep(4);
          return;
        }
      } catch (getErr) {
        console.error('Fallback failed:', getErr);
      }
      setWizardStep(3);
    }
  });

  function renderAiPlaylistResult(data) {
    el.resultPlTitle.textContent = data.title || 'Custom AI Playlist';
    el.resultPlDesc.textContent = data.description || 'Curated blend of multi-language tracks';

    // Format language badges
    const displayLangs = (data.languages || []).map(l => l.charAt(0).toUpperCase() + l.slice(1)).join(' + ');
    el.resultLangsBadge.textContent = displayLangs || 'Multi-Language';
    el.resultCountBadge.textContent = `${data.tracks?.length || 0} Tracks`;

    // Render preview track items
    el.resultTracksPreview.innerHTML = '';
    const tracks = data.tracks || [];

    if (tracks.length === 0) {
      el.resultTracksPreview.innerHTML = '<p style="color: var(--text-dim); padding: 20px; text-align: center;">No tracks found for this specific combination. Try tweaking your prompt!</p>';
      return;
    }

    tracks.forEach((t, i) => {
      t.id = t.id || t.videoId;
      t.videoId = t.videoId || t.id;
      const item = document.createElement('div');
      item.className = 'result-track-item';
      item.innerHTML = `
        <img class="result-track-thumb" src="${t.thumbnail || 'https://i.ytimg.com/vi/' + t.id + '/hqdefault.jpg'}" alt="${t.title}" loading="lazy" decoding="async" />
        <div class="result-track-info">
          <div class="result-track-title">${t.title}</div>
          <div class="result-track-artist">${t.artist || 'Unknown Artist'}</div>
        </div>
        <span class="result-track-lang-pill">${t.language || 'Mix'}</span>
        <span class="result-track-duration">${t.duration || '3:30'}</span>
      `;
      item.style.cursor = 'pointer';
      item.addEventListener('click', () => {
        setQueueAndPlay(tracks, i);
        closeAiModal();
        showToast(`Playing "${t.title}" from AI mix 🎶`);
      });
      el.resultTracksPreview.appendChild(item);
    });

    // Reset save button state
    el.btnAiSavePlaylist.textContent = 'Save to My Playlists';
    el.btnAiSavePlaylist.disabled = false;

    // Action: Play Entire Playlist
    el.btnAiPlayNow.onclick = () => {
      if (tracks.length > 0) {
        setQueueAndPlay(tracks, 0);
        closeAiModal();
        showToast(`Playing "${data.title}" 🎶`);
      }
    };

    // Action: Save to My Playlists
    el.btnAiSavePlaylist.onclick = () => {
      if (!tracks || tracks.length === 0) return;
      const newPl = {
        id: 'pl_ai_' + Date.now(),
        name: data.title || 'AI Curated Mix',
        description: data.description || 'AI Curated Multi-Language Playlist',
        createdAt: Date.now(),
        tracks: tracks
      };
      state.playlists.push(newPl);
      savePlaylists();
      showToast(`Saved "${newPl.name}" to My Playlists! 📁`);
      el.btnAiSavePlaylist.textContent = '✓ Saved to Playlists';
      el.btnAiSavePlaylist.disabled = true;
    };

    // Action: Share Playlist
    if (el.btnAiSharePlaylist) {
      el.btnAiSharePlaylist.onclick = async () => {
        if (!tracks || tracks.length === 0) return;
        const topTracks = tracks.slice(0, 5).map((t, idx) => `${idx + 1}. ${t.title} - ${t.artist}`).join('\n');
        const shareText = `🎵 Check out my AI Playlist: "${data.title}" on Swarify!\n\nTop Tracks:\n${topTracks}\n\nStream full ad-free mix: ${window.location.origin}`;
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(shareText);
            showToast('Playlist summary copied to clipboard! 📋');
          } else {
            showToast('Share link ready!');
          }
        } catch (_) {
          showToast('Mix ready to share!');
        }
      };
    }

    // Action: Tweak Options
    el.btnAiTweak.onclick = () => {
      setWizardStep(3);
    };
  }

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

  // Video Dock Toggle
  el.btnToggleVideo.addEventListener('click', () => {
    state.isVideoDockVisible = !state.isVideoDockVisible;
    el.videoDock.classList.toggle('hidden', !state.isVideoDockVisible);
    el.btnToggleVideo.classList.toggle('active', state.isVideoDockVisible);

    const curTrack = state.queue[state.currentIndex];
    if (state.isVideoDockVisible && curTrack) {
      audio.pause();
      playViaYouTube(curTrack.id);
      showToast('Video Mode: Playing official video 🎬');
    } else if (!state.isVideoDockVisible && curTrack) {
      if (state.ytPlayer && state.isPlayerReady) {
        state.ytPlayer.pauseVideo();
      }
      stopYtProgressTracking();
      state.audioMode = 'native';
      audio.play().catch(e => console.warn('Audio play resumed error:', e));
      showToast('Audio Mode: Background & Screen-Off enabled 🎧');
    }
  });

  el.dockCloseBtn.addEventListener('click', () => {
    state.isVideoDockVisible = false;
    el.videoDock.classList.add('hidden');
    el.btnToggleVideo.classList.remove('active');
    const curTrack = state.queue[state.currentIndex];
    if (curTrack) {
      if (state.ytPlayer && state.isPlayerReady) state.ytPlayer.pauseVideo();
      stopYtProgressTracking();
      state.audioMode = 'native';
      audio.play().catch(e => console.warn('Audio play resumed error:', e));
    }
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
        <span class="card-duration-tag">${track.duration || '3:30'}</span>
        <button class="card-play-btn" title="Play">
          <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"></polygon></svg>
        </button>
      </div>
      <div class="card-title" title="${track.title}">${track.title}</div>
      <div class="card-artist" title="${track.artist}">${track.artist}</div>
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
      const [telRes, hinRes, engRes] = await Promise.all([
        fetch('/api/trending?lang=telugu').then(r => r.json()),
        fetch('/api/trending?lang=hindi').then(r => r.json()),
        fetch('/api/trending?lang=english').then(r => r.json())
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
            <div class="skeleton-line shimmer"></div>
            <div class="skeleton-line shimmer short"></div>
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
      audio.currentTime = Math.min(audio.duration || 9999, audio.currentTime + 5);
      updateMediaSessionPosition();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      audio.currentTime = Math.max(0, audio.currentTime - 5);
      updateMediaSessionPosition();
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

  // Keep-alive ping every 10 minutes (600,000 ms)
  setInterval(async () => {
    try {
      await fetch('/api/trending?lang=all');
      console.log('[Swarify] 10-minute keep-alive ping succeeded at', new Date().toLocaleTimeString());
    } catch (e) {
      console.warn('[Swarify] Keep-alive error:', e);
    }
  }, 10 * 60 * 1000);

  // Initialize
  updateLikedCountUI();
  updatePlaylistsSidebar();
  loadInitialCatalog();
})();
