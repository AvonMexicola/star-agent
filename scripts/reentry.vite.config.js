import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  build:{outDir:'/tmp/star-agent-reentry-build',emptyOutDir:true,rollupOptions:{input:{
    main:fileURLToPath(new URL('../index.html',import.meta.url)),
    reentry:fileURLToPath(new URL('./reentry-fixture.html',import.meta.url)),
  }}},
});
