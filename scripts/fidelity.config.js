import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: 'fidelity.spec.js', workers: 1, timeout: 240000,
  reporter: 'list', outputDir: '/tmp/star-agent-fidelity/results',
  use: {
    baseURL: 'http://127.0.0.1:5183', viewport: { width: 1440, height: 900 },
    launchOptions: { executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: [
      '--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage',
    ] },
  },
  webServer: { command: 'npm run build && npm run preview -- --port 5183 --strictPort', url: 'http://127.0.0.1:5183', reuseExistingServer: false },
});
