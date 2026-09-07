import { defineConfig } from '@playwright/test';

const live = process.env.NOMAD_URL;
const hardware = process.env.NOMAD_HARDWARE === '1';
const out = process.env.NOMAD_CONTROLLER_OUT ?? '/tmp/star-agent-nomad-controller';
const port = 5295;

export default defineConfig({
  testDir: '.', testMatch: 'nomad-controller.spec.js', timeout: 360000,
  expect: { timeout: 15000 }, workers: 1, retries: 0,
  reporter: [['list'], ['json', { outputFile: `${out}/runner.json` }]],
  outputDir: `${out}/playwright-results`,
  use: {
    baseURL: live ?? `http://127.0.0.1:${port}`, deviceScaleFactor: 1,
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium',
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle',
        ...(hardware ? ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=gl'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])],
    },
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'phone', grep: /parked controller journey/, use: { viewport: { width: 390, height: 844 }, hasTouch: true } },
  ],
  ...(!live && { webServer: { command: `npm run build && npm run preview -- --port ${port} --strictPort`, url: `http://127.0.0.1:${port}`, reuseExistingServer: false, timeout: 120000 } }),
});
