import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'.',testMatch:'kestrel-flight.spec.js',timeout:180000,workers:1,retries:0,reporter:'list',outputDir:'/tmp/star-agent-kestrel-flight-browser/results',
  use:{baseURL:'http://127.0.0.1:5294',viewport:{width:1440,height:900},deviceScaleFactor:1,actionTimeout:10000,
    launchOptions:{executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--enable-gpu','--ignore-gpu-blocklist','--use-gl=angle','--use-angle=gl']}},
});
