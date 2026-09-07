import base from './fidelity.config.js';
export default {
  ...base, testMatch: ['opening.spec.js', 'station.spec.js'], timeout: 360000,
  expect: {timeout:120000}, outputDir:'/tmp/star-agent-hull-tests',
  use: {...base.use, baseURL:'http://127.0.0.1:5185', screenshot:'only-on-failure'},
  webServer: {command:'npm run build && npm run preview -- --port 5185 --strictPort',
    url:'http://127.0.0.1:5185', reuseExistingServer:true},
};
