const { contextBridge } = require('electron')

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Add any IPC methods you need here
  // For example:
  // sendMessage: (message: string) => ipcRenderer.send('message', message),
  // onMessage: (callback: (message: string) => void) => ipcRenderer.on('message', callback)
})

// Preload script for contextBridge
