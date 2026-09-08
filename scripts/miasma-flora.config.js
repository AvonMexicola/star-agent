import base from './miasma.config.js';
const port=53763;
export default {...base,testMatch:'miasma-flora.spec.js',outputDir:'/tmp/star-agent-miasma-flora/results',use:{...base.use,baseURL:`http://127.0.0.1:${port}`},webServer:{...base.webServer,command:`npm run build && npm run preview -- --port ${port} --strictPort`,url:`http://127.0.0.1:${port}`}};
