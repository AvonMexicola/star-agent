import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'.',testMatch:'dev-launcher.spec.js',timeout:600000,workers:1,retries:0,reporter:'list',outputDir:'/tmp/star-agent-dev-qa/results',
  use:{baseURL:process.env.DEV_TEST_URL??'http://127.0.0.1:5178',viewport:{width:1440,height:900},deviceScaleFactor:1,actionTimeout:15000,
    launchOptions:{executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',ignoreDefaultArgs:['--disable-dev-shm-usage'],args:['--no-sandbox','--enable-gpu','--ignore-gpu-blocklist','--use-gl=angle','--use-angle=gl']}},
});
