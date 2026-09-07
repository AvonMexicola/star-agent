import base from './expedition.config.js';
const port=4271;
export default {...base,testMatch:/(loadout|loadout-ui|controller-gameplay|mining-particles|space-mining|container-inventory)\.spec\.js$/,outputDir:'/tmp/star-agent-loadout-evidence/results',use:{...base.use,baseURL:`http://127.0.0.1:${port}`},webServer:{...base.webServer,command:`npm run build && npm run preview -- --port ${port} --strictPort`,url:`http://127.0.0.1:${port}`}};
