import { defineConfig } from '@playwright/test';
const live=process.env.NOMAD_URL,port=5295,hardware=process.env.NOMAD_HARDWARE==='1';
export default defineConfig({
  testDir:'.',testMatch:'nomad-studio.spec.js',timeout:120000,workers:1,reporter:'list',
  outputDir:'/tmp/star-agent-nomad-studio-results',
  use:{baseURL:live??`http://127.0.0.1:${port}`,viewport:{width:1440,height:900},deviceScaleFactor:1,screenshot:'only-on-failure',
    launchOptions:{executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:[
      '--no-sandbox','--disable-dev-shm-usage','--use-gl=angle',
      ...(hardware?['--enable-gpu','--ignore-gpu-blocklist','--use-angle=gl']:['--use-angle=swiftshader','--enable-unsafe-swiftshader']),
    ]}},
  ...(!live&&{webServer:{command:`npm run build && npm run preview -- --port ${port} --strictPort`,url:`http://127.0.0.1:${port}`,reuseExistingServer:false,timeout:120000}}),
});
