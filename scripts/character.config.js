import { defineConfig } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
// Keep Chromium profiles and evidence off a quota-limited shared /tmp mount.
const cache = process.env.CHARACTER_CACHE || join(homedir(), '.cache', 'star-agent-character');
process.env.TMPDIR = join(cache, 'tmp');
process.env.CHARACTER_EVIDENCE = join(cache, 'evidence');
for (const dir of [process.env.TMPDIR, process.env.CHARACTER_EVIDENCE]) mkdirSync(dir, { recursive: true });
export default defineConfig({ testDir: '.', testMatch: ['character.spec.js', 'character-performance.spec.js', 'character-eva.spec.js', 'opening.spec.js'], timeout: 180000,
  workers: 1, reporter: 'list', outputDir: join(cache, 'test-results'),
  use: { baseURL: process.env.CHARACTER_URL || 'http://127.0.0.1:5319', viewport: { width: 1440, height: 900 },
    launchOptions: { executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: [
      '--no-sandbox', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-dev-shm-usage', '--use-gl=angle', '--use-angle=gl',
    ] } },
  webServer: process.env.CHARACTER_URL ? undefined : { command: 'npm run build && npm run preview -- --port 5319 --strictPort',
    url: 'http://127.0.0.1:5319', reuseExistingServer: false },
});
