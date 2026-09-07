// Record against an existing immutable production preview; never rebuild it here.
import {defineConfig} from '@playwright/test';
import base from './concourse.config.js';
process.env.STATION_MOTION_RENDER_SCALE='1';
const motionOut=process.env.STATION_MOTION_OUTPUT||`/tmp/star-agent-shop-motion-${Date.now()}`;
export default defineConfig({
  ...base,
  testDir:'.',
  testMatch:'station-shop.spec.js',
  grep:/walk through passenger transit to the armory/,
  workers:1,
  retries:0,
  outputDir:`${motionOut}/raw`,
  reporter:[['list'],['json',{outputFile:`${motionOut}/results.json`}]],
  webServer:undefined,
  use:{...base.use,
    baseURL:process.env.STATION_REVIEW_URL||'http://127.0.0.1:5260',
    viewport:{width:1440,height:900},
    video:{mode:'on',size:{width:1440,height:900}},
    trace:'on',
    launchOptions:{...base.use.launchOptions,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--enable-gpu','--ignore-gpu-blocklist','--use-angle=gl']},
  },
});
