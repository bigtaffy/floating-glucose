const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getConfig: () => ipcRenderer.invoke('config:get'),
  saveConfig: (cfg) => ipcRenderer.invoke('config:save', cfg),
  testConfig: (cfg) => ipcRenderer.invoke('config:test', cfg),
  openSettings: () => ipcRenderer.send('open-settings'),
  quit: () => ipcRenderer.send('quit-app'),
  onGlucoseUpdate: (cb) => ipcRenderer.on('glucose-update', (_e, data) => cb(data)),
  onGlucoseError: (cb) => ipcRenderer.on('glucose-error', (_e, data) => cb(data)),
  getI18n: () => ipcRenderer.invoke('i18n:get'),
  setLanguage: (lang) => ipcRenderer.invoke('i18n:setLanguage', lang),
  onLanguageChanged: (cb) => ipcRenderer.on('language-changed', (_e, data) => cb(data))
});
