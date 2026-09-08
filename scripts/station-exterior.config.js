import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'.',testMatch:'station-exterior.spec.js',timeout:180000,workers:1,retries:0,reporter:'list',
  outputDir:(process.env.STATION_EXTERIOR_OUTPUT??'/tmp/star-agent-station-exterior-capture')+'/test-output',
  use:{baseURL:process.env.STATION_EXTERIOR_URL??'http://127.0.0.1:5400',viewport:{width:1440,height:900},deviceScaleFactor:1,
    launchOptions:{executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox','--enable-gpu','--ignore-gpu-blocklist','--use-gl=angle','--use-angle=gl','--disable-dev-shm-usage']}},
});
