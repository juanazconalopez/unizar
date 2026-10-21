import { defineConfig, devices } from '@playwright/test'

// Exercises the real application (not the in-memory demo) against intercepted
// Supabase requests. No credentials or remote database are used.
export default defineConfig({
  testDir: './e2e',
  testMatch: 'navigation.performance.spec.ts',
  outputDir: '/tmp/unizar-navigation-e2e',
  use: { baseURL: 'http://127.0.0.1:4175', trace: 'retain-on-failure' },
  projects: [
    { name: 'navigation-desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'navigation-mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4175 --strictPort',
    port: 4175,
    env: { VITE_SUPABASE_URL: 'http://127.0.0.1:54321', VITE_SUPABASE_PUBLISHABLE_KEY: 'navigation-test-public-key' },
  },
})
