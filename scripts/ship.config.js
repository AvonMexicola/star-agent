import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: 'ship.spec.js', timeout: 240000, workers: 1,
  reporter: 'list', outputDir: '/tmp/star-agent-ship-tests',
  use: { baseURL: 'http://127.0.0.1:5186', viewport: { width: 1440, height: 900 },
    launchOptions: { executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] } },
  // Parallel feature sessions must not overwrite the production build under test.
  webServer: { command: 'npm run build -- --outDir /tmp/star-agent-ship-build && npm run preview -- --outDir /tmp/star-agent-ship-build --port 5186 --strictPort', url: 'http://127.0.0.1:5186', reuseExistingServer: false },
});
