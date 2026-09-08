import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'.',testMatch:'stratum-studio.spec.js',workers:1,timeout:90000,maxFailures:1,
  outputDir:process.env.STRATUM_QA_OUTPUT??'/tmp/star-agent-stratum-native',reporter:'list',
  use:{baseURL:process.env.STRATUM_URL??'http://127.0.0.1:5580',video:'on',
    launchOptions:{executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',
      args:['--no-sandbox','--disable-dev-shm-usage','--enable-gpu','--ignore-gpu-blocklist','--use-gl=angle','--use-angle=gl']}},
});
