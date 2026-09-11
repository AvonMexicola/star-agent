import { defineConfig } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
const commonDir = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { encoding: 'utf8' }).trim();
const temporary = resolve(dirname(commonDir), 'test-results/promenade-tmp');
mkdirSync(temporary, { recursive: true });
process.env.TMPDIR = temporary;
const baseURL = process.env.PROMENADE_URL || 'http://127.0.0.1:5283';
export default defineConfig({
  testDir: '.', testMatch: ['station-promenade.spec.js'], workers: 1, timeout: 900000,
  expect: { timeout: 30000 }, reporter: 'list', outputDir: `../test-results/promenade-browser-${Date.now()}`,
  use: {
    baseURL, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1,
    screenshot: 'only-on-failure', trace: 'retain-on-failure',
    video: { mode: 'on', size: { width: 1440, height: 900 } },
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
      env: { ...process.env, TMPDIR: temporary },
      args: ['--no-sandbox', '--use-gl=angle', '--use-angle=gl', '--disable-dev-shm-usage'],
    },
  },
  webServer: process.env.PROMENADE_URL ? undefined : {
    command: 'npm run build -- --outDir test-results/promenade-build && npm run preview -- --outDir test-results/promenade-build --port 5283 --strictPort',
    url: baseURL, reuseExistingServer: false, timeout: 180000,
    env: { ...process.env, VITE_DEV_TOOLS: '1' },
  },
});
