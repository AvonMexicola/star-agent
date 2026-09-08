import {defineConfig} from '@playwright/test';
import {fileURLToPath} from 'node:url';
const cwd=fileURLToPath(new URL('..',import.meta.url));
export default defineConfig({
  testDir:'.',testMatch:'hud-display.spec.js',workers:1,retries:0,maxFailures:1,
  timeout:180000,reporter:'list',outputDir:'/tmp/star-agent-hud-qa/browser',
  use:{baseURL:'http://127.0.0.1:5666',viewport:{width:1440,height:900},actionTimeout:15000,
    screenshot:'only-on-failure',video:'on',
    launchOptions:{executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',
      args:['--no-sandbox','--disable-dev-shm-usage','--enable-gpu','--ignore-gpu-blocklist','--use-gl=angle','--use-angle=gl']}},
  webServer:[
    {cwd,command:'node server/index.js',env:{NODE_ENV:'test',STAR_AGENT_MEMORY:'1',DATABASE_URL:'',SMTP_HOST:'',SMTP_FROM:'',SMTP_USER:'',SMTP_PASSWORD:'',PORT:'8666',PUBLIC_ORIGIN:'http://127.0.0.1:5666'},
      url:'http://127.0.0.1:8666/api/health',reuseExistingServer:false,timeout:90000},
    {cwd,command:'VITE_DEV_TOOLS=1 npm run build -- --outDir /tmp/star-agent-hud-qa/dist && MULTIPLAYER_SERVER=http://127.0.0.1:8666 npm run preview -- --outDir /tmp/star-agent-hud-qa/dist --port 5666 --strictPort',
      url:'http://127.0.0.1:5666',reuseExistingServer:false,timeout:90000},
  ],
});
