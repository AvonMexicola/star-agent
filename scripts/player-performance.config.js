import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: ['player-performance.spec.js', 'multiplayer-ui-performance.spec.js'], workers: 1, maxFailures: 1, timeout: 180000,
  reporter: 'list', outputDir: '/tmp/star-agent-player-performance/results',
  use: { baseURL: 'http://127.0.0.1:5592', viewport: { width: 1440, height: 900 },
    launchOptions: { executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
      args: ['--no-sandbox', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=gl'] } },
  webServer: { command: 'node scripts/prepare-player-performance-baseline.mjs && npm run dev -- --port 5592 --strictPort', url: 'http://127.0.0.1:5592', reuseExistingServer: false },
});
