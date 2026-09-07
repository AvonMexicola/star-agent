import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const STUDIO_SCRIPT = '/assets/atlas-mark-ii-studio.js';
const STUDIO_STYLE = '/assets/atlas-mark-ii-studio.css';

/** Keep the standalone studio's URLs identical in source and production builds. */
function atlasMarkIIStudioDevEntries() {
  return {
    name: 'atlas-mark-ii-studio-dev-entries',
    configureServer(server) {
      server.middlewares.use((request, _response, next) => {
        if (request.url?.startsWith('/assets/avatar-studio.js')) request.url = request.url.replace('/assets/avatar-studio.js', '/src/avatar-studio.js');
        if (request.url?.startsWith('/assets/avatar-studio.css')) request.url = request.url.replace('/assets/avatar-studio.css', '/src/avatar-studio.css');
        if (request.url?.startsWith(STUDIO_SCRIPT)) request.url = request.url.replace(STUDIO_SCRIPT, '/src/atlas-mark-ii-studio.js');
        if (request.url?.startsWith(STUDIO_STYLE)) request.url = request.url.replace(STUDIO_STYLE, '/src/atlas-mark-ii-studio.css');
        next();
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [atlasMarkIIStudioDevEntries()],
  build: {
    rollupOptions: {
      input: {
        main: resolve('index.html'),
        effects: resolve('effects/index.html'),
        avatarStudio: resolve('src/avatar-studio.js'),
        avatarStudioStyle: resolve('src/avatar-studio.css'),
        atlasMarkIIStudio: resolve('src/atlas-mark-ii-studio.js'),
        atlasMarkIIStudioStyle: resolve('src/atlas-mark-ii-studio.css'),
      },
      output: {
        entryFileNames(chunk) {
          if (chunk.name === 'avatarStudio') return 'assets/avatar-studio.js';
          return chunk.name === 'atlasMarkIIStudio'
            ? 'assets/atlas-mark-ii-studio.js'
            : 'assets/[name]-[hash].js';
        },
        assetFileNames(asset) {
          const sourceNames = [asset.name, ...(asset.names ?? [])].filter(Boolean);
          if (sourceNames.some(name => name.toLowerCase().replaceAll(/[^a-z0-9]/g, '').includes('avatarstudio'))) return 'assets/avatar-studio.css';
          return sourceNames.some(name => name.toLowerCase().replaceAll(/[^a-z0-9]/g, '').includes('atlasmarkiistudio'))
            ? 'assets/atlas-mark-ii-studio.css'
            : 'assets/[name]-[hash][extname]';
        },
      },
    },
  },
});
