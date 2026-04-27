import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@styles': path.resolve(__dirname, '../public/css'),
      '@assets': path.resolve(__dirname, '../public'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
      '/socket.io': { target: 'http://localhost:3000', ws: true, changeOrigin: true },
      '/images': { target: 'http://localhost:3000', changeOrigin: true },
      '/heroes': { target: 'http://localhost:3000', changeOrigin: true },
      '/css': { target: 'http://localhost:3000', changeOrigin: true },
      '/js': { target: 'http://localhost:3000', changeOrigin: true },
      '/mobile.css': { target: 'http://localhost:3000', changeOrigin: true },
      '/mobile.js': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  build: {
    outDir: '../public/dist',
    emptyOutDir: true,
  },
})
