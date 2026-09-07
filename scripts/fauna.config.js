import base from '../playwright.config.js';
import {mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const repo=resolve(dirname(fileURLToPath(import.meta.url)),'..');
let tempRoot=repo;
try{tempRoot=resolve(repo,execFileSync('git',['rev-parse','--git-common-dir'],{cwd:repo,encoding:'utf8'}).trim(),'..');}catch{/* Exported source tree; FAUNA_TMPDIR can supply a shorter path. */}
// Keep this job off a quota-limited system/tmp and under the checkout's ignored output.
process.env.TMPDIR=process.env.FAUNA_TMPDIR||join(tempRoot,'test-results','fau-tmp');
mkdirSync(process.env.TMPDIR,{recursive:true});
export default {...base,testDir:'.',testMatch:/fauna\.spec\.js$/,outputDir:'../test-results/fauna',timeout:420000,use:{...base.use,baseURL:'http://127.0.0.1:5516',viewport:{width:1280,height:800},launchOptions:{...base.use.launchOptions,args:['--use-gl=angle','--use-angle=gl','--ignore-gpu-blocklist','--no-sandbox','--disable-dev-shm-usage']}},webServer:undefined};
