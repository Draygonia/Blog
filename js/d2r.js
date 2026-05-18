// D2R character roster + equipment display

(function () {

  const QUALITY_CLASS = {
    normal:   'q-normal',
    magic:    'q-magic',
    rare:     'q-rare',
    set:      'q-set',
    unique:   'q-unique',
    runeword: 'q-runeword',
    crafted:  'q-crafted',
  };

  const SLOT_LABEL = {
    head:   'Helm',    amulet: 'Amulet', chest:  'Armor',
    weapon: 'Weapon',  shield: 'Shield', gloves: 'Gloves',
    belt:   'Belt',    boots:  'Boots',  ring1:  'Ring 1',
    ring2:  'Ring 2',
  };

  // Grid-area layout mirrors the D2R paper doll
  const SLOT_ORDER = ['head','amulet','chest','weapon','shield','gloves','belt','boots','ring1','ring2'];

  // ── Public entry point ────────────────────────────────────────────────────

  function render(containerId, gameData) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const chars = gameData.characters || [];
    if (!chars.length) {
      el.innerHTML = `<div class="d2r-empty">No characters yet.</div>`;
      return;
    }
    el.innerHTML = `
      <div class="d2r-roster" id="d2r-roster">${chars.map((c, i) => renderCharCard(c, i)).join('')}</div>
      <div class="d2r-detail" id="d2r-detail" style="display:none"></div>`;

    el.querySelectorAll('.d2r-view-btn').forEach(btn => {
      btn.addEventListener('click', () => showDetail(chars, parseInt(btn.dataset.idx)));
    });
  }

  // ── Roster card ───────────────────────────────────────────────────────────

  function renderCharCard(c, idx) {
    const hcBadge = c.hardcore ? '<span class="d2r-hc-badge">HC</span>' : '';
    return `
      <div class="d2r-char-card">
        <div class="d2r-char-class">${escHtml(c.class)}</div>
        <div class="d2r-char-name">${escHtml(c.name)}${hcBadge}</div>
        <div class="d2r-char-level">Level ${escHtml(String(c.level))}</div>
        <button class="d2r-view-btn" data-idx="${idx}">View Build &rsaquo;</button>
      </div>`;
  }

  // ── Detail view ───────────────────────────────────────────────────────────

  function showDetail(chars, idx) {
    const c = chars[idx];
    const roster = document.getElementById('d2r-roster');
    const detail = document.getElementById('d2r-detail');
    if (!roster || !detail) return;

    const hcBadge = c.hardcore ? '<span class="d2r-hc-badge">HC</span>' : '';
    detail.innerHTML = `
      <div class="d2r-detail-header">
        <button class="d2r-back-btn" id="d2r-back">&larr; Roster</button>
        <div class="d2r-detail-title">
          <span class="d2r-detail-name">${escHtml(c.name)}${hcBadge}</span>
          <span class="d2r-detail-meta">${escHtml(c.class)} &middot; Level ${escHtml(String(c.level))}</span>
        </div>
      </div>
      <div class="d2r-equip-grid">${renderEquipGrid(c.equipment || {})}</div>`;

    roster.style.display = 'none';
    detail.style.display = '';
    detail.querySelector('#d2r-back').addEventListener('click', () => {
      detail.style.display = 'none';
      roster.style.display = '';
    });
  }

  // ── Equipment grid ────────────────────────────────────────────────────────

  function renderEquipGrid(eq) {
    return SLOT_ORDER.map(slot => {
      const item = eq[slot];
      const label = SLOT_LABEL[slot];
      if (!item || !item.name) {
        return `<div class="d2r-slot d2r-slot--empty d2r-slot-${slot}">
                  <div class="d2r-slot-label">${label}</div>
                  <div class="d2r-slot-empty-text">—</div>
                </div>`;
      }
      const qc = QUALITY_CLASS[item.quality] || 'q-normal';
      const affixes = (item.affixes || []).map(a => `<div class="d2r-affix">${escHtml(a)}</div>`).join('');
      return `
        <div class="d2r-slot d2r-slot-${slot}">
          <div class="d2r-slot-label">${label}</div>
          <div class="d2r-item-name ${qc}">${escHtml(item.name)}</div>
          <div class="d2r-affixes">${affixes}</div>
        </div>`;
    }).join('');
  }

  // ── Export ────────────────────────────────────────────────────────────────

  window.D2R = { render };

})();
