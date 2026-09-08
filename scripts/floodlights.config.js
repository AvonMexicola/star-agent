import {defineConfig} from '@playwright/test';
process.env.TMPDIR = '/tmp';
export default defineConfig({
  testDir: '.', testMatch: 'floodlights.spec.js', timeout: 240000, workers: 1, retries: 0, maxFailures: 1,
  reporter: 'list', outputDir: process.env.FLOODLIGHT_EVIDENCE || '/tmp/star-agent-floodlights-01',
  use: {baseURL: 'http://127.0.0.1:5654', viewport: {width: 1440, height: 900}, hasTouch: true,
    actionTimeout: 12000, video: 'retain-on-failure',
    launchOptions: {executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
      args: ['--no-sandbox', '--enable-gpu', '--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=gl', '--disable-dev-shm-usage']}},
  webServer: [
    {cwd: new URL('..', import.meta.url).pathname, command: 'STAR_AGENT_MEMORY=1 PORT=8654 PUBLIC_ORIGIN=http://127.0.0.1:5654 node server/index.js', url: 'http://127.0.0.1:8654/api/health', reuseExistingServer: false},
    {command: 'MULTIPLAYER_SERVER=http://127.0.0.1:8654 npm run preview -- --port 5654 --strictPort', url: 'http://127.0.0.1:5654', reuseExistingServer: false},
  ],
});
