import {defineConfig} from '@playwright/test';
import carrier from '../gannet-gameplay.config.js';

const cwd = new URL('../..', import.meta.url).pathname;
const baseURL = process.env.GANNET_URL ?? 'http://127.0.0.1:5630';

// Reuse the complete existing controller journey, with our own production
// preview and explicitly ephemeral offline API. No shared preview or SQL store.
export default defineConfig({
  ...carrier,
  testDir: '..', testMatch: 'gannet-gameplay.spec.js',
  use: {...carrier.use, baseURL},
  webServer: [
    {command: 'node server/index.js', cwd, url: 'http://127.0.0.1:8630/api/health',
      env: {...process.env, STAR_AGENT_MEMORY: '1', PUBLIC_ORIGIN: baseURL, HOST: '127.0.0.1', PORT: '8630'},
      reuseExistingServer: false, timeout: 30000},
    {command: 'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5630 --strictPort', cwd, url: baseURL,
      env: {...process.env, MULTIPLAYER_SERVER: 'http://127.0.0.1:8630'},
      reuseExistingServer: false, timeout: 30000},
  ],
});
