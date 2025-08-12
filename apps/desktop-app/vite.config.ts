import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'

// https://vite.dev/config/
export default defineConfig({
  define: {
    global: 'globalThis',
  },
  plugins: [
    react(),
    electron([
      {
        entry: 'src/main.ts',
        onstart(options) {
          options.startup()
        },
        vite: {
          build: {
            sourcemap: true,
            minify: false,
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron']
            }
          },
          plugins: [{
            name: 'vite-plugin-electron-renderer-url',
            config(config) {
              const server = config.server
              if (server) {
                process.env.VITE_DEV_SERVER_URL = `http://localhost:${server.port}`
              }
            }
          }]
        }
      },
      {
        entry: 'src/preload.ts',
        onstart(options) {
          options.reload()
        },
        vite: {
          build: {
            lib: {
              entry: 'src/preload.ts',
              formats: ['cjs'],
              fileName: () => 'preload.cjs'
            },
            sourcemap: true,
            minify: false,
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron']
            }
          }
        }
      }
    ])
  ],
  build: {
    rollupOptions: {
      external: ['electron', 'crypto']
    }
  }
})
