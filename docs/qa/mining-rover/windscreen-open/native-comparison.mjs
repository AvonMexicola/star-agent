// Bounded producer-operated native comparison, reusing the established rover
// fixture's exact scene, PBR policy, lights, shadow fit and canonical pilot eye.
// Preparation is not execution. Acquire the shared GPU window before running.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';

const ROOT=path.resolve(process.env.ROVER_REVIEW_ROOT??fileURLToPath(new URL('../../../../',import.meta.url)));
const OUT=path.resolve(process.env.ROVER_REVIEW_OUT??'/tmp/star-agent-rover-windscreen-native');
const PORT=Number(process.env.ROVER_REVIEW_PORT);
const BEFORE=process.env.ROVER_BEFORE_GLB;
if(!BEFORE||!Number.isInteger(PORT)||PORT<1024)throw Error('Set ROVER_BEFORE_GLB and an allocated ROVER_REVIEW_PORT.');
if(OUT===ROOT||OUT.startsWith(ROOT+path.sep))throw Error('Raw capture output must stay outside the repository.');
const BEFORE_SHA='88448d9dd48e0a0acdb2397465302e8ab41335b8ffaab6234050d136bf6cc78f';
const AFTER_SHA='831b9569633efda11652e3827057d2f4bc3f47d20f23a47df152fa437cb29468';
const HUMAN_SHA='8a46b5b09f0659661a0e4373db159f9b87d43136144e118e908265f45ba6a52d';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const baseline=await fs.readFile(BEFORE),candidate=await fs.readFile(path.join(ROOT,'public/models/mining-rover.glb'));
if(sha(baseline)!==BEFORE_SHA||sha(candidate)!==AFTER_SHA)throw Error('Frozen before/after asset hash mismatch.');
const layoutRaw=await fs.readFile(path.join(ROOT,'assets/mining-rover/layout.json'),'utf8');
const source=await fs.readFile(path.join(ROOT,'scripts/rover-review/capture.mjs'),'utf8');
const begin='const fixture=String.raw`',end='`.replace(',start=source.indexOf(begin),stop=source.indexOf(end,start);
if(start<0||stop<0)throw Error('Established native fixture extraction anchors changed.');
let fixture=source.slice(start+begin.length,stop);
function replaceOnce(from,to){if(fixture.split(from).length!==2)throw Error('Established native fixture anchor changed: '+from);fixture=fixture.replace(from,to);}
replaceOnce("const L=__LAYOUT__,HASH='__HASH__',HUMAN='__HUMAN__',DIAGNOSTIC=__DIAGNOSTIC__;",
  "const L=__LAYOUT__,BEFORE=new URLSearchParams(location.search).get('before')==='1',HASH=BEFORE?'__BEFORE_HASH__':'__HASH__',HUMAN='__HUMAN__',DIAGNOSTIC=false;");
