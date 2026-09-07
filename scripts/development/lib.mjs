import {execFileSync} from 'node:child_process';
import {readFileSync, existsSync} from 'node:fs';
import {resolve, relative, isAbsolute} from 'node:path';

export const CHECKS = new Set(['repository','unit','build','browser','controller','touch','visual','performance','multiplayer','database','assets','audio']);
export const STATES = new Set(['proposed','active','review','blocked','integrated','released','parked','cancelled']);
export const ACTIVE = new Set(['active','review','blocked']);
export function git(args, cwd=process.cwd()) {
  return execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:32*1024*1024});
}
export function repoRoot(cwd=process.cwd()){return git(['rev-parse','--show-toplevel'],cwd).trim();}
export function commit(ref,cwd){return git(['rev-parse','--verify','--end-of-options',`${ref}^{commit}`],cwd).trim();}
export function argumentsFor(argv,allowed=[]){
  const result={};
  for(let i=0;i<argv.length;i++){
    const arg=argv[i];
    if(!allowed.includes(arg))throw Error(`Unknown option: ${arg}`);
    if(['--json','--ci'].includes(arg)){result[arg.slice(2)]=true;continue;}
    const value=argv[++i];if(!value||value.startsWith('--'))throw Error(`Missing value for ${arg}`);
    result[arg.slice(2)]=value;
  }
  return result;
}
export function safePath(value,{glob=false}={}){
  return typeof value==='string'&&value.length>0&&!isAbsolute(value)&&!/[\\\x00-\x1f:]/.test(value)
    &&!value.replace(/\/$/,'').split('/').some(p=>p==='..'||p==='.'||!p)
    &&(glob||!/[?*\[\]]/.test(value));
}
export function contained(root,path){const rel=relative(root,resolve(root,path));return rel!==''&&!rel.startsWith('../')&&!isAbsolute(rel);}
export function pathPattern(pattern){
  let re='^';
  for(let i=0;i<pattern.length;i++){
    const c=pattern[i];
    if(c==='*'){if(pattern[i+1]==='*'){re+='.*';i++;}else re+='[^/]*';}
    else re+=/[\\^$+?.()|{}[\]]/.test(c)?`\\${c}`:c;
  }
  return new RegExp(re+'$');
}
export function claimOverlap(a,b){return a===b||(a.endsWith('/')&&b.startsWith(a))||(b.endsWith('/')&&a.startsWith(b));}
export function validateRegistry(registry,tasks,{exists=()=>true,milestones=new Set()}={}){
  const errors=[],ids=new Set(),taskIds=new Set();
  if(registry?.version!==1||!/^@[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)?$/.test(registry?.fallbackOwner??''))errors.push('Invalid area registry version or fallback owner');
  if(!Array.isArray(registry?.areas)||!registry.areas.length)return [...errors,'Area registry needs areas'];
  for(const area of registry.areas){
    if(!area||typeof area!=='object'){errors.push('Malformed area');continue;}
    if(!/^[a-z][a-z0-9-]*$/.test(area.id??'')||ids.has(area.id))errors.push(`Invalid/duplicate area ID: ${area.id}`);
    ids.add(area.id);
    if(typeof area.name!=='string'||!area.name.trim())errors.push(`Area ${area.id} needs a name`);
    if(area.maintainer!==null&&!/^@[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)?$/.test(area.maintainer??''))errors.push(`Area ${area.id} needs a real handle or null`);
    if(!Array.isArray(area.paths)||!area.paths.length||area.paths.some(p=>!safePath(p,{glob:true})))errors.push(`Area ${area.id} has unsafe/empty paths`);
    if(!Array.isArray(area.checks)||!area.checks.length||area.checks.some(c=>!CHECKS.has(c)))errors.push(`Area ${area.id} has unknown/empty checks`);
    if(!Array.isArray(area.contracts)||!area.contracts.length||area.contracts.some(p=>!safePath(p)||!exists(p)))errors.push(`Area ${area.id} has missing/unsafe contracts`);
  }
  for(const t of tasks){
    if(!t||typeof t!=='object'){errors.push('Malformed task');continue;}
    const label=t.id??'<missing ID>';
    if(!/^SA-[A-Z][A-Z0-9]*-\d{3,}$/.test(label)||taskIds.has(label))errors.push(`Invalid/duplicate task ID: ${label}`);
    taskIds.add(label);
    if(!STATES.has(t.status))errors.push(`${label}: unknown status`);
    if(!/^@[A-Za-z0-9_-]+$/.test(t.owner??'')||typeof t.title!=='string'||!t.title.trim())errors.push(`${label}: needs human owner handle and title`);
    if(!/^(feat|fix|art|docs|release)\/[a-z0-9][a-z0-9_/-]*$/.test(t.branch??''))errors.push(`${label}: invalid contribution branch`);
    if(!/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(t.base??''))errors.push(`${label}: record the full base commit`);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(t.updated??'')||!Number.isFinite(Date.parse(t.updated))||new Date(t.updated).toISOString().slice(0,10)!==t.updated)errors.push(`${label}: invalid updated date`);
    if(!milestones.has(t.milestone))errors.push(`${label}: unknown roadmap milestone`);
    if(!safePath(t.brief)||!exists(t.brief))errors.push(`${label}: missing/unsafe brief`);
    if(!Array.isArray(t.areas)||!t.areas.length||t.areas.some(a=>!ids.has(a)))errors.push(`${label}: unknown/empty areas`);
    if(!Array.isArray(t.claims)||!t.claims.length||t.claims.some(p=>!safePath(p)))errors.push(`${label}: unsafe/empty claims`);
  }
  const active=tasks.filter(t=>t&&ACTIVE.has(t.status)&&Array.isArray(t.claims));
  for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++){
    for(const a of active[i].claims)for(const b of active[j].claims){
      if(typeof a==='string'&&typeof b==='string'&&claimOverlap(a,b))errors.push(`Overlapping active claims: ${active[i].id} ${a} / ${active[j].id} ${b}`);
    }
  }
  return errors;
}
export function localLinks(markdown){
  const text=markdown.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[^\n]*$/gm,'').replace(/`[^`\n]*`/g,'');
  return [...text.matchAll(/!?\[[^\]]*\]\((<[^>]+>|[^\s)]+)(?:\s+"[^"]*")?\)/g)]
    .map(m=>m[1].replace(/^<|>$/g,''))
    .filter(p=>!p.startsWith('#')&&!/^[a-z][a-z0-9+.-]*:/i.test(p)&&!p.startsWith('//'))
    .map(p=>decodeURIComponent(p.split(/[?#]/,1)[0]));
}
export function hygiene(path,{size=0,text=''}={}){
  const errors=[];
  if(/(^|\/)(node_modules|dist|test-results|playwright-report|coverage|\.vercel)(\/|$)/.test(path))errors.push('Generated/dependency output');
  if(/(^|\/)\.env(?:\.[^/]*)?$/.test(path)&&!path.endsWith('.example'))errors.push('Environment file (only .env.example is allowed)');
  if(/\.(pem|key|p12|pfx|blend[1-9]|core)$/i.test(path)||/(^|\/)core(?:\.\d+)?$/.test(path))errors.push('Credential, core dump or authoring backup file');
  if(size>100*1024*1024)errors.push('File exceeds 100 MiB; choose a reviewed artifact strategy');
  if(/^<<<<<<< .+$|^>>>>>>> .+$/m.test(text))errors.push('Unresolved merge marker');
  if(/[\x00-\x1f]/.test(path))errors.push('Control character in file path');
  return errors.map(e=>`${path}: ${e}`);
}
export function changedPaths(root,base){
  const paths=new Set();
  const collect=args=>git(args,root).split('\0').filter(Boolean).forEach(p=>paths.add(p));
  if(base){const b=commit(base,root),common=git(['merge-base',b,'HEAD'],root).trim();collect(['diff','--name-only','-z',common,'HEAD']);}
  collect(['diff','--name-only','-z','HEAD']);
  collect(['ls-files','--others','--exclude-standard','-z']);
  return [...paths].sort();
}
export function trackedPaths(root){return git(['ls-files','-z'],root).split('\0').filter(Boolean);}
export function eventBase(path){
  if(!path||!existsSync(path))return null;
  const event=JSON.parse(readFileSync(path,'utf8'));
  return event.pull_request?.base?.sha??(/^0+$/.test(event.before??'0')?null:event.before);
}
export function classify(paths,registry){
  const selected=registry.areas.filter(a=>a.paths.some(p=>paths.some(path=>pathPattern(p).test(path))));
  const checks=new Set(['repository']);selected.forEach(a=>a.checks.forEach(c=>checks.add(c)));
  const browser=paths.some(p=>/^(src\/|public\/|assets\/|blender\/|server\/|index\.html$|(?:vite|playwright)\.config\.|package(?:-lock)?\.json$|\.github\/workflows\/|(?:scripts|tests)\/development\/|scripts\/.*(?:\.spec|\.config)\.|tests\/.*\.spec\.)/.test(p));
  const multiplayer=paths.some(p=>/^(server\/|src\/|package(?:-lock)?\.json$|\.github\/workflows\/|(?:scripts|tests)\/development\/|tests\/(?:server-|remote-players\.|multiplayer-ui\.))/.test(p));
  const unknown=paths.filter(p=>!selected.some(a=>a.paths.some(pattern=>pathPattern(pattern).test(p)))&&!/^(docs\/|tests\/|scripts\/|.*\.md$)/.test(p));
  if(browser){checks.add('unit');checks.add('build');checks.add('browser');}
  if(multiplayer){checks.add('multiplayer');checks.add('database');}
  return {paths,areas:selected.map(a=>a.id),contracts:[...new Set(selected.flatMap(a=>a.contracts))].sort(),checks:[...checks].sort(),browser,multiplayer,unclassified:unknown};
}
