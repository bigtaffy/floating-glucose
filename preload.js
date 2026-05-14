const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // config
  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: (cfg) => ipcRenderer.invoke('config:save', cfg),

  // profiles
  testProfile: (profile) => ipcRenderer.invoke('profile:test', profile),
  newProfile: () => ipcRenderer.invoke('profile:new'),
  listProfiles: () => ipcRenderer.invoke('profiles:list'),

  // windows
  openSettings: () => ipcRenderer.send('open-settings'),
  openTrend: (profileId) => ipcRenderer.send('open-trend', profileId || null),
  quit: () => ipcRenderer.send('quit-app'),

  // trend window initial selection
  getInitialTrendProfileId: () => ipcRenderer.invoke('trend:initialProfileId'),
  onTrendSetProfile: (cb) => ipcRenderer.on('trend:set-profile', (_e, id) => cb(id)),

  // glucose events (multi-profile)
  onGlucoseUpdateAll: (cb) => ipcRenderer.on('glucose-update-all', (_e, data) => cb(data)),
  onPlayAlarm: (cb) => ipcRenderer.on('play-alarm', (_e, data) => cb(data)),

  // i18n
  getI18n: () => ipcRenderer.invoke('i18n:get'),
  setLanguage: (lang) => ipcRenderer.invoke('i18n:setLanguage', lang),
  onLanguageChanged: (cb) => ipcRenderer.on('language-changed', (_e, data) => cb(data)),

  // window sizing
  reportContentSize: (size) => ipcRenderer.send('floating:report-size', size),

  // trend
  fetchTrend: (profileId) => ipcRenderer.invoke('fetch-trend', profileId)
});
