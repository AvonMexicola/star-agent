import base from './base-scene.config.js';
const port=5561;
export default {...base,testMatch:/build-sandbox\.spec\.js$/,grep:/marked and lit Nomad/,outputDir:'/home/cees/.cache/star-agent-pad-results',use:{...base.use,baseURL:`http://127.0.0.1:${port}`},webServer:{...base.webServer,command:`MULTIPLAYER_SERVER=http://127.0.0.1:8557 npm run build && MULTIPLAYER_SERVER=http://127.0.0.1:8557 npm run preview -- --port ${port} --strictPort`,url:`http://127.0.0.1:${port}`}};
