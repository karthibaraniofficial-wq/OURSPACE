/**
 * OURSPACE Desktop — Standalone Native Application Engine
 * Native Windows/macOS desktop host running embedded Chromium with native OS integration.
 */

const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  ipcMain,
  dialog,
  shell,
  Notification,
} = require('electron');
const path = require('path');
const fs = require('fs');

const PRODUCTION_URL = process.env.OURSPACE_URL || 'https://ourspace-app-two.vercel.app';
const APP_TITLE = 'OURSPACE — Two Hearts. One Private Digital World.';

let mainWindow = null;
let tray = null;
let isQuitting = false;

// Ensure single instance lock so multiple clicks focus existing sanctuary
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: APP_TITLE,
    backgroundColor: '#FAF8F5',
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      partition: 'persist:ourspace-session',
      webSecurity: true,
    },
    show: false,
  });

  // Custom User Agent identifying desktop app
  const defaultUA = mainWindow.webContents.getUserAgent();
  mainWindow.webContents.setUserAgent(`${defaultUA} OURSPACE-Desktop/2.3.0`);

  // Build native menu
  const menuTemplate = [
    {
      label: 'OURSPACE',
      submenu: [
        { label: 'About OURSPACE', click: () => showAboutDialog() },
        { type: 'separator' },
        { label: 'Preferences...', accelerator: 'CmdOrCtrl+,', click: () => mainWindow.loadURL(`${PRODUCTION_URL}/dashboard/settings`) },
        { type: 'separator' },
        { label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: () => { isQuitting = true; app.quit(); } },
      ],
    },
    {
      label: 'Sanctuary',
      submenu: [
        { label: 'Chat', accelerator: 'CmdOrCtrl+1', click: () => mainWindow.loadURL(`${PRODUCTION_URL}/dashboard/chat`) },
        { label: 'Memory Albums', accelerator: 'CmdOrCtrl+2', click: () => mainWindow.loadURL(`${PRODUCTION_URL}/dashboard/albums`) },
        { label: 'Our Locker (Vault)', accelerator: 'CmdOrCtrl+3', click: () => mainWindow.loadURL(`${PRODUCTION_URL}/dashboard/locker`) },
        { label: 'Calls', accelerator: 'CmdOrCtrl+4', click: () => mainWindow.loadURL(`${PRODUCTION_URL}/dashboard/calls`) },
        { label: 'Plans & Bucket List', accelerator: 'CmdOrCtrl+5', click: () => mainWindow.loadURL(`${PRODUCTION_URL}/dashboard/plans`) },
        { type: 'separator' },
        { label: 'Reload Sanctuary', accelerator: 'CmdOrCtrl+R', click: () => mainWindow.reload() },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { role: 'close' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(menuTemplate));

  // Load production application
  mainWindow.loadURL(PRODUCTION_URL);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Intercept navigation to prevent opening external browser for internal routes
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(PRODUCTION_URL) || url.startsWith('http://localhost')) {
      return { action: 'allow' };
    }
    // Only open truly external documentation in system browser
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Offline failure handling
  mainWindow.webContents.on('did-fail-load', (_event, errorCode) => {
    if (errorCode === -105 || errorCode === -106 || errorCode === -102) {
      mainWindow.loadFile(path.join(__dirname, 'offline.html'));
    }
  });

  // Tray minimization support
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
    return false;
  });
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'icon.ico');
  if (!fs.existsSync(iconPath)) return;

  tray = new Tray(iconPath);
  tray.setToolTip('OURSPACE — Private Couple Sanctuary');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open Sanctuary',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    {
      label: 'Direct to Chat',
      click: () => {
        if (mainWindow) {
          mainWindow.loadURL(`${PRODUCTION_URL}/dashboard/chat`);
          mainWindow.show();
          mainWindow.focus();
        }
      },
    },
    { type: 'separator' },
    {
      label: 'Quit OURSPACE',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function showAboutDialog() {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'About OURSPACE',
    message: 'OURSPACE — Desktop Sanctuary v2.3.0',
    detail: 'Two Hearts. One Private Digital World.\nPrivate Couple Communication, Memory Albums & E2EE Locker.\nPowered by Google Firebase & LiveKit SFU.\n© 2026 OURSPACE.',
    buttons: ['OK'],
  });
}

// IPC Handlers
ipcMain.on('app:notification', (_event, { title, body }) => {
  if (Notification.isSupported()) {
    new Notification({
      title: title || 'OURSPACE',
      body: body || 'New update from your partner',
      icon: path.join(__dirname, 'assets', 'icon.ico'),
    }).show();
  }
});

ipcMain.handle('dialog:save', async (_event, options) => {
  const result = await dialog.showSaveDialog(mainWindow, options);
  return result;
});

ipcMain.handle('dialog:open', async (_event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, options);
  return result;
});

ipcMain.on('window:minimize', () => mainWindow?.minimize());
ipcMain.on('window:maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on('window:close', () => mainWindow?.close());

app.whenReady().then(() => {
  createMainWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
