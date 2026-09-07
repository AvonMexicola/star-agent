import {defineConfig} from '@playwright/test';

export default defineConfig({
  testDir:'.',testMatch:'mining-rover-inputs.spec.js',timeout:480000,workers:1,retries:0,
  reporter:'list',outputDir:(process.env.ROVER_INPUT_OUTPUT??'/tmp/star-agent-rover-input-review/results')+'/test-output',
  use:{
    baseURL:process.env.ROVER_URL??'http://127.0.0.1:5415',deviceScaleFactor:1,
    actionTimeout:12000,navigationTimeout:60000,
    launchOptions:{executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox','--enable-gpu','--ignore-gpu-blocklist','--use-gl=angle','--use-angle=gl','--disable-dev-shm-usage']},
  },
  projects:[
    {name:'keyboard',use:{viewport:{width:1440,height:900}}},
    {name:'touch',use:{viewport:{width:390,height:844},hasTouch:true,isMobile:true}},
  ],
});
