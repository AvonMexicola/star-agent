import {defineConfig} from 'vite';
import {resolve} from 'node:path';
import {copyFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
const root=resolve(import.meta.dirname,'..'),qa=process.env.GANNET_QA_DIR??resolve(tmpdir(),'star-agent-gannet-qa'),out=resolve(qa,'build');
export default defineConfig({root,base:'/',publicDir:false,resolve:{preserveSymlinks:true},cacheDir:resolve(qa,'vite-cache'),
  server:{host:'127.0.0.1'},preview:{host:'127.0.0.1'},
  plugins:[{
    name:'gannet-isolated-studio',
    configureServer(server){server.middlewares.use((req,_res,next)=>{
      if(req.url?.startsWith('/assets/gannet-studio.'))req.url=req.url.replace('/assets/','/src/');
      if(req.url==='/')req.url='/public/dev/gannet.html';
      if(req.url?.startsWith('/models/'))req.url='/public'+req.url;
      next();
    });},
    async closeBundle(){
      await mkdir(resolve(out,'models'),{recursive:true});
      await copyFile(resolve(root,'public/dev/gannet.html'),resolve(out,'index.html'));
      for(const name of ['gannet','mining-rover'])await copyFile(resolve(root,`public/models/${name}.glb`),resolve(out,`models/${name}.glb`));
    },
  }],
  build:{outDir:out,emptyOutDir:true,rollupOptions:{input:{'gannet-studio':resolve(root,'src/gannet-studio.js'),'gannet-style':resolve(root,'src/gannet-studio.css')},output:{entryFileNames:'assets/[name].js',assetFileNames:asset=>asset.names?.some(n=>n.endsWith('.css'))?'assets/gannet-studio.css':'assets/[name]-[hash][extname]'}}},
});
