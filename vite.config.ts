import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
})

// vite.config.ts
build: {
  rollupOptions: {
    external: [
      '@tauri-apps/plugin-os',
      '@tauri-apps/plugin-fs',
      '@tauri-apps/api/path',
      '@tauri-apps/plugin-opener',
    ]
  }
}
