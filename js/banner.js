async function loadRepoBanner() {
  try {
    const res = await fetch('/data/banner.json');
    if (!res.ok) {
      startBannerCycle(10000);
      return;
    }
    const cfg = await res.json();

    if (cfg.avatarSrc) applyAvatar('/' + cfg.avatarSrc);

    const banners = Array.isArray(cfg.banners) && cfg.banners.length > 0
      ? cfg.banners
      : (cfg.type === 'image' && cfg.src ? [cfg.src] : []);

    if (banners.length > 0) {
      const prev = parseInt(localStorage.getItem('banner-img-idx') || '-1');
      const idx = (prev + 1) % banners.length;
      localStorage.setItem('banner-img-idx', String(idx));
      applyBannerConfig({ ...cfg, type: 'image', src: banners[idx] });
    } else {
      startBannerCycle(10000);
    }
  } catch {
    startBannerCycle(10000);
  }
}

function applyBannerConfig(cfg) {
  const banner = document.getElementById('site-banner');
  if (!banner) return;

  banner.style.height = (cfg.height || 160) + 'px';

  if (cfg.type === 'image' && cfg.src) {
    const url = '/' + cfg.src;
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
  const aboutAvatar = document.getElementById('user-avatar');
  if (aboutAvatar) aboutAvatar.src = src;
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
  const aboutAvatar = document.getElementById('user-avatar');
  if (aboutAvatar) aboutAvatar.src = 'https://github.com/draygonia.png';
}

document.addEventListener('DOMContentLoaded', loadRepoBanner);
