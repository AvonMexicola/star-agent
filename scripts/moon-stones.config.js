import base from '../playwright.config.js';
const port=53755;
export default {...base,testDir:'.',testMatch:'moon-stones.spec.js',timeout:420000,
 outputDir:'/tmp/star-agent-moon-stones/results',use:{...base.use,viewport:{width:960,height:600},baseURL:`http://127.0.0.1:${port}`},
 webServer:{...base.webServer,command:`npm run build && npm run preview -- --port ${port} --strictPort`,url:`http://127.0.0.1:${port}`}};
