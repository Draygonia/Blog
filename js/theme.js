const THEMES = {
  orange: {
    '--accent': '#e07a10', '--accent-dark': '#b86008',
    '--bg': '#0f1923', '--surface': '#182332', '--surface-hover': '#1e2d40',
    '--border': '#253545', '--text': '#ccd8e4', '--text-muted': '#5a7888',
    '--text-dim': '#2e4255', '--link': '#7ab0d8', '--link-hover': '#a0c8f0',
    '--green': '#30cc60', '--header-bg': '#0c1620', '--footer-bg': '#0c1620',
  },
  red: {
    '--accent': '#cc3020', '--accent-dark': '#a02018',
    '--bg': '#1a0d0d', '--surface': '#241616', '--surface-hover': '#2d1c1c',
    '--border': '#3d2222', '--text': '#e4cccc', '--text-muted': '#886868',
    '--text-dim': '#4a2828', '--link': '#d87878', '--link-hover': '#f09090',
    '--green': '#30cc60', '--header-bg': '#120909', '--footer-bg': '#120909',
  },
  green: {
    '--accent': '#2ea840', '--accent-dark': '#1e8030',
    '--bg': '#0d1a0f', '--surface': '#152318', '--surface-hover': '#1c2d1f',
    '--border': '#253a28', '--text': '#cce4d0', '--text-muted': '#5a8860',
    '--text-dim': '#2e4a32', '--link': '#78d890', '--link-hover': '#a0f0a8',
    '--green': '#40e060', '--header-bg': '#09120a', '--footer-bg': '#09120a',
  },
  silver: {
    '--accent': '#607090', '--accent-dark': '#405070',
    '--bg': '#dde4ec', '--surface': '#eef2f8', '--surface-hover': '#e4eaf4',
    '--border': '#b0bfcf', '--text': '#2a3848', '--text-muted': '#607888',
    '--text-dim': '#a0b0c0', '--link': '#2a5890', '--link-hover': '#4070b0',
    '--green': '#1e9040', '--header-bg': '#c0ccd8', '--footer-bg': '#c0ccd8',
  },
  dark: {
    '--accent': '#6060a8', '--accent-dark': '#404090',
    '--bg': '#070810', '--surface': '#0e0f1c', '--surface-hover': '#141525',
    '--border': '#1c1e30', '--text': '#b8bcd8', '--text-muted': '#485068',
    '--text-dim': '#1e2038', '--link': '#7878c8', '--link-hover': '#a0a0e0',
    '--green': '#30cc60', '--header-bg': '#040508', '--footer-bg': '#040508',
  },
  purple: {
    '--accent': '#8a30c8', '--accent-dark': '#6820a8',
    '--bg': '#0f0a1c', '--surface': '#1a1232', '--surface-hover': '#22184a',
    '--border': '#2c1858', '--text': '#d0c0f0', '--text-muted': '#806898',
    '--text-dim': '#301858', '--link': '#b090e8', '--link-hover': '#d0b8ff',
    '--green': '#30cc60', '--header-bg': '#0a0714', '--footer-bg': '#0a0714',
  },
};

const BANNERS = [
  {
    id: 'red-glow',
    label: 'Red Glow',
    css: '#080c14 radial-gradient(ellipse at 65% 45%, rgba(180,12,8,.6) 0%, rgba(90,5,12,.35) 40%, transparent 68%), radial-gradient(ellipse at 80% 30%, rgba(120,8,8,.3) 0%, transparent 50%)',
    preview: 'radial-gradient(ellipse at 65% 45%, #b40c08 0%, #200305 60%, #080c14 100%)',
  },
  {
    id: 'blue-storm',
    label: 'Blue Storm',
    css: '#08090f radial-gradient(ellipse at 30% 50%, rgba(10,60,200,.7) 0%, rgba(5,30,100,.4) 45%, transparent 70%)',
    preview: 'radial-gradient(ellipse at 30% 50%, #0a40c8 0%, #050a20 60%, #08090f 100%)',
  },
  {
    id: 'green-mist',
    label: 'Green Mist',
    css: '#070f08 radial-gradient(ellipse at 50% 60%, rgba(10,160,40,.55) 0%, rgba(5,80,20,.3) 45%, transparent 70%)',
    preview: 'radial-gradient(ellipse at 50% 60%, #0aa028 0%, #051808 60%, #070f08 100%)',
  },
  {
    id: 'purple-void',
    label: 'Purple Void',
    css: '#0a0810 radial-gradient(ellipse at 70% 40%, rgba(120,10,200,.65) 0%, rgba(60,5,120,.35) 45%, transparent 70%)',
    preview: 'radial-gradient(ellipse at 70% 40%, #780ac8 0%, #0a0510 60%, #0a0810 100%)',
  },
  {
    id: 'gold-flame',
    label: 'Gold',
    css: '#0f0c06 radial-gradient(ellipse at 50% 70%, rgba(200,140,10,.55) 0%, rgba(120,70,5,.3) 45%, transparent 70%)',
    preview: 'radial-gradient(ellipse at 50% 70%, #c88c0a 0%, #0f0c06 60%, #0f0c06 100%)',
  },
];

function applyTheme(name) {
  const theme = THEMES[name];
  if (!theme) return;
  const root = document.documentElement;
  Object.entries(theme).forEach(([k, v]) => root.style.setProperty(k, v));
  document.querySelectorAll('.swatch').forEach(s => {
    s.classList.toggle('active', s.dataset.theme === name);
  });
  localStorage.setItem('theme-name', name);
}

function applyBanner(id, css) {
  const banner = document.getElementById('site-banner');
  if (banner) banner.style.background = css;
  document.querySelectorAll('.banner-opt').forEach(b => {
    b.classList.toggle('active', b.dataset.banner === id);
  });
  localStorage.setItem('banner-id', id);
  localStorage.setItem('banner-css', css);
}

function promptCustomBanner() {
  const url = prompt('Enter image URL for banner:');
  if (!url) return;
  applyBanner('custom', `url('${CSS.escape ? url : url}') center/cover no-repeat, #080c14`);
}

function changeAvatar() {
  const current = document.getElementById('user-avatar');
  const url = prompt('Enter new avatar image URL:', current ? current.src : '');
  if (!url) return;
  document.querySelectorAll('.user-avatar').forEach(el => { el.src = url; });
  localStorage.setItem('avatar-url', url);
}

function toggleMobileView() {
  const on = document.body.classList.toggle('mobile-view');
  const btn = document.getElementById('mobile-btn');
  if (btn) btn.textContent = on ? '🖥 DESKTOP' : '📱 MOBILE';
  localStorage.setItem('mobile-view', on ? '1' : '0');
}

function initTheme() {
  const savedTheme = localStorage.getItem('theme-name');
  if (savedTheme && THEMES[savedTheme]) applyTheme(savedTheme);

  const savedBannerId = localStorage.getItem('banner-id');
  const savedBannerCss = localStorage.getItem('banner-css');
  if (savedBannerId && savedBannerCss) applyBanner(savedBannerId, savedBannerCss);

  const savedAvatar = localStorage.getItem('avatar-url');
  if (savedAvatar) {
    document.querySelectorAll('.user-avatar').forEach(el => { el.src = savedAvatar; });
  }

  if (localStorage.getItem('mobile-view') === '1') {
    document.body.classList.add('mobile-view');
    const btn = document.getElementById('mobile-btn');
    if (btn) btn.textContent = '🖥 DESKTOP';
  }
}

document.addEventListener('DOMContentLoaded', initTheme);
