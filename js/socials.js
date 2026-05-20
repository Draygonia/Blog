// Socials page and game sub-page rendering

const PLATFORM_ICONS = {
  'twitter / x': '𝕏', 'youtube': '▶', 'twitch': '🎮', 'instagram': '📷',
  'tiktok': '♪', 'discord': '💬', 'reddit': '🔴', 'bluesky': '🦋',
  'github': '⌥', 'facebook': 'f', 'linkedin': 'in', 'mastodon': '🐘',
  'steam': '♨', 'battle.net': '⚔', 'xbox live': '✕', 'playstation network': 'PS',
  'nintendo switch': '⊕', 'epic games': '◈', 'riot games': '⚔', 'ubisoft connect': 'U',
  'origin': '○', 'gog': '◉',
};

function platformIcon(name) {
  return PLATFORM_ICONS[name.toLowerCase()] || name.slice(0, 2).toUpperCase();
}

async function loadSocialsPage(containerId) {
  const el = document.getElementById(containerId);
  try {
    const res = await fetch(rawUrl('data/socials.json'), { cache: 'no-store' });
    if (!res.ok) throw new Error('socials.json not found');
    const data = await res.json();

    const socialItems   = (data.socials || []).filter(s => s.category === 'Socials'    && s.url);
    const gamerItems    = (data.socials || []).filter(s => s.category === 'Gamer Tags' && s.tag);
    const games         = data.games || [];

    const parts = [];

    if (socialItems.length) {
      parts.push(`
        <div class="socials-section">
          <div class="socials-section-header">Socials</div>
          <div class="socials-grid">
            ${socialItems.map(s => `
              <a href="${escHtml(s.url)}" target="_blank" rel="noopener noreferrer" class="social-card">
                <div class="social-card-icon">${escHtml(platformIcon(s.platform))}</div>
                <div class="social-card-info">
                  <div class="social-card-name">${escHtml(s.platform)}</div>
                </div>
              </a>`).join('')}
          </div>
        </div>`);
    }

    if (gamerItems.length) {
      parts.push(`
        <div class="socials-section">
          <div class="socials-section-header">Gamer Tags</div>
          <div class="socials-grid">
            ${gamerItems.map(s => `
              <div class="gamer-tag-card">
                <div class="gamer-tag-card-icon">${escHtml(platformIcon(s.platform))}</div>
                <div class="gamer-tag-card-info">
                  <div class="gamer-tag-card-name">${escHtml(s.platform)}</div>
                  <div class="gamer-tag-card-tag">${escHtml(s.tag)}</div>
                </div>
              </div>`).join('')}
          </div>
        </div>`);
    }

    if (games.length) {
      parts.push(`
        <div class="socials-section">
          <div class="socials-section-header">Games</div>
          <div class="games-grid">
            ${games.map(g => {
              const logoUrl = g.logo ? rawUrl(g.logo) : '';
              const logoClass = logoUrl ? ' game-card--has-logo' : '';
              const logoStyle = logoUrl ? ` style="--game-logo-img: url('${encodeURI(logoUrl)}')"` : '';
              return `
              <a href="game.html?id=${encodeURIComponent(g.id)}" class="game-card${logoClass}"${logoStyle}>
                <div class="game-card-body">
                  <div class="game-card-title">${escHtml(g.title)}</div>
                  <div class="game-card-arrow">View &rsaquo;</div>
                </div>
              </a>`;
            }).join('')}
          </div>
        </div>`);
    }

    if (!parts.length) {
      el.innerHTML = `<div class="empty-state"><p>No socials configured yet. Set them up in the <a href="admin.html">admin panel</a>.</p></div>`;
    } else {
      el.innerHTML = parts.join('');
    }
  } catch (err) {
    el.innerHTML = `<div class="empty-state"><p>Could not load socials: ${escHtml(err.message)}</p></div>`;
  }
}

async function loadGamePage(containerId) {
  const el = document.getElementById(containerId);
  const id = new URLSearchParams(window.location.search).get('id');
  if (!id) { el.innerHTML = '<p>No game specified.</p>'; return; }

  try {
    const [socialsRes, gameRes] = await Promise.all([
      fetch(rawUrl('data/socials.json'), { cache: 'no-store' }),
      fetch(rawUrl(`data/games/${id}.json`), { cache: 'no-store' }),
    ]);

    if (!socialsRes.ok) throw new Error('socials.json not found');
    const socialsData = await socialsRes.json();
    const game = (socialsData.games || []).find(g => g.id === id);
    if (!game) throw new Error('Game not found');

    document.title = `${game.title} — Draygonia`;
    document.getElementById('breadcrumb-game').textContent = game.title;

    el.innerHTML = `<div class="game-content-area" id="game-body"></div>`;

    if (gameRes.ok) {
      const gameData = await gameRes.json();
      const RENDERERS = { 'diablo-2-resurrected': window.D2R, 'guild-wars-2': window.GW2 };
      const renderer = RENDERERS[id];
      if (renderer) renderer.render('game-body', gameData);
    }
  } catch (err) {
    el.innerHTML = `<p style="color:var(--text-muted);padding:18px">${escHtml(err.message)}</p>`;
  }
}
