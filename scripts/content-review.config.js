import {defineConfig} from '@playwright/test';
import {mkdirSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
const cache=process.env.CONTENT_REVIEW_CACHE||join(homedir(),'.cache','star-agent-content-review');
process.env.TMPDIR=join(homedir(),'.cache','sa-int-tmp');
process.env.CHARACTER_EVIDENCE=join(cache,'character');
for(const dir of [process.env.TMPDIR,process.env.CHARACTER_EVIDENCE])mkdirSync(dir,{recursive:true});
export default defineConfig({testDir:'.',testMatch:['content-review.spec.js','character.spec.js'],workers:1,retries:0,timeout:180000,reporter:'list',outputDir:join(cache,'browser-results'),
 use:{baseURL:process.env.CONTENT_REVIEW_URL||'http://127.0.0.1:5523',viewport:{width:1440,height:900},actionTimeout:15000,
  launchOptions:{executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox','--enable-gpu','--ignore-gpu-blocklist','--use-gl=angle','--use-angle=gl','--disable-dev-shm-usage']}}});
