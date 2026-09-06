import base from '../playwright.config.js';
const port=4193;
export default {...base,testDir:'.',testMatch:'mining.spec.js',outputDir:'/tmp/star-agent-mining-evidence/results',use:{...base.use,viewport:{width:1440,height:900},baseURL:`http://127.0.0.1:${port}`},webServer:{...base.webServer,command:`npm run build && npm run preview -- --port ${port} --strictPort`,url:`http://127.0.0.1:${port}`}};
