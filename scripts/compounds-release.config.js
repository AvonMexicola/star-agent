import {defineConfig} from '@playwright/test';
const root=new URL('..',import.meta.url).pathname,out=process.env.COMPOUNDS_RELEASE_OUT;
export default defineConfig({testDir:'.',testMatch:['direct-entry.spec.js','compounds-release.spec.js'],workers:1,retries:0,maxFailures:1,timeout:240000,reporter:'list',outputDir:out+'/artifacts',
 use:{baseURL:'http://127.0.0.1:5690',viewport:{width:1440,height:900},deviceScaleFactor:1,hasTouch:true,actionTimeout:15000,screenshot:'only-on-failure',video:'retain-on-failure',launchOptions:{executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--enable-gpu','--ignore-gpu-blocklist','--use-gl=angle','--use-angle=gl','--disable-dev-shm-usage']}},
 webServer:[
  {cwd:root,command:'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5690 --strictPort --outDir dist/solo',url:'http://127.0.0.1:5690',reuseExistingServer:false},
  {cwd:root,command:'STAR_AGENT_MEMORY=1 PORT=8690 PUBLIC_ORIGIN=http://127.0.0.1:5691 node server/index.js',url:'http://127.0.0.1:8690/api/health',reuseExistingServer:false},
  {cwd:root,command:'MULTIPLAYER_SERVER=http://127.0.0.1:8690 node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 5691 --strictPort --outDir dist/multiplayer',url:'http://127.0.0.1:5691',reuseExistingServer:false},
 ]});
