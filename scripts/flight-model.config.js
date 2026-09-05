import base from './station.config.js';

export default {
  ...base,
  testMatch: ['flight-model.spec.js', 'station.spec.js'],
  outputDir: '/tmp/star-agent-flight/results',
};
