import base from './base-scene.config.js';
import {execFileSync} from 'node:child_process';
// Inspect at actual launch, including after an approval delay. Do not acquire
// Chromium while another lane is already using the shared GPU.
const busy=process.env.TEST_WORKER_INDEX!==undefined?[]:execFileSync('ps',['-eo','pid,comm,args'],{encoding:'utf8'}).split('\n').filter(line=>/^\s*\d+\s+node(?:-MainThread)?\s/.test(line)&&/playwright.*(?:cli\.js.*test|lib\/worker)/.test(line)&&!line.includes('terrain-foundations'));
if(busy.length)throw Error('GPU queue busy: another Playwright job is running.');
const port=5642;
export default {...base,testMatch:/terrain-foundations\.spec\.js$/,workers:1,retries:0,maxFailures:1,timeout:420000,outputDir:'/tmp/star-agent-foundations-evidence/results',use:{...base.use,hasTouch:true,baseURL:`http://127.0.0.1:${port}`,video:'retain-on-failure'},webServer:[{cwd:new URL('..',import.meta.url).pathname,command:'STAR_AGENT_MEMORY=1 PORT=8642 PUBLIC_ORIGIN=http://127.0.0.1:5642 node server/index.js',url:'http://127.0.0.1:8642/api/health',reuseExistingServer:false,timeout:30000},{...base.webServer,command:`VITE_DEV_TOOLS=1 npm run build && MULTIPLAYER_SERVER=http://127.0.0.1:8642 npm run preview -- --port ${port} --strictPort`,url:`http://127.0.0.1:${port}`,timeout:90000}]};
