import base from '../playwright.config.js';
const port=53753;
export default {...base,testDir:'.',testMatch:'meadow.spec.js',timeout:480000,
 outputDir:'/tmp/star-agent-meadow/results',use:{...base.use,viewport:{width:960,height:600},baseURL:`http://127.0.0.1:${port}`},
 webServer:{...base.webServer,command:`npm run build && npm run preview -- --port ${port} --strictPort`,url:`http://127.0.0.1:${port}`}};
