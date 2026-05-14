async function loadRepoBanner() {
  try {
    const res = await fetch(rawUrl('data/banner.json'));
    if (!res.ok) return;
    const cfg = await res.json();
    applyBannerConfig(cfg);
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

document.addEventListener('DOMContentLoaded', loadRepoBanner);
