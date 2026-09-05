import base from './fidelity.config.js';
export default {
  ...base,testMatch:'forest.spec.js',timeout:240000,expect:{timeout:90000},
  outputDir:'/tmp/star-agent-forest/results',
  use:{...base.use,baseURL:'http://127.0.0.1:5196'},
  webServer:{command:'npm run build && npm run preview -- --port 5196 --strictPort',url:'http://127.0.0.1:5196',reuseExistingServer:false},
};
