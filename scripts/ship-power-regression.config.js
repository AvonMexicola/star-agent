import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '..',
  testMatch: [
    'scripts/hangar-merge.spec.js',
    'tests/browser/flight.spec.js',
    'tests/browser/travel.spec.js',
  ],
  timeout: 240000,
  expect: { timeout: 60000 },
  workers: 1,
  reporter: 'list',
  outputDir: '/tmp/star-agent-ship-power-regression-results',
  use: {
    baseURL: 'http://127.0.0.1:5243',
    viewport: { width: 1440, height: 900 },
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
      args: [
        '--no-sandbox',
        '--use-gl=angle',
        '--use-angle=swiftshader',
        '--enable-unsafe-swiftshader',
        '--disable-dev-shm-usage',
      ],
    },
  },
  webServer: {
    command: 'npm run build -- --outDir /tmp/star-agent-ship-power-regression-build && npm run preview -- --outDir /tmp/star-agent-ship-power-regression-build --port 5243 --strictPort',
    url: 'http://127.0.0.1:5243',
    reuseExistingServer: false,
  },
});
