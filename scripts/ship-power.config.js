import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: 'ship-power.spec.js',
  timeout: 120_000,
  workers: 1,
  reporter: 'list',
  outputDir: '/tmp/star-agent-power-browser/results',
  use: {
    baseURL: 'http://127.0.0.1:5242',
    viewport: { width: 1440, height: 900 },
    hasTouch: true,
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
      args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'],
    },
  },
  webServer: {
    command: 'npm run build -- --outDir /tmp/star-agent-power-browser/build && npm run preview -- --outDir /tmp/star-agent-power-browser/build --port 5242 --strictPort',
    url: 'http://127.0.0.1:5242',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
