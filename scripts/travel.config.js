import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '../tests/browser', testMatch: 'travel.spec.js', timeout: 120000,
  workers: 1, reporter: 'list', outputDir: '/tmp/star-agent-travel-browser',
  use: { baseURL: 'http://127.0.0.1:5199', viewport: {width:1440,height:900},
    launchOptions: {executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',
      args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']}},
  webServer: {command:'npm run build && npm run preview -- --port 5199 --strictPort',
    url:'http://127.0.0.1:5199',reuseExistingServer:false}
});
