import base from './aeon-fauna.config.js';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const url = 'http://127.0.0.1:5566';

// Reuse the feature owner's physical encounters against the combined build.
// Build first with VITE_DEV_TOOLS=1; this preview never opens the account API.
export default {
  ...base,
  outputDir: '../test-results/wildlife-integration',
  workers: 1,
  use: { ...base.use, baseURL: url, actionTimeout: 15000 },
  webServer: {
    command: 'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5566 --strictPort',
    cwd: root,
    url,
    reuseExistingServer: false,
    timeout: 30000,
  },
};
