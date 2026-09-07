import {defineConfig} from '@playwright/test';
import config from './kestrel.config.js';
export default defineConfig({...config,testMatch:'kestrel-performance.spec.js',timeout:150000,
 use:{...config.use,viewport:{width:1440,height:900},launchOptions:{...config.use.launchOptions,args:['--no-sandbox','--enable-gpu','--ignore-gpu-blocklist','--disable-dev-shm-usage','--use-gl=angle','--use-angle=gl']}}
});
