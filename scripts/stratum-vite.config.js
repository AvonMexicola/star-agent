import { defineConfig } from 'vite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, copyFile } from 'node:fs/promises';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
/** Independent studio build: does not change the main game entries/package. */
export default defineConfig({
  root,base:'/',publicDir:false,cacheDir:resolve(root,'node_modules/.vite-stratum'),
  plugins:[{name:'stratum-runtime-model',async closeBundle(){await mkdir(resolve(root,'dist/stratum/models'),{recursive:true});await copyFile(resolve(root,'public/models/stratum.glb'),resolve(root,'dist/stratum/models/stratum.glb'));}}],
  build:{outDir:'dist/stratum',emptyOutDir:true,rollupOptions:{input:resolve(root,'public/dev/stratum.html')}},
  server:{host:'127.0.0.1',port:5580,strictPort:true},preview:{host:'127.0.0.1',port:5580,strictPort:true},
});
