import base from './base-scene.config.js';
const port=4288;
export default {...base,testMatch:/base-polish\.spec\.js$/,outputDir:'/tmp/star-agent-base-polish/results',use:{...base.use,baseURL:`http://127.0.0.1:${port}`},webServer:{...base.webServer,command:`npm run build && npm run preview -- --port ${port} --strictPort`,url:`http://127.0.0.1:${port}`}};
