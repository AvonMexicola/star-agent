import base from './fidelity.config.js';
export default {
  ...base, testMatch: 'station.spec.js', timeout: 360000,
  expect: { timeout: 120000 }, outputDir: '/tmp/star-agent-station/results',
  use: { ...base.use, baseURL: 'http://127.0.0.1:5184', screenshot: 'only-on-failure' },
  webServer: { command: 'npm run build && npm run preview -- --port 5184 --strictPort', url: 'http://127.0.0.1:5184', reuseExistingServer: false },
};
