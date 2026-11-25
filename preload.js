// preload.js — Secure bridge between Electron host and House Designer web client
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  getVersion: () => ipcRenderer.invoke('get-version'),
  getVersionInfo: () => ipcRenderer.invoke('get-version-info'),
  applyUpdate: () => ipcRenderer.invoke('apply-update'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  onUpdateProgress: (callback) => {
    ipcRenderer.removeAllListeners('update-progress');
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('update-progress', handler);
    return () => ipcRenderer.removeListener('update-progress', handler);
  }
});
