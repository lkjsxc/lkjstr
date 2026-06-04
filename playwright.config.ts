import { defineConfig, devices } from '@playwright/test';

const workerCount = Number.parseInt(process.env.PLAYWRIGHT_WORKERS ?? '1', 10);

export default defineConfig({
  testDir: './tests/e2e',
  workers: Number.isFinite(workerCount) && workerCount > 0 ? workerCount : 1,
  webServer: {
    command: 'pnpm build && pnpm preview --host 0.0.0.0 --port 5174',
    port: 5174,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://127.0.0.1:5174',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
