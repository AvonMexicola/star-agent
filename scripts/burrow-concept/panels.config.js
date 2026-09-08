import {defineConfig} from '@playwright/test';
import gameplay from './gameplay.config.js';

const output = process.env.BURROW_OUTPUT ?? '/tmp/burrow-concept-panels';
export default defineConfig({
  ...gameplay, testDir: '.', testMatch: 'panels.spec.js', timeout: 180000,
  outputDir: output + '/test-output',
  projects: [
    {name: 'keyboard'},
    {name: 'touch', use: {viewport: {width: 390, height: 844}, hasTouch: true}},
  ],
});
