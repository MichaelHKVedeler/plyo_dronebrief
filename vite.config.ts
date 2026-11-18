import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'
// @ts-expect-error The package ships types for its browser entry only.
import { plyoLoadingScreen } from '@plyo/accounts-client/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), plyoLoadingScreen()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'], css: false, maxWorkers: 4, include: ['src/**/*.test.{ts,tsx}', 'functions/src/**/*.test.ts'] },
})
