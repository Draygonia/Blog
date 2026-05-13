let token = sessionStorage.getItem('gh_token') || '';
let gh = new GitHub(token);
let postsData = [];
let linksData = { links: [] };
let linksSha = null;
let editingPost = null;

function init() {
  if (token) {
    showAdmin();
  } else {
    showAuth();
  }
}

function showAuth() {
  document.getElementById('auth-section').style.display = '';
  document.getElementById('admin-content').style.display = 'none';
}

async function showAdmin() {
  document.getElementById('auth-section').style.display = 'none';
  document.getElementById('admin-content').style.display = '';
  await Promise.all([loadPosts(), loadLinks(), loadWallets()]);
}

async function login() {
  const t = document.getElementById('token-input').value.trim();
  const errEl = document.getElementById('auth-error');
  if (!t) return;

  try {
    const res = await fetch('https://api.github.com/user', {
      headers: { Authorization: `token ${t}` },
    });
    if (!res.ok) throw new Error('Invalid token');

    token = t;
    gh = new GitHub(token);
    sessionStorage.setItem('gh_token', token);
    errEl.style.display = 'none';
    showAdmin();
  } catch {
    errEl.textContent = 'Could not authenticate. Check your token and try again.';
    errEl.style.display = '';
  }
}

function logout() {
  token = '';
  gh = new GitHub('');
  sessionStorage.removeItem('gh_token');
  showAuth();
}

// ---- Posts ----

async function loadPosts() {
  const listEl = document.getElementById('post-list');
  listEl.innerHTML = '<div class="loading"><div class="spinner"></div> Loading...</div>';
  try {
    const files = await gh.listDir('posts');
    postsData = files
      .filter(f => f.name.endsWith('.md'))
      .sort((a, b) => b.name.localeCompare(a.name));
    renderPostList();
  } catch (err) {
    listEl.innerHTML = `<p style="color:var(--text-muted);font-size:.875rem">Error: ${escHtml(err.message)}</p>`;
  }
}

function renderPostList() {
  const listEl = document.getElementById('post-list');
  if (postsData.length === 0) {
    listEl.innerHTML = '<p style="color:var(--text-muted);font-size:.875rem">No posts yet.</p>';
    return;
  }
  listEl.innerHTML = postsData.map((f, i) => `
    <div class="admin-list-item">
      <div class="admin-list-item-info">
        <div class="admin-list-item-title">${escHtml(filenameToTitle(f.name))}</div>
        <div class="admin-list-item-meta">${escHtml(f.name)}</div>
      </div>
      <div class="admin-list-item-actions">
        <button class="btn btn-secondary btn-sm" onclick="startEditPost(${i})">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="confirmDeletePost(${i})">Delete</button>
      </div>
    </div>
  `).join('');
}

