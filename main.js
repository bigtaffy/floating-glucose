const { app, BrowserWindow, ipcMain, Menu, Tray, Notification, dialog, nativeImage, screen, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const crypto = require('crypto');
const { autoUpdater } = require('electron-updater');
const i18n = require('./i18n');

const CONFIG_PATH = path.join(app.getPath('userData'), 'config.json');

// Per-profile fields. Each profile represents one Nightscout site.
const DEFAULT_PROFILE_TEMPLATE = {
  id: '',
  name: '',
  nsUrl: '',
  token: '',
  urgentHigh: 200,
  high: 150,
  low: 85,
  urgentLow: 68,
  staleWarn: 15,
  staleUrgent: 30,
  enabled: true,
  color: '#6ee36b'
};

// Top-level shared settings.
const DEFAULT_CONFIG = {
  profiles: [],
  units: 'mg/dL',
  windowX: null,
  windowY: null,
  fontSize: 28,
  refreshSec: 60,
  language: null,
  showFloating: true,
  showInMenuBar: true,
  hideDock: false,
  showTrayValue: true,
  enableSoundAlarms: true,
  enableStaleNotification: true,
  trendHours: 4
};

// For picking which profile's value to render into the Windows tray icon
// (and which to prioritise in the macOS title): higher = more attention.
const STATUS_PRIORITY = {
  'urgent-low': 6,
  'urgent-high': 6,
  'low': 4,
  'high': 4,
  'stale-urgent': 3,
  'stale-warn': 2,
  'in-range': 1
};

let floatingWindow = null;
let settingsWindow = null;
let trendWindow = null;
let tray = null;
let refreshTimer = null;
// Track previous classification per profile so we only fire alarms on
// transitions (not on every refresh while still in urgent state).
const previousStatusByProfile = new Map();

function generateId() {
  return 'p-' + crypto.randomBytes(8).toString('hex');
}

function newProfile(overrides = {}) {
  return { ...DEFAULT_PROFILE_TEMPLATE, id: generateId(), ...overrides };
}

/**
 * v1 → v2 migration: collapse the flat single-NS config into a single
 * profile inside the new profiles[] array. Preserves user's data.
 */
function migrateIfNeeded(raw) {
  if (raw && Array.isArray(raw.profiles)) return raw;
  if (!raw || typeof raw !== 'object') return null;

  const legacy = newProfile({
    name: '主要',
    nsUrl: raw.nsUrl || '',
    token: raw.token || '',
    urgentHigh: raw.urgentHigh ?? 200,
    high: raw.high ?? 150,
    low: raw.low ?? 85,
    urgentLow: raw.urgentLow ?? 68,
    staleWarn: raw.staleWarn ?? 15,
    staleUrgent: raw.staleUrgent ?? 30,
    enabled: true
  });

  // Strip legacy keys, keep shared ones
  const { nsUrl, token, urgentHigh, high, low, urgentLow, staleWarn, staleUrgent, ...rest } = raw;
  return { ...rest, profiles: [legacy] };
}

function loadConfig() {
  let cfg;
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      cfg = migrateIfNeeded(cfg);
    }
  } catch (e) {
    console.error('Failed to load config', e);
  }
  cfg = { ...DEFAULT_CONFIG, ...(cfg || {}) };

  // Ensure profiles is always an array, even if migration produced nothing
  if (!Array.isArray(cfg.profiles)) cfg.profiles = [];

  // Ensure every profile has an id (helps with reorder/edit safety)
  cfg.profiles = cfg.profiles.map(p => ({ ...DEFAULT_PROFILE_TEMPLATE, ...p, id: p.id || generateId() }));

  if (!cfg.language || !i18n.SUPPORTED.includes(cfg.language)) {
    cfg.language = i18n.detectSystemLanguage();
  }
  return cfg;
}

function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

