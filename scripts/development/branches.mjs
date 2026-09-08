import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {repoRoot,argumentsFor,git,commit} from './lib.mjs';
try{
  const args=argumentsFor(process.argv.slice(2),['--base','--json']),root=repoRoot();
  const base=args.base??'origin/dev/all-features',sha=commit(base,root);
  const worktrees=new Map();let worktree='';
  for(const line of git(['worktree','list','--porcelain'],root).split('\n')){
    if(line.startsWith('worktree '))worktree=line.slice(9);
    if(line.startsWith('branch '))worktrees.set(line.slice(7),worktree);
  }
  const taskDir=resolve(root,'project/tasks');
  const tasks=readdirSync(taskDir).filter(p=>p.endsWith('.json')).map(p=>JSON.parse(readFileSync(resolve(taskDir,p),'utf8')));
  const refs=git(['for-each-ref','--format=%(refname)\t%(objectname)','refs/heads','refs/remotes/origin'],root).trim().split('\n').filter(Boolean);
  const rows=refs.filter(line=>!line.split('\t')[0].endsWith('/HEAD')).map(line=>{
    const [ref,head]=line.split('\t');
    const [ahead,behind]=git(['rev-list','--left-right','--count',`${head}...${sha}`],root).trim().split(/\s+/).map(Number);
    const branch=ref.replace(/^refs\/(heads|remotes\/origin)\//,'');
    return {ref,sha:head,ahead,behind,contained:ahead===0,worktree:worktrees.get(ref)??null,tasks:tasks.filter(t=>t.branch===branch).map(t=>({id:t.id,owner:t.owner,status:t.status}))};
  });
  if(args.json)console.log(JSON.stringify({base,sha,branches:rows},null,2));
  else{
    console.log(`Branch inventory relative to ${base} (${sha.slice(0,8)})`);
    for(const r of rows)console.log(`${String(r.ahead).padStart(4)} ahead ${String(r.behind).padStart(4)} behind  ${r.ref.replace('refs/','')}${r.worktree?' [checked out]':''}${r.contained?' [ancestry retained]':''}${r.tasks.length?' '+r.tasks.map(t=>`${t.id}:${t.status}`).join(','):''}`);
    console.log('Read-only: no fetch, merge, rebase, deletion or process changes. Counts describe ancestry, not cherry-pick equivalence, acceptance or deployment. Inspect PRs/HANDOFF before taking action.');
  }
}catch(error){console.error('Could not inspect branches: '+error.message);process.exitCode=1;}
