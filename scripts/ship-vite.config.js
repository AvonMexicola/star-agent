import { defineConfig } from 'vite';
// Give the studio its own dependency cache while parallel feature dev servers run.
export default defineConfig({ base: './', cacheDir: '/tmp/star-agent-ship-vite-cache' });
