import {readFileSync,readdirSync,existsSync,lstatSync,realpathSync} from 'node:fs';
import {resolve,dirname,relative} from 'node:path';
import {repoRoot,argumentsFor,trackedPaths,changedPaths,eventBase,validateRegistry,localLinks,hygiene,contained} from './lib.mjs';
try {
  const args=argumentsFor(process.argv.slice(2),['--base','--ci']),root=repoRoot();
  const registry=JSON.parse(readFileSync(resolve(root,'project/areas.json'),'utf8'));
  const taskDir=resolve(root,'project/tasks');
  const tasks=readdirSync(taskDir).filter(p=>p.endsWith('.json')).map(p=>JSON.parse(readFileSync(resolve(taskDir,p),'utf8')));
  const milestones=new Set([...readFileSync(resolve(root,'ROADMAP.md'),'utf8').matchAll(/^### (M\d+) —/gm)].map(m=>m[1]));
  const exists=p=>contained(root,p)&&existsSync(resolve(root,p))&&contained(root,relative(root,realpathSync(resolve(root,p))));
  const errors=validateRegistry(registry,tasks,{exists,milestones});
  const base=args.base??(args.ci?eventBase(process.env.GITHUB_EVENT_PATH):null);
  const changed=changedPaths(root,base);
  const all=[...new Set([...trackedPaths(root),...changed])];
  const managed=all.filter(p=>/^(AGENTS|ARCHITECTURE|CONTRIBUTING|GOVERNANCE|QUALITY|README|ROADMAP|SECURITY|CODE_OF_CONDUCT)\.md$/.test(p)||/^(docs\/(development|templates|decisions)\/|project\/).*\.md$/.test(p));
  for(const path of managed){
    if(!existsSync(resolve(root,path)))continue;
    if(!exists(path)){errors.push(`${path}: document symlink escapes repository`);continue;}
    for(const target of localLinks(readFileSync(resolve(root,path),'utf8'))){
      const absolute=resolve(root,dirname(path),target);
      if(!exists(relative(root,absolute)))errors.push(`${path}: missing or outside-repo link target ${target}`);
    }
  }
  for(const path of all){
    const full=resolve(root,path);if(!existsSync(full))continue;
    const info=lstatSync(full);
    if(info.isSymbolicLink()){
      if(!contained(root,relative(root,realpathSync(full))))errors.push(`${path}: symlink escapes repository`);
      continue;
    }
    if(!info.isFile())continue;
    // New/range-changed text is checked for conflict markers; do not parse binary art.
    const content=changed.includes(path)&&info.size<2*1024*1024?readFileSync(full):null;
    errors.push(...hygiene(path,{size:info.size,text:content&&!content.includes(0)?content.toString('utf8'):''}));
  }
  if(errors.length){for(const e of errors)console.error(e);process.exitCode=1;}
  else console.log(`Repository checks passed: ${registry.areas.length} areas, ${tasks.length} tasks, ${managed.length} managed documents, ${changed.length} changed paths. Manual evidence and external links are not certified.`);
}catch(error){console.error('Repository checks failed: '+error.message);process.exitCode=1;}
