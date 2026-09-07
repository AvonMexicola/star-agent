import { defineConfig } from '@playwright/test';

const hardware = process.env.NOMAD_HARDWARE === '1';
// Start the untouched integration baseline and the candidate in separate Vite
// servers/caches. The spec records response hashes and identical view settings.
export default defineConfig({
  testDir: '.', testMatch: 'nomad-comparison.spec.js', workers: 1, timeout: 90000,
  reporter: 'list', outputDir: '/tmp/star-agent-nomad-comparison-results',
  use: {
    viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1,
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium',
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=angle',
        ...(hardware ? ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=gl'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])],
    },
  },
});
