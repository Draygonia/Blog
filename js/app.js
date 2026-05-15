function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { data: {}, content: raw };
  const data = {};
  match[1].split('\n').forEach(line => {
    const i = line.indexOf(':');
    if (i === -1) return;
    data[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  });
  return { data, content: match[2].trim() };
}

function formatDate(str) {
  if (!str) return '';
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function slugify(title) {
  return title.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function rawUrl(path) {
  const { owner, repo, branch } = CONFIG;
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
}

// Homepage: render posts grid
async function loadPostsGrid(containerId) {
  const el = document.getElementById(containerId);
  try {
    const res = await fetch('/data/posts.json');
    if (!res.ok) throw new Error('posts.json not found');
    const { posts } = await res.json();

    const mdFiles = (posts || []).slice().sort((a, b) => b.localeCompare(a));

    if (mdFiles.length === 0) {
      el.innerHTML = `<div class="empty-state">
        <p>No posts yet.</p>
        <a href="admin.html" class="btn btn-secondary btn-sm">Add your first post &rarr;</a>
      </div>`;
      return;
    }

    const postData = await Promise.all(mdFiles.map(async filename => {
      try {
        const r = await fetch(`/posts/${filename}`);
        const raw = await r.text();
        const { data } = parseFrontmatter(raw);
        return { ...data, filename };
      } catch { return null; }
    }));

    el.innerHTML = postData.filter(Boolean).map(p => `
      <article class="post-card" onclick="window.location='post.html?slug=${encodeURIComponent(p.filename)}'">
        <div class="post-card-date">${formatDate(p.date)}</div>
        <h2 class="post-card-title">${escHtml(p.title || 'Untitled')}</h2>
        ${p.excerpt ? `<p class="post-card-excerpt">${escHtml(p.excerpt)}</p>` : ''}
        ${p.tags ? `<div class="post-card-tags">${p.tags.split(',').map(t => `<span class="tag">${escHtml(t.trim())}</span>`).join('')}</div>` : ''}
      </article>
    `).join('');
  } catch (err) {
    el.innerHTML = `<div class="empty-state"><p>Could not load posts: ${escHtml(err.message)}</p></div>`;
  }
}

// Post page: render single post
async function loadPost(containerId) {
  const el = document.getElementById(containerId);
  const slug = new URLSearchParams(window.location.search).get('slug');
  if (!slug) { el.innerHTML = '<p>No post specified.</p>'; return; }

  try {
    const res = await fetch(`/posts/${slug}`);
    if (!res.ok) throw new Error('Post not found');
    const raw = await res.text();
    const { data, content } = parseFrontmatter(raw);

    document.title = `${data.title || 'Post'} — ${CONFIG.siteName}`;

    el.innerHTML = `
      <a href="index.html" class="post-back">&larr; Back to posts</a>
      <header class="post-header">
        <div class="post-header-date">${formatDate(data.date)}</div>
        <h1 class="post-header-title">${escHtml(data.title || 'Untitled')}</h1>
        ${data.tags ? `<div class="post-card-tags" style="margin-top:0">${data.tags.split(',').map(t => `<span class="tag">${escHtml(t.trim())}</span>`).join('')}</div>` : ''}
      </header>
      <div class="post-content" id="post-body"></div>
    `;
    document.getElementById('post-body').innerHTML = marked.parse(content);
  } catch (err) {
    el.innerHTML = `<a href="index.html" class="post-back">&larr; Back to posts</a><p style="color:var(--text-muted);margin-top:1rem">${escHtml(err.message)}</p>`;
  }
}

// Links page: render links grid
async function loadLinksGrid(containerId) {
  const el = document.getElementById(containerId);
  try {
    const res = await fetch('/data/links.json');
    if (!res.ok) throw new Error('links.json not found');
    const { links } = await res.json();

    if (!links || links.length === 0) {
      el.innerHTML = `<div class="empty-state"><p>No links yet. Add some from the <a href="admin.html">admin panel</a>.</p></div>`;
      return;
    }

    el.innerHTML = links.map(l => `
      <a href="${escHtml(l.url)}" target="_blank" rel="noopener noreferrer" class="link-card">
        ${l.category ? `<div class="link-card-category">${escHtml(l.category)}</div>` : ''}
        <div class="link-card-title">${escHtml(l.title)}</div>
        ${l.description ? `<div class="link-card-desc">${escHtml(l.description)}</div>` : ''}
        <div class="link-card-url">${escHtml(l.url)}</div>
      </a>
    `).join('');
  } catch (err) {
    el.innerHTML = `<div class="empty-state"><p>Could not load links: ${escHtml(err.message)}</p></div>`;
  }
}
