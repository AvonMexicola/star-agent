import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'.',testMatch:'enemy-encounters.spec.js',timeout:480000,workers:1,retries:0,reporter:'list',
 outputDir:process.env.ENCOUNTER_RESULTS||'/tmp/star-agent-encounter-results',
 use:{baseURL:'http://127.0.0.1:5398',viewport:{width:1440,height:900},actionTimeout:12000,screenshot:'only-on-failure',trace:'retain-on-failure',video:{mode:'on',size:{width:960,height:600}},
  launchOptions:{executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--enable-gpu','--ignore-gpu-blocklist','--use-gl=angle','--use-angle=gl','--disable-dev-shm-usage']}},
 webServer:{command:'npm run preview -- --port 5398 --strictPort',url:'http://127.0.0.1:5398',reuseExistingServer:false},
});