replaceOnce("load('/models/mining-rover.glb',HASH)","load(BEFORE?'/__rover_before.glb':'/models/mining-rover.glb',HASH)");
fixture=fixture.replace('__LAYOUT__',layoutRaw).replace('__BEFORE_HASH__',BEFORE_SHA).replace('__HASH__',AFTER_SHA).replace('__HUMAN__',HUMAN_SHA);
await fs.mkdir(OUT,{recursive:true});
if(process.argv.includes('--prepare-only')){
  await fs.writeFile(path.join(OUT,'native-module.mjs'),fixture);
  console.log(JSON.stringify({prepared:true,fixtureSourceSHA:sha(source),beforeSHA:BEFORE_SHA,afterSHA:AFTER_SHA,browserLaunched:false}));
  process.exit(0);
}
const TMP=process.env.ROVER_BROWSER_TMP??'/tmp/rv-ws11';await fs.mkdir(TMP,{recursive:true});
const {createServer}=await import(pathToFileURL(path.join(ROOT,'node_modules/vite/dist/node/index.js')));
const {chromium}=await import(pathToFileURL(path.join(ROOT,'node_modules/@playwright/test/index.mjs')));
const server=await createServer({root:ROOT,configFile:false,server:{host:'127.0.0.1',port:PORT,strictPort:true},plugins:[{name:'rover-windscreen-paired-native',resolveId:id=>id==='/__rover_review_module'?id:null,load:id=>id==='/__rover_review_module'?fixture:null}]});
await server.listen();
const report={complete:false,scope:'Isolated native PBR cockpit comparison; no gameplay, independent art score, or FPS claim',builder:'/root/nomad_cutter',fixtureSource:'scripts/rover-review/capture.mjs',fixtureSourceSHA:sha(source),sourceCommit:execFileSync('git',['-C',ROOT,'rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceDirty:Boolean(execFileSync('git',['-C',ROOT,'status','--porcelain'],{encoding:'utf8'}).trim()),layoutSHA:sha(layoutRaw),beforeSHA:BEFORE_SHA,afterSHA:AFTER_SHA,images:[],messages:[]};
let browser,timedOut=false;const started=Date.now(),timer=setTimeout(()=>{timedOut=true;if(browser)void browser.close().catch(()=>{});},20000);
const remaining=()=>Math.max(1,20000-(Date.now()-started));
try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',env:{...process.env,TMPDIR:TMP},args:['--no-sandbox','--enable-gpu','--ignore-gpu-blocklist','--use-gl=angle','--use-angle=gl','--disable-dev-shm-usage'],timeout:Math.min(10000,remaining())});
  report.browser=browser.version();const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
  page.on('pageerror',e=>report.messages.push({type:'pageerror',text:e.message}));page.on('console',m=>{if(['warning','error'].includes(m.type()))report.messages.push({type:m.type(),text:m.text()});});
  await page.route('**/__rover_before.glb',route=>route.fulfill({contentType:'model/gltf-binary',body:baseline}));
  await page.route(url=>url.pathname==='/__rover_review',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><style>html,body{margin:0;background:#18242b;color:#dce8e2;font:14px monospace}canvas{display:block}#caption{position:absolute;top:18px;left:22px;right:22px;pointer-events:none;line-height:1.4}</style><div id="caption"></div><script type="module" src="/__rover_review_module"></script>'}));
  for(const before of [true,false]){
    await page.goto(`http://127.0.0.1:${PORT}/__rover_review?before=${before?'1':'0'}`,{timeout:remaining()});
    await page.waitForFunction(()=>window.review?.ready,null,{timeout:remaining()});
    const file=before?'01-before-cockpit.png':'02-after-cockpit.png';
    const state=await page.evaluate(()=>({hash:review.HASH,...review.draw({cockpit:true,label:'BURROW / CANONICAL PILOT EYE / NATIVE PBR / UNCHANGED GLASS AND FRAME'})}));
    if(state.hash!==(before?BEFORE_SHA:AFTER_SHA))throw Error('Wrong native phase asset.');
    await page.screenshot({path:path.join(OUT,file),timeout:remaining()});report.images.push({file,...state});
  }
  if(timedOut||report.messages.length)throw Error(timedOut?'20-second native window exceeded':'Browser diagnostics: '+JSON.stringify(report.messages));
  if(JSON.stringify(report.images[0].position)!==JSON.stringify(report.images[1].position)||JSON.stringify(report.images[0].target)!==JSON.stringify(report.images[1].target)||JSON.stringify(report.images[0].shadowFrustum)!==JSON.stringify(report.images[1].shadowFrustum))throw Error('Paired camera or shadow frame changed.');
  report.complete=true;
}catch(error){report.failure=String(error.stack??error);throw error;}
finally{clearTimeout(timer);report.elapsedMs=Date.now()-started;await fs.writeFile(path.join(OUT,'capture.json'),JSON.stringify(report,null,2)+'\n');await browser?.close();await server.close();}
