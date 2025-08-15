import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { promises as fs } from 'fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import os from 'os'
import { fork, ChildProcess } from 'child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null
let serverProcess: ChildProcess
let serverPort: number | null = null

function startServer(dataPath: string): ChildProcess {
  const serverPath = path.resolve(__dirname, '../../server-backend/dist/server.js'); // Adjust if your output dir is different

  const child = fork(serverPath, [], {
    env: { ...process.env, APP_DATA_PATH: dataPath },
    stdio: 'pipe',
  });

  child.stdout?.on('data', (data) => console.log(`[Server Backend]: ${data.toString().trim()}`));
  child.stderr?.on('data', (data) => console.error(`[Server Backend ERROR]: ${data.toString().trim()}`));

  return child;
}

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC || RENDERER_DIST, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('set-server-port', serverPort); // Pass the dynamic port
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('will-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(async () => {
  const dataPath = path.join(app.getPath('userData'), 'raggedy'); 

  try {
    await fs.mkdir(dataPath, { recursive: true });
    console.log(`✅ Application data directory ensured at: ${dataPath}`);
  } catch (error) {
    dialog.showErrorBox(
      'Fatal Error',
      `Failed to create application data directory at ${dataPath}. Please check permissions and restart the app.`
    );
    app.quit();
    return;
  }

  // Register IPC handlers
  ipcMain.handle('dialog:openFile', async (event, options) => {
    // Mark event as used to satisfy noUnusedParameters while keeping the signature
    void event
    const result = await dialog.showOpenDialog(options)
    return result
  })

  // File system operations
  ipcMain.handle('fs:createDirectory', async (event, dirPath) => {
    void event
    try {
      await fs.mkdir(dirPath, { recursive: true })
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('fs:copyFile', async (event, sourcePath, destinationPath) => {
    void event
    try {
      await fs.copyFile(sourcePath, destinationPath)
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('fs:pathExists', async (event, path) => {
    void event
    try {
      await fs.access(path)
      return { exists: true }
    } catch {
      return { exists: false }
    }
  })

  ipcMain.handle('fs:getHomeDirectory', async (event) => {
    void event
    return os.homedir()
  })

  ipcMain.handle('fs:getAppDataPath', (event) => {
    void event;
    return dataPath;
  });

  serverProcess = startServer(dataPath);

  serverProcess.on('message', (message: { type: string; port?: number }) => {
    if (message.type === 'serverReady' && message.port) {
      console.log(`✅ Server is ready on port ${message.port}`);
      serverPort = message.port;

      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    }
  });

});
