import base from './miasma.config.js';
const port=53766;
export default {...base,testMatch:'rock-formations.spec.js',timeout:900000,outputDir:'/tmp/star-agent-rocks/results',use:{...base.use,baseURL:`http://127.0.0.1:${port}`},webServer:{...base.webServer,command:`npm run build && npm run preview -- --port ${port} --strictPort`,url:`http://127.0.0.1:${port}`,timeout:120000}};
