import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: 'nomad-refinement.spec.js', timeout: 60000, workers: 1,
  reporter: 'list', outputDir: '/tmp/star-agent-ship-studio',
  use: { baseURL: 'http://127.0.0.1:5215', viewport: { width: 1600, height: 1000 },
    launchOptions: { executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage'] } },
  webServer: { command: 'npm run dev -- --config scripts/ship-vite.config.js --port 5215 --strictPort', url: 'http://127.0.0.1:5215', reuseExistingServer: false },
});
