import base from './fleet-engine.config.js';
import {fileURLToPath} from 'node:url';

const cwd=fileURLToPath(new URL('..',import.meta.url));
const url='http://127.0.0.1:5586',api='http://127.0.0.1:8106';
export default {...base,testMatch:'fleet-opening.spec.js',timeout:180000,
  outputDir:'../test-results/fleet-opening',use:{...base.use,baseURL:url},
  webServer:[
    {cwd,command:'node server/index.js',url:api+'/api/health',reuseExistingServer:false,timeout:30000,
      env:{NODE_ENV:'test',STAR_AGENT_MEMORY:'1',DATABASE_URL:'',PORT:'8106',PUBLIC_ORIGIN:url,
        SMTP_HOST:'',SMTP_FROM:'',SMTP_USER:'',SMTP_PASSWORD:''}},
    {cwd,command:'VITE_DEV_TOOLS=0 VITE_MULTIPLAYER_ENTRY=1 npm run build -- --outDir test-results/fleet-opening-dist && MULTIPLAYER_SERVER='+api+' npm run preview -- --host 127.0.0.1 --port 5586 --strictPort --outDir test-results/fleet-opening-dist',
      url,reuseExistingServer:false,timeout:60000},
  ],
};
