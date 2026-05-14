/* ============================================================
   桌面血糖鐘 · Landing Page · Interactive JS
   ============================================================ */

const REPO = 'bigtaffy/floating-glucose';
const RELEASE_API = `https://api.github.com/repos/${REPO}/releases/latest`;

/* ===== Platform detection =====================================
   Returns one of: 'mac-arm64', 'mac-intel', 'mac-unknown',
                   'windows', 'mobile', 'other'
   Note: Apple Silicon detection is heuristic (Web APIs can't be
   100% certain client-side).
================================================================ */
function detectPlatform() {
  const ua = navigator.userAgent || '';
  const uaData = navigator.userAgentData;
  if (uaData?.mobile || /iPhone|iPad|Android/i.test(ua)) return 'mobile';

  const isMac = uaData?.platform === 'macOS' || /Mac OS X|Macintosh/i.test(ua);
  const isWin = uaData?.platform === 'Windows' || /Windows/i.test(ua);

  if (isMac) {
    // Apple Silicon heuristic: WebGL renderer reports 'Apple GPU' / 'Apple M*' on M-series
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl) {
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        if (ext) {
          const renderer = gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '';
          if (/Apple\s*M\d|Apple GPU/i.test(renderer)) return 'mac-arm64';
          if (/Intel|AMD|NVIDIA/i.test(renderer)) return 'mac-intel';
        }
      }
    } catch (e) { /* ignore */ }
    // Fallback: post-2020 Macs are most likely arm64
    return 'mac-arm64';
  }
  if (isWin) return 'windows';
  return 'other';
}

/* ===== GitHub Release fetch =================================== */
async function loadLatestRelease() {
  try {
    const r = await fetch(RELEASE_API);
    if (!r.ok) throw new Error('GitHub API ' + r.status);
    const data = await r.json();
    return {
      version: data.tag_name,
      publishedAt: data.published_at,
      assets: data.assets.map(a => ({
        name: a.name,
        url: a.browser_download_url,
        size: a.size
      }))
    };
  } catch (e) {
    console.error('Failed to fetch latest release:', e);
    return null;
  }
}

function formatBytes(bytes) {
  if (!bytes) return '';
  const mb = bytes / 1024 / 1024;
  if (mb < 1024) return mb.toFixed(1) + ' MB';
  return (mb / 1024).toFixed(2) + ' GB';
}

function platformToAssetPattern(p) {
  switch (p) {
    case 'mac-arm64':  return /arm64\.dmg$/;
    case 'mac-intel':  return /^FloatingGlucose-\d.+\.dmg$/;
    case 'mac-unknown':return /\.dmg$/;
    case 'windows':    return /\.exe$/;
    default: return null;
  }
}

function findAsset(release, pattern) {
  if (!release || !pattern) return null;
  return release.assets.find(a => pattern.test(a.name));
}

/* ===== Setup primary download button =========================
   The hero CTA button picks the right asset for the visitor's
   detected platform and updates label + href accordingly.
=============================================================== */
async function setupDownloads() {
  const release = await loadLatestRelease();
  const platform = detectPlatform();

  // Update version label
  if (release) {
    const verEl = document.getElementById('latest-version');
    if (verEl) verEl.textContent = release.version;
  }

  // Primary hero button
  const primary = document.getElementById('primary-download');
  if (primary) {
    if (platform === 'mobile' || platform === 'other') {
      primary.querySelector('.btn-text').textContent = '查看下載選項';
      primary.href = '#download';
    } else if (release) {
      const pattern = platformToAssetPattern(platform);
      const asset = findAsset(release, pattern);
      const label = {
        'mac-arm64': '為 Mac (Apple Silicon) 下載',
        'mac-intel': '為 Mac (Intel) 下載',
        'mac-unknown': '為 Mac 下載',
        'windows': '為 Windows 下載'
      }[platform] || '下載';
      if (asset) {
        primary.href = asset.url;
        primary.querySelector('.btn-text').textContent = label + ' · ' + release.version;
        primary.setAttribute('download', '');
      }
    } else {
      primary.querySelector('.btn-text').textContent = '前往下載區';
    }
  }

  // Download cards (3 platforms)
  document.querySelectorAll('.dl-btn').forEach(btn => {
    const patternStr = btn.getAttribute('data-asset-pattern');
    if (!patternStr) return;
    const pattern = new RegExp(patternStr);
    const asset = release ? findAsset(release, pattern) : null;
    if (asset) {
      btn.href = asset.url;
      btn.querySelector('.dl-size').textContent = formatBytes(asset.size);
      btn.innerHTML = `<span>⬇ 下載</span> <span class="dl-size">${formatBytes(asset.size)}</span>`;
      btn.setAttribute('download', '');
    } else {
      btn.innerHTML = `<span class="dl-size">暫不可用</span>`;
      btn.style.opacity = '0.5';
      btn.style.pointerEvents = 'none';
    }
  });

  // Highlight the recommended card
  const recommendCardId = {
    'mac-arm64': 'dl-mac-arm',
    'mac-intel': 'dl-mac-intel',
    'mac-unknown': 'dl-mac-arm',
    'windows': 'dl-windows'
  }[platform];
  if (recommendCardId) {
    const card = document.getElementById(recommendCardId);
    if (card) card.classList.add('recommended');
  }
}