// Turn low-level network errors into a short, human-readable message.
// Node throws AggregateError when every resolved address fails to connect —
// its own .message is usually empty, so dig into .errors[0] / .code.
function describeNetError(err) {
  let e = err;
  if (e && Array.isArray(e.errors) && e.errors.length) e = e.errors[0];
  const code = e && e.code;
  switch (code) {
    case 'ENOTFOUND':
    case 'EAI_AGAIN':
      return 'Cannot reach server (wrong URL or no internet)';
    case 'ECONNREFUSED':
      return 'Server refused the connection';
    case 'ETIMEDOUT':
      return 'Connection timed out';
    case 'CERT_HAS_EXPIRED':
      return 'Server certificate expired';
    case 'UNABLE_TO_VERIFY_LEAF_SIGNATURE':
    case 'DEPTH_ZERO_SELF_SIGNED_CERT':
      return 'Server certificate not trusted';
    default:
      break;
  }
  if (e && e.message) return e.message;
  if (code) return code;
  return 'Network error';
}

function fetchJson(urlStr) {
  return new Promise((resolve, reject) => {
    let url;
    try {
      url = new URL(urlStr);
    } catch (_) {
      return reject(new Error('Invalid URL'));
    }
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchJson(new URL(res.headers.location, urlStr).toString()).then(resolve, reject);
      }
      if (res.statusCode === 401 || res.statusCode === 403) {
        res.resume();
        return reject(new Error('Unauthorized — check your token / password'));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => body += c);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (_) {
          reject(new Error('Server did not return valid data'));
        }
      });
    });
    req.on('error', (err) => reject(new Error(describeNetError(err))));
    req.setTimeout(15000, () => req.destroy(new Error('Connection timed out')));
  });
}

