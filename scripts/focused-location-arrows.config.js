import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'.',testMatch:'focused-location-arrows.spec.js',workers:1,retries:0,maxFailures:1,
  timeout:180000,reporter:'list',outputDir:process.env.NAV_RESULTS||'/tmp/star-agent-focused-arrows/browser',
  use:{baseURL:'http://127.0.0.1:5694',viewport:{width:1440,height:900},actionTimeout:15000,
    screenshot:'only-on-failure',video:'on',
    launchOptions:{executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',
      args:['--no-sandbox','--disable-dev-shm-usage','--enable-gpu','--ignore-gpu-blocklist','--use-gl=angle','--use-angle=gl']}},
  webServer:{command:'npm run preview -- --port 5694 --strictPort',url:'http://127.0.0.1:5694',reuseExistingServer:false},
});
