import base from '../playwright.config.js';
const port=53760;
export default {...base,testDir:'.',testMatch:'star.spec.js',timeout:600000,
 outputDir:'/tmp/star-agent-stellar/results',use:{...base.use,viewport:{width:1100,height:750},baseURL:`http://127.0.0.1:${port}`},
 webServer:{...base.webServer,command:`npm run build && npm run preview -- --port ${port} --strictPort`,url:`http://127.0.0.1:${port}`}};
