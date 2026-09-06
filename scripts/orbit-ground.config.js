import base from '../playwright.config.js';
const port=53743;
export default {...base,testDir:'.',testMatch:'orbit-ground.spec.js',timeout:480000,
  outputDir:'/tmp/star-agent-orbit-ground/results',
  projects:[{name:'before'},{name:'after'}],
  use:{...base.use,viewport:{width:1280,height:800},baseURL:`http://127.0.0.1:${port}`},
  webServer:{...base.webServer,command:`${process.env.ORBIT_REUSE_BUILD ? '' : 'npm run build && '}npm run preview -- --port ${port} --strictPort`,url:`http://127.0.0.1:${port}`}};
