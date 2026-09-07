import { defineConfig } from '@playwright/test';
import launch from './public-launch.config.js';
export default defineConfig({ ...launch, testMatch:'public-arrival.spec.js', timeout:420000,
  outputDir:'../test-results/public-arrival' });
