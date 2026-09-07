import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch:'public-launch.spec.js', workers:1, fullyParallel:false, retries:0, maxFailures:1,
  timeout:300000, expect:{timeout:30000}, reporter:'list', outputDir:'../test-results/public-launch',
  use:{ screenshot:"only-on-failure", viewport:{width:1440,height:900}, deviceScaleFactor:1, launchOptions:{
    executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',
    args:['--no-sandbox','--disable-dev-shm-usage','--enable-gpu','--ignore-gpu-blocklist','--use-gl=angle','--use-angle=gl'],
  } },
});
