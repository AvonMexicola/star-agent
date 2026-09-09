import {defineConfig} from '@playwright/test';

export default defineConfig({
  testDir:'.',testMatch:'landmark-restraint.spec.js',timeout:480000,
  workers:1,retries:0,reporter:'list',
  outputDir:process.env.RESTRAINT_QA_OUTPUT??'test-results/landmark-restraint',
  use:{baseURL:'http://127.0.0.1:5383',viewport:{width:1440,height:900},deviceScaleFactor:1,
    launchOptions:{executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',
      ignoreDefaultArgs:['--disable-dev-shm-usage'],
      args:['--no-sandbox','--enable-gpu','--ignore-gpu-blocklist','--use-gl=angle','--use-angle=gl']},
    screenshot:'only-on-failure',trace:'retain-on-failure'},
  webServer:[
    {command:'npm run preview -- --port 5383 --strictPort',url:'http://127.0.0.1:5383',reuseExistingServer:false,timeout:30000},
    {command:'npm run preview -- --outDir ../star-agent-rock-restraint-baseline/dist --port 5384 --strictPort',
      url:'http://127.0.0.1:5384',reuseExistingServer:false,timeout:30000},
  ],
});
