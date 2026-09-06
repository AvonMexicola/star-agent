import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'..',testMatch:['scripts/hangar-finish.spec.js','scripts/hangar.spec.js','scripts/freighter.spec.js','scripts/station.spec.js','scripts/opening.spec.js','scripts/player-interface.spec.js','tests/browser/travel.spec.js','scripts/hangar-merge.spec.js'],
  timeout:240000,expect:{timeout:60000},workers:1,reporter:'list',outputDir:'/tmp/star-agent-hangar-merge-tests',
  use:{baseURL:'http://127.0.0.1:5238',viewport:{width:1440,height:900},launchOptions:{executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']}},
  webServer:{command:'npm run build -- --outDir /tmp/star-agent-hangar-merge-build && npm run preview -- --outDir /tmp/star-agent-hangar-merge-build --port 5238 --strictPort',url:'http://127.0.0.1:5238',reuseExistingServer:false},
});
