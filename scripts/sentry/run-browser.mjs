import {readdir,readFile,readlink,mkdir,writeFile,appendFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'../..'),journal=process.env.SENTRY_JOURNAL??path.join(root,'HANDOFF.md');
const selection=process.argv.slice(2),guardOnly=selection.length===1&&selection[0]==='--guard-only';
if(!guardOnly&&(selection.length>2||selection.length&&selection[0]!=='--grep'))throw Error('Use --guard-only or one optional Playwright --grep.');
const stamp=new Date().toISOString().replaceAll(':','-'),output=path.join(root,'test-results','sentry-'+stamp);
await mkdir(output,{recursive:true});
const jobs=[];
for(const id of (await readdir('/proc')).filter(x=>/^\d+$/.test(x))){
  try{
    const exe=await readlink('/proc/'+id+'/exe'),args=(await readFile('/proc/'+id+'/cmdline','utf8')).split('\0').filter(Boolean);
    // Chromium may rewrite /proc/cmdline as one space-joined argument. Inspect
    // flag words while retaining the original argv in the private receipt.
    const words=args.flatMap(a=>a.split(/\s+/));
    const chromium=/\/(chromium|chrome|chrome-headless-shell)$/.test(exe)&&words.some(a=>a==='--remote-debugging-pipe'||a==='--test-type'||a.startsWith('--test-type='));
    const cli=words.includes('test')&&words.some(a=>/(?:\/\.bin\/playwright|\/(?:@playwright\/test|playwright)\/cli\.js)$/.test(a));
    const testWorker=words.some(a=>/\/playwright\/lib\/worker\/worker(?:Main|ProcessEntry)\.js$/.test(a));
    const worker=/\/(node|npm)$/.test(exe)&&(cli||testWorker);
    if(chromium||worker)jobs.push({pid:Number(id),exe,args});
  }catch{}
}
await writeFile(path.join(output,'process-guard.json'),JSON.stringify({time:new Date().toISOString(),jobs},null,2));
if(jobs.length){console.error('GPU busy; no Sentry browser launched. Guard:',output);process.exit(2);}
if(guardOnly){console.log('GPU guard clear; read-only check, no Sentry browser launched. Guard:',output);process.exit(0);}
const sourceFiles=[...(await readdir(path.join(root,'src/sentry'))).filter(n=>/\.(js|css)$/.test(n)).map(n=>'src/sentry/'+n),'src/rover-carrier.js','src/rover-physics.js','src/rover-support.js','src/multiplayer/client.js','src/multiplayer/remote-players.js','src/inventory/ship-access.js','src/combat/ship-occupancy.js','scripts/sentry/run-browser.mjs','scripts/sentry/sentry.config.js','scripts/sentry/sentry.spec.js','scripts/sentry/eva-feedback.mjs','src/main.js','src/multiplayer/protocol.js','server/sentry.js','server/room.js','server/index.js','server/world.js','src/navigation.js','src/navigation-rotation.js','src/planet-rotation.js','src/planet-render-frames.js','server/security.js','server/combat.js','public/models/burrow-sentry.glb'];
const hashes=async()=>Object.fromEntries(await Promise.all(sourceFiles.map(async name=>[name,createHash('sha256').update(await readFile(path.join(root,name))).digest('hex')])));
const before=await hashes();await writeFile(path.join(output,'source-before.json'),JSON.stringify(before,null,2));
const tmp=process.env.SENTRY_TMPDIR??path.join(root,'test-results','tmp');await mkdir(tmp,{recursive:true});
await appendFile(journal,`\n\nSA-VEH-003 GPU ${new Date().toISOString()}: ACQUIRED at actual host executable/argv guard, one 5678/API8678 Sentry job, single worker/no retries, disk-backed TMPDIR. Frozen source receipt ${output}. ${selection.join(' ')}\n`);
console.log('Sentry evidence:',output);
const log=await import('node:fs').then(fs=>fs.createWriteStream(path.join(output,'runner.log')));
let child=null,signal=null;
const stop=name=>{signal=name;if(child)try{process.kill(-child.pid,'SIGTERM');}catch{}};
process.once('SIGINT',()=>stop('SIGINT'));process.once('SIGTERM',()=>stop('SIGTERM'));
async function run(args,extra={}){
  child=spawn('npm',args,{cwd:root,env:{...process.env,...extra,SENTRY_OUTPUT:output,TMPDIR:tmp},stdio:['ignore','pipe','pipe'],detached:true});
  for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{log.write(chunk);process.stdout.write(chunk);});
  const code=await new Promise(resolve=>{child.once('error',error=>{console.error(error);resolve(1);});child.once('exit',code=>resolve(code??1));});child=null;return code;
}
let code=1,buildReceipt;
try{
  // The guarded QA command owns its production entry flags. A prior ordinary
  // public build must never silently supply this explicit local feature route.
  const flags={VITE_DEV_TOOLS:'1',VITE_MULTIPLAYER_ENTRY:'1'},started=new Date().toISOString();
  const buildCode=await run(['run','build'],flags);
  const files=buildCode===0?['index.html',...(await readdir(path.join(root,'dist/assets'))).filter(name=>/\.(js|css)$/.test(name)).sort().map(name=>'assets/'+name)]:[];
  const bundles=Object.fromEntries(await Promise.all(files.map(async name=>[name,createHash('sha256').update(await readFile(path.join(root,'dist',name))).digest('hex')])));
  buildReceipt={started,completed:new Date().toISOString(),code:buildCode,command:'npm run build',flags,node:process.version,source:before,bundles};
  await writeFile(path.join(output,'build-receipt.json'),JSON.stringify(buildReceipt,null,2));
  code=buildCode===0&&!signal?await run(['run','test:browser','--','-c','scripts/sentry/sentry.config.js',...selection]):buildCode||1;
}catch(error){console.error(error);log.write(String(error)+'\n');}
const after=await hashes(),changed=sourceFiles.filter(name=>before[name]!==after[name]);
await writeFile(path.join(output,'receipt.json'),JSON.stringify({completed:new Date().toISOString(),code,signal,changed,before,after,build:buildReceipt},null,2));
await appendFile(journal,`\n\nSA-VEH-003 GPU ${new Date().toISOString()}: RELEASED, focused runner exit ${code}; changed sources ${JSON.stringify(changed)}. Original ${output} retained. No automatic repeat.\n`);
log.end();process.exitCode=code||Number(changed.length>0);
