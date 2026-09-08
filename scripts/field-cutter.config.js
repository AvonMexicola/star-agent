import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'.',testMatch:'field-cutter.spec.js',workers:1,retries:0,maxFailures:1,timeout:300000,
  reporter:'list',outputDir:`${process.env.CUTTER_EVIDENCE}/results`,
  use:{baseURL:'http://127.0.0.1:5672',viewport:{width:1440,height:900},hasTouch:true,actionTimeout:15000,
    video:'on',launchOptions:{executablePath:'/usr/bin/chromium',args:['--no-sandbox','--enable-gpu','--ignore-gpu-blocklist','--use-gl=angle','--use-angle=gl','--disable-dev-shm-usage']}},
  webServer:[
    {cwd:new URL('..',import.meta.url).pathname,command:'STAR_AGENT_MEMORY=1 PORT=8672 PUBLIC_ORIGIN=http://127.0.0.1:5672 node server/index.js',url:'http://127.0.0.1:8672/api/health',reuseExistingServer:false},
    {cwd:new URL('..',import.meta.url).pathname,command:'MULTIPLAYER_SERVER=http://127.0.0.1:8672 npm run preview -- --port 5672 --strictPort',url:'http://127.0.0.1:5672',reuseExistingServer:false},
  ],
});
