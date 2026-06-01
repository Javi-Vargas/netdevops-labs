import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Only answer requests addressed to localhost (defeats DNS-rebinding).
    // IP-literal hosts like 127.0.0.1 are always allowed by Vite.
    allowedHosts: ['localhost'],
    // In Docker, bind-mounted source may not deliver native FS events on some
    // host OSes; VITE_USE_POLLING=true (set by docker-compose) enables polling.
    watch: process.env.VITE_USE_POLLING ? { usePolling: true } : undefined,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{js,jsx}'],
  },
})
