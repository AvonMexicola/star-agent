import base from './fauna.config.js';
export default {...base,testMatch:/creature-rig\.spec\.js$/,outputDir:'../test-results/creature-rig',timeout:90000,use:{...base.use,baseURL:'http://127.0.0.1:5515',video:{mode:'on',size:{width:1280,height:800}}}};
