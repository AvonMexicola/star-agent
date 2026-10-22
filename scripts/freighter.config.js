import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: ['freighter.spec.js', 'ship.spec.js'], timeout: 240000, workers: 1,
  reporter: 'list', outputDir: '/tmp/star-agent-freighter-tests',
  use: { baseURL: 'http://127.0.0.1:5214', viewport: { width: 1440, height: 900 },
    launchOptions: { executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] } },
  webServer: { command: 'npm run build -- --outDir /tmp/star-agent-freighter-build && npm run preview -- --outDir /tmp/star-agent-freighter-build --port 5214 --strictPort', url: 'http://127.0.0.1:5214', reuseExistingServer: false },
});
