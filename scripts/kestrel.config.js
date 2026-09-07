import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'.',testMatch:'kestrel.spec.js',timeout:90000,workers:1,reporter:'list',outputDir:'/tmp/star-agent-kestrel-browser',
 use:{baseURL:process.env.KESTREL_URL||'http://127.0.0.1:5292',viewport:{width:1600,height:900},launchOptions:{executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']}},
 webServer:process.env.KESTREL_URL?undefined:{command:'npm run build && npm run preview -- --port 5292 --strictPort',url:'http://127.0.0.1:5292/dev/kestrel.html',reuseExistingServer:false}
});
