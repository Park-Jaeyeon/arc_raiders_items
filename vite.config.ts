import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/arc_raiders_items/',
  plugins: [
    react(),
  ],
  define: {
    'process.env': {},
  },
  optimizeDeps: {
    exclude: ['@xenova/transformers'],
  },
  worker: {
    format: 'es',
  },
  server: {
    headers: {
      'Cache-Control': 'no-store',
    },
  },
})