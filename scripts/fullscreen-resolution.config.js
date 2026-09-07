import base from './flight-options.config.js';
export default {...base,testMatch:'fullscreen-resolution.spec.js',outputDir:'/tmp/star-agent-fullscreen-results',use:{...base.use,viewport:{width:1000,height:650},contextOptions:{screen:{width:1600,height:900}},deviceScaleFactor:2}};
