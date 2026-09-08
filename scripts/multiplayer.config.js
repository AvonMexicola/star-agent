import { defineConfig } from '@playwright/test';

// Explicit disposable SQL test database only; never inherit the application DATABASE_URL.
const testDatabase = process.env.MULTIPLAYER_TEST_DATABASE_URL;

export default defineConfig({
  testDir: '.', testMatch: 'multiplayer.spec.js', timeout: 240000, workers: 1, reporter: 'list',
  outputDir: '/tmp/star-agent-hangar-physics-evidence/results',
  use: {
    baseURL: 'http://127.0.0.1:5301', viewport: { width: 1280, height: 720 },
    launchOptions: { executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', args: ['--no-sandbox', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=gl'] },
  },
  webServer: [
    { command: 'npm run server', env: { NODE_ENV: 'test', PUBLIC_ORIGIN: 'http://127.0.0.1:5301',
      STAR_AGENT_MEMORY: testDatabase ? '0' : '1', DATABASE_URL: testDatabase ?? '', PORT: '8086',
      SMTP_HOST: '', SMTP_FROM: '', SMTP_USER: '', SMTP_PASSWORD: '' },
      url: 'http://127.0.0.1:8086/api/health', reuseExistingServer: false, timeout: 30000 },
    { command: 'VITE_MULTIPLAYER_ENTRY=1 npm run build && MULTIPLAYER_SERVER=http://127.0.0.1:8086 npm run preview -- --host 127.0.0.1 --port 5301', url: 'http://127.0.0.1:5301', reuseExistingServer: false, timeout: 60000 },
  ],
});
