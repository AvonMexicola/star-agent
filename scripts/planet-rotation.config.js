import { defineConfig } from '@playwright/test';
import { readdirSync, readFileSync, readlinkSync } from 'node:fs';
const root=new URL('..',import.meta.url).pathname;
if(process.env.TEST_WORKER_INDEX===undefined){
  const busy=readdirSync('/proc').filter(id=>/^\d+$/.test(id)).flatMap(id=>{
    try{
      const exe=readlinkSync(`/proc/${id}/exe`),args=readFileSync(`/proc/${id}/cmdline`,'utf8').replaceAll('\0',' ');
      return /\/node$/.test(exe)&&/playwright.*(?:cli\.js.*test|lib\/worker)/.test(args)&&!args.includes('planet-rotation.config')?[id]:[];
    }catch{return [];}
  });
  if(busy.length)throw new Error(`GPU queue busy: Playwright processes ${busy.join(', ')}`);
}
export default defineConfig({
  testDir:'.',testMatch:'planet-rotation.spec.js',workers:1,retries:0,maxFailures:1,
  timeout:420_000,expect:{timeout:30_000},reporter:'list',
  outputDir:`../test-results/planet-rotation/browser-${process.env.ROTATION_QA_RUN??'local'}`,
  use:{baseURL:'http://127.0.0.1:5682',viewport:{width:1440,height:900},deviceScaleFactor:1,
    screenshot:'only-on-failure',trace:'retain-on-failure',
    launchOptions:{executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=gl','--ignore-gpu-blocklist','--enable-gpu','--disable-dev-shm-usage']}},
  webServer:[
    {cwd:root,command:'node server/index.js',env:{NODE_ENV:'test',STAR_AGENT_MEMORY:'1',PORT:'8682',HOST:'127.0.0.1',PUBLIC_ORIGIN:'http://127.0.0.1:5682'},url:'http://127.0.0.1:8682/api/health',reuseExistingServer:false,timeout:60_000},
    {cwd:root,command:'VITE_DEV_TOOLS=1 npm run build && MULTIPLAYER_SERVER=http://127.0.0.1:8682 npm run preview -- --port 5682 --strictPort',url:'http://127.0.0.1:5682',reuseExistingServer:false,timeout:120_000},
  ],
});
