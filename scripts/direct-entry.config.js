import base from './fleet-engine.config.js';
export default { ...base, testMatch: 'direct-entry.spec.js', timeout: 180000,
  outputDir: '../test-results/direct-entry',
  use: { ...base.use, baseURL: 'http://127.0.0.1:5586' },
  webServer: { ...base.webServer,
    command: 'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5586 --strictPort --outDir dist/solo',
    url: 'http://127.0.0.1:5586',
  },
};
