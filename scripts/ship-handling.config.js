import {defineConfig} from '@playwright/test';
import base from './flight-options.config.js';
export default defineConfig({...base,testMatch:'ship-handling.spec.js',outputDir:'/tmp/star-agent-handling-results'});
