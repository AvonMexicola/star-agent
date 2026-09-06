import base from '../playwright.config.js';
const port = 4202;
export default { ...base, testDir: '.', testMatch: /container-inventory\.spec\.js$/, outputDir: '/tmp/star-agent-inventory-evidence/results', use: { ...base.use, viewport: { width: 1440, height: 900 }, baseURL: `http://127.0.0.1:${port}` }, webServer: { ...base.webServer, command: `npm run build && npm run preview -- --port ${port} --strictPort`, url: `http://127.0.0.1:${port}` } };
