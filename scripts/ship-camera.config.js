import base from './ship.config.js';
export default {
  ...base,expect:{timeout:20000},testMatch:'ship-camera.spec.js',outputDir:'/tmp/star-agent-camera/results',
  use:{...base.use,baseURL:'http://127.0.0.1:5193'},
  webServer:{command:'npm run build -- --outDir /tmp/star-agent-camera-build && npm run preview -- --outDir /tmp/star-agent-camera-build --port 5193 --strictPort',url:'http://127.0.0.1:5193',reuseExistingServer:false},
};
