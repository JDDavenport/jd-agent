/**
 * Preload script - Exposes safe IPC to renderer
 */

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  // Auth
  login: (email: string, password: string) => ipcRenderer.invoke('login', { email, password }),
  logout: () => ipcRenderer.invoke('logout'),
  
  // Status
  getStatus: () => ipcRenderer.invoke('get-status'),
  
  // Canvas
  setCanvasToken: (token: string, url?: string) => ipcRenderer.invoke('set-canvas-token', { token, url }),
  
  // Plaud
  selectPlaudFolder: () => ipcRenderer.invoke('select-plaud-folder'),
  
  // Remarkable
  setRemarkableToken: (token: string) => ipcRenderer.invoke('set-remarkable-token', { token }),
  
  // Sync
  triggerSync: () => ipcRenderer.invoke('trigger-sync'),
  
  // External links
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  
  // Event listeners
  onSyncStatus: (callback: (status: any) => void) => {
    ipcRenderer.on('sync-status', (_, status) => callback(status));
    return () => ipcRenderer.removeAllListeners('sync-status');
  },
  onLastSync: (callback: (lastSync: any) => void) => {
    ipcRenderer.on('last-sync', (_, lastSync) => callback(lastSync));
    return () => ipcRenderer.removeAllListeners('last-sync');
  },
});
