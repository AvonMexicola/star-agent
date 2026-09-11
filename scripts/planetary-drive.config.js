import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'.',testMatch:'planetary-drive.spec.js',workers:1,retries:0,maxFailures:1,
 timeout:240000,expect:{timeout:20000},reporter:'list',outputDir:'/tmp/star-agent-planetary-drive-results',
 use:{baseURL:'http://127.0.0.1:5694',viewport:{width:1440,height:900},hasTouch:true,trace:'retain-on-failure',screenshot:'only-on-failure',
 launchOptions:{executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--enable-gpu','--ignore-gpu-blocklist','--use-gl=angle','--use-angle=gl','--disable-dev-shm-usage']}},
 webServer:{command:'npm run preview -- --port 5694 --strictPort',url:'http://127.0.0.1:5694',reuseExistingServer:false}});
