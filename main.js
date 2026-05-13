const { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const i18n = require('./i18n');

const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');
const DEFAULT_CONFIG = {
  nsUrl: '',
  token: '',
  units: 'mg/dL',
  urgentHigh: 200,
  high: 150,
  low: 85,
  urgentLow: 68,
  staleWarn: 15,
  staleUrgent: 30,
  windowX: null,
  windowY: null,
  fontSize: 28,
  refreshSec: 60,
  language: null,
  showFloating: true,
  showInMenuBar: true,
  hideDock: false
};

let floatingWindow = null;
let settingsWindow = null;
let tray = null;
let refreshTimer = null;

function loadConfig() {
  let cfg = { ...DEFAULT_CONFIG };
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      cfg = { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) };
    }
  } catch (e) {
    console.error('Failed to load config', e);
  }
  if (!cfg.language || !i18n.SUPPORTED.includes(cfg.language)) {
    cfg.language = i18n.detectSystemLanguage();
  }
  return cfg;
}

function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

function fetchJson(urlStr) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchJson(new URL(res.headers.location, urlStr).toString()).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => body += c);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => req.destroy(new Error('timeout')));
  });
}

async function fetchGlucose(cfg) {
  if (!cfg.nsUrl) throw new Error('Nightscout URL not configured');
  const base = cfg.nsUrl.replace(/\/+$/, '');
  let url = `${base}/api/v1/entries.json?count=2`;
  if (cfg.token) {
    const hash = crypto.createHash('sha1').update(cfg.token).digest('hex');
    url += `&secret=${hash}`;
    url += `&token=${encodeURIComponent(cfg.token)}`;
  }
  const data = await fetchJson(url);
  if (!Array.isArray(data) || data.length === 0) throw new Error('No entries');
  return data;
}

const DIRECTION_ARROW = {
  DoubleUp: '⇈',
  SingleUp: '↑',
  FortyFiveUp: '↗',
  Flat: '→',
  FortyFiveDown: '↘',
  SingleDown: '↓',
  DoubleDown: '⇊',
  NONE: '⇼',
  'NOT COMPUTABLE': '-',
  'RATE OUT OF RANGE': '⇕'
};

function classify(sgv, ageMin, cfg) {
  if (ageMin >= cfg.staleUrgent) return 'stale-urgent';
  if (ageMin >= cfg.staleWarn) return 'stale-warn';
  if (sgv >= cfg.urgentHigh) return 'urgent-high';
  if (sgv >= cfg.high) return 'high';
  if (sgv <= cfg.urgentLow) return 'urgent-low';
  if (sgv <= cfg.low) return 'low';
  return 'in-range';
}

function updateTrayTitle(text) {
  if (process.platform !== 'darwin' || !tray) return;
  try { tray.setTitle(text || ''); } catch (_) {}
}

async function refresh() {
  const cfg = loadConfig();
  try {
    const entries = await fetchGlucose(cfg);
    const latest = entries[0];
    const prev = entries[1];
    const sgv = latest.sgv;
    const ageMin = Math.round((Date.now() - latest.date) / 60000);
    const delta = prev ? sgv - prev.sgv : 0;
    const display = cfg.units === 'mmol/L' ? (sgv / 18).toFixed(1) : String(sgv);
    const deltaDisplay = cfg.units === 'mmol/L' ? (delta / 18).toFixed(1) : String(delta);
    const arrow = DIRECTION_ARROW[latest.direction] || '';
    const payload = {
      value: display,
      arrow,
      delta: (delta >= 0 ? '+' : '') + deltaDisplay,
      ageMin,
      units: cfg.units,
      status: classify(sgv, ageMin, cfg),
      fontSize: cfg.fontSize
    };
    if (floatingWindow && !floatingWindow.isDestroyed()) {
      floatingWindow.webContents.send('glucose-update', payload);
    }
    if (cfg.showInMenuBar) {
      updateTrayTitle(`${display}${arrow ? ' ' + arrow : ''}`);
    } else {
      updateTrayTitle('');
    }
  } catch (e) {
    if (floatingWindow && !floatingWindow.isDestroyed()) {
      floatingWindow.webContents.send('glucose-error', { message: e.message, fontSize: cfg.fontSize });
    }
    if (cfg.showInMenuBar) updateTrayTitle('--');
  }
}

function scheduleRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  const cfg = loadConfig();
  refreshTimer = setInterval(refresh, Math.max(15, cfg.refreshSec) * 1000);
  refresh();
}

function applyVisibility() {
  const cfg = loadConfig();

  if (cfg.showFloating) {
    if (!floatingWindow || floatingWindow.isDestroyed()) {
      createFloatingWindow();
    } else if (!floatingWindow.isVisible()) {
      floatingWindow.show();
    }
  } else if (floatingWindow && !floatingWindow.isDestroyed()) {
    floatingWindow.hide();
  }

  if (process.platform === 'darwin' && app.dock) {
    if (cfg.hideDock) app.dock.hide();
    else app.dock.show();
  }

  if (!cfg.showInMenuBar) updateTrayTitle('');
}

