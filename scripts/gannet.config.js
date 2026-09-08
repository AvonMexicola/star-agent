import {defineConfig} from '@playwright/test';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
const root=resolve(import.meta.dirname,'..'),url=process.env.GANNET_URL??'http://127.0.0.1:5581';
const hardware=process.env.GANNET_HARDWARE==='1';
export default defineConfig({testDir:'.',testMatch:'gannet.spec.js',workers:1,maxFailures:1,timeout:120000,reporter:'list',
  outputDir:process.env.GANNET_TEST_OUTPUT??resolve(tmpdir(),'star-agent-gannet-browser'),
  use:{baseURL:url,viewport:{width:1440,height:900},deviceScaleFactor:1,screenshot:'only-on-failure',video:{mode:'on',size:{width:1440,height:900}},
    launchOptions:{executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle',...(hardware?['--enable-gpu','--ignore-gpu-blocklist','--use-angle=gl']:['--use-angle=swiftshader','--enable-unsafe-swiftshader'])]}},
  ...(!process.env.GANNET_URL&&{webServer:{command:'npx vite build --config scripts/gannet-vite.config.js && npx vite preview --config scripts/gannet-vite.config.js --port 5581 --strictPort',cwd:root,url,reuseExistingServer:false,timeout:120000}}),
});
