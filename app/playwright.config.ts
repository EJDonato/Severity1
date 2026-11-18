import { defineConfig } from '@playwright/test'

// Uses the machine's installed Chrome (no browser download). Run: npm run e2e
export default defineConfig({
  testDir: 'e2e',
  timeout: 120_000,
  webServer: { command: 'npm run build && npx vite preview --port 4174 --strictPort', url: 'http://localhost:4174', reuseExistingServer: true, timeout: 120_000 },
  use: { baseURL: 'http://localhost:4174', channel: 'chrome', viewport: { width: 1440, height: 900 } },
})
