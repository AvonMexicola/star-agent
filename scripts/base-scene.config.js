import base from './expedition.config.js';
const port=4296;
export default {...base,testMatch:/base-scene\.spec\.js$/,outputDir:'/tmp/star-agent-base-scene/results',use:{...base.use,baseURL:`http://127.0.0.1:${port}`,viewport:{width:1440,height:900},launchOptions:{...base.use.launchOptions,args:['--no-sandbox','--use-gl=angle','--use-angle=gl','--enable-webgl','--disable-dev-shm-usage']}},webServer:{...base.webServer,command:`npm run build && npm run preview -- --port ${port} --strictPort`,url:`http://127.0.0.1:${port}`}};
