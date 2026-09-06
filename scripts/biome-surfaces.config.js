import base from '../playwright.config.js';
const port=Number(process.env.BIOME_PORT||53747);
export default {...base,testDir:'.',testMatch:'biome-surfaces.spec.js',timeout:480000,
  outputDir:'/tmp/star-agent-biomes/results',projects:[{name:'before'},{name:'after'}],
  use:{...base.use,viewport:{width:1280,height:800},baseURL:`http://127.0.0.1:${port}`},
  webServer:{...base.webServer,command:`${process.env.BIOME_REUSE_BUILD?'':'npm run build && '}npm run preview -- --port ${port} --strictPort`,url:`http://127.0.0.1:${port}`}};
