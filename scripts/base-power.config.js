import base from './base-scene.config.js';
const port=5556;
export default {...base,testMatch:/base-power\.spec\.js$/,outputDir:'/home/cees/.cache/star-agent-base-power-results',use:{...base.use,baseURL:`http://127.0.0.1:${port}`},webServer:{...base.webServer,command:`npm run build && npm run preview -- --port ${port} --strictPort`,url:`http://127.0.0.1:${port}`}};
