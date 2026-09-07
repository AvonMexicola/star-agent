import {defineConfig} from '@playwright/test';

const output = process.env.STRATUM_OUTPUT ?? '/home/cees/projects/.medium-ships-qa/stratum-controller';
export default defineConfig({
  testDir: '.', testMatch: 'stratum-gameplay.spec.js', timeout: 480000,
  workers: 1, retries: 0, reporter: 'list', outputDir: output + '/test-output',
  use: {
    baseURL: process.env.STRATUM_URL ?? 'http://127.0.0.1:5582',
    viewport: {width: 1440, height: 900}, deviceScaleFactor: 1,
    actionTimeout: 12000, navigationTimeout: 60000,
    video: {mode: 'on', size: {width: 1440, height: 900}},
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium',
      args: ['--no-sandbox', '--enable-gpu', '--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=gl', '--disable-dev-shm-usage'],
      // Root creates this short disk-backed directory before the queued run.
      env: {...process.env, TMPDIR: process.env.STRATUM_BROWSER_TMPDIR ?? '/home/cees/projects/.mdtmp'},
    },
  },
});
