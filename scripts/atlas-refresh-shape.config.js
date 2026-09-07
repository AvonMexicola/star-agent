import {defineConfig} from '@playwright/test';
export default defineConfig({
  testDir:'.',testMatch:process.env.ATLAS_REFRESH_JOURNEY==='1'
    ? ['atlas-refresh-shape.spec.js','atlas-mark-ii.spec.js'] : 'atlas-refresh-shape.spec.js',
  timeout:90000,workers:1,reporter:'list',
  outputDir:'/tmp/atlas-refresh-shape-results',
  use:{baseURL:process.env.ATLAS_REFRESH_URL||'http://127.0.0.1:5394',viewport:{width:1440,height:900},deviceScaleFactor:1,
    launchOptions:{executablePath:'/usr/bin/chromium',args:['--no-sandbox','--enable-gpu','--use-gl=angle','--use-angle=gl','--ignore-gpu-blocklist','--disable-dev-shm-usage']}},
});
