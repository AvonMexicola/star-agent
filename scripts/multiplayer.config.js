import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.', testMatch: 'multiplayer.spec.js', timeout: 240000, workers: 1, reporter: 'list',
  outputDir: '/tmp/star-agent-hangar-physics-evidence/results',
  use: {
    baseURL: 'http://127.0.0.1:5301', viewport: { width: 1280, height: 720 },
    launchOptions: { executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', args: ['--no-sandbox', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=gl'] },
  },
  webServer: [
    { command: 'PUBLIC_ORIGIN=http://127.0.0.1:5301 STAR_AGENT_MEMORY=1 PORT=8086 npm run server', url: 'http://127.0.0.1:8086/api/health', reuseExistingServer: false, timeout: 30000 },
    { command: 'VITE_MULTIPLAYER_ENTRY=1 npm run build && MULTIPLAYER_SERVER=http://127.0.0.1:8086 npm run preview -- --host 127.0.0.1 --port 5301', url: 'http://127.0.0.1:5301', reuseExistingServer: false, timeout: 60000 },
  ],
});
