import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const before = process.env.FLEET_ENGINE_BEFORE === '1';
const port = before ? 5577 : 5576;
const url = `http://127.0.0.1:${port}`;
export default defineConfig({
  testDir: '.', testMatch: 'fleet-engine.spec.js', workers: 1, retries: 0,
  timeout: 240000, expect: { timeout: 20000 }, reporter: 'list',
  outputDir: `../test-results/fleet-engine-${before ? 'before' : 'after'}`,
  use: {
    baseURL: url, viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1,
    hasTouch: true, actionTimeout: 15000, screenshot: 'only-on-failure',
    video: { mode: 'on', size: { width: 1440, height: 900 } },
    launchOptions: {
      executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium',
      args: ['--use-gl=angle', '--use-angle=gl', '--ignore-gpu-blocklist', '--no-sandbox', '--disable-dev-shm-usage'],
    },
  },
  webServer: {
    command: `node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port ${port} --strictPort`,
    cwd: before ? resolve(process.env.FLEET_ENGINE_BASELINE_ROOT || root) : root,
    url, reuseExistingServer: false, timeout: 30000,
  },
});
