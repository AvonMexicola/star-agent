import base from './base-power.config.js';
const port=5559;
export default {...base,testMatch:/build-removal\.spec\.js$/,outputDir:'/home/cees/.cache/star-agent-build-removal-results',use:{...base.use,baseURL:`http://127.0.0.1:${port}`},webServer:{...base.webServer,command:`npm run build && npm run preview -- --port ${port} --strictPort`,url:`http://127.0.0.1:${port}`}};
