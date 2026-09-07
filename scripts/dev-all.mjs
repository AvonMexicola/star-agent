import { spawn } from 'node:child_process';
import { createServer as createSocketServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { startLocalDatabase } from '../server/local-database.js';

// One local integration entry, with persistent local accounts and isolated test flights.
const cwd=fileURLToPath(new URL('..',import.meta.url));
const port=Number(process.env.DEV_PORT??5178),apiPort=Number(process.env.DEV_API_PORT??8087);
for(const value of [port,apiPort])if(!Number.isInteger(value)||value<1024||value>65535)throw new Error('Development ports must be between 1024 and 65535.');
if(port===apiPort)throw new Error('Frontend and API need different ports.');
const origin='http://127.0.0.1:'+port;
async function available(value){await new Promise((resolve,reject)=>{const server=createSocketServer();server.once('error',()=>reject(new Error('Port '+value+' is already in use. Keep that preview running or choose DEV_PORT / DEV_API_PORT.')));server.listen(value,'127.0.0.1',()=>server.close(resolve));});}
await Promise.all([available(port),available(apiPort)]);
let database;
try { database=await startLocalDatabase(); }
catch { console.error('LOCAL_DATABASE_STARTUP_FAILED: check npm ci, local PostgreSQL files/permissions and DEV_DATABASE_PORT or DEV_DATABASE_URL. Existing data was preserved.'); process.exit(1); }
console.log('All-features local build: '+origin+'\nShip and location selector opens after preload. F2 / controller Menu reopens it.\nOffline test flights use temporary saves. Multiplayer accounts and inventory persist across restarts.\nDatabase: '+database.description);
const children=[];let stopping=false,stopPromise;
function stop(code=0){
  if(stopping)return stopPromise;stopping=true;process.exitCode=code;
  for(const {child} of children)child.kill('SIGTERM');
  // Let room departure/save queues drain before closing the SQL service.
  stopPromise=Promise.all(children.map(({closed})=>closed)).then(()=>database.close())
    .catch(()=>{console.error('LOCAL_DATABASE_SHUTDOWN_FAILED');process.exitCode=1;});
  return stopPromise;
}
function run(args,env){
  const child=spawn(process.execPath,args,{cwd,env:{...process.env,...env},stdio:'inherit'});
  const closed=new Promise(resolve=>child.once('close',resolve));children.push({child,closed});
  child.once('error',()=>{console.error('LOCAL_SERVICE_STARTUP_FAILED');void stop(1);});
  child.once('exit',code=>{if(!stopping)void stop(code??1);});return child;
}
// Only the dedicated local database is passed on; production/SMTP settings are not consumed.
run(['server/index.js'],{NODE_ENV:'development',STAR_AGENT_MEMORY:'0',PUBLIC_ORIGIN:origin,HOST:'127.0.0.1',PORT:String(apiPort),DATABASE_URL:database.connectionString,SMTP_HOST:'',SMTP_FROM:'',SMTP_USER:'',SMTP_PASSWORD:''});
run(['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{VITE_DEV_TOOLS:'1',MULTIPLAYER_SERVER:'http://127.0.0.1:'+apiPort});
process.once('SIGINT',()=>void stop());process.once('SIGTERM',()=>void stop());
database.closed?.then(()=>{if(!stopping){console.error('LOCAL_DATABASE_EXITED');void stop(1);}});
