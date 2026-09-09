import {readdir,readFile,readlink} from 'node:fs/promises';
import path from 'node:path';

/** A unique SENTRY_OUTPUT token, exact worktree and executable/argv establish
 * ownership. Port numbers are diagnostic evidence, never permission to kill. */
export async function ownedSentryProcesses(root,output){
  const sockets=new Map();
  for(const file of ['/proc/net/tcp','/proc/net/tcp6'])try{
    for(const line of (await readFile(file,'utf8')).trim().split('\n').slice(1)){
      const fields=line.trim().split(/\s+/);if(fields[3]!=='0A')continue;
      const port=parseInt(fields[1].split(':').at(-1),16);if([5678,8678].includes(port))sockets.set(fields[9],port);
    }
  }catch{}
  const result=[];
  for(const id of (await readdir('/proc')).filter(x=>/^\d+$/.test(x)))try{
    const cwd=await readlink('/proc/'+id+'/cwd');if(cwd!==root)continue;
    const exe=await readlink('/proc/'+id+'/exe');if(!exe.endsWith('/node'))continue;
    const args=(await readFile('/proc/'+id+'/cmdline','utf8')).split('\0').filter(Boolean),words=args.flatMap(a=>a.split(/\s+/));
    const api=args[1]==='server/index.js'||args[1]===path.join(root,'server/index.js');
    const preview=words.includes('preview')&&words[words.indexOf('--port')+1]==='5678'&&words.some(a=>/\/(?:\.bin\/vite|vite\/bin\/vite\.js)$/.test(a));
    if(!api&&!preview)continue;
    const env=(await readFile('/proc/'+id+'/environ','utf8')).split('\0');
    if(!env.includes('SENTRY_OUTPUT='+output))continue;
    if(api&&(!env.includes('PORT=8678')||!env.includes('STAR_AGENT_MEMORY=1')))continue;
    const stat=await readFile('/proc/'+id+'/stat','utf8'),startTicks=stat.slice(stat.lastIndexOf(')')+2).split(' ')[19],ports=[];
    for(const fd of await readdir('/proc/'+id+'/fd'))try{const link=await readlink('/proc/'+id+'/fd/'+fd),inode=/^socket:\[(\d+)\]$/.exec(link)?.[1];if(sockets.has(inode))ports.push(sockets.get(inode));}catch{}
    result.push({pid:Number(id),exe,args,cwd,startTicks,output,kind:api?'memory-api':'preview',listeningPorts:[...new Set(ports)]});
  }catch{}
  return result;
}

export async function stopOwnedSentryProcesses(root,output){
  const before=await ownedSentryProcesses(root,output),signals=[];
  for(const item of before){
    const current=(await ownedSentryProcesses(root,output)).find(p=>p.pid===item.pid&&p.startTicks===item.startTicks);if(!current)continue;
    try{process.kill(item.pid,'SIGTERM');signals.push({pid:item.pid,signal:'SIGTERM'});}catch(error){signals.push({pid:item.pid,error:error.code});}
  }
  let after=await ownedSentryProcesses(root,output);const deadline=Date.now()+5000;
  while(after.length&&Date.now()<deadline){await new Promise(resolve=>setTimeout(resolve,100));after=await ownedSentryProcesses(root,output);}
  return {time:new Date().toISOString(),before,signals,after};
}
