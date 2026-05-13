const { app, BrowserWindow, ipcMain, Menu, Tray, Notification, dialog, nativeImage, screen, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const { autoUpdater } = require('electron-updater');
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
  hideDock: false,
  enableSoundAlarms: true,
  enableStaleNotification: true,
  trendHours: 4
};

let floatingWindow = null;
let settingsWindow = null;
let trendWindow = null;
let tray = null;
let refreshTimer = null;
let previousStatus = null;

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

function handleStateTransition(newStatus, ageMin, sgv, cfg) {
  const lang = cfg.language;
  const wasUrgent = previousStatus === 'urgent-high' || previousStatus === 'urgent-low';
  const wasStale = previousStatus === 'stale-warn' || previousStatus === 'stale-urgent';
  const isUrgent = newStatus === 'urgent-high' || newStatus === 'urgent-low';
  const isStale = newStatus === 'stale-warn' || newStatus === 'stale-urgent';

  // Sound alarm: entered urgent from non-urgent state
  if (cfg.enableSoundAlarms !== false && isUrgent && !wasUrgent) {
    if (floatingWindow && !floatingWindow.isDestroyed()) {
      floatingWindow.webContents.send('play-alarm', { status: newStatus });
    }
  }

  // CGM disconnect notification: entered stale state from fresh data
  if (cfg.enableStaleNotification !== false && isStale && !wasStale) {
    try {
      new Notification({
        title: i18n.t(lang, 'alert.cgmDisconnectedTitle'),
        body: i18n.t(lang, 'alert.cgmDisconnectedBody', { minutes: ageMin })
      }).show();
    } catch (e) {
      console.error('Notification failed:', e);
    }
  }

  // Urgent-state system notification (in addition to sound) for OS-level alert
  if (cfg.enableStaleNotification !== false && isUrgent && !wasUrgent) {
    const key = newStatus === 'urgent-low' ? 'alert.urgentLowBody' : 'alert.urgentHighBody';
    const titleKey = newStatus === 'urgent-low' ? 'alert.urgentLowTitle' : 'alert.urgentHighTitle';
    try {
      new Notification({
        title: i18n.t(lang, titleKey),
        body: i18n.t(lang, key, { value: sgv, units: cfg.units })
      }).show();
    } catch (e) {
      console.error('Notification failed:', e);
    }
  }

  previousStatus = newStatus;
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
    const status = classify(sgv, ageMin, cfg);
    const payload = {
      value: display,
      arrow,
      delta: (delta >= 0 ? '+' : '') + deltaDisplay,
      ageMin,
      units: cfg.units,
      status,
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
    handleStateTransition(status, ageMin, sgv, cfg);
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

function openTrend() {
  if (trendWindow && !trendWindow.isDestroyed()) {
    trendWindow.show();
    trendWindow.focus();
    return;
  }
  trendWindow = new BrowserWindow({
    width: 640,
    height: 380,
    title: 'Glucose Trend',
    center: true,
    show: false,
    minWidth: 480,
    minHeight: 300,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  trendWindow.setMenu(null);
  trendWindow.loadFile(path.join(__dirname, 'renderer', 'trend.html'));
  trendWindow.once('ready-to-show', () => {
    trendWindow.show();
    trendWindow.focus();
  });
  trendWindow.on('closed', () => { trendWindow = null; });
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
      { label: i18n.t(lang, 'tray.trend'), click: openTrend },
      { label: i18n.t(lang, 'tray.settings'), click: openSettings },
      { label: i18n.t(lang, 'tray.checkUpdate'), click: () => checkForUpdates(false) },
      { type: 'separator' },
      { label: `v${app.getVersion()}`, enabled: false },
      { type: 'separator' },
      { label: i18n.t(lang, 'tray.quit'), click: () => { app.quit(); } }
    ]);
    tray.setContextMenu(menu);
    tray.on('click', () => openSettings());
  } catch (e) {
    console.error('Failed to build tray:', e);
  }
}

let updateCheckSilent = true;
function checkForUpdates(silent) {
  if (!app.isPackaged) {
    if (!silent) {
      dialog.showMessageBox({
        type: 'info',
        message: 'Update check is disabled in development mode.'
      });
    }
    return;
  }
  updateCheckSilent = !!silent;
  autoUpdater.checkForUpdates().catch((e) => {
    console.error('Update check failed:', e);
  });
}

function setupAutoUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('error', (err) => {
    console.error('autoUpdater error:', err);
    if (!updateCheckSilent) {
      const lang = loadConfig().language;
      dialog.showErrorBox(
        i18n.t(lang, 'update.errorTitle'),
        i18n.t(lang, 'update.errorBody', { error: err.message || String(err) })
      );
    }
  });

  autoUpdater.on('update-not-available', () => {
    if (!updateCheckSilent) {
      const lang = loadConfig().language;
      dialog.showMessageBox({
        type: 'info',
        title: i18n.t(lang, 'update.upToDateTitle'),
        message: i18n.t(lang, 'update.upToDateBody', { version: app.getVersion() })
      });
    }
  });

  autoUpdater.on('update-available', (info) => {
    if (!updateCheckSilent) {
      const lang = loadConfig().language;
      new Notification({
        title: i18n.t(lang, 'update.downloadingTitle'),
        body: i18n.t(lang, 'update.downloadingBody', { version: info.version })
      }).show();
    }
  });

  autoUpdater.on('update-downloaded', (info) => {
    const lang = loadConfig().language;
    const result = dialog.showMessageBoxSync({
      type: 'info',
      buttons: [
        i18n.t(lang, 'update.restartNow'),
        i18n.t(lang, 'update.restartLater')
      ],
      defaultId: 0,
      cancelId: 1,
      title: i18n.t(lang, 'update.readyTitle'),
      message: i18n.t(lang, 'update.readyBody', { version: info.version })
    });
    if (result === 0) {
      setImmediate(() => autoUpdater.quitAndInstall());
    }
  });
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
ipcMain.on('open-trend', openTrend);
ipcMain.on('quit-app', () => app.quit());

ipcMain.handle('fetch-trend', async () => {
  const cfg = loadConfig();
  if (!cfg.nsUrl) throw new Error('Nightscout URL not configured');
  const hours = Math.max(1, Math.min(24, cfg.trendHours || 4));
  const base = cfg.nsUrl.replace(/\/+$/, '');
  const sinceMs = Date.now() - hours * 60 * 60 * 1000;
  // Use NS find filter so we never miss entries within window. count cap is large.
  let url = `${base}/api/v1/entries.json?count=300&find[date][$gte]=${sinceMs}`;
  if (cfg.token) {
    const hash = crypto.createHash('sha1').update(cfg.token).digest('hex');
    url += `&secret=${hash}&token=${encodeURIComponent(cfg.token)}`;
  }
  const data = await fetchJson(url);
  return {
    entries: Array.isArray(data) ? data.filter(e => typeof e.sgv === 'number') : [],
    units: cfg.units,
    hours,
    thresholds: {
      urgentHigh: cfg.urgentHigh,
      high: cfg.high,
      low: cfg.low,
      urgentLow: cfg.urgentLow
    }
  };
});
ipcMain.on('floating:report-size', (_e, size) => {
  if (!floatingWindow || floatingWindow.isDestroyed()) return;
  if (!size || !size.width || !size.height) return;
  const targetW = Math.max(140, Math.min(800, Math.ceil(size.width)));
  const targetH = Math.max(60, Math.min(400, Math.ceil(size.height)));
  const bounds = floatingWindow.getBounds();
  if (Math.abs(bounds.width - targetW) < 4 && Math.abs(bounds.height - targetH) < 4) return;
  // Anchor the right edge so widget stays put when growing/shrinking.
  const newX = bounds.x + (bounds.width - targetW);
  floatingWindow.setBounds({ x: newX, y: bounds.y, width: targetW, height: targetH }, false);
});

app.whenReady().then(() => {
  buildTray();
  applyVisibility();
  setupAutoUpdater();
  const cfg = loadConfig();
  if (!cfg.nsUrl) openSettings();
  // First check 30s after launch (let app settle), then every 6 hours.
  setTimeout(() => checkForUpdates(true), 30 * 1000);
  setInterval(() => checkForUpdates(true), 6 * 60 * 60 * 1000);
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
