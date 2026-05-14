// Icon lookup cache (sessionStorage-backed to survive page navigations)
const _iconCache = {};

async function fetchCoinIcon(symbol, name) {
  const key = (symbol || name || '').toLowerCase();
  if (!key) return null;
  if (_iconCache[key]) return _iconCache[key];

  const stored = sessionStorage.getItem('coin-icon:' + key);
  if (stored) { _iconCache[key] = stored; return stored; }

  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/search?query=' + encodeURIComponent(symbol || name),
      { headers: { Accept: 'application/json' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const coins = data.coins || [];
    // Prefer exact symbol match, then exact name match, then first result
    const match =
      coins.find(c => c.symbol.toLowerCase() === (symbol || '').toLowerCase()) ||
      coins.find(c => c.name.toLowerCase() === (name || '').toLowerCase()) ||
      coins[0];
    const url = (match && (match.large || match.thumb)) || null;
    if (url) {
      _iconCache[key] = url;
      try { sessionStorage.setItem('coin-icon:' + key, url); } catch {}
    }
    return url;
  } catch {
    return null;
  }
}

async function loadWalletsPanel(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;

  el.innerHTML = '<div class="loading"><div class="spinner"></div> Loading&hellip;</div>';

  try {
    const res = await fetch(rawUrl('data/wallets.json'));
    if (!res.ok) throw new Error('not found');
    const { wallets } = await res.json();

    if (!wallets || wallets.length === 0) {
      el.innerHTML = '<p class="wallet-empty">No wallets added yet.</p>';
      return;
    }

    // Fetch all icons in parallel
    const withIcons = await Promise.all(
      wallets.map(async w => ({ ...w, icon: await fetchCoinIcon(w.symbol, w.name) }))
    );

    el.innerHTML = withIcons.map((w, i) => `
      <div class="wallet-card">
        <div class="wallet-header">
          ${w.icon
            ? `<img src="${escHtml(w.icon)}" class="wallet-icon" alt="${escHtml(w.symbol || w.name)}">`
            : `<div class="wallet-icon-ph">${escHtml((w.symbol || w.name || '?').slice(0, 1).toUpperCase())}</div>`
          }
          <span class="wallet-name">${escHtml(w.name)}</span>
          ${w.symbol ? `<span class="wallet-symbol">${escHtml(w.symbol.toUpperCase())}</span>` : ''}
        </div>
        <div class="wallet-addr" data-addr="${escHtml(w.address)}" onclick="copyWalletAddr(this)" title="Click to copy">
          <span class="wallet-addr-text">${escHtml(shortAddr(w.address))}</span>
          <span class="wallet-copy-icon">&#128203;</span>
        </div>
      </div>
    `).join('');
  } catch {
    el.innerHTML = '<p class="wallet-empty">Could not load wallets.</p>';
  }
}

function shortAddr(addr) {
  if (!addr) return '';
  if (addr.length <= 18) return addr;
  return addr.slice(0, 8) + '…' + addr.slice(-6);
}

function copyWalletAddr(el) {
  const addr = el.dataset.addr;
  if (!addr) return;
  navigator.clipboard.writeText(addr).then(() => {
    const prev = el.innerHTML;
    el.innerHTML = '<span style="color:var(--green);font-size:11px">&#10003; Copied!</span>';
    setTimeout(() => { el.innerHTML = prev; }, 1600);
  }).catch(() => {
    prompt('Copy this address:', addr);
  });
}