async function fetchGlucoseForProfile(profile) {
  if (!profile.nsUrl) throw new Error('Nightscout URL not configured');
  const base = profile.nsUrl.replace(/\/+$/, '');
  let url = `${base}/api/v1/entries.json?count=2`;
  if (profile.token) {
    const hash = crypto.createHash('sha1').update(profile.token).digest('hex');
    url += `&secret=${hash}&token=${encodeURIComponent(profile.token)}`;
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

function classify(sgv, ageMin, profile) {
  if (ageMin >= profile.staleUrgent) return 'stale-urgent';
  if (ageMin >= profile.staleWarn) return 'stale-warn';
  if (sgv >= profile.urgentHigh) return 'urgent-high';
  if (sgv >= profile.high) return 'high';
  if (sgv <= profile.urgentLow) return 'urgent-low';
  if (sgv <= profile.low) return 'low';
  return 'in-range';
}

function updateTrayTitle(text) {
  if (process.platform !== 'darwin' || !tray) return;
  try { tray.setTitle(text || ''); } catch (_) {}
}

/**
 * Fire sound and OS notifications for a profile that just changed state.
 * Frequency bump per profile index so the user can hear which person is
 * alarming (decision 2: option B).
 */
function handleStateTransition(profile, profileIndex, newStatus, ageMin, sgv, cfg) {
  const lang = cfg.language;
  const prev = previousStatusByProfile.get(profile.id);
  const wasUrgent = prev === 'urgent-high' || prev === 'urgent-low';
  const wasStale  = prev === 'stale-warn' || prev === 'stale-urgent';
  const isUrgent  = newStatus === 'urgent-high' || newStatus === 'urgent-low';
  const isStale   = newStatus === 'stale-warn' || newStatus === 'stale-urgent';

  if (cfg.enableSoundAlarms !== false && isUrgent && !wasUrgent) {
    if (floatingWindow && !floatingWindow.isDestroyed()) {
      floatingWindow.webContents.send('play-alarm', {
        status: newStatus,
        profileIndex,
        profileName: profile.name
      });
    }
  }

  if (cfg.enableStaleNotification !== false && isStale && !wasStale) {
    try {
      new Notification({
        title: i18n.t(lang, 'alert.cgmDisconnectedTitle'),
        body: i18n.t(lang, 'alert.cgmDisconnectedBodyNamed', { name: profile.name, minutes: ageMin })
      }).show();
    } catch (e) { console.error('Notification failed:', e); }
  }

  if (cfg.enableStaleNotification !== false && isUrgent && !wasUrgent) {
    const titleKey = newStatus === 'urgent-low' ? 'alert.urgentLowTitle' : 'alert.urgentHighTitle';
    const bodyKey  = newStatus === 'urgent-low' ? 'alert.urgentLowBodyNamed' : 'alert.urgentHighBodyNamed';
    try {
      new Notification({
        title: i18n.t(lang, titleKey),
        body: i18n.t(lang, bodyKey, { name: profile.name, value: sgv, units: cfg.units })
      }).show();
    } catch (e) { console.error('Notification failed:', e); }
  }

  previousStatusByProfile.set(profile.id, newStatus);
}

/**
 * Refresh all enabled profiles in parallel and push a batched update
 * to the floating window. Also updates menu-bar title and triggers
 * per-profile alarm transitions.
 */
async function refreshAll() {
  const cfg = loadConfig();
  const enabledProfiles = cfg.profiles.filter(p => p.enabled);

  if (enabledProfiles.length === 0) {
    if (floatingWindow && !floatingWindow.isDestroyed()) {
      floatingWindow.webContents.send('glucose-update-all', {
        profiles: [],
        units: cfg.units,
        fontSize: cfg.fontSize,
        needsSetup: true
      });
    }
    if (cfg.showInMenuBar) updateTrayTitle('');
    return;
  }

  // Split into fetchable (have URL) and needs-setup. Both groups still appear
  // in the floating widget so the user can see all their profiles, even ones
  // that haven't been finished setting up.
  const profiles = enabledProfiles.filter(p => p.nsUrl);
  const needsUrlProfiles = enabledProfiles.filter(p => !p.nsUrl);

  const results = await Promise.allSettled(profiles.map(p => fetchGlucoseForProfile(p)));

  const updates = results.map((r, i) => {
    const profile = profiles[i];
    if (r.status === 'rejected') {
      return {
        profileId: profile.id,
        name: profile.name,
        color: profile.color,
        error: r.reason?.message || String(r.reason)
      };
    }
    const entries = r.value;
    const latest = entries[0];
    const prev = entries[1];
    const sgv = latest.sgv;
    const ageMin = Math.round((Date.now() - latest.date) / 60000);
    const delta = prev ? sgv - prev.sgv : 0;
    const display = cfg.units === 'mmol/L' ? (sgv / 18).toFixed(1) : String(sgv);
    const deltaDisplay = cfg.units === 'mmol/L' ? (delta / 18).toFixed(1) : String(delta);
    const arrow = DIRECTION_ARROW[latest.direction] || '';
    const status = classify(sgv, ageMin, profile);
    return {
      profileId: profile.id,
      name: profile.name,
      color: profile.color,
      value: display,
      arrow,
      delta: (delta >= 0 ? '+' : '') + deltaDisplay,
      ageMin,
      status,
      sgvRaw: sgv
    };
  });

  // Append needs-URL placeholders so the user sees them in the floating widget
  needsUrlProfiles.forEach(p => {
    updates.push({
      profileId: p.id,
      name: p.name,
      color: p.color,
      needsUrl: true
    });
  });

  if (floatingWindow && !floatingWindow.isDestroyed()) {
    floatingWindow.webContents.send('glucose-update-all', {
      profiles: updates,
      units: cfg.units,
      fontSize: cfg.fontSize
    });
  }

  // Build the combined text once — used for macOS title and the tray tooltip.
  const trayParts = updates
    .filter(u => !u.error && !u.needsUrl)
    .map(u => {
      const prefix = profiles.length > 1 ? `${u.name} ` : '';
      return `${prefix}${u.value}${u.arrow ? ' ' + u.arrow : ''}`;
    });
  const combinedText = trayParts.join(' · ') || '--';

  // macOS: text next to the menu-bar icon
  if (process.platform === 'darwin') {
    updateTrayTitle(cfg.showInMenuBar ? combinedText : '');
  }

  // Tooltip works on all platforms — show every profile on hover.
  if (tray) {
    const tipLines = updates.map(u => {
      if (u.needsUrl) return `${u.name}: (尚未設定網址)`;
      if (u.error) return `${u.name}: ERR`;
      return `${u.name}: ${u.value}${u.arrow ? ' ' + u.arrow : ''}  ${u.delta} ${cfg.units}`;
    });
    try { tray.setToolTip(tipLines.join('\n') || i18n.t(cfg.language, 'app.name')); } catch (_) {}
  }

  // Windows: render the most-urgent profile's value INTO the tray icon, since
  // the Windows notification area can't show text beside an icon.
  if (process.platform === 'win32') {
    if (cfg.showTrayValue !== false) {
      const realUpdates = updates.filter(u => !u.error && !u.needsUrl);
      if (realUpdates.length > 0 && floatingWindow && !floatingWindow.isDestroyed()) {
        const pick = realUpdates.slice().sort(
          (a, b) => (STATUS_PRIORITY[b.status] || 0) - (STATUS_PRIORITY[a.status] || 0)
        )[0];
        floatingWindow.webContents.send('render-tray-icon', {
          value: pick.value,
          status: pick.status
        });
      }
    } else if (tray) {
      // showTrayValue turned off → restore the static blood-drop icon
      try { tray.setImage(makeTrayIcon()); } catch (_) {}
    }
  }

  // Process state transitions for alarms / notifications
  updates.forEach((u, i) => {
    if (u.error || u.needsUrl) return;
    handleStateTransition(profiles[i], i, u.status, u.ageMin, u.sgvRaw, cfg);
  });

  // Clean up state for profiles that no longer exist
  const validIds = new Set(profiles.map(p => p.id));
  for (const id of Array.from(previousStatusByProfile.keys())) {
    if (!validIds.has(id)) previousStatusByProfile.delete(id);
  }
}

function scheduleRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  const cfg = loadConfig();
  refreshTimer = setInterval(refreshAll, Math.max(15, cfg.refreshSec) * 1000);
  refreshAll();
}

function applyVisibility() {
  const cfg = loadConfig();
  // The floating window always exists — it is both the desktop widget AND
  // the rendering engine for the Windows tray icon. We only show/hide it.
  if (!floatingWindow || floatingWindow.isDestroyed()) {
    createFloatingWindow();
  }
  if (cfg.showFloating) {
    if (!floatingWindow.isVisible()) floatingWindow.show();
  } else {
    floatingWindow.hide();
  }

  if (process.platform === 'darwin' && app.dock) {
    if (cfg.hideDock) app.dock.hide();
    else app.dock.show();
  }

  if (!cfg.showInMenuBar && process.platform === 'darwin') updateTrayTitle('');
}

function createFloatingWindow() {
  const cfg = loadConfig();
  const display = screen.getPrimaryDisplay();
  const defaultX = display.workArea.x + display.workArea.width - 220;
  const defaultY = display.workArea.y + 20;

  floatingWindow = new BrowserWindow({
    width: 240,
    height: 110,
    x: cfg.windowX ?? defaultX,
    y: cfg.windowY ?? defaultY,
    show: cfg.showFloating,
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

let pendingTrendProfileId = null;

function openTrend(profileId) {
  if (profileId) pendingTrendProfileId = profileId;
  if (trendWindow && !trendWindow.isDestroyed()) {
    if (profileId) trendWindow.webContents.send('trend:set-profile', profileId);
    trendWindow.show();
    trendWindow.focus();
    return;
  }
  trendWindow = new BrowserWindow({
    width: 720,
    height: 420,
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
    width: 600,
    height: 720,
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
  } catch (e) { console.error('Tray icon load failed:', e); }
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
      tray = new Tray(makeTrayIcon());
    }
    const cfg = loadConfig();
    const lang = cfg.language;
    tray.setToolTip(i18n.t(lang, 'app.name'));

    // Submenu of profiles for trend window
    const profileTrendItems = cfg.profiles
      .filter(p => p.enabled && p.nsUrl)
      .map(p => ({ label: p.name, click: () => { openTrend(); /* trend window picks its own default */ } }));

    const menu = Menu.buildFromTemplate([
      { label: i18n.t(lang, 'tray.refresh'), click: refreshAll },
      { label: i18n.t(lang, 'tray.trend'), click: openTrend },
      { label: i18n.t(lang, 'tray.settings'), click: openSettings },
      { label: i18n.t(lang, 'tray.checkUpdate'), click: () => checkForUpdates(false) },
      { type: 'separator' },
      { label: `v${app.getVersion()}`, enabled: false },
      { type: 'separator' },
      { label: i18n.t(lang, 'tray.quit'), click: () => app.quit() }
    ]);
    tray.setContextMenu(menu);
    tray.on('click', () => openSettings());
  } catch (e) { console.error('Failed to build tray:', e); }
}

function broadcastLanguage() {
  const lang = loadConfig().language;
  const bundle = i18n.getBundle(lang);
  const payload = { lang, bundle };
  [floatingWindow, settingsWindow, trendWindow].forEach(w => {
    if (w && !w.isDestroyed()) w.webContents.send('language-changed', payload);
  });
  buildTray();
}

// ===== Auto-updater =====

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
  autoUpdater.checkForUpdates().catch(e => console.error('Update check failed:', e));
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
    if (result === 0) setImmediate(() => autoUpdater.quitAndInstall());
  });
}

