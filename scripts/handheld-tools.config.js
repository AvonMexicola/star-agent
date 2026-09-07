import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'..',testMatch:/tests\/(handheld-tools\/visual|tool-visual\/visual|browser\/cargo-tractor)\.spec\.js$/,
  grep:/four real GLBs|controller lands on Selene|HDR log-depth|controller physically reaches2SBU/,
  workers:1,maxFailures:1,timeout:180000,reporter:'list',outputDir:process.env.TOOL_ART_RESULTS,
  use:{baseURL:'http://127.0.0.1:5578',viewport:{width:1440,height:900},actionTimeout:12000,
    video:'on',launchOptions:{executablePath:'/usr/bin/chromium',args:['--no-sandbox','--enable-gpu','--ignore-gpu-blocklist','--use-gl=angle','--use-angle=gl','--disable-dev-shm-usage']}},
  webServer:{cwd:new URL('../',import.meta.url).pathname,command:'VITE_DEV_TOOLS=1 node tests/handheld-tools/build-preview.mjs && npm run preview -- --port 5578 --strictPort',url:'http://127.0.0.1:5578',reuseExistingServer:false,timeout:120000}});
