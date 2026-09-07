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
    allEnglish: []
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
    btnQuickCreatePl: document.getElementById('btn-quick-create-pl')
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

  // Format Seconds to M:SS
  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  // Parse Duration String (e.g. "3:45") to Seconds
  function parseDurationToSeconds(durStr) {
    if (!durStr) return 210;
    const parts = durStr.split(':').map(Number);
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return 210;
  }

  // ==========================================
  // 1. Native HTML5 Audio Setup (Spotify Style)
  // ==========================================
  const audio = el.nativeAudio;
  audio.volume = state.volume / 100;

  audio.addEventListener('play', () => {
    state.isPlaying = true;
    updatePlayPauseUI(true);
    updateMediaSessionPosition();
  });

  audio.addEventListener('pause', () => {
    state.isPlaying = false;
    updatePlayPauseUI(false);
  });

  audio.addEventListener('timeupdate', () => {
    if (audio.duration && !isNaN(audio.duration)) {
      const current = audio.currentTime;
      const total = audio.duration;
      el.currentTime.textContent = formatTime(current);
      el.totalDuration.textContent = formatTime(total);
      const percent = Math.min(100, (current / total) * 100);
      el.progressFill.style.width = `${percent}%`;
    }
  });

  audio.addEventListener('loadedmetadata', () => {
    if (audio.duration && !isNaN(audio.duration)) {
      el.totalDuration.textContent = formatTime(audio.duration);
    }
  });

  audio.addEventListener('ended', () => {
    handleTrackEnded();
  });

  audio.addEventListener('error', (e) => {
    console.warn('Native audio stream error, falling back to YouTube Iframe:', e);
    const curTrack = state.queue[state.currentIndex];
    if (curTrack && state.ytPlayer && state.isPlayerReady) {
      showToast('Switching to secondary stream...');
      playViaYouTube(curTrack.id);
    } else {
      showToast('Error playing audio, skipping...');
      playNext(true);
    }
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
          audio.currentTime = details.seekTime;
          updateMediaSessionPosition();
        }
      });

      navigator.mediaSession.setActionHandler('seekforward', () => {
        audio.currentTime = Math.min(audio.duration || 9999, audio.currentTime + 10);
        updateMediaSessionPosition();
      });

      navigator.mediaSession.setActionHandler('seekbackward', () => {
        audio.currentTime = Math.max(0, audio.currentTime - 10);
        updateMediaSessionPosition();
      });
    }
  }

  function updateMediaSessionPosition() {
    if ('mediaSession' in navigator && 'setPositionState' in navigator.mediaSession) {
      if (audio.duration && !isNaN(audio.duration)) {
        navigator.mediaSession.setPositionState({
          duration: audio.duration,
          playbackRate: audio.playbackRate || 1,
          position: Math.min(audio.currentTime, audio.duration)
        });
      }
    }
  }

  // ==========================================
  // 3. YouTube Secondary Engine (Video Dock)
  // ==========================================
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
        onReady: () => { state.isPlayerReady = true; },
        onStateChange: onYouTubeStateChange
      }
    });
  };

  function onYouTubeStateChange(event) {
    if (state.audioMode === 'video') {
      if (event.data === YT.PlayerState.PLAYING) {
        state.isPlaying = true;
        updatePlayPauseUI(true);
      } else if (event.data === YT.PlayerState.PAUSED) {
        state.isPlaying = false;
        updatePlayPauseUI(false);
      } else if (event.data === YT.PlayerState.ENDED) {
        handleTrackEnded();
      }
    }
  }

  let streamTimeout = null;

  function playViaYouTube(videoId) {
    state.audioMode = 'video';
    audio.pause();
    if (state.ytPlayer && state.isPlayerReady) {
      state.ytPlayer.loadVideoById(videoId);
      state.ytPlayer.playVideo();
      state.isPlaying = true;
      updatePlayPauseUI(true);
      const curTrack = state.queue[state.currentIndex];
      if (curTrack) showToast(`Now Playing: ${curTrack.title} 🎵`);
    }
  }

  // ==========================================
  // 4. Playback Controllers
  // ==========================================
  async function loadAndPlayTrack(track, addToQueue = true) {
    if (!track || !track.id) return;

    if (addToQueue) {
      const existingIdx = state.queue.findIndex(t => t.id === track.id);
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
    if (state.ytPlayer && state.isPlayerReady) {
      try { state.ytPlayer.pauseVideo(); } catch (e) {}
    }

    let started = false;
    const onPlaying = () => {
      started = true;
      if (streamTimeout) clearTimeout(streamTimeout);
      audio.removeEventListener('playing', onPlaying);
      showToast(`Now Playing: ${track.title} 🎵`);
    };
    audio.addEventListener('playing', onPlaying);

    // If native stream does not start within 3.5s, seamlessly fallback to YouTube engine
    streamTimeout = setTimeout(() => {
      if (!started && !state.isPlaying) {
        console.warn('Stream buffering timeout, switching engine...');
        audio.removeEventListener('playing', onPlaying);
        playViaYouTube(track.id);
      }
    }, 3500);

    try {
      const streamUrl = `/api/stream/${track.id}?title=${encodeURIComponent(track.title)}`;
      audio.src = streamUrl;
      audio.load();
      await audio.play();
    } catch (err) {
      console.warn('Direct stream failed, falling back:', err);
      if (streamTimeout) clearTimeout(streamTimeout);
      audio.removeEventListener('playing', onPlaying);
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
        if (state.isPlaying) state.ytPlayer.pauseVideo();
        else state.ytPlayer.playVideo();
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
    if (audio.currentTime > 4) {
      audio.currentTime = 0;
      return;
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
      el.playingIndicator.classList.remove('hidden');
      el.audioVisualizer.classList.add('active');
    } else {
      el.playIcon.classList.remove('hidden');
      el.pauseIcon.classList.add('hidden');
      el.playingIndicator.classList.add('hidden');
      el.audioVisualizer.classList.remove('active');
    }
  }

  function updateCurrentTrackUI(track) {
    el.playerTitle.textContent = track.title || 'Unknown Title';
    el.playerArtist.textContent = track.artist || 'MARK 3 Music';
    el.playerThumb.src = track.thumbnail || `https://i.ytimg.com/vi/${track.id}/hqdefault.jpg`;
    el.totalDuration.textContent = track.duration || '3:30';

    const isLiked = state.likedSongs.some(t => t.id === track.id);
    if (isLiked) {
      el.playerLikeBtn.classList.add('active');
      el.playerLikeBtn.querySelector('svg').style.fill = '#ef4444';
      el.playerLikeBtn.querySelector('svg').style.stroke = '#ef4444';
    } else {
      el.playerLikeBtn.classList.remove('active');
      el.playerLikeBtn.querySelector('svg').style.fill = 'none';
      el.playerLikeBtn.querySelector('svg').style.stroke = 'currentColor';
    }
  }

  // Seeker Scrubber
  el.progressWrapper.addEventListener('click', function(e) {
    const rect = el.progressWrapper.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const fraction = Math.max(0, Math.min(1, clickX / rect.width));

    if (state.audioMode === 'video') {
      if (state.ytPlayer && state.ytPlayer.getDuration) {
        state.ytPlayer.seekTo(fraction * state.ytPlayer.getDuration(), true);
      }
    } else {
      if (audio.duration && !isNaN(audio.duration)) {
        audio.currentTime = fraction * audio.duration;
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
        <img class="queue-thumb" src="${track.thumbnail}" alt="" />
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
      state.audioMode = 'native';
      audio.play();
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
      state.audioMode = 'native';
      audio.play();
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
        <img src="${track.thumbnail}" alt="${track.title}" loading="lazy" />
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

  // Search & Suggestions
  let searchDebounce;
  el.searchInput.addEventListener('input', function() {
    const query = el.searchInput.value.trim();
    el.clearSearchBtn.classList.toggle('hidden', query.length === 0);

    if (query.length === 0) {
      el.suggestionsDropdown.classList.add('hidden');
      return;
    }

    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      fetchSuggestions(query);
    }, 200);
  });

  el.searchInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
      const q = el.searchInput.value.trim();
      if (q) {
        performSearch(q);
        el.suggestionsDropdown.classList.add('hidden');
      }
    }
  });

  el.clearSearchBtn.addEventListener('click', function() {
    el.searchInput.value = '';
    el.clearSearchBtn.classList.add('hidden');
    el.suggestionsDropdown.classList.add('hidden');
    switchView('home');
  });

  async function fetchSuggestions(query) {
    try {
      const res = await fetch(`/api/suggestions?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (data.suggestions && data.suggestions.length > 0) {
        renderSuggestions(data.suggestions);
      } else {
        el.suggestionsDropdown.classList.add('hidden');
      }
    } catch (e) {
      el.suggestionsDropdown.classList.add('hidden');
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

  async function performSearch(query) {
    showToast(`Searching for "${query}"...`);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      const results = data.results || [];

      renderSearchResultsView(query, results);
    } catch (err) {
      console.error('Search failed:', err);
      showToast('Search failed. Please try again.');
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

  // Initialize
  updateLikedCountUI();
  updatePlaylistsSidebar();
  loadInitialCatalog();
})();
