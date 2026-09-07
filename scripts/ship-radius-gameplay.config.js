import base from './build-gameplay.config.js';
const port=4280;
export default {...base,testMatch:/ship-radius-gameplay\.spec\.js$/,outputDir:'/tmp/star-agent-ship-radius/results',use:{...base.use,baseURL:`http://127.0.0.1:${port}`},webServer:{...base.webServer,command:`npm run build && npm run preview -- --port ${port} --strictPort`,url:`http://127.0.0.1:${port}`}};