// ===== IPC =====

ipcMain.handle('config:get', () => loadConfig());

ipcMain.handle('config:save', (_e, cfg) => {
  const prev = loadConfig();
  saveConfig(cfg);
  scheduleRefresh();
  applyVisibility();
  if (prev.language !== cfg.language) broadcastLanguage();
  return true;
});

ipcMain.handle('profile:test', async (_e, profile) => {
  try {
    const entries = await fetchGlucoseForProfile(profile);
    return { ok: true, sample: entries[0] };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle('profile:new', () => newProfile({ name: '' }));

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

ipcMain.on('open-settings', openSettings);
ipcMain.on('open-trend', (_e, profileId) => openTrend(profileId));
ipcMain.handle('trend:initialProfileId', () => {
  const id = pendingTrendProfileId;
  pendingTrendProfileId = null;
  return id;
});
ipcMain.on('quit-app', () => app.quit());

ipcMain.on('floating:report-size', (_e, size) => {
  if (!floatingWindow || floatingWindow.isDestroyed()) return;
  if (!size || !size.width || !size.height) return;
  const targetW = Math.max(140, Math.min(800, Math.ceil(size.width)));
  const targetH = Math.max(60, Math.min(800, Math.ceil(size.height)));
  const bounds = floatingWindow.getBounds();
  if (Math.abs(bounds.width - targetW) < 4 && Math.abs(bounds.height - targetH) < 4) return;
  const newX = bounds.x + (bounds.width - targetW);
  floatingWindow.setBounds({ x: newX, y: bounds.y, width: targetW, height: targetH }, false);
});

ipcMain.handle('fetch-trend', async (_e, profileId) => {
  const cfg = loadConfig();
  let profile = cfg.profiles.find(p => p.id === profileId);
  if (!profile) profile = cfg.profiles.find(p => p.enabled && p.nsUrl);
  if (!profile) throw new Error('No profile selected');

  const hours = Math.max(1, Math.min(24, cfg.trendHours || 4));
  const base = profile.nsUrl.replace(/\/+$/, '');
  const sinceMs = Date.now() - hours * 60 * 60 * 1000;
  let url = `${base}/api/v1/entries.json?count=300&find[date][$gte]=${sinceMs}`;
  if (profile.token) {
    const hash = crypto.createHash('sha1').update(profile.token).digest('hex');
    url += `&secret=${hash}&token=${encodeURIComponent(profile.token)}`;
  }
  const data = await fetchJson(url);
  return {
    profileId: profile.id,
    profileName: profile.name,
    entries: Array.isArray(data) ? data.filter(e => typeof e.sgv === 'number') : [],
    units: cfg.units,
    hours,
    thresholds: {
      urgentHigh: profile.urgentHigh,
      high: profile.high,
      low: profile.low,
      urgentLow: profile.urgentLow
    }
  };
});

ipcMain.handle('profiles:list', () => {
  const cfg = loadConfig();
  return cfg.profiles
    .filter(p => p.enabled && p.nsUrl)
    .map(p => ({ id: p.id, name: p.name }));
});

// Windows: the floating renderer drew the glucose number into a 32x32 canvas
// and sent back the PNG data URL — apply it as the tray icon.
ipcMain.on('tray:icon-ready', (_e, dataUrl) => {
  if (process.platform !== 'win32' || !tray || !dataUrl) return;
  try {
    const img = nativeImage.createFromDataURL(dataUrl);
    if (img && !img.isEmpty()) tray.setImage(img);
  } catch (e) {
    console.error('Failed to apply tray icon:', e);
  }
});

// ===== Lifecycle =====

app.whenReady().then(() => {
  buildTray();
  applyVisibility();
  setupAutoUpdater();
  const cfg = loadConfig();
  if (cfg.profiles.length === 0) openSettings();
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
  if (cfg.profiles.length === 0) openSettings();
});

app.on('window-all-closed', (e) => { e.preventDefault(); });

process.on('uncaughtException', (err) => {
  console.error('uncaughtException:', err);
});
