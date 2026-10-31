/**
 * OURSPACE Desktop — Preload IPC Bridge
 * Exposes safe, isolated native capabilities to the renderer window.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isDesktop: true,
  platform: process.platform,
  version: '2.3.0',

  // Native Notifications
  showNotification: (title, body, options = {}) => {
    ipcRenderer.send('app:notification', { title, body, ...options });
  },

  // Native Dialogs
  showSaveDialog: (options) => ipcRenderer.invoke('dialog:save', options),
  showOpenDialog: (options) => ipcRenderer.invoke('dialog:open', options),

  // Badge / Unread count
  setBadgeCount: (count) => {
    ipcRenderer.send('app:set-badge', count);
  },

  // App Controls
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  maximizeWindow: () => ipcRenderer.send('window:maximize'),
  closeWindow: () => ipcRenderer.send('window:close'),

  // Listeners
  onIncomingCall: (callback) => {
    ipcRenderer.on('call:incoming', (_event, data) => callback(data));
  },
  onNetworkChange: (callback) => {
    ipcRenderer.on('network:change', (_event, status) => callback(status));
  },
});
