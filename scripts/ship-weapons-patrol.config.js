import {defineConfig} from '@playwright/test';
import weapons from './ship-weapons.config.js';
export default defineConfig({...weapons,testMatch:'space-combat.spec.js',timeout:240000,outputDir:'/tmp/star-agent-ship-weapons/patrol-output'});
