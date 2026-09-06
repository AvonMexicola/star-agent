import {defineConfig} from '@playwright/test';
const baseline=process.env.WATER_BASELINE;
export default defineConfig({testDir:'.',testMatch:'water.spec.js',timeout:240000,workers:1,reporter:'list',
outputDir:'/tmp/star-agent-water-tests',use:{baseURL:'http://127.0.0.1:5204',viewport:{width:1440,height:900},launchOptions:{executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']}},
webServer:{command:baseline?'npm run preview -- --outDir /tmp/star-agent-water-before --port 5204 --strictPort':'npm run build && npm run preview -- --port 5204 --strictPort',url:'http://127.0.0.1:5204',reuseExistingServer:false}});
