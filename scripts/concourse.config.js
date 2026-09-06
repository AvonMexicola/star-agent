import {defineConfig} from '@playwright/test';

const external=process.env.STATION_REVIEW_URL;
const baseURL=external||'http://127.0.0.1:5261';
const hardware=process.env.STATION_HARDWARE==='1';
export default defineConfig({
  testDir:'.',
  testMatch:['station-shop.spec.js','station-concourse.spec.js','hangar.spec.js','hangar-finish.spec.js','opening.spec.js','freighter.spec.js'],
  timeout:240000,workers:1,reporter:'list',outputDir:'/tmp/star-agent-concourse-tests',
  use:{baseURL,viewport:{width:1440,height:900},screenshot:'only-on-failure',
    launchOptions:{executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',
      args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle',...(hardware?
        ['--enable-gpu','--ignore-gpu-blocklist','--use-angle=gl']:
        ['--use-angle=swiftshader','--enable-unsafe-swiftshader'])]}},
  webServer:external?undefined:{
    command:'npm run build -- --outDir /tmp/star-agent-concourse-test-build && npm run preview -- --outDir /tmp/star-agent-concourse-test-build --port 5261 --strictPort',
    url:baseURL,reuseExistingServer:false,timeout:60000},
});
