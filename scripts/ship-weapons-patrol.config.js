import {defineConfig} from '@playwright/test';
import weapons from './ship-weapons.config.js';
export default defineConfig({...weapons,testMatch:['space-combat.spec.js','kestrel-flight.spec.js'],timeout:240000,outputDir:(process.env.SHIP_WEAPONS_OUTPUT??'/tmp/star-agent-ship-weapons')+'/patrol-output'});
