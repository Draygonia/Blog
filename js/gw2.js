// Guild Wars 2 character roster + equipment display

(function () {

  const GW2_API = 'https://api.guildwars2.com/v2';

  const RARITY_CLASS = {
    Junk:        'gw2-r-junk',
    Basic:       'gw2-r-basic',
    Fine:        'gw2-r-fine',
    Masterwork:  'gw2-r-masterwork',
    Rare:        'gw2-r-rare',
    Exotic:      'gw2-r-exotic',
    Ascended:    'gw2-r-ascended',
    Legendary:   'gw2-r-legendary',
  };

  const PROF_COLOR = {
    Guardian:     '#3E88D4',
    Warrior:      '#FFD166',
    Engineer:     '#D09C59',
    Ranger:       '#67A84B',
    Thief:        '#74A0B0',
    Elementalist: '#F68A87',
    Mesmer:       '#9B5C9A',
    Necromancer:  '#52A76F',
    Revenant:     '#A0303A',
  };

  const SLOT_LABEL = {
    Helm:        'Helm',
    Shoulders:   'Shoulders',
    Coat:        'Coat',
    Gloves:      'Gloves',
    Leggings:    'Leggings',
    Boots:       'Boots',
    Backpack:    'Back',
    Amulet:      'Amulet',
    Accessory1:  'Accessory 1',
    Accessory2:  'Accessory 2',
    Ring1:       'Ring 1',
    Ring2:       'Ring 2',
    WeaponA1:    'Weapon 1',
    WeaponA2:    'Off-hand 1',
  };

  const SLOT_ORDER = [
    'Helm', 'Shoulders', 'Coat', 'Gloves', 'Leggings', 'Boots',
    'Backpack',
    'Amulet', 'Accessory1', 'Accessory2', 'Ring1', 'Ring2',
    'WeaponA1', 'WeaponA2',
  ];

  // ── Public entry point ────────────────────────────────────────────────────

  async function render(containerId, gameData) {
    const el = document.getElementById(containerId);
    if (!el) return;

    const apiKey = (gameData || {}).apiKey;
    if (!apiKey || apiKey === 'YOUR_GW2_API_KEY_HERE') {
      el.innerHTML = `
        <div class="gw2-empty">
          <div class="gw2-empty-title">No API Key Configured</div>
          <div class="gw2-empty-text">
            Add your GW2 API key to <code>data/games/guild-wars-2.json</code>.<br>
            Generate one at <strong>account.arena.net</strong> with <em>characters</em> scope.
          </div>
        </div>`;
      return;
    }

    el.innerHTML = `<div class="gw2-loading"><div class="spinner"></div> Loading characters&hellip;</div>`;

    try {
      const chars = await fetchCharacters(apiKey);
      if (!chars.length) {
        el.innerHTML = `<div class="gw2-empty"><div class="gw2-empty-title">No characters found.</div></div>`;
        return;
      }

      const itemMap = await fetchItems(chars);
      el.innerHTML = `
        <div class="gw2-roster" id="gw2-roster">${chars.map((c, i) => renderCharCard(c, i)).join('')}</div>
        <div class="gw2-detail" id="gw2-detail" style="display:none"></div>`;

      el.querySelectorAll('.gw2-view-btn').forEach(btn => {
        btn.addEventListener('click', () => showDetail(chars, parseInt(btn.dataset.idx), itemMap));
      });
    } catch (err) {
      el.innerHTML = `<div class="gw2-error">Failed to load characters: ${escHtml(err.message)}</div>`;
    }
  }

  // ── API fetching ──────────────────────────────────────────────────────────

  async function fetchCharacters(apiKey) {
    const res = await fetch(`${GW2_API}/characters?ids=all&access_token=${encodeURIComponent(apiKey)}`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.text || `API error ${res.status}`);
    }
    return res.json();
  }

  async function fetchItems(chars) {
    const ids = new Set();
    for (const c of chars) {
      for (const item of (c.equipment || [])) {
        if (item.id) ids.add(item.id);
      }
    }
    if (!ids.size) return {};

    const idList = [...ids].join(',');
    const res = await fetch(`${GW2_API}/items?ids=${idList}`);
    if (!res.ok) return {};
    const items = await res.json();
    const map = {};
    for (const item of items) map[item.id] = item;
    return map;
  }

  // ── Roster card ───────────────────────────────────────────────────────────

  function renderCharCard(c, idx) {
    const profColor = PROF_COLOR[c.profession] || '#888';
    return `
      <div class="gw2-char-card">
        <div class="gw2-char-name">${escHtml(c.name)}</div>
        <div class="gw2-char-meta">
          <span class="gw2-prof-badge" style="--prof-color:${profColor}">${escHtml(c.profession)}</span>
          <span class="gw2-char-race">${escHtml(c.race)}</span>
        </div>
        <div class="gw2-char-level">Level ${escHtml(String(c.level))}</div>
        <button class="gw2-view-btn" data-idx="${idx}">View Equipment &rsaquo;</button>
      </div>`;
  }

  // ── Detail view ───────────────────────────────────────────────────────────

  function showDetail(chars, idx, itemMap) {
    const c = chars[idx];
    const roster = document.getElementById('gw2-roster');
    const detail = document.getElementById('gw2-detail');
    if (!roster || !detail) return;

    const profColor = PROF_COLOR[c.profession] || '#888';
    detail.innerHTML = `
      <div class="gw2-detail-header">
        <button class="gw2-back-btn" id="gw2-back">&larr; Roster</button>
        <div class="gw2-detail-title">
          <span class="gw2-detail-name">${escHtml(c.name)}</span>
          <span class="gw2-detail-meta">
            <span class="gw2-prof-badge" style="--prof-color:${profColor}">${escHtml(c.profession)}</span>
            ${escHtml(c.race)} &middot; Level ${escHtml(String(c.level))}
          </span>
        </div>
      </div>
      <div class="gw2-equip-grid">${renderEquipGrid(c.equipment || [], itemMap)}</div>`;

    roster.style.display = 'none';
    detail.style.display = '';
    detail.querySelector('#gw2-back').addEventListener('click', () => {
      detail.style.display = 'none';
      roster.style.display = '';
    });
  }

  // ── Equipment grid ────────────────────────────────────────────────────────

  function renderEquipGrid(equipment, itemMap) {
    const bySlot = {};
    for (const entry of equipment) {
      if (entry.slot && !bySlot[entry.slot]) bySlot[entry.slot] = entry;
    }

    return SLOT_ORDER.map(slot => {
      const label = SLOT_LABEL[slot];
      const entry = bySlot[slot];
      const slotClass = `gw2-slot-${slot.toLowerCase().replace(/\d/g, s => s)}`;

      if (!entry) {
        return `<div class="gw2-slot gw2-slot--empty ${slotClass}">
                  <div class="gw2-slot-label">${label}</div>
                  <div class="gw2-slot-empty-text">—</div>
                </div>`;
      }

      const item = itemMap[entry.id];
      const name = item ? item.name : `Item #${entry.id}`;
      const rarity = item ? item.rarity : 'Basic';
      const rc = RARITY_CLASS[rarity] || 'gw2-r-basic';

      return `
        <div class="gw2-slot ${slotClass}">
          <div class="gw2-slot-label">${label}</div>
          <div class="gw2-item-name ${rc}">${escHtml(name)}</div>
          ${rarity !== 'Basic' ? `<div class="gw2-item-rarity">${escHtml(rarity)}</div>` : ''}
        </div>`;
    }).join('');
  }

  // ── Export ────────────────────────────────────────────────────────────────

  window.GW2 = { render };

})();
