import base from './fidelity.config.js';
export default {
  ...base,testMatch:'reentry.spec.js',outputDir:'/tmp/star-agent-reentry/results',
  use:{...base.use,baseURL:'http://127.0.0.1:5192'},
  webServer:{command:'npm run build -- --config scripts/reentry.vite.config.js && npm run preview -- --config scripts/reentry.vite.config.js --port 5192 --strictPort',url:'http://127.0.0.1:5192',reuseExistingServer:false},
};
