import base from './main-integration.config.js';
export default {...base,testMatch:['scripts/loadout.spec.js','scripts/loadout-ui.spec.js','scripts/atlas-mark-ii.spec.js'],timeout:360000,outputDir:'/tmp/star-agent-main-extra-results'};
