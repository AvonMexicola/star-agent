import base from './build-ui.config.js';const port=4208;
export default {...base,testMatch:/ship-access-ui\.spec\.js$/,outputDir:'/tmp/star-agent-ship-radius/ui-results',use:{...base.use,baseURL:`http://127.0.0.1:${port}`},webServer:{...base.webServer,command:`npm run dev -- --port ${port} --strictPort`,url:`http://127.0.0.1:${port}`}};
