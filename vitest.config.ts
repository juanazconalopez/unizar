import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  // Las pruebas deben poder ejecutarse sin la configuración del proyecto real.
  envDir: false,
  plugins: [react()],
  resolve: {
    alias: {
      'virtual:pwa-register/react': fileURLToPath(new URL('./node_modules/vite-plugin-pwa/dist/client/build/react.js', import.meta.url)),
    },
  },
  test: {
    env: {
      VITE_SUPABASE_URL: 'https://supabase.test',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'test-publishable-key',
    },
    exclude: ['e2e/**', 'node_modules/**'],
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
  },
})
