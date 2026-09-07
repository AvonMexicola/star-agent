import base from '../playwright.config.js';
const port=4996;
export default {...base,testDir:'.',testMatch:/materials-gameplay\.spec\.js$/,outputDir:'/tmp/star-agent-materials-gameplay/results',timeout:300000,use:{...base.use,viewport:{width:1280,height:800},launchOptions:{...base.use.launchOptions,args:['--use-gl=angle','--use-angle=gl','--enable-webgl','--ignore-gpu-blocklist','--no-sandbox','--disable-dev-shm-usage']},baseURL:`http://127.0.0.1:${port}`},webServer:{...base.webServer,command:`npm run preview -- --port ${port} --strictPort`,url:`http://127.0.0.1:${port}`}};
