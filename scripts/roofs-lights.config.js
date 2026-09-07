import base from './base-power.config.js';
const port=5561;
export default {...base,testMatch:/roofs-lights\.spec\.js$/,outputDir:'/home/cees/.cache/star-agent-roofs-lights-results',use:{...base.use,baseURL:`http://127.0.0.1:${port}`},webServer:{...base.webServer,command:`npm run build && MULTIPLAYER_SERVER=http://127.0.0.1:8557 npm run preview -- --port ${port} --strictPort`,url:`http://127.0.0.1:${port}`}};
