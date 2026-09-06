import base from '../playwright.config.js';
const port=4201;
export default {...base,testDir:'.',testMatch:/controller-ui\.spec\.js$/,outputDir:'/tmp/star-agent-controller-evidence/results',use:{...base.use,viewport:{width:1024,height:768},baseURL:`http://127.0.0.1:${port}`},webServer:{...base.webServer,command:`npm run dev -- --port ${port} --strictPort`,url:`http://127.0.0.1:${port}`}};
