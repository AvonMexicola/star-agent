import base from './fleet-engine.config.js';
export default {...base,testDir:'../tests/browser',testMatch:'cargo-tractor.spec.js',
  outputDir:'../test-results/fleet-tractor',timeout:300000};
