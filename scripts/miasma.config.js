import base from '../playwright.config.js';
const port=53762;
export default {...base,testDir:'.',testMatch:'miasma.spec.js',timeout:600000,
 outputDir:'/tmp/star-agent-miasma/results',use:{...base.use,viewport:{width:1280,height:800},baseURL:`http://127.0.0.1:${port}`},
 webServer:{...base.webServer,command:`npm run build && npm run preview -- --port ${port} --strictPort`,url:`http://127.0.0.1:${port}`}};
