import {build,mergeConfig} from 'vite';
import base from '../../vite.config.js';
import {resolve} from 'node:path';
await build(mergeConfig(base,{configFile:false,build:{rollupOptions:{input:{handheldQA:resolve('tests/handheld-tools/fixture.html'),toolHDR:resolve('tests/tool-visual/fixture.html')}}}}));
