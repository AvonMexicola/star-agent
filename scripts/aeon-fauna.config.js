import base from './fauna.config.js';
export default {...base,testMatch:/aeon-fauna\.spec\.js$/,outputDir:'../test-results/aeon-fauna',timeout:420000,use:{...base.use,baseURL:'http://127.0.0.1:5517',video:{mode:'on',size:{width:1280,height:800}}}};
