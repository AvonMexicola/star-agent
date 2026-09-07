import base from './fleet-engine.config.js';
export default {...base,testMatch:'fleet-development.spec.js',timeout:360000,
  outputDir:`../test-results/fleet-development-${Date.now()}`};
