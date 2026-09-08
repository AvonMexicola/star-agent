import {readdir,readFile,readlink,mkdir,writeFile,appendFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'../..'),journal=process.env.SENTRY_JOURNAL??path.join(root,'HANDOFF.md');
const stamp=new Date().toISOString().replaceAll(':','-'),output=path.join(root,'test-results','sentry-'+stamp);
await mkdir(output,{recursive:true});
const jobs=[];
for(const id of (await readdir('/proc')).filter(x=>/^\d+$/.test(x))){
  try{
    const exe=await readlink('/proc/'+id+'/exe'),args=(await readFile('/proc/'+id+'/cmdline','utf8')).split('\0').filter(Boolean);
    const chromium=/\/(chromium|chrome|chrome-headless-shell)$/.test(exe)&&args.some(a=>a==='--remote-debugging-pipe'||a.startsWith('--test-type'));
    const worker=/\/(node|npm)$/.test(exe)&&args.some(a=>/playwright.*(?:cli\.js|workerMain\.js|\/test)/.test(a))&&args.includes('test');
    if(chromium||worker)jobs.push({pid:Number(id),exe,args});
  }catch{}
}
await writeFile(path.join(output,'process-guard.json'),JSON.stringify({time:new Date().toISOString(),jobs},null,2));
if(jobs.length){console.error('GPU busy; no Sentry browser launched. Guard:',output);process.exit(2);}
const sourceFiles=[...(await readdir(path.join(root,'src/sentry'))).filter(n=>/\.(js|css)$/.test(n)).map(n=>'src/sentry/'+n),'src/rover-carrier.js','src/rover-physics.js','src/rover-support.js','src/multiplayer/client.js','src/multiplayer/remote-players.js','src/inventory/ship-access.js','src/combat/ship-occupancy.js','scripts/sentry/run-browser.mjs','scripts/sentry/sentry.config.js','scripts/sentry/sentry.spec.js','scripts/sentry/eva-feedback.mjs','src/main.js','src/multiplayer/protocol.js','server/sentry.js','server/room.js','server/security.js','server/combat.js','public/models/burrow-sentry.glb'];
const hashes=async()=>Object.fromEntries(await Promise.all(sourceFiles.map(async name=>[name,createHash('sha256').update(await readFile(path.join(root,name))).digest('hex')])));
const before=await hashes();await writeFile(path.join(output,'source-before.json'),JSON.stringify(before,null,2));
const tmp=process.env.SENTRY_TMPDIR??path.join(root,'test-results','tmp');await mkdir(tmp,{recursive:true});
const selection=process.argv.slice(2);if(selection.length>2||selection.length&&selection[0]!=='--grep')throw Error('Only one optional Playwright grep is accepted.');
await appendFile(journal,`\n\nSA-VEH-003 GPU ${new Date().toISOString()}: ACQUIRED at actual host executable/argv guard, one 5678/API8678 Sentry job, single worker/no retries, disk-backed TMPDIR. Frozen source receipt ${output}. ${selection.join(' ')}\n`);
console.log('Sentry evidence:',output);
const log=await import('node:fs').then(fs=>fs.createWriteStream(path.join(output,'runner.log')));
const child=spawn('npm',['run','test:browser','--','-c','scripts/sentry/sentry.config.js',...selection],{cwd:root,env:{...process.env,SENTRY_OUTPUT:output,TMPDIR:tmp},stdio:['ignore','pipe','pipe'],detached:true});
for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{log.write(chunk);process.stdout.write(chunk);});
let signal=null;const stop=name=>{signal=name;try{process.kill(-child.pid,'SIGTERM');}catch{}};
process.once('SIGINT',()=>stop('SIGINT'));process.once('SIGTERM',()=>stop('SIGTERM'));
const code=await new Promise(resolve=>{child.once('error',error=>{console.error(error);resolve(1);});child.once('exit',code=>resolve(code??1));});
const after=await hashes(),changed=sourceFiles.filter(name=>before[name]!==after[name]);
await writeFile(path.join(output,'receipt.json'),JSON.stringify({completed:new Date().toISOString(),code,signal,changed,before,after},null,2));
await appendFile(journal,`\n\nSA-VEH-003 GPU ${new Date().toISOString()}: RELEASED, focused runner exit ${code}; changed sources ${JSON.stringify(changed)}. Original ${output} retained. No automatic repeat.\n`);
log.end();process.exitCode=code||Number(changed.length>0);
