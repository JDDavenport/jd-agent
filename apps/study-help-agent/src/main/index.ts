/**
 * Study Help Agent - Main Electron Process
 * 
 * Menu bar app that syncs:
 * - Canvas (via user's API token)
 * - Plaud recordings (file watcher)
 * - Remarkable notes (cloud sync)
 */

import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell, dialog } from 'electron';
import { menubar } from 'menubar';
import * as path from 'path';
import * as fs from 'fs';
import Store from 'electron-store';
import { CanvasSyncer } from './sync/canvas';
import { PlaudWatcher } from './sync/plaud';
import { RemarkableSync } from './sync/remarkable';

// Store for persistent data
interface StoreSchema {
  sessionToken: string | null;
  user: {
    id: string;
    email: string;
    name: string | null;
  } | null;
  canvasToken: string | null;
  canvasUrl: string;
  plaudPath: string | null;
  remarkableToken: string | null;
  lastSync: {
    canvas: string | null;
    plaud: string | null;
    remarkable: string | null;
  };
}

const store = new Store<StoreSchema>({
  defaults: {
    sessionToken: null,
    user: null,
    canvasToken: null,
    canvasUrl: 'https://byu.instructure.com',
    plaudPath: null,
    remarkableToken: null,
    lastSync: {
      canvas: null,
      plaud: null,
      remarkable: null,
    },
  },
});

// API base URL
const API_BASE = process.env.API_URL || 'https://study-help-api-production.up.railway.app';

// Sync services
let canvasSyncer: CanvasSyncer | null = null;
let plaudWatcher: PlaudWatcher | null = null;
let remarkableSync: RemarkableSync | null = null;

// Main window
let mb: ReturnType<typeof menubar>;
let mainWindow: BrowserWindow | null = null;

// Sync status
interface SyncStatus {
  canvas: 'idle' | 'syncing' | 'error' | 'connected';
  plaud: 'idle' | 'watching' | 'error' | 'syncing';
  remarkable: 'idle' | 'syncing' | 'error' | 'connected';
  lastError: string | null;
}

let syncStatus: SyncStatus = {
  canvas: 'idle',
  plaud: 'idle',
  remarkable: 'idle',
  lastError: null,
};

// Create tray icon
function createTrayIcon(status: 'idle' | 'syncing' | 'connected' | 'error'): Electron.NativeImage {
  // Simple colored dot icons
  const colors = {
    idle: '#9CA3AF',     // Gray
    syncing: '#3B82F6',  // Blue
    connected: '#22C55E', // Green
    error: '#EF4444',    // Red
  };
  
  // Create a 16x16 template image
  const size = 16;
  const canvas = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="6" fill="${colors[status]}"/>
    </svg>
  `;
  
  return nativeImage.createFromBuffer(
    Buffer.from(canvas),
    { scaleFactor: 2 }
  );
}

// Initialize menubar
function createMenubar() {
  const iconPath = path.join(__dirname, '../../assets/tray-icon.png');
  
  mb = menubar({
    index: process.env.NODE_ENV === 'development'
      ? 'http://localhost:5173'
      : `file://${path.join(__dirname, '../renderer/index.html')}`,
    icon: fs.existsSync(iconPath) ? iconPath : createTrayIcon('idle'),
    browserWindow: {
      width: 360,
      height: 500,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
      },
    },
    preloadWindow: true,
    showOnAllWorkspaces: true,
    showDockIcon: false,
  });

  mb.on('ready', () => {
    console.log('Study Help Agent ready');
    
    // Set up context menu
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Open Study Aide', click: () => shell.openExternal('https://www.studyaide.app') },
      { type: 'separator' },
      { label: 'Sync Now', click: () => triggerSync() },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() },
    ]);
    
    mb.tray?.on('right-click', () => {
      mb.tray?.popUpContextMenu(contextMenu);
    });
    
    // Auto-start sync if configured
    initializeSyncServices();
  });
  
  mb.on('after-create-window', () => {
    mainWindow = mb.window!;
    
    // Open DevTools in development
    if (process.env.NODE_ENV === 'development') {
      mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
  });
}