function filenameToTitle(name) {
  return name.replace(/\.md$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, '')
    .split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

async function startEditPost(index) {
  const file = postsData[index];
  try {
    const { content, sha } = await gh.getFile(`posts/${file.name}`);
    const { data, content: body } = parseFrontmatter(content);

    document.getElementById('post-title').value = data.title || '';
    document.getElementById('post-tags').value = data.tags || '';
    document.getElementById('post-excerpt').value = data.excerpt || '';
    document.getElementById('post-content').value = body;
    document.getElementById('post-form-title').textContent = 'Edit Post';
    document.getElementById('cancel-edit-btn').style.display = '';
    document.getElementById('save-post-btn').textContent = 'Update';

    editingPost = { filename: file.name, sha };
    document.getElementById('post-form-section').scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    showMessage('post-message', 'error', `Error loading post: ${err.message}`);
  }
}

function cancelEditPost() {
  editingPost = null;
  document.getElementById('post-form').reset();
  document.getElementById('post-form-title').textContent = 'New Post';
  document.getElementById('cancel-edit-btn').style.display = 'none';
  document.getElementById('save-post-btn').textContent = 'Publish';
}

async function savePost() {
  const title = document.getElementById('post-title').value.trim();
  const tags = document.getElementById('post-tags').value.trim();
  const excerpt = document.getElementById('post-excerpt').value.trim();
  const content = document.getElementById('post-content').value.trim();

  if (!title) { showMessage('post-message', 'error', 'Title is required.'); return; }

  const date = editingPost ? editingPost.filename.slice(0, 10) : today();
  const lines = ['---', `title: ${title}`, `date: ${date}`];
  if (tags) lines.push(`tags: ${tags}`);
  if (excerpt) lines.push(`excerpt: ${excerpt}`);
  lines.push('---');
  const fileContent = `${lines.join('\n')}\n\n${content}`;

  const filename = editingPost ? editingPost.filename : `${date}-${slugify(title)}.md`;
  const path = `posts/${filename}`;
  const message = editingPost ? `Update: ${title}` : `Add post: ${title}`;

  const btn = document.getElementById('save-post-btn');
  btn.textContent = 'Saving...';
  btn.disabled = true;

  try {
    await gh.putFile(path, fileContent, message, editingPost?.sha);
    showMessage('post-message', 'success', editingPost ? 'Post updated!' : 'Post published!');
    cancelEditPost();
    await loadPosts();
  } catch (err) {
    showMessage('post-message', 'error', `Error: ${err.message}`);
  } finally {
    btn.textContent = editingPost ? 'Update' : 'Publish';
    btn.disabled = false;
  }
}

async function confirmDeletePost(index) {
  const file = postsData[index];
  if (!confirm(`Delete "${file.name}"? This cannot be undone.`)) return;
  try {
    await gh.deleteFile(`posts/${file.name}`, `Delete: ${file.name}`, file.sha);
    await loadPosts();
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

// ---- Links ----

async function loadLinks() {
  const listEl = document.getElementById('link-list');
  listEl.innerHTML = '<div class="loading"><div class="spinner"></div> Loading...</div>';
  try {
    const { content, sha } = await gh.getFile('data/links.json');
    linksData = JSON.parse(content);
    linksSha = sha;
    renderLinkList();
  } catch {
    linksData = { links: [] };
    linksSha = null;
    listEl.innerHTML = '<p style="color:var(--text-muted);font-size:.875rem">No links yet.</p>';
  }
}

function renderLinkList() {
  const listEl = document.getElementById('link-list');
  if (!linksData.links || linksData.links.length === 0) {
    listEl.innerHTML = '<p style="color:var(--text-muted);font-size:.875rem">No links yet.</p>';
    return;
  }
  listEl.innerHTML = linksData.links.map((l, i) => `
    <div class="admin-list-item">
      <div class="admin-list-item-info">
        <div class="admin-list-item-title">${escHtml(l.title)}</div>
        <div class="admin-list-item-meta">${escHtml(l.url)}${l.category ? ` &middot; ${escHtml(l.category)}` : ''}</div>
      </div>
      <div class="admin-list-item-actions">
        <button class="btn btn-danger btn-sm" onclick="deleteLink(${i})">Delete</button>
      </div>
    </div>
  `).join('');
}

async function addLink() {
  const title = document.getElementById('link-title').value.trim();
  const url = document.getElementById('link-url').value.trim();
  const description = document.getElementById('link-desc').value.trim();
  const category = document.getElementById('link-category').value.trim();

  if (!title || !url) { showMessage('link-message', 'error', 'Title and URL are required.'); return; }

  linksData.links = [...(linksData.links || []), { title, url, description, category }];
  await saveLinks('add-link-btn', 'Add Link');
}

async function deleteLink(index) {
  if (!confirm('Remove this link?')) return;
  linksData.links.splice(index, 1);
  await saveLinks(null, null);
}

async function saveLinks(btnId, btnLabel) {
  const btn = btnId ? document.getElementById(btnId) : null;
  if (btn) { btn.textContent = 'Saving...'; btn.disabled = true; }

  try {
    const content = JSON.stringify(linksData, null, 2);
    await gh.putFile('data/links.json', content, 'Update links', linksSha);
    showMessage('link-message', 'success', 'Links updated!');
    if (btnId === 'add-link-btn') document.getElementById('link-form').reset();
    await loadLinks();
  } catch (err) {
    showMessage('link-message', 'error', `Error: ${err.message}`);
    await loadLinks();
  } finally {
    if (btn) { btn.textContent = btnLabel; btn.disabled = false; }
  }
}

// ---- Wallets ----

let walletsData = { wallets: [] };
let walletsSha = null;

async function loadWallets() {
  const listEl = document.getElementById('wallet-list');
  if (!listEl) return;
  listEl.innerHTML = '<div class="loading"><div class="spinner"></div> Loading...</div>';
  try {
    const { content, sha } = await gh.getFile('data/wallets.json');
    walletsData = JSON.parse(content);
    walletsSha = sha;
    renderWalletList();
  } catch {
    walletsData = { wallets: [] };
    walletsSha = null;
    listEl.innerHTML = '<p style="color:var(--text-muted);font-size:.875rem">No wallets yet.</p>';
  }
}

function renderWalletList() {
  const listEl = document.getElementById('wallet-list');
  if (!listEl) return;
  if (!walletsData.wallets || walletsData.wallets.length === 0) {
    listEl.innerHTML = '<p style="color:var(--text-muted);font-size:.875rem">No wallets yet.</p>';
    return;
  }
  listEl.innerHTML = walletsData.wallets.map((w, i) => `
    <div class="admin-list-item">
      <div class="admin-list-item-info">
        <div class="admin-list-item-title">${escHtml(w.name)}${w.symbol ? ` <span style="color:var(--text-muted);font-weight:400">(${escHtml(w.symbol.toUpperCase())})</span>` : ''}</div>
        <div class="admin-list-item-meta" style="font-family:monospace">${escHtml(w.address)}</div>
      </div>
      <div class="admin-list-item-actions">
        <button class="btn btn-danger btn-sm" onclick="deleteWallet(${i})">Delete</button>
      </div>
    </div>
  `).join('');
}

async function addWallet() {
  const name = document.getElementById('wallet-name').value.trim();
  const symbol = document.getElementById('wallet-symbol').value.trim();
  const address = document.getElementById('wallet-address').value.trim();

  if (!name || !address) { showMessage('wallet-message', 'error', 'Name and address are required.'); return; }

  walletsData.wallets = [...(walletsData.wallets || []), { name, symbol, address }];
  await saveWallets('add-wallet-btn', 'Add Wallet');
}

async function deleteWallet(index) {
  if (!confirm('Remove this wallet?')) return;
  walletsData.wallets.splice(index, 1);
  await saveWallets(null, null);
}

async function saveWallets(btnId, btnLabel) {
  const btn = btnId ? document.getElementById(btnId) : null;
  if (btn) { btn.textContent = 'Saving...'; btn.disabled = true; }

  try {
    const content = JSON.stringify(walletsData, null, 2);
    await gh.putFile('data/wallets.json', content, 'Update wallets', walletsSha);
    showMessage('wallet-message', 'success', 'Wallets updated!');
    if (btnId === 'add-wallet-btn') document.getElementById('wallet-form').reset();
    await loadWallets();
  } catch (err) {
    showMessage('wallet-message', 'error', `Error: ${err.message}`);
    await loadWallets();
  } finally {
    if (btn) { btn.textContent = btnLabel; btn.disabled = false; }
  }
}

// ---- Helpers ----

function showMessage(id, type, text) {
  const el = document.getElementById(id);
  if (!el) return;
  el.className = `alert alert-${type}`;
  el.textContent = text;
  el.style.display = '';
  if (type === 'success') setTimeout(() => { el.style.display = 'none'; }, 4000);
}

function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${name}`));
}

document.addEventListener('DOMContentLoaded', init);
