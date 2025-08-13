/// <reference types="vite/client" />

interface ElectronAPI {
  openFileDialog: (options: any) => Promise<{ canceled: boolean; filePaths: string[] }>;
  createDirectory: (dirPath: string) => Promise<{ success: boolean; error?: string }>;
  copyFile: (sourcePath: string, destinationPath: string) => Promise<{ success: boolean; error?: string }>;
  pathExists: (path: string) => Promise<{ exists: boolean }>;
  getHomeDirectory: () => Promise<string>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}