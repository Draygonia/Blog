let token = sessionStorage.getItem('gh_token') || '';
let gh = new GitHub(token);
let postsData = [];
let postsManifest = { posts: [] };
let linksData = { links: [] };
let linksSha = null;
let editingPost = null;

function init() {
  if (token) {
    showAdmin();
  } else {
    showAuth();
  }
  initPostDrop();
}

// ---- Post image drop zone ----

function initPostDrop() {
  const zone = document.getElementById('post-img-drop-zone');
  if (!zone) return;

  zone.addEventListener('click', () => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*,video/*,.pdf,.zip,.txt,.md';
    inp.onchange = e => handlePostFile(e.target.files[0]);
    inp.click();
  });

  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drop-active'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drop-active'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drop-active');
    if (e.dataTransfer.files[0]) handlePostFile(e.dataTransfer.files[0]);
  });
}

async function handlePostFile(file) {
  if (!file) return;
  if (!token) { showMessage('post-img-message', 'error', 'Sign in first.'); return; }

  const zone = document.getElementById('post-img-drop-zone');
  const ext = file.name.split('.').pop().toLowerCase();
  const safeName = slugify(file.name.replace(/\.[^.]+$/, '')) + '.' + ext;
  const imgPath = `images/posts/${safeName}`;

  zone.textContent = `Uploading ${file.name}…`;

  const reader = new FileReader();
  reader.onload = async ev => {
    const base64 = ev.target.result.split(',')[1];
    try {
      const sha = await gh.getSha(imgPath);
      await gh.putRaw(imgPath, base64, `Upload: ${safeName}`, sha);

      const textarea = document.getElementById('post-content');
      const isImage = file.type.startsWith('image/');
      const md = isImage ? `\n![${file.name}](/images/posts/${safeName})\n` : `\n[${file.name}](/images/posts/${safeName})\n`;
      const pos = textarea.selectionStart ?? textarea.value.length;
      textarea.value = textarea.value.slice(0, pos) + md + textarea.value.slice(pos);
      textarea.selectionStart = textarea.selectionEnd = pos + md.length;
      textarea.focus();

      zone.textContent = '📷 Drop image or file to attach';
      showMessage('post-img-message', 'success', `Inserted: /images/posts/${safeName}`);
    } catch (err) {
      zone.textContent = '📷 Drop image or file to attach';
      showMessage('post-img-message', 'error', `Upload failed: ${err.message}`);
    }
  };
  reader.readAsDataURL(file);
}

function showAuth() {
  document.getElementById('auth-section').style.display = '';
  document.getElementById('admin-content').style.display = 'none';
}

async function showAdmin() {
  document.getElementById('auth-section').style.display = 'none';
  document.getElementById('admin-content').style.display = '';
  await Promise.all([loadPosts(), loadLinks(), loadWallets(), loadPostsManifest()]);
}

async function login() {
  const t = document.getElementById('token-input').value.trim();
  const errEl = document.getElementById('auth-error');
  if (!t) return;

  try {
    const res = await fetch('https://api.github.com/user', {
      headers: { Authorization: `token ${t}` },
    });
    if (!res.ok) throw new Error('Invalid token — check your token and try again.');

    const { owner, repo } = CONFIG;
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: { Authorization: `token ${t}` },
    });
    if (!repoRes.ok) throw new Error(`Token can't access ${owner}/${repo}. Make sure it has "repo" scope (not just "public_repo").`);

    token = t;
    gh = new GitHub(token);
    sessionStorage.setItem('gh_token', token);
    errEl.style.display = 'none';
    showAdmin();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = '';
  }
}

function logout() {
  token = '';
  gh = new GitHub('');
  sessionStorage.removeItem('gh_token');
  showAuth();
}

// ---- Posts manifest ----

async function loadPostsManifest() {
  try {
    const { content } = await gh.getFile('data/posts.json');
    postsManifest = JSON.parse(content);
  } catch {
    postsManifest = { posts: [] };
  }
}

async function savePostsManifest(message) {
  const freshSha = await gh.getSha('data/posts.json');
  await gh.putFile('data/posts.json', JSON.stringify(postsManifest, null, 2), message, freshSha);
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

  const isNew = !editingPost;
  try {
    await gh.putFile(path, fileContent, message, editingPost?.sha);
    if (isNew) {
      postsManifest.posts = [filename, ...(postsManifest.posts || []).filter(f => f !== filename)];
      await savePostsManifest(`Add post to index: ${title}`);
    }
    showMessage('post-message', 'success', isNew ? 'Post published!' : 'Post updated!');
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
    postsManifest.posts = (postsManifest.posts || []).filter(f => f !== file.name);
    await savePostsManifest(`Remove post from index: ${file.name}`);
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
  } else {
    listEl.innerHTML = linksData.links.map((l, i) => `
      <div class="admin-list-item">
        <div class="admin-list-item-info">
          <div class="admin-list-item-title">${escHtml(l.title)}</div>
          <div class="admin-list-item-meta">${escHtml(l.url)}${l.category ? ` &middot; ${escHtml(l.category)}` : ''}</div>
        </div>
        <div class="admin-list-item-actions">
          <button class="btn btn-star btn-sm${l.featured ? ' active' : ''}" onclick="toggleFeatured(${i})" title="${l.featured ? 'Remove from featured' : 'Mark as featured'}">&#9733;</button>
          <button class="btn btn-danger btn-sm" onclick="deleteLink(${i})">Delete</button>
        </div>
      </div>
    `).join('');
  }
  renderCategoryList();
}

function renderCategoryList() {
  const listEl = document.getElementById('category-list');
  if (!listEl) return;
  const cats = linksData.categories || [];
  if (cats.length === 0) {
    listEl.innerHTML = '<p style="color:var(--text-muted);font-size:.875rem;margin-bottom:8px">No categories yet.</p>';
  } else {
    listEl.innerHTML = cats.map((c, i) => `
      <div class="admin-list-item" style="margin-bottom:4px">
        <div class="admin-list-item-info">
          <div class="admin-list-item-title">${escHtml(c)}</div>
        </div>
        <div class="admin-list-item-actions">
          <button class="btn btn-danger btn-sm" onclick="deleteCategory(${i})">Delete</button>
        </div>
      </div>
    `).join('');
  }
  populateCategoryDropdown();
}

function populateCategoryDropdown() {
  const sel = document.getElementById('link-category');
  if (!sel) return;
  const cats = linksData.categories || [];
  const current = sel.value;
  sel.innerHTML = '<option value="">-- None --</option>' + cats.map(c => `<option value="${escHtml(c)}"${c === current ? ' selected' : ''}>${escHtml(c)}</option>`).join('');
}

async function addCategory() {
  const input = document.getElementById('new-category');
  if (!input) return;
  const name = input.value.trim();
  if (!name) return;
  if (!linksData.categories) linksData.categories = [];
  if (linksData.categories.includes(name)) {
    showMessage('link-message', 'error', 'Category already exists.');
    return;
  }
  linksData.categories.push(name);
  await saveLinks(null, null);
  input.value = '';
}

async function deleteCategory(index) {
  if (!confirm('Delete this category?')) return;
  linksData.categories.splice(index, 1);
  await saveLinks(null, null);
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

async function toggleFeatured(index) {
  linksData.links[index].featured = !linksData.links[index].featured;
  await saveLinks(null, null);
}

async function saveLinks(btnId, btnLabel) {
  const btn = btnId ? document.getElementById(btnId) : null;
  if (btn) { btn.textContent = 'Saving...'; btn.disabled = true; }

  try {
    const content = JSON.stringify(linksData, null, 2);
    const freshSha = await gh.getSha('data/links.json');
    await gh.putFile('data/links.json', content, 'Update links', freshSha);
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
    const freshSha = await gh.getSha('data/wallets.json');
    await gh.putFile('data/wallets.json', content, 'Update wallets', freshSha);
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

// ---- Banner ----

let bannerData = { type: 'gradient', height: 160, posX: 50, posY: 50 };
let bannerSha = null;
let bannerPendingBase64 = null;
let bannerPendingExt = null;
let bannerSelectedPath = null;
const bannerGalleryUrls = {}; // path → GitHub download_url for private-repo thumbnails

async function fetchBannerConfig() {
  try {
    const { content, sha } = await gh.getFile('data/banner.json');
    return { config: JSON.parse(content), sha };
  } catch {
    return { config: { ...bannerData }, sha: null };
  }
}

async function loadBannerTab() {
  try {
    const { content, sha } = await gh.getFile('data/banner.json');
    bannerData = JSON.parse(content);
    bannerSha = sha;
  } catch {
    bannerData = { type: 'gradient', height: 160, posX: 50, posY: 50 };
    bannerSha = null;
  }
  syncBannerUI();

  const preview = document.getElementById('avatar-preview');
  if (preview && bannerData.avatarSrc) {
    preview.src = '/' + bannerData.avatarSrc;
    preview.style.display = '';
  }

  await loadBannerGallery();
}

async function loadBannerGallery() {
  const el = document.getElementById('banner-gallery');
  if (!el) return;
  el.innerHTML = '<div class="loading"><div class="spinner"></div> Loading&hellip;</div>';
  try {
    const files = await gh.listDir('images/banners');
    const banners = files.filter(f => f.type === 'file' && f.name !== '.gitkeep');
    banners.forEach(b => { if (b.download_url) bannerGalleryUrls[b.path] = b.download_url; });
    if (banners.length === 0) {
      el.innerHTML = '<p style="color:var(--text-muted);font-size:.875rem;margin-bottom:8px">No banners uploaded yet.</p>';
      return;
    }
    const activeSrc = bannerData.src || '';
    el.innerHTML = `<div class="banner-gallery-grid">${banners.map(b => `
      <div class="banner-thumb${b.path === activeSrc || b.path === bannerSelectedPath ? ' banner-thumb-active' : ''}" onclick="selectBannerFromGallery('${escHtml(b.path)}')">
        <div class="banner-thumb-img"><img src="${escHtml(b.download_url || '/' + b.path)}" alt="${escHtml(b.name)}"></div>
        <div class="banner-thumb-name">${escHtml(b.name)}</div>
        <div class="banner-thumb-actions">
          <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();deleteBannerFile('${escHtml(b.path)}','${escHtml(b.sha)}')" title="Delete">&#x2715; Delete</button>
        </div>
      </div>`).join('')}</div>`;
  } catch (err) {
    el.innerHTML = `<p style="color:var(--text-muted);font-size:.875rem">Error: ${escHtml(err.message)}</p>`;
  }
}

function selectBannerFromGallery(path) {
  bannerSelectedPath = path;
  bannerPendingBase64 = null;
  bannerPendingExt = null;
  const zone = document.getElementById('banner-drop-zone');
  if (zone) zone.textContent = `Selected: ${path.split('/').pop()} — click "Set as Banner" to apply`;
  updateBannerPreview();
  loadBannerGallery();
}

async function deleteBannerFile(path, sha) {
  if (!confirm('Delete this banner image? This cannot be undone.')) return;
  try {
    await gh.deleteFile(path, `Delete banner: ${path.split('/').pop()}`, sha);
    if (bannerSelectedPath === path) { bannerSelectedPath = null; }
    {
      const { config: fresh, sha: freshSha } = await fetchBannerConfig();
      const remaining = (Array.isArray(fresh.banners) ? fresh.banners : (fresh.src ? [fresh.src] : []))
        .filter(p => p !== path);
      let updated;
      if (remaining.length > 0) {
        updated = { ...fresh, type: 'image', src: remaining[0], banners: remaining };
      } else {
        updated = { ...fresh, type: 'gradient', src: null, banners: [] };
      }
      await gh.putFile('data/banner.json', JSON.stringify(updated, null, 2), 'Remove deleted banner from config', freshSha);
      bannerData = updated;
      syncBannerUI();
    }
    showMessage('banner-message', 'success', 'Banner deleted.');
    await loadBannerGallery();
  } catch (err) {
    showMessage('banner-message', 'error', `Error deleting: ${err.message}`);
  }
}

function syncBannerUI() {
  const h = document.getElementById('banner-height');
  const hv = document.getElementById('banner-height-val');
  const px = document.getElementById('banner-pos-x');
  const pxv = document.getElementById('banner-pos-x-val');
  const py = document.getElementById('banner-pos-y');
  const pyv = document.getElementById('banner-pos-y-val');
  if (h) { h.value = bannerData.height || 160; hv.textContent = h.value + 'px'; }
  if (px) { px.value = bannerData.posX ?? 50; pxv.textContent = px.value + '%'; }
  if (py) { py.value = bannerData.posY ?? 50; pyv.textContent = py.value + '%'; }
  updateBannerPreview();
}

function updateBannerPreview() {
  const preview = document.getElementById('banner-preview');
  if (!preview) return;
  const h = parseInt(document.getElementById('banner-height')?.value || bannerData.height || 160);
  const px = parseInt(document.getElementById('banner-pos-x')?.value ?? bannerData.posX ?? 50);
  const py = parseInt(document.getElementById('banner-pos-y')?.value ?? bannerData.posY ?? 50);
  preview.style.height = h + 'px';
  let imgSrc = null;
  if (bannerPendingBase64) {
    imgSrc = `data:image/${bannerPendingExt};base64,${bannerPendingBase64}`;
  } else if (bannerSelectedPath) {
    imgSrc = bannerGalleryUrls[bannerSelectedPath] || '/' + bannerSelectedPath;
  } else if (bannerData.type === 'image' && bannerData.src) {
    imgSrc = bannerGalleryUrls[bannerData.src] || '/' + bannerData.src;
  }
  if (imgSrc) {
    preview.style.backgroundImage = `url(${JSON.stringify(imgSrc)})`;
    preview.style.backgroundSize = 'cover';
    preview.style.backgroundPosition = `${px}% ${py}%`;
    preview.style.backgroundRepeat = 'no-repeat';
  } else {
    preview.style.backgroundImage = '';
    preview.style.backgroundPosition = '';
    preview.style.backgroundSize = '';
  }
}

function initBannerDrop() {
  const zone = document.getElementById('banner-drop-zone');
  if (!zone) return;

  zone.addEventListener('click', () => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.onchange = e => handleBannerFile(e.target.files[0]);
    inp.click();
  });

  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drop-active'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drop-active'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drop-active');
    const file = e.dataTransfer.files[0];
    if (file) handleBannerFile(file);
  });
}

function handleBannerFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const ext = file.name.split('.').pop().toLowerCase() || 'jpg';
  const reader = new FileReader();
  reader.onload = e => {
    const dataUrl = e.target.result;
    const base64 = dataUrl.split(',')[1];
    bannerPendingBase64 = base64;
    bannerPendingExt = ext;
    const zone = document.getElementById('banner-drop-zone');
    if (zone) zone.textContent = `Ready: ${escHtml(file.name)}`;
    updateBannerPreview();
  };
  reader.readAsDataURL(file);
}

async function saveBanner() {
  const btn = document.getElementById('banner-save-btn');
  btn.textContent = 'Saving...';
  btn.disabled = true;

  try {
    const h = parseInt(document.getElementById('banner-height').value);
    const px = parseInt(document.getElementById('banner-pos-x').value);
    const py = parseInt(document.getElementById('banner-pos-y').value);

    const { config: fresh, sha: freshSha } = await fetchBannerConfig();
    let updated;

    const existingBanners = Array.isArray(fresh.banners) ? [...fresh.banners]
      : (fresh.src ? [fresh.src] : []);

    if (bannerPendingBase64) {
      const imgPath = `images/banners/banner-${Date.now()}.${bannerPendingExt}`;
      const imgSha = await gh.getSha(imgPath).catch(e => { throw new Error(`getSha(${imgPath}): ${e.message}`); });
      await gh.putRaw(imgPath, bannerPendingBase64, 'Upload banner image', imgSha).catch(e => { throw new Error(`upload image: ${e.message}`); });
      if (!existingBanners.includes(imgPath)) existingBanners.push(imgPath);
      updated = { ...fresh, type: 'image', src: imgPath, height: h, posX: px, posY: py, banners: existingBanners };
      bannerPendingBase64 = null;
      bannerPendingExt = null;
      const zone = document.getElementById('banner-drop-zone');
      if (zone) zone.textContent = 'Drop image here or click to browse';
    } else if (bannerSelectedPath) {
      if (!existingBanners.includes(bannerSelectedPath)) existingBanners.push(bannerSelectedPath);
      updated = { ...fresh, type: 'image', src: bannerSelectedPath, height: h, posX: px, posY: py, banners: existingBanners };
      bannerSelectedPath = null;
      const zone = document.getElementById('banner-drop-zone');
      if (zone) zone.textContent = 'Drop image here or click to browse';
    } else {
      updated = { ...fresh, height: h, posX: px, posY: py };
    }

    await gh.putFile('data/banner.json', JSON.stringify(updated, null, 2), 'Update banner config', freshSha).catch(e => { throw new Error(`save config: ${e.message}`); });
    bannerData = updated;
    showMessage('banner-message', 'success', 'Banner saved!');
    syncBannerUI();
    await loadBannerGallery();
  } catch (err) {
    showMessage('banner-message', 'error', `Error: ${err.message}`);
  } finally {
    btn.textContent = 'Set as Banner';
    btn.disabled = false;
  }
}

async function resetBanner() {
  if (!confirm('Reset banner to default gradient?')) return;
  bannerPendingBase64 = null;
  bannerPendingExt = null;
  bannerSelectedPath = null;
  try {
    const { config: fresh, sha: freshSha } = await fetchBannerConfig();
    const updated = { ...fresh, type: 'gradient', src: null };
    await gh.putFile('data/banner.json', JSON.stringify(updated, null, 2), 'Reset banner to gradient', freshSha);
    bannerData = updated;
    showMessage('banner-message', 'success', 'Banner reset!');
    const zone = document.getElementById('banner-drop-zone');
    if (zone) zone.textContent = 'Drop image here or click to browse';
    syncBannerUI();
  } catch (err) {
    showMessage('banner-message', 'error', `Error: ${err.message}`);
  }
}

// ---- Avatar ----

let avatarPendingBase64 = null;
let avatarPendingExt = null;

function initAvatarDrop() {
  const zone = document.getElementById('avatar-drop-zone');
  if (!zone) return;

  zone.addEventListener('click', () => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.onchange = e => handleAvatarFile(e.target.files[0]);
    inp.click();
  });

  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drop-active'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('drop-active'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('drop-active');
    const file = e.dataTransfer.files[0];
    if (file) handleAvatarFile(file);
  });
}

function handleAvatarFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const ext = file.name.split('.').pop().toLowerCase() || 'png';
  const reader = new FileReader();
  reader.onload = e => {
    const dataUrl = e.target.result;
    avatarPendingBase64 = dataUrl.split(',')[1];
    avatarPendingExt = ext;
    const zone = document.getElementById('avatar-drop-zone');
    if (zone) zone.textContent = `Ready: ${file.name}`;
    const preview = document.getElementById('avatar-preview');
    if (preview) { preview.src = dataUrl; preview.style.display = ''; }
  };
  reader.readAsDataURL(file);
}

async function saveAvatar() {
  if (!avatarPendingBase64) { showMessage('avatar-message', 'error', 'No image selected.'); return; }
  const btn = document.getElementById('avatar-save-btn');
  btn.textContent = 'Saving...';
  btn.disabled = true;

  try {
    const imgPath = `images/avatar.${avatarPendingExt}`;
    const imgSha = await gh.getSha(imgPath).catch(e => { throw new Error(`getSha(${imgPath}): ${e.message}`); });
    await gh.putRaw(imgPath, avatarPendingBase64, 'Upload site avatar', imgSha).catch(e => { throw new Error(`upload avatar: ${e.message}`); });

    const { config: fresh, sha: freshSha } = await fetchBannerConfig();
    const updated = { ...fresh, avatarSrc: imgPath };
    await gh.putFile('data/banner.json', JSON.stringify(updated, null, 2), 'Update site avatar', freshSha).catch(e => { throw new Error(`save config: ${e.message}`); });
    bannerData = updated;

    applyAvatar('/' + imgPath);
    avatarPendingBase64 = null;
    avatarPendingExt = null;
    showMessage('avatar-message', 'success', 'Avatar saved!');
  } catch (err) {
    showMessage('avatar-message', 'error', `Error: ${err.message}`);
  } finally {
    btn.textContent = 'Set Avatar';
    btn.disabled = false;
  }
}

async function clearAvatar() {
  if (!confirm('Remove avatar and restore the D box?')) return;
  try {
    const { config: fresh, sha: freshSha } = await fetchBannerConfig();
    const updated = { ...fresh, avatarSrc: null };
    await gh.putFile('data/banner.json', JSON.stringify(updated, null, 2), 'Remove site avatar', freshSha);
    bannerData = updated;

    removeAvatar();
    avatarPendingBase64 = null;
    avatarPendingExt = null;
    const zone = document.getElementById('avatar-drop-zone');
    if (zone) zone.textContent = 'Drop image here or click to browse';
    const preview = document.getElementById('avatar-preview');
    if (preview) { preview.src = ''; preview.style.display = 'none'; }
    showMessage('avatar-message', 'success', 'Avatar removed!');
  } catch (err) {
    showMessage('avatar-message', 'error', `Error: ${err.message}`);
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

let bannerTabLoaded = false;

function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `tab-${name}`));
  if (name === 'banner' && !bannerTabLoaded) {
    bannerTabLoaded = true;
    initBannerDrop();
    initAvatarDrop();
    loadBannerTab();
  }
}

document.addEventListener('DOMContentLoaded', init);
