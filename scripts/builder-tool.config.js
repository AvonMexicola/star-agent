import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'.',testMatch:'builder-tool.spec.js',workers:1,retries:0,maxFailures:1,timeout:240000,
  reporter:'list',outputDir:process.env.BUILDER_EVIDENCE,
  use:{baseURL:'http://127.0.0.1:5670',viewport:{width:1440,height:900},hasTouch:true,actionTimeout:15000,
    video:'on',launchOptions:{executablePath:'/usr/bin/chromium',
      args:['--no-sandbox','--enable-gpu','--ignore-gpu-blocklist','--use-gl=angle','--use-angle=gl','--disable-dev-shm-usage']}},
  webServer:[
    {command:'STAR_AGENT_MEMORY=1 PORT=8670 PUBLIC_ORIGIN=http://127.0.0.1:5670 node server/index.js',url:'http://127.0.0.1:8670/api/health',reuseExistingServer:false},
    {command:'MULTIPLAYER_SERVER=http://127.0.0.1:8670 npm run preview -- --port 5670 --strictPort',url:'http://127.0.0.1:5670',reuseExistingServer:false},
  ],
});
