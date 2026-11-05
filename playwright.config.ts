import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'NODE_ENV=production PORT=3000 HOST=127.0.0.1 DATABASE_PATH=:memory: DISCONNECT_GRACE_MS=300 npx --yes pnpm@11.9.0 --filter @yeopjan/server start',
    url: 'http://127.0.0.1:3000/health',
    reuseExistingServer: false,
    timeout: 30_000
  }
});
