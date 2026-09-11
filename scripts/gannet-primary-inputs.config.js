import {defineConfig} from '@playwright/test';

// Use a fresh output root for every attempt, preserving failed journeys/videos.
const output = process.env.GANNET_PRIMARY_OUTPUT ?? '/tmp/star-agent-gannet-primary-results/' + new Date().toISOString().replaceAll(':', '-');
process.env.GANNET_PRIMARY_OUTPUT = output;
export default defineConfig({
  testDir: '.', testMatch: 'gannet-primary-inputs.spec.js', timeout: 600000,
  workers: 1, retries: 0, reporter: 'list', outputDir: output + '/test-output',
  use: {
    baseURL: process.env.GANNET_URL ?? 'http://127.0.0.1:5582', deviceScaleFactor: 1,
    actionTimeout: 12000, navigationTimeout: 60000,
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium',
      args: ['--no-sandbox', '--enable-gpu', '--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=gl', '--disable-dev-shm-usage'],
      // Root prepares/owns this existing disk-backed browser scratch directory.
      env: {...process.env, TMPDIR: process.env.GANNET_BROWSER_TMPDIR ?? '/home/cees/projects/.mdtmp'},
    },
  },
  projects: [
    {name: 'keyboard', use: {viewport: {width: 1440, height: 900}, video: {mode: 'on', size: {width: 1440, height: 900}}}},
    {name: 'touch', use: {viewport: {width: 390, height: 844}, hasTouch: true, isMobile: true, video: {mode: 'on', size: {width: 390, height: 844}}}},
  ],
});
