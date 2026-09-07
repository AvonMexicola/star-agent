import base from './rock-formations.config.js';
const port = 53768;
export default { ...base, testMatch: 'surface-weather.spec.js', outputDir: '/tmp/star-agent-weather/results',
  use: { ...base.use, baseURL: `http://127.0.0.1:${port}` },
  webServer: { ...base.webServer, command: `npm run build && npm run preview -- --port ${port} --strictPort`, url: `http://127.0.0.1:${port}` } };
