import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: '/web/',
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:8000',
      '/exports': 'http://localhost:8000',
    },
  },
  build: {
    outDir: '../web',
    emptyOutDir: true,
  },
})
