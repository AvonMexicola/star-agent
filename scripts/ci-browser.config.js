import { defineConfig } from '@playwright/test';

// One owned production preview; never silently attach to another agent's server.
const port = 4780;
const backend = process.env.CI_BROWSER_BACKEND || 'swiftshader';
if (!['swiftshader', 'gl'].includes(backend)) throw new Error('CI_BROWSER_BACKEND must be swiftshader or gl');

export default defineConfig({
  testDir: '.',
  testMatch: 'ci-smoke.spec.js',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 300_000,
  expect: { timeout: 60_000 },
  reporter: 'list',
  outputDir: '../test-results/ci-browser',
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    browserName: 'chromium',
    headless: true,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions: {
      // CI installs Playwright's pinned bundle; local runs may supply a system path.
      executablePath: process.env.CHROMIUM_PATH || undefined,
      ignoreDefaultArgs: ['--disable-dev-shm-usage'],
      args: ['--no-sandbox', '--use-gl=angle', `--use-angle=${backend}`,
        '--ignore-gpu-blocklist', '--enable-gpu',
        ...(backend === 'swiftshader' ? ['--enable-unsafe-swiftshader'] : [])],
    },
  },
  webServer: {
    command: `npm run build && npm run preview -- --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
