import {execFileSync,spawn} from 'node:child_process';import {appendFileSync,mkdirSync} from 'node:fs';
const waitSlot=process.argv.includes('--wait-slot'),started=Date.now();let waiting=false;
for(;;){
 const inventory=execFileSync('ps',['-eo','pid,comm,args'],{encoding:'utf8'});
 const busy=inventory.split('\n').some(line=>/^\s*\d+\s+chromium\s/.test(line)&&line.includes('--remote-debugging-pipe'));
 if(!busy)break;
 if(!waitSlot||Date.now()-started>15*60000){console.error('Pirate QA deferred: another automated browser is running.');process.exit(2);}
 if(!waiting){console.log('Pirate QA queued; waiting for the active browser job to release the GPU.');waiting=true;}
 await new Promise(resolve=>setTimeout(resolve,5000));
}
const journal='/home/cees/projects/star-agent/HANDOFF.md';const note=text=>appendFileSync(journal,`\n\nSA-PIRATE-001 ${new Date().toISOString()}: ${text}\n`);
const args=['run','test:browser','--','-c','scripts/pirates.config.js',...process.argv.slice(2).filter(a=>a!=='--wait-slot')];
note(`GPU ACQUIRED for one focused5664 job: ${args.join(' ')}. Host inventory clear at execution, one worker/no retries; no shared services/SQL/production changes.`);
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const evidence=`/home/cees/projects/star-agent/test-results/pirates-${stamp}`;
const tmp='/home/cees/projects/star-agent/test-results/p-tmp';
mkdirSync(evidence,{recursive:true});mkdirSync(tmp,{recursive:true});
const child=spawn('npm',args,{stdio:'inherit',env:{...process.env,TMPDIR:tmp,PIRATE_EVIDENCE:evidence,PIRATE_RESULTS:`${evidence}/test-output`}});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.on('exit',(code,signal)=>{note(`GPU RELEASED; focused5664 runner exit ${code??signal}. Original evidence ${evidence}. No automatic repeat.`);process.exit(code??1);});
