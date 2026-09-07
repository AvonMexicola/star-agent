import base from './community-hub.config.js';
const output='test-results/fleet-community';
export default {...base,
  testMatch:['community-hub.spec.js','community-defense.spec.js'],
  grep:/controller:|controller witness:/,
  outputDir:'../'+output+'/results',
  webServer:[base.webServer[0],{...base.webServer[1],
    command:'VITE_MULTIPLAYER_ENTRY=1 VITE_DEV_TOOLS=1 npm run build -- --outDir '+output+'/dist && MULTIPLAYER_SERVER=http://127.0.0.1:8098 npm run preview -- --host 127.0.0.1 --port 5564 --strictPort --outDir '+output+'/dist'}],
};
