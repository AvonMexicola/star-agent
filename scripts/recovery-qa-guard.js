import {readdir,readFile,readlink,mkdir,appendFile,writeFile} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
const journal=resolve('../..','HANDOFF.md');
const digest=()=>{const h=createHash('sha256');for(const path of execFileSync('git',['ls-files','--cached','--others','--exclude-standard','src','scripts'],{encoding:'utf8'}).trim().split('\n').sort()){h.update(path);try{h.update(readFileSync(path));}catch{h.update('deleted');}}return h.digest('hex');};
export default async function guard(){
 const ancestors=new Set();let pid=process.pid;
 while(pid>1&&!ancestors.has(String(pid))){ancestors.add(String(pid));try{pid=+(await readFile(`/proc/${pid}/status`,'utf8')).match(/^PPid:\s+(\d+)/m)[1];}catch{break;}}
 const conflicts=[];
 for(const pid of await readdir('/proc')){if(!/^\d+$/.test(pid)||ancestors.has(pid))continue;try{const exe=await readlink(`/proc/${pid}/exe`),args=(await readFile(`/proc/${pid}/cmdline`,'utf8')).split('\0').join(' ');if((/node/.test(exe)&&/playwright/.test(args)&&/\btest\b|workerMain|worker\/|workerProcess/.test(args))||(/chromium|chrome/.test(exe)&&args.includes('--remote-debugging-pipe')))conflicts.push({pid,exe,args});}catch{}}
 if(conflicts.length)throw Error(`Shared GPU occupied: ${JSON.stringify(conflicts)}`);
 await mkdir(process.env.TMPDIR,{recursive:true});await mkdir(process.env.TRANSPORT_EVIDENCE,{recursive:true});
 const before=digest(),start=new Date().toISOString();await writeFile(resolve(process.env.TRANSPORT_EVIDENCE,'source.json'),JSON.stringify({start,head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),before,browser:'/usr/bin/chromium',backend:'ANGLE gl',viewport:[1440,900],physicalController:false},null,2));
 await appendFile(journal,`\n\nSA-RECOVERY-001 GPU ${start}: ACQUIRED actual host executable/argv guard clear; private5680 production, one worker/no retries, disk TMPDIR .browser-cache/rc, source freeze ${before}. Evidence ${process.env.TRANSPORT_EVIDENCE}. No shared service changes.\n`);
 return async()=>{const after=digest();await appendFile(journal,`\n\nSA-RECOVERY-001 GPU ${new Date().toISOString()}: RELEASED focused runner complete, source unchanged=${before===after}. Original evidence ${process.env.TRANSPORT_EVIDENCE}; no automatic retry or shared service changes.\n`);if(before!==after)throw Error('Recovery source changed during browser QA');};
}