function createFloatingWindow() {
  const cfg = loadConfig();
  const display = screen.getPrimaryDisplay();
  const defaultX = display.workArea.x + display.workArea.width - 220;
  const defaultY = display.workArea.y + 20;

  floatingWindow = new BrowserWindow({
    width: 200,
    height: 90,
    x: cfg.windowX ?? defaultX,
    y: cfg.windowY ?? defaultY,
    frame: false,
    transparent: true,
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    focusable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  floatingWindow.setAlwaysOnTop(true, 'floating');
  floatingWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  floatingWindow.loadFile(path.join(__dirname, 'renderer', 'floating.html'));

  floatingWindow.on('moved', () => {
    const [x, y] = floatingWindow.getPosition();
    const c = loadConfig();
    c.windowX = x; c.windowY = y;
    saveConfig(c);
  });

  floatingWindow.webContents.on('did-finish-load', () => scheduleRefresh());
}

function openSettings() {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.show();
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 520,
    height: 640,
    title: 'Glucose Settings',
    center: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  settingsWindow.setMenu(null);
  settingsWindow.loadFile(path.join(__dirname, 'renderer', 'settings.html'));
  settingsWindow.once('ready-to-show', () => {
    settingsWindow.show();
    settingsWindow.focus();
    if (process.platform === 'darwin') app.dock?.show?.();
  });
  settingsWindow.on('closed', () => { settingsWindow = null; });
}

function makeTrayIcon() {
  const isMac = process.platform === 'darwin';
  const base = isMac ? 'tray.png' : 'tray-win.png';
  const trayPath = path.join(__dirname, 'assets', base);
  try {
    if (fs.existsSync(trayPath)) {
      const img = nativeImage.createFromPath(trayPath);
      if (img && !img.isEmpty()) return img;
    }
  } catch (e) {
    console.error('Failed to load tray icon from', trayPath, e);
  }
  // Fallback: tiny white dot bitmap so the app still functions if assets missing.
  const w = 16, h = 16;
  const buf = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const dx = x - 7.5, dy = y - 7.5;
      if (Math.sqrt(dx * dx + dy * dy) < 6.5) {
        buf[i] = 0xFF; buf[i + 1] = 0xFF; buf[i + 2] = 0xFF; buf[i + 3] = 0xFF;
      }
    }
  }
  return nativeImage.createFromBuffer(buf, { width: w, height: h });
}

function buildTray() {
  try {
    if (!tray) {
      const icon = makeTrayIcon();
      tray = new Tray(icon);
    }
    const lang = loadConfig().language;
    tray.setToolTip(i18n.t(lang, 'app.name'));
    const menu = Menu.buildFromTemplate([
      { label: i18n.t(lang, 'tray.refresh'), click: refresh },
      { label: i18n.t(lang, 'tray.settings'), click: openSettings },
      { type: 'separator' },
      { label: i18n.t(lang, 'tray.quit'), click: () => { app.quit(); } }
    ]);
    tray.setContextMenu(menu);
    tray.on('click', () => openSettings());
  } catch (e) {
    console.error('Failed to build tray:', e);
  }
}

function broadcastLanguage() {
  const lang = loadConfig().language;
  const bundle = i18n.getBundle(lang);
  const payload = { lang, bundle };
  if (floatingWindow && !floatingWindow.isDestroyed()) {
    floatingWindow.webContents.send('language-changed', payload);
  }
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.webContents.send('language-changed', payload);
  }
  buildTray();
}

ipcMain.handle('config:get', () => loadConfig());
ipcMain.handle('config:save', (_e, cfg) => {
  const prev = loadConfig();
  saveConfig(cfg);
  scheduleRefresh();
  applyVisibility();
  if (prev.language !== cfg.language) broadcastLanguage();
  return true;
});
ipcMain.handle('i18n:get', () => {
  const lang = loadConfig().language;
  return { lang, bundle: i18n.getBundle(lang), supported: i18n.SUPPORTED };
});
ipcMain.handle('i18n:setLanguage', (_e, lang) => {
  if (!i18n.SUPPORTED.includes(lang)) return false;
  const cfg = loadConfig();
  cfg.language = lang;
  saveConfig(cfg);
  broadcastLanguage();
  return true;
});
ipcMain.handle('config:test', async (_e, cfg) => {
  try {
    const entries = await fetchGlucose(cfg);
    return { ok: true, sample: entries[0] };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});
ipcMain.on('open-settings', openSettings);
ipcMain.on('quit-app', () => app.quit());

app.whenReady().then(() => {
  buildTray();
  applyVisibility();
  const cfg = loadConfig();
  if (!cfg.nsUrl) openSettings();
});

app.on('activate', () => {
  if (!floatingWindow || floatingWindow.isDestroyed()) {
    createFloatingWindow();
  } else {
    floatingWindow.show();
  }
  const cfg = loadConfig();
  if (!cfg.nsUrl) openSettings();
});

app.on('window-all-closed', (e) => { e.preventDefault(); });

process.on('uncaughtException', (err) => {
  console.error('uncaughtException:', err);
});
