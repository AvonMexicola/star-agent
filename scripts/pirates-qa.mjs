import {execFileSync,spawn} from 'node:child_process';import {appendFileSync,mkdirSync} from 'node:fs';
const inventory=execFileSync('ps',['-eo','pid,comm,args'],{encoding:'utf8'});
const busy=inventory.split('\n').filter(line=>/chromium.*--remote-debugging-pipe/.test(line)&&!/bash|codex|bwrap/.test(line));
if(busy.length){console.error('Pirate QA deferred: another automated browser is running.');process.exit(2);}
const journal='/home/cees/projects/star-agent/HANDOFF.md';const note=text=>appendFileSync(journal,`\n\nSA-PIRATE-001 ${new Date().toISOString()}: ${text}\n`);
const args=['run','test:browser','--','-c','scripts/pirates.config.js',...process.argv.slice(2)];
note(`GPU ACQUIRED for one focused5664 job: ${args.join(' ')}. Host inventory clear at execution, one worker/no retries; no shared services/SQL/production changes.`);
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const evidence=`/home/cees/projects/star-agent/test-results/pirates-${stamp}`;
const tmp='/home/cees/projects/star-agent/test-results/p-tmp';
mkdirSync(evidence,{recursive:true});mkdirSync(tmp,{recursive:true});
const child=spawn('npm',args,{stdio:'inherit',env:{...process.env,TMPDIR:tmp,PIRATE_EVIDENCE:evidence,PIRATE_RESULTS:`${evidence}/test-output`}});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
child.on('exit',(code,signal)=>{note(`GPU RELEASED; focused5664 runner exit ${code??signal}. Original evidence ${evidence}. No automatic repeat.`);process.exit(code??1);});
