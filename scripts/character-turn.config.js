import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'.',testMatch:'character-turn.spec.js',workers:1,retries:0,maxFailures:1,
 timeout:180000,expect:{timeout:15000},reporter:'list',outputDir:process.env.CHARACTER_TURN_RESULTS||'/tmp/star-agent-character-turn-results',
 use:{baseURL:'http://127.0.0.1:5702',viewport:{width:1440,height:900},trace:'retain-on-failure',screenshot:'only-on-failure',
 launchOptions:{executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--enable-gpu','--ignore-gpu-blocklist','--use-gl=angle','--use-angle=gl','--disable-dev-shm-usage']}},
 webServer:{command:'npm run preview -- --port 5702 --strictPort',url:'http://127.0.0.1:5702',reuseExistingServer:false}});
