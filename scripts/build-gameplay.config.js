import base from './expedition.config.js';
const port=4277;
export default {...base,testMatch:/build-gameplay\.spec\.js$/,outputDir:'/tmp/star-agent-build-gameplay/results',use:{...base.use,viewport:{width:1440,height:900},baseURL:`http://127.0.0.1:${port}`,launchOptions:{...base.use.launchOptions,args:['--use-gl=angle','--use-angle=gl','--enable-webgl','--ignore-gpu-blocklist','--no-sandbox','--disable-dev-shm-usage']}},webServer:{...base.webServer,command:`npm run build && npm run preview -- --port ${port} --strictPort`,url:`http://127.0.0.1:${port}`}};
