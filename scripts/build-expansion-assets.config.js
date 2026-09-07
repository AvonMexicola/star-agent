import base from './build-ui.config.js';
export default {...base,testMatch:/build-expansion-assets\.spec\.js$/,outputDir:'/home/cees/.cache/star-agent-expansion-assets-results',use:{...base.use,launchOptions:{...base.use.launchOptions,args:['--no-sandbox','--use-gl=angle','--use-angle=gl','--enable-webgl','--disable-dev-shm-usage']}}};
