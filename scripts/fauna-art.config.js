import base from './fauna.config.js';
export default {...base,testMatch:/fauna-art\.spec\.js$/,outputDir:'../test-results/fauna-art',timeout:240000,use:{...base.use,video:{mode:'on',size:{width:1280,height:800}}}};
