import {defineConfig} from '@playwright/test';
const output=process.env.COMMUNITY_OUTPUT??'/home/cees/projects/.community-hub-qa/game-01';
export default defineConfig({
 testDir:'.',testMatch:'community-hub.spec.js',workers:1,retries:0,timeout:300000,reporter:'list',outputDir:output+'/test-output',
 use:{baseURL:'http://127.0.0.1:5564',viewport:{width:1440,height:900},actionTimeout:15000,navigationTimeout:60000,
  launchOptions:{executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox','--enable-gpu','--ignore-gpu-blocklist','--disable-dev-shm-usage','--use-gl=angle','--use-angle=gl']}},
 webServer:[
  {command:'node scripts/community-hub-server.mjs',env:{NODE_ENV:'test',DATABASE_URL:'',STAR_AGENT_MEMORY:'1',SMTP_HOST:'',SMTP_USER:'',SMTP_PASSWORD:''},url:'http://127.0.0.1:8098/api/health',reuseExistingServer:false,timeout:30000},
  {command:'VITE_MULTIPLAYER_ENTRY=1 VITE_DEV_TOOLS=1 npm run build -- --outDir /home/cees/projects/.community-hub-qa/dist && MULTIPLAYER_SERVER=http://127.0.0.1:8098 npm run preview -- --host 127.0.0.1 --port 5564 --outDir /home/cees/projects/.community-hub-qa/dist',url:'http://127.0.0.1:5564',reuseExistingServer:false,timeout:90000},
 ],
});
