// Live site-wide search

(function () {

  let index = null;
  let building = false;
  let dropdown = null;

  // ── Index building ────────────────────────────────────────────────────────

  async function buildIndex() {
    if (index) return index;
    if (building) return null;
    building = true;

    try {
      const [postsRes, linksRes, socialsRes] = await Promise.all([
        fetch(rawUrl('data/posts.json'), { cache: 'no-store' }),
        fetch(rawUrl('data/links.json'), { cache: 'no-store' }),
        fetch(rawUrl('data/socials.json'), { cache: 'no-store' }),
      ]);

      const entries = [];

      if (postsRes.ok) {
        const { posts } = await postsRes.json();
        const mds = await Promise.all(
          (posts || []).map(f => fetch(rawUrl(`posts/${f}`), { cache: 'no-store' }).then(r => r.ok ? r.text() : null).then(t => ({ f, t })))
        );
        for (const { f, t } of mds) {
          if (!t) continue;
          const { data } = parseFrontmatter(t);
          if (!data.title) continue;
          entries.push({
            type: 'post',
            title: data.title,
            subtitle: data.excerpt || data.tags || '',
            url: `post.html?file=${encodeURIComponent(f)}`,
            keywords: [data.title, data.excerpt, data.tags].filter(Boolean).join(' ').toLowerCase(),
          });
        }
      }

      if (linksRes.ok) {
        const { links } = await linksRes.json();
        for (const l of (links || [])) {
          entries.push({
            type: 'link',
            title: l.title,
            subtitle: l.description || l.category || '',
            url: l.url,
            external: true,
            keywords: [l.title, l.description, l.category].filter(Boolean).join(' ').toLowerCase(),
          });
        }
      }

      if (socialsRes.ok) {
        const data = await socialsRes.json();
        for (const g of (data.games || [])) {
          entries.push({
            type: 'game',
            title: g.title,
            subtitle: 'Game profile',
            url: `game.html?id=${encodeURIComponent(g.id)}`,
            keywords: g.title.toLowerCase(),
          });
        }
      }

      index = entries;
      return index;
    } catch {
      building = false;
      return null;
    }
  }

  // ── Matching ──────────────────────────────────────────────────────────────

  function search(query, entries) {
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!tokens.length) return [];
    return entries.filter(e => tokens.every(t => e.keywords.includes(t)));
  }

  // ── Dropdown rendering ────────────────────────────────────────────────────

  const GROUP_LABEL = { post: 'Posts', link: 'Links', game: 'Games' };
  const MAX_PER_GROUP = 5;

  function showDropdown(input, html) {
    if (!dropdown) {
      dropdown = document.createElement('div');
      dropdown.className = 'search-dropdown';
      document.body.appendChild(dropdown);
    }
    dropdown.innerHTML = html;
    dropdown.style.display = 'block';
    positionDropdown(input);
  }

  function positionDropdown(input) {
    if (!dropdown) return;
    const r = input.getBoundingClientRect();
    dropdown.style.top = (r.bottom + window.scrollY + 4) + 'px';
    dropdown.style.left = r.left + 'px';
    dropdown.style.minWidth = Math.max(r.width, 340) + 'px';
  }

  function hideDropdown() {
    if (dropdown) dropdown.style.display = 'none';
  }

  function renderResults(results, query) {
    if (!results.length) {
      return `<div class="search-no-results">No results for <strong>${escHtml(query)}</strong></div>`;
    }

    const groups = {};
    for (const r of results) {
      if (!groups[r.type]) groups[r.type] = [];
      groups[r.type].push(r);
    }

    return Object.entries(groups).map(([type, items]) => {
      const visible = items.slice(0, MAX_PER_GROUP);
      const more = items.length - visible.length;
      const rows = visible.map(item => {
        const target = item.external ? ' target="_blank" rel="noopener noreferrer"' : '';
        return `
          <a href="${escHtml(item.url)}"${target} class="search-result">
            <div class="search-result-title">${escHtml(item.title)}</div>
            ${item.subtitle ? `<div class="search-result-sub">${escHtml(item.subtitle)}</div>` : ''}
          </a>`;
      }).join('');
      const moreRow = more > 0 ? `<div class="search-more">+${more} more</div>` : '';
      return `<div class="search-group-header">${GROUP_LABEL[type] || type}</div>${rows}${moreRow}`;
    }).join('');
  }

  // ── Event wiring ──────────────────────────────────────────────────────────

  function initSearch() {
    const input = document.getElementById('site-search');
    if (!input) return;

    let pending = null;

    input.addEventListener('focus', () => { buildIndex(); });

    input.addEventListener('input', () => {
      const q = input.value.trim();
      clearTimeout(pending);

      if (!q) { hideDropdown(); return; }

      if (!index) {
        showDropdown(input, `<div class="search-loading"><div class="spinner"></div> Loading index&hellip;</div>`);
        pending = setTimeout(async () => {
          await buildIndex();
          const q2 = input.value.trim();
          if (q2) showDropdown(input, renderResults(search(q2, index || []), q2));
          else hideDropdown();
        }, 300);
        return;
      }

      pending = setTimeout(() => {
        const q2 = input.value.trim();
        if (q2) showDropdown(input, renderResults(search(q2, index), q2));
        else hideDropdown();
      }, 80);
    });

    input.addEventListener('keydown', e => {
      if (e.key === 'Escape') { hideDropdown(); input.blur(); }
    });

    document.addEventListener('click', e => {
      if (!input.contains(e.target) && (!dropdown || !dropdown.contains(e.target))) {
        hideDropdown();
      }
    });

    window.addEventListener('resize', () => { if (dropdown && dropdown.style.display !== 'none') positionDropdown(input); });
  }

  document.addEventListener('DOMContentLoaded', initSearch);

})();
