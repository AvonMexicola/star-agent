import { defineConfig } from '@playwright/test';
import release from './compounds-release.config.js';

// Reuse the same entry and marker journeys for frozen builds and public HTTPS.
const live = process.env.NAV_RELEASE_LIVE === '1';
export default defineConfig({
  ...release,
  testMatch: ['direct-entry.spec.js', 'compounds-release.spec.js', 'focused-location-arrows.spec.js'],
  use: { ...release.use, baseURL: live ? 'https://play.staragent.site' : release.use.baseURL },
  webServer: live ? undefined : release.webServer,
});
