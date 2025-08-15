import { ipcRenderer, contextBridge } from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },

})

contextBridge.exposeInMainWorld('electronAPI', {
  // File dialog operations
  openFileDialog: (options: any) => ipcRenderer.invoke('dialog:openFile', options),
  
  // File system operations
  createDirectory: (dirPath: string) => ipcRenderer.invoke('fs:createDirectory', dirPath),
  copyFile: (sourcePath: string, destinationPath: string) => ipcRenderer.invoke('fs:copyFile', sourcePath, destinationPath),
  pathExists: (path: string) => ipcRenderer.invoke('fs:pathExists', path),
  getHomeDirectory: () => ipcRenderer.invoke('fs:getHomeDirectory'),
  
  // Server port listener
  onSetServerPort: (callback: (port: number) => void) => {
    ipcRenderer.on('set-server-port', (_, port) => {
      console.log('Received server port from main process:', port)
      
      // Automatically initialize the API with the correct port
      if ((window as any).initializeApi) {
        (window as any).initializeApi(port)
        console.log('API initialized with port:', port)
      } else {
        console.warn('initializeApi not available on window object')
      }
      
      // Also call the callback for any other components that need the port
      callback(port)
    })
  },
})