// Initialize sync services based on stored config
async function initializeSyncServices() {
  const sessionToken = store.get('sessionToken');
  const canvasToken = store.get('canvasToken');
  const plaudPath = store.get('plaudPath');
  const remarkableToken = store.get('remarkableToken');
  
  // Canvas
  if (sessionToken && canvasToken) {
    canvasSyncer = new CanvasSyncer(API_BASE, sessionToken, canvasToken, store.get('canvasUrl'));
    syncStatus.canvas = 'connected';
  }
  
  // Plaud
  if (sessionToken && plaudPath && fs.existsSync(plaudPath)) {
    plaudWatcher = new PlaudWatcher(API_BASE, sessionToken, plaudPath);
    plaudWatcher.start();
    syncStatus.plaud = 'watching';
  }
  
  // Remarkable
  if (sessionToken && remarkableToken) {
    remarkableSync = new RemarkableSync(API_BASE, sessionToken, remarkableToken);
    syncStatus.remarkable = 'connected';
  }
  
  updateTrayIcon();
  notifyRenderer();
}

// Trigger manual sync
async function triggerSync() {
  if (canvasSyncer) {
    syncStatus.canvas = 'syncing';
    updateTrayIcon();
    notifyRenderer();
    
    try {
      await canvasSyncer.sync();
      syncStatus.canvas = 'connected';
      store.set('lastSync.canvas', new Date().toISOString());
    } catch (error) {
      syncStatus.canvas = 'error';
      syncStatus.lastError = error instanceof Error ? error.message : 'Canvas sync failed';
    }
  }
  
  if (remarkableSync) {
    syncStatus.remarkable = 'syncing';
    updateTrayIcon();
    notifyRenderer();
    
    try {
      await remarkableSync.sync();
      syncStatus.remarkable = 'connected';
      store.set('lastSync.remarkable', new Date().toISOString());
    } catch (error) {
      syncStatus.remarkable = 'error';
      syncStatus.lastError = error instanceof Error ? error.message : 'Remarkable sync failed';
    }
  }
  
  updateTrayIcon();
  notifyRenderer();
}

// Update tray icon based on status
function updateTrayIcon() {
  let status: 'idle' | 'syncing' | 'connected' | 'error' = 'idle';
  
  if (syncStatus.canvas === 'error' || syncStatus.plaud === 'error' || syncStatus.remarkable === 'error') {
    status = 'error';
  } else if (syncStatus.canvas === 'syncing' || syncStatus.plaud === 'syncing' || syncStatus.remarkable === 'syncing') {
    status = 'syncing';
  } else if (syncStatus.canvas === 'connected' || syncStatus.plaud === 'watching' || syncStatus.remarkable === 'connected') {
    status = 'connected';
  }
  
  // Note: In production, use actual icon files
  // mb.tray?.setImage(createTrayIcon(status));
}

// Notify renderer of status changes
function notifyRenderer() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('sync-status', syncStatus);
    mainWindow.webContents.send('last-sync', store.get('lastSync'));
  }
}

// IPC Handlers
ipcMain.handle('get-status', () => ({
  syncStatus,
  lastSync: store.get('lastSync'),
  user: store.get('user'),
  config: {
    hasCanvasToken: !!store.get('canvasToken'),
    hasPlaudPath: !!store.get('plaudPath'),
    hasRemarkableToken: !!store.get('remarkableToken'),
    plaudPath: store.get('plaudPath'),
    canvasUrl: store.get('canvasUrl'),
  },
}));

