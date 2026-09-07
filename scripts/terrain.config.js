import base from './fidelity.config.js';
export default {
  ...base, testMatch:'terrain.spec.js', timeout:300000, expect:{timeout:180000},
  outputDir:'/tmp/star-agent-terrain/results',
  use:{...base.use,baseURL:'http://127.0.0.1:5198'},
  webServer:{command:'npm run build && npm run preview -- --port 5198 --strictPort',url:'http://127.0.0.1:5198',reuseExistingServer:false},
};
