import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.', testMatch: 'atlas-ground-ramps.spec.js', workers: 1, retries: 0, maxFailures: 1,
  timeout: 360000, expect: { timeout: 15000 }, reporter: 'list',
  outputDir: '/tmp/star-agent-atlas-ground-ramps/results',
  use: { baseURL: 'http://127.0.0.1:5597', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1,
    actionTimeout: 15000, screenshot: 'only-on-failure',
    video: { mode: 'on', size: { width: 1440, height: 900 } },
    launchOptions: { executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
      args: ['--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist', '--no-sandbox', '--disable-dev-shm-usage'] } },
  // The explicit meadow scene is a development-only entry point.
  webServer: { command: 'VITE_DEV_TOOLS=1 node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5597 --strictPort',
    url: 'http://127.0.0.1:5597', reuseExistingServer: false, timeout: 30000 },
});
