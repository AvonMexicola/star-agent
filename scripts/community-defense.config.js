import {defineConfig} from '@playwright/test';
import community from './community-hub.config.js';

// Reuse the same disposable memory API and production build. This fixture must
// be scheduled separately from community-hub: both own ports 5564 and 8098.
const output=process.env.COMMUNITY_DEFENSE_OUTPUT??process.env.COMMUNITY_OUTPUT??'/home/cees/projects/.community-hub-qa/defense-01';
export default defineConfig({
  ...community,
  testMatch:'community-defense.spec.js',
  outputDir:output+'/test-output',
  workers:1,
  retries:0,
});
