import {defineConfig} from '@playwright/test';
import {resolve} from 'node:path';
process.env.TMPDIR=resolve('../..','.browser-cache/rc');
process.env.TRANSPORT_EVIDENCE=resolve(process.env.RECOVERY_EVIDENCE||'test-results/recovery-03');
export default defineConfig({testDir:'.',testMatch:'recovery-missions.spec.js',timeout:1800000,workers:1,retries:0,maxFailures:1,globalSetup:'./recovery-qa-guard.js',reporter:'list',outputDir:resolve(process.env.TRANSPORT_EVIDENCE,'playwright'),use:{baseURL:'http://127.0.0.1:5680',viewport:{width:1440,height:900},actionTimeout:15000,screenshot:'only-on-failure',trace:'retain-on-failure',video:{mode:'on',size:{width:960,height:600}},launchOptions:{executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--enable-gpu','--ignore-gpu-blocklist','--use-gl=angle','--use-angle=gl','--disable-dev-shm-usage']}},webServer:{command:'npm run preview -- --port 5680 --strictPort',url:'http://127.0.0.1:5680',reuseExistingServer:false}});
