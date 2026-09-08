import { defineConfig } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
const commonDir = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], { encoding: 'utf8' }).trim();
const temporary = resolve(dirname(commonDir), 'test-results/npc-tmp');
mkdirSync(temporary, { recursive: true });
process.env.TMPDIR = temporary;
export default defineConfig({
  testDir: '.', testMatch: 'shopkeeper.spec.js', workers: 1, timeout: 720000,
  expect: { timeout: 30000 }, reporter: 'list', outputDir: `../test-results/shopkeeper-browser-${Date.now()}`,
  use: {
    baseURL: process.env.SHOPKEEPER_URL || 'http://127.0.0.1:5572',
    viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1,
    screenshot: 'only-on-failure', trace: 'retain-on-failure',
    video: { mode: 'on', size: { width: 1440, height: 900 } },
    launchOptions: { executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
      env: { ...process.env, TMPDIR: temporary },
      args: ['--no-sandbox', '--use-gl=angle', '--use-angle=gl', '--disable-dev-shm-usage'] },
  },
});
