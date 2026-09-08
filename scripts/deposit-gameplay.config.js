import base from './build-gameplay.config.js';
const port=4278;
export default {...base,testMatch:/deposit-gameplay\.spec\.js$/,outputDir:'/tmp/star-agent-deposit-gameplay/results',use:{...base.use,baseURL:`http://127.0.0.1:${port}`},webServer:{...base.webServer,command:`npm run build && npm run preview -- --port ${port} --strictPort`,url:`http://127.0.0.1:${port}`}};
