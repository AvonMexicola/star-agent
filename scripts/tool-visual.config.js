import base from '../playwright.config.js';
const port=4205;
export default {...base,testDir:'../tests/tool-visual',testMatch:/visual\.spec\.js$/,outputDir:'/tmp/star-agent-tool-visual-evidence/results',use:{...base.use,viewport:{width:1000,height:700},baseURL:`http://127.0.0.1:${port}`},webServer:{...base.webServer,command:`npm run dev -- --port ${port} --strictPort`,url:`http://127.0.0.1:${port}`}};
