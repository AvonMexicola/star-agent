import base from './build-ui.config.js';
const port=5558;
export default {...base,testMatch:/base-power-assets\.spec\.js$/,outputDir:'/home/cees/.cache/star-agent-base-power-assets-results',use:{...base.use,baseURL:`http://127.0.0.1:${port}`,launchOptions:{...base.use.launchOptions,args:['--no-sandbox','--use-gl=angle','--use-angle=gl','--enable-webgl','--disable-dev-shm-usage']}},webServer:{...base.webServer,command:`npm run dev -- --port ${port} --strictPort`,url:`http://127.0.0.1:${port}`}};
