async function loadRepoBanner() {
  try {
    const res = await fetch(rawUrl('data/banner.json'));
    if (!res.ok) return;
    const cfg = await res.json();
    applyBannerConfig(cfg);
    if (cfg.avatarSrc) applyAvatar(rawUrl(cfg.avatarSrc));
  } catch {}
}

function applyBannerConfig(cfg) {
  const banner = document.getElementById('site-banner');
  if (!banner) return;

  banner.style.height = (cfg.height || 160) + 'px';

  if (cfg.type === 'image' && cfg.src) {
    const url = rawUrl(cfg.src);
    banner.style.backgroundImage = `url(${JSON.stringify(url)})`;
    banner.style.backgroundSize = 'cover';
    banner.style.backgroundPosition = `${cfg.posX ?? 50}% ${cfg.posY ?? 50}%`;
    banner.style.backgroundRepeat = 'no-repeat';
  }
}

function applyAvatar(src) {
  ['site-logo-img', 'banner-logo-img'].forEach(id => {
    const img = document.getElementById(id);
    if (!img) return;
    img.src = src;
    img.style.display = '';
    const letter = img.nextElementSibling;
    if (letter) letter.style.display = 'none';
  });
}

function removeAvatar() {
  ['site-logo-img', 'banner-logo-img'].forEach(id => {
    const img = document.getElementById(id);
    if (!img) return;
    img.src = '';
    img.style.display = 'none';
    const letter = img.nextElementSibling;
    if (letter) letter.style.display = '';
  });
}

document.addEventListener('DOMContentLoaded', loadRepoBanner);
