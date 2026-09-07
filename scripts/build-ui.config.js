import base from '../playwright.config.js';
const port=4207;
export default {...base,testDir:'.',testMatch:/build-ui\.spec\.js$/,outputDir:'/tmp/star-agent-build-ui/results',use:{...base.use,viewport:{width:1440,height:900},baseURL:`http://127.0.0.1:${port}`},webServer:{...base.webServer,command:`npm run dev -- --port ${port} --strictPort`,url:`http://127.0.0.1:${port}`}};
