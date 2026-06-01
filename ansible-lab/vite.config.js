import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true, // fail rather than collide with vyos-lab on 5173
    // Only answer requests addressed to localhost (defeats DNS-rebinding).
    // IP-literal hosts like 127.0.0.1 are always allowed by Vite.
    allowedHosts: ['localhost'],
    // VITE_USE_POLLING=true (set by docker-compose) enables polling so HMR works
    // over a Docker bind mount on any host OS.
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
