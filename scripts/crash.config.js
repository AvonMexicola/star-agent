import base from './fidelity.config.js';
export default {
  ...base, testMatch:'crash.spec.js',timeout:180000,
  outputDir:'/tmp/star-agent-crash/results',
  use:{...base.use,baseURL:'http://127.0.0.1:5186'},
  webServer:{command:'npm run build && npm run preview -- --port 5186 --strictPort',url:'http://127.0.0.1:5186',reuseExistingServer:false},
};
