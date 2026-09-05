import base from '../playwright.config.js';
const port=4184;
export default {
  ...base,testDir:'.',testMatch:'moon.spec.js',outputDir:'/tmp/star-agent-moon-evidence/results',
  use:{...base.use,baseURL:`http://127.0.0.1:${port}`},
  webServer:{...base.webServer,command:`npm run build && npm run preview -- --port ${port} --strictPort`,url:`http://127.0.0.1:${port}`},
};