/* ===== Hero widget cycling animation =========================
   6-state loop showing widget across glucose range
=============================================================== */
const HERO_STATES = [
  { value: '120', arrow: '→',  color: '#6ee36b', delta: '+2',  age: 'just now',  arrowRot: 0 },
  { value: '145', arrow: '↗',  color: '#6ee36b', delta: '+8',  age: 'just now',  arrowRot: -45 },
  { value: '175', arrow: '↗',  color: '#f5d442', delta: '+12', age: '1 min ago', arrowRot: -45 },
  { value: '198', arrow: '↑',  color: '#ff5252', delta: '+18', age: '2 mins ago', arrowRot: -90 },
  { value: '120', arrow: '→',  color: '#6ee36b', delta: '-15', age: 'just now',  arrowRot: 0 },
  { value: '85',  arrow: '↓',  color: '#f5d442', delta: '-8',  age: '1 min ago', arrowRot: 90 }
];

function startHeroAnimation() {
  const valEl   = document.getElementById('hero-value');
  const arrEl   = document.getElementById('hero-arrow');
  const dltEl   = document.getElementById('hero-delta');
  const ageEl   = document.getElementById('hero-age');
  const mbVal   = document.getElementById('hero-menubar-value');
  const mbArr   = document.getElementById('hero-menubar-arrow');
  if (!valEl) return;

  let i = 0;
  const apply = () => {
    const s = HERO_STATES[i];
    valEl.textContent = s.value;
    valEl.style.color = s.color;
    arrEl.textContent = s.arrow;
    arrEl.style.color = s.color;
    dltEl.textContent = s.delta;
    ageEl.textContent = s.age;
    if (mbVal) mbVal.textContent = s.value;
    if (mbVal) mbVal.style.color = s.color;
    if (mbArr) { mbArr.textContent = s.arrow; mbArr.style.color = s.color; }
    i = (i + 1) % HERO_STATES.length;
  };
  apply();
  setInterval(apply, 2200);
}

/* ===== Feature card: color demo on hover ====================== */
function setupColorDemo() {
  const card = document.querySelector('.feature-color');
  if (!card) return;
  const valueEl = document.getElementById('demo-color-value');
  const widget = document.getElementById('demo-color');

  const states = [
    { v: 120, color: '#6ee36b' },
    { v: 165, color: '#f5d442' },
    { v: 210, color: '#ff5252' },
    { v: 75,  color: '#ff5252' }
  ];
  let timer = null;
  let idx = 0;
  function step() {
    const s = states[idx % states.length];
    valueEl.textContent = s.v;
    valueEl.style.color = s.color;
    idx++;
  }
  card.addEventListener('mouseenter', () => {
    step();
    timer = setInterval(step, 700);
  });
  card.addEventListener('mouseleave', () => {
    clearInterval(timer);
    idx = 0;
    valueEl.textContent = '120';
    valueEl.style.color = '#6ee36b';
  });
}

/* ===== Feature card: trend chart draw-in ====================== */
function setupTrendDemo() {
  const path = document.getElementById('demo-trend-path');
  if (!path) return;
  const len = path.getTotalLength();
  path.style.strokeDasharray = len;
  path.style.strokeDashoffset = len;
  path.style.transition = 'stroke-dashoffset 2s ease-out';

  // Trigger when feature card scrolls into view
  const card = path.closest('.feature-card');
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        requestAnimationFrame(() => {
          path.style.strokeDashoffset = '0';
        });
        io.disconnect();
      }
    });
  }, { threshold: 0.4 });
  io.observe(card);
}

/* ===== Feature card: alarm sound demo (Web Audio API) ========= */
let audioCtx = null;
function playBeeps(freq, count = 3, duration = 0.2, gap = 0.12) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const now = audioCtx.currentTime;
    for (let i = 0; i < count; i++) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      const start = now + i * (duration + gap);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(0.3, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      osc.start(start);
      osc.stop(start + duration + 0.05);
    }
  } catch (e) { console.error('beep:', e); }
}

function setupAlarmDemo() {
  document.querySelectorAll('[data-sound]').forEach(btn => {
    btn.addEventListener('click', () => {
      const kind = btn.getAttribute('data-sound');
      if (kind === 'urgent-low') playBeeps(440, 4, 0.2, 0.1);
      else playBeeps(880, 3, 0.18, 0.12);
      btn.classList.add('playing');
      setTimeout(() => btn.classList.remove('playing'), 800);
    });
  });
}

/* ===== Feature card: language demo (cycles every 2s) ========== */
const LANG_PHRASES = [
  { lang: 'zh-TW', phrase: '設定畫面', bg: 'linear-gradient(135deg, #FFE0EC 0%, #C9E4FF 100%)' },
  { lang: 'zh-CN', phrase: '设置画面', bg: 'linear-gradient(135deg, #FFE8B0 0%, #FFD1F2 100%)' },
  { lang: 'en',    phrase: 'Settings', bg: 'linear-gradient(135deg, #C9E4FF 0%, #E9D6FF 100%)' },
  { lang: 'ja',    phrase: '設定画面', bg: 'linear-gradient(135deg, #FFD1F2 0%, #FFE8B0 100%)' }
];

function setupLangDemo() {
  const el = document.getElementById('demo-lang');
  if (!el) return;
  const inner = el.querySelector('.lang-current');
  let i = 0;
  setInterval(() => {
    i = (i + 1) % LANG_PHRASES.length;
    const p = LANG_PHRASES[i];
    inner.style.opacity = '0';
    setTimeout(() => {
      inner.textContent = p.phrase;
      el.style.background = p.bg;
      inner.style.opacity = '1';
    }, 250);
  }, 2200);
  inner.style.transition = 'opacity 0.25s';
}

/* ===== Scroll reveal animations =============================== */
function setupReveal() {
  const elements = document.querySelectorAll('.reveal');
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });
  elements.forEach(el => io.observe(el));
}

/* ===== Init =================================================== */
window.addEventListener('DOMContentLoaded', () => {
  setupReveal();
  startHeroAnimation();
  setupColorDemo();
  setupTrendDemo();
  setupAlarmDemo();
  setupLangDemo();
  setupDownloads();
});