ipcMain.handle('login', async (_, { email, password }) => {
  try {
    const response = await fetch(`${API_BASE}/api/study-help/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    
    const json = await response.json();
    
    if (!json.success) {
      throw new Error(json.error?.message || 'Login failed');
    }
    
    // Get session token from Set-Cookie header
    const cookies = response.headers.get('set-cookie');
    const sessionMatch = cookies?.match(/study_help_session=([^;]+)/);
    const sessionToken = sessionMatch?.[1];
    
    if (!sessionToken) {
      throw new Error('No session token received');
    }
    
    store.set('sessionToken', sessionToken);
    store.set('user', json.data.user);
    
    return { success: true, user: json.data.user };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Login failed' };
  }
});

ipcMain.handle('logout', () => {
  store.set('sessionToken', null);
  store.set('user', null);
  store.set('canvasToken', null);
  store.set('plaudPath', null);
  store.set('remarkableToken', null);
  
  // Stop sync services
  plaudWatcher?.stop();
  plaudWatcher = null;
  canvasSyncer = null;
  remarkableSync = null;
  
  syncStatus = { canvas: 'idle', plaud: 'idle', remarkable: 'idle', lastError: null };
  updateTrayIcon();
  
  return { success: true };
});

ipcMain.handle('set-canvas-token', async (_, { token, url }) => {
  const sessionToken = store.get('sessionToken');
  if (!sessionToken) {
    return { success: false, error: 'Not logged in' };
  }
  
  try {
    // Verify token with backend
    const response = await fetch(`${API_BASE}/api/canvas/connect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `study_help_session=${sessionToken}`,
      },
      body: JSON.stringify({ canvasToken: token, canvasUrl: url }),
    });
    
    const json = await response.json();
    
    if (!json.success) {
      throw new Error(json.error?.message || 'Failed to connect Canvas');
    }
    
    store.set('canvasToken', token);
    store.set('canvasUrl', url || 'https://byu.instructure.com');
    
    // Initialize syncer
    canvasSyncer = new CanvasSyncer(API_BASE, sessionToken, token, url);
    syncStatus.canvas = 'connected';
    updateTrayIcon();
    notifyRenderer();
    
    return { success: true, coursesFound: json.data.coursesFound };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to connect Canvas' };
  }
});

ipcMain.handle('select-plaud-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
    title: 'Select PlaudSync Folder',
    message: 'Select the folder where Plaud stores your recordings',
    defaultPath: path.join(app.getPath('home'), 'Documents', 'PlaudSync'),
  });
  
  if (result.canceled || !result.filePaths[0]) {
    return { success: false, cancelled: true };
  }
  
  const selectedPath = result.filePaths[0];
  
  // Verify it looks like a Plaud folder
  const files = fs.readdirSync(selectedPath);
  const hasRecordings = files.some(f => f.match(/^\d{4}-\d{2}-\d{2}/));
  
  if (!hasRecordings && files.length > 0) {
    return { 
      success: false, 
      error: 'This doesn\'t look like a PlaudSync folder. Expected folders like "2026-01-30_..."' 
    };
  }
  
  const sessionToken = store.get('sessionToken');
  if (!sessionToken) {
    return { success: false, error: 'Not logged in' };
  }
  
  store.set('plaudPath', selectedPath);
  
  // Start watcher
  plaudWatcher?.stop();
  plaudWatcher = new PlaudWatcher(API_BASE, sessionToken, selectedPath);
  plaudWatcher.start();
  syncStatus.plaud = 'watching';
  updateTrayIcon();
  notifyRenderer();
  
  return { success: true, path: selectedPath };
});

ipcMain.handle('set-remarkable-token', async (_, { token }) => {
  const sessionToken = store.get('sessionToken');
  if (!sessionToken) {
    return { success: false, error: 'Not logged in' };
  }
  
  try {
    // Verify token with backend
    const response = await fetch(`${API_BASE}/api/sync/remarkable/connect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `study_help_session=${sessionToken}`,
      },
      body: JSON.stringify({ deviceToken: token }),
    });
    
    const json = await response.json();
    
    if (!json.success) {
      throw new Error(json.error?.message || 'Failed to connect Remarkable');
    }
    
    store.set('remarkableToken', token);
    
    // Initialize syncer
    remarkableSync = new RemarkableSync(API_BASE, sessionToken, token);
    syncStatus.remarkable = 'connected';
    updateTrayIcon();
    notifyRenderer();
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to connect Remarkable' };
  }
});

ipcMain.handle('trigger-sync', async () => {
  await triggerSync();
  return { success: true };
});

ipcMain.handle('open-external', (_, url) => {
  shell.openExternal(url);
});

// App lifecycle
app.on('ready', () => {
  createMenubar();
});

app.on('window-all-closed', () => {
  // Keep running in menu bar
});

app.on('before-quit', () => {
  plaudWatcher?.stop();
});
