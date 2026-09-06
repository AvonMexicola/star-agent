import base from '../playwright.config.js';
const port=4210;
export default {...base,testDir:'.',testMatch:/(ship-marker|ring-visibility|asteroid-aim|expedition-regressions|resource-survey|controller-gameplay|container-inventory|eva|space-mining|mining|moon)\.spec\.js$/,outputDir:'/tmp/star-agent-expedition-evidence/results',use:{...base.use,viewport:{width:1440,height:900},baseURL:`http://127.0.0.1:${port}`},webServer:{...base.webServer,command:`npm run build && npm run preview -- --port ${port} --strictPort`,url:`http://127.0.0.1:${port}`}};
