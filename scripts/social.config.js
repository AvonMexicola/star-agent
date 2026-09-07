import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
const cwd = fileURLToPath(new URL('..', import.meta.url));
export default defineConfig({
  testDir: '.', testMatch: 'social.spec.js', workers: 1, timeout: 240000, reporter: 'list',
  outputDir: '../test-results/social',
  use: {
    baseURL: 'http://127.0.0.1:5544', viewport: { width: 1440, height: 900 }, hasTouch: true,
    launchOptions: { executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', args: ['--no-sandbox', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=gl'] },
  },
  webServer: [
    { cwd, command: 'node scripts/social-browser-server.mjs', env: { NODE_ENV: 'test', PUBLIC_ORIGIN: 'http://127.0.0.1:5544',
      STAR_AGENT_MEMORY: '1', DATABASE_URL: '', PORT: '8094', SMTP_HOST: '', SMTP_FROM: '', SMTP_USER: '', SMTP_PASSWORD: '' },
      url: 'http://127.0.0.1:8094/api/health', reuseExistingServer: false, timeout: 30000 },
    { cwd, command: 'VITE_MULTIPLAYER_ENTRY=1 npm run build && MULTIPLAYER_SERVER=http://127.0.0.1:8094 npm run preview -- --host 127.0.0.1 --port 5544',
      url: 'http://127.0.0.1:5544', reuseExistingServer: false, timeout: 90000 },
  ],
});
