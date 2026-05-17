// Podcast miniplayer: RSS fetching, global audio player, Media Session API

(function () {
  const PROXY = 'https://api.allorigins.win/raw?url=';
  const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

  let audio = null;
  let currentRssUrl = null;

  function getAudio() {
    if (!audio) {
      audio = new Audio();
      audio.preload = 'metadata';
      audio.addEventListener('timeupdate', onTimeUpdate);
      audio.addEventListener('ended', onEnded);
      audio.addEventListener('play', onPlay);
      audio.addEventListener('pause', onPause);
    }
    return audio;
  }

  // ── RSS fetch & parse ─────────────────────────────────────────────────────

  async function fetchLatestEpisode(rssUrl) {
    const cacheKey = 'podcast:' + rssUrl;
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const { ts, data } = JSON.parse(cached);
        if (Date.now() - ts < CACHE_TTL) return data;
      }
    } catch (_) {}

    const res = await fetch(PROXY + encodeURIComponent(rssUrl));
    if (!res.ok) throw new Error('RSS fetch failed');
    const text = await res.text();
    const xml = new DOMParser().parseFromString(text, 'text/xml');

    const item = xml.querySelector('item');
    if (!item) throw new Error('No episodes found');

    const title = item.querySelector('title')?.textContent?.trim() || 'Latest Episode';
    const enclosure = item.querySelector('enclosure');
    const audioUrl = enclosure?.getAttribute('url') || null;

    // artwork: try itunes:image on item, then channel
    const itunesNS = 'http://www.itunes.com/dtds/podcast-1.0.dtd';
    let artwork = item.getElementsByTagNameNS(itunesNS, 'image')[0]?.getAttribute('href')
      || xml.querySelector('channel')?.getElementsByTagNameNS(itunesNS, 'image')[0]?.getAttribute('href')
      || xml.querySelector('channel > image > url')?.textContent
      || null;

    const pubDate = item.querySelector('pubDate')?.textContent?.trim() || null;

    const data = { title, audioUrl, artwork, pubDate };
    try { sessionStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data })); } catch (_) {}
    return data;
  }

  // ── Global player DOM ─────────────────────────────────────────────────────

  function getPlayer() { return document.getElementById('global-player'); }

  function showPlayer(podcastName, episodeTitle) {
    const p = getPlayer();
    if (!p) return;
    p.querySelector('.gp-podcast').textContent = podcastName;
    p.querySelector('.gp-episode').textContent = episodeTitle;
    p.classList.remove('gp-hidden');
  }

  function hidePlayer() {
    const p = getPlayer();
    if (p) p.classList.add('gp-hidden');
  }

  function setPlayState(playing) {
    const btn = document.querySelector('#global-player .gp-play-btn');
    if (btn) btn.textContent = playing ? '⏸' : '▶';
    // sync all card buttons for the active card
    document.querySelectorAll('.podcast-play-btn').forEach(b => {
      if (b.dataset.rssUrl === currentRssUrl) {
        b.textContent = playing ? '⏸ Pause' : '▶ Resume';
      }
    });
  }

  function onPlay() { setPlayState(true); updateMediaSession(); }
  function onPause() { setPlayState(false); }
  function onEnded() {
    setPlayState(false);
    const bar = document.querySelector('#global-player .gp-fill');
    if (bar) bar.style.width = '100%';
  }

  function onTimeUpdate() {
    const a = getAudio();
    if (!a.duration) return;
    const pct = (a.currentTime / a.duration) * 100;
    const bar = document.querySelector('#global-player .gp-fill');
    if (bar) bar.style.width = pct + '%';
    const time = document.querySelector('#global-player .gp-time');
    if (time) time.textContent = fmt(a.currentTime) + ' / ' + fmt(a.duration);
  }

  function fmt(s) {
    s = Math.floor(s || 0);
    const m = Math.floor(s / 60);
    const sec = String(s % 60).padStart(2, '0');
    if (m >= 60) return Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0') + ':' + sec;
    return m + ':' + sec;
  }

  // ── Media Session API ──────────────────────────────────────────────────────

  let _mediaTitle = '';
  let _mediaArtist = '';
  let _mediaArtwork = null;

  function updateMediaSession() {
    if (!('mediaSession' in navigator)) return;
    const artwork = _mediaArtwork
      ? [{ src: _mediaArtwork, sizes: '512x512', type: 'image/jpeg' }]
      : [];
    navigator.mediaSession.metadata = new MediaMetadata({
      title: _mediaTitle,
      artist: _mediaArtist,
      artwork
    });
  }

  function setupMediaSessionHandlers() {
    if (!('mediaSession' in navigator)) return;
    const a = getAudio();
    navigator.mediaSession.setActionHandler('play', () => a.play());
    navigator.mediaSession.setActionHandler('pause', () => a.pause());
    navigator.mediaSession.setActionHandler('seekbackward', () => { a.currentTime = Math.max(0, a.currentTime - 15); });
    navigator.mediaSession.setActionHandler('seekforward', () => { a.currentTime = Math.min(a.duration || Infinity, a.currentTime + 30); });
  }

  // ── Play an episode ───────────────────────────────────────────────────────

  async function playEpisode(rssUrl, podcastName, btn) {
    const a = getAudio();

    // Toggling the same podcast
    if (currentRssUrl === rssUrl) {
      if (a.paused) { a.play(); }
      else { a.pause(); }
      return;
    }

    // Switch to new episode
    currentRssUrl = rssUrl;

    // Reset all other card buttons
    document.querySelectorAll('.podcast-play-btn').forEach(b => {
      if (b.dataset.rssUrl !== rssUrl) b.textContent = '▶ Play Latest';
    });

    btn.textContent = '⏳ Loading…';
    btn.disabled = true;

    try {
      const ep = await fetchLatestEpisode(rssUrl);
      if (!ep.audioUrl) throw new Error('No audio file in this feed');

      _mediaTitle = ep.title;
      _mediaArtist = podcastName;
      _mediaArtwork = ep.artwork;

      a.src = ep.audioUrl;
      a.load();
      await a.play();

      showPlayer(podcastName, ep.title);
      setupMediaSessionHandlers();
    } catch (err) {
      btn.textContent = '⚠ ' + (err.message || 'Error');
      btn.disabled = false;
      currentRssUrl = null;
      setTimeout(() => { btn.textContent = '▶ Play Latest'; }, 3000);
      return;
    }

    btn.disabled = false;
  }

  // ── Global player init ────────────────────────────────────────────────────

  function initGlobalPlayer() {
    const p = getPlayer();
    if (!p) return;

    // Play / pause toggle
    p.querySelector('.gp-play-btn').addEventListener('click', () => {
      const a = getAudio();
      if (a.paused) a.play(); else a.pause();
    });

    // Seek on progress bar click
    p.querySelector('.gp-track').addEventListener('click', e => {
      const a = getAudio();
      if (!a.duration) return;
      const rect = e.currentTarget.getBoundingClientRect();
      a.currentTime = ((e.clientX - rect.left) / rect.width) * a.duration;
    });

    // Skip back 15s
    p.querySelector('.gp-back-btn').addEventListener('click', () => {
      const a = getAudio();
      a.currentTime = Math.max(0, a.currentTime - 15);
    });

    // Skip forward 30s
    p.querySelector('.gp-fwd-btn').addEventListener('click', () => {
      const a = getAudio();
      a.currentTime = Math.min(a.duration || Infinity, a.currentTime + 30);
    });

    // Close
    p.querySelector('.gp-close-btn').addEventListener('click', () => {
      const a = getAudio();
      a.pause();
      a.src = '';
      currentRssUrl = null;
      hidePlayer();
      document.querySelectorAll('.podcast-play-btn').forEach(b => { b.textContent = '▶ Play Latest'; });
    });
  }

  // ── Public API ────────────────────────────────────────────────────────────

  window.PodcastPlayer = { playEpisode, initGlobalPlayer };
})();
