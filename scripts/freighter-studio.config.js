import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: 'freighter-studio.spec.js', timeout: 90000, workers: 1,
  reporter: 'list', outputDir: '/tmp/star-agent-freighter-studio-tests',
  use: { baseURL: 'http://127.0.0.1:5193', viewport: { width: 1600, height: 1000 },
    launchOptions: { executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] } },
  webServer: { command: 'npm run dev -- --port 5193 --strictPort', url: 'http://127.0.0.1:5193', reuseExistingServer: false },
});
