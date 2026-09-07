import {defineConfig} from '@playwright/test';
const port=53770;
export default defineConfig({
  testDir:'.',testMatch:'aeon-stones.spec.js',timeout:600000,workers:1,retries:0,reporter:'list',
  outputDir:process.env.STONE_QA_OUTPUT??'test-results/aeon-stones',
  use:{baseURL:process.env.STONE_QA_URL??`http://127.0.0.1:${port}`,viewport:{width:1440,height:900},deviceScaleFactor:1,
    launchOptions:{executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',ignoreDefaultArgs:['--disable-dev-shm-usage'],
      args:['--no-sandbox','--enable-gpu','--ignore-gpu-blocklist','--use-gl=angle','--use-angle=gl']},screenshot:'only-on-failure',trace:'retain-on-failure'},
  webServer:process.env.STONE_QA_URL?undefined:{command:`npm run preview -- --port ${port} --strictPort`,url:`http://127.0.0.1:${port}`,reuseExistingServer:false,timeout:30000},
});
