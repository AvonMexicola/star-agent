import { defineConfig } from '@playwright/test';

const hardware = process.env.ATLAS_HARDWARE === '1';
const launchArgs = hardware
  ? ['--no-sandbox', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=gl']
  : ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'];

export default defineConfig({
  testDir: '.',
  testMatch: 'atlas-mark-ii.spec.js',
  timeout: 300000,
  expect: { timeout: 30000 },
  workers: 1,
  reporter: 'list',
  outputDir: '/tmp/star-agent-atlas-mark-ii-results',
  use: {
    baseURL: 'http://127.0.0.1:5251',
    actionTimeout: 15000,
    viewport: { width: 1440, height: 900 },
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
      args: launchArgs,
    },
  },
  webServer: {
    command: 'npm run build -- --outDir /tmp/star-agent-atlas-mark-ii-build && npm run preview -- --outDir /tmp/star-agent-atlas-mark-ii-build --port 5251 --strictPort',
    url: 'http://127.0.0.1:5251/dev/atlas-mark-ii.html',
    reuseExistingServer: false,
  },
});
