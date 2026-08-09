import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  use: { baseURL: 'http://127.0.0.1:4174', trace: 'retain-on-failure' },
  projects: [{ name: 'pixel-9', use: { ...devices['Pixel 7'], viewport: { width: 412, height: 915 } } }],
  webServer: {
    command: 'npm run dev -- --config demo.local/vite.config.ts --host 127.0.0.1 --port 4174',
    port: 4174,
    reuseExistingServer: true,
  },
})
