import {defineConfig} from '@playwright/test';
import path from 'node:path';
const cwd=path.resolve(import.meta.dirname,'../..');
const output=process.env.SENTRY_OUTPUT??'test-results/sentry-manual';
export default defineConfig({testDir:'.',testMatch:'sentry.spec.js',timeout:720000,workers:1,retries:0,maxFailures:1,reporter:'list',outputDir:output+'/results',
  use:{baseURL:'http://127.0.0.1:5678',viewport:{width:1440,height:900},deviceScaleFactor:1,video:{mode:'on',size:{width:1440,height:900}},screenshot:'only-on-failure',actionTimeout:20000,navigationTimeout:90000,
    launchOptions:{executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox','--enable-gpu','--ignore-gpu-blocklist','--disable-dev-shm-usage','--use-gl=angle','--use-angle=gl']}},
  webServer:[
    {command:'npm run server',cwd,env:{NODE_ENV:'test',STAR_AGENT_MEMORY:'1',DATABASE_URL:'',PORT:'8678',PUBLIC_ORIGIN:'http://127.0.0.1:5678',SMTP_HOST:'',SMTP_FROM:'',SMTP_USER:'',SMTP_PASSWORD:''},url:'http://127.0.0.1:8678/api/health',reuseExistingServer:false,timeout:30000},
    {command:'npm run preview -- --port 5678 --strictPort',cwd,env:{MULTIPLAYER_SERVER:'http://127.0.0.1:8678'},url:'http://127.0.0.1:5678',reuseExistingServer:false,timeout:30000},
  ]});
