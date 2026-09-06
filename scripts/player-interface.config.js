import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'.',testMatch:'player-interface.spec.js',timeout:150000,workers:1,reporter:'list',outputDir:'/tmp/star-agent-player-interface-tests',
use:{baseURL:'http://127.0.0.1:5202',viewport:{width:1440,height:900},launchOptions:{executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']}},
webServer:{command:'npm run build && npm run preview -- --port 5202 --strictPort',url:'http://127.0.0.1:5202',reuseExistingServer:false}});
