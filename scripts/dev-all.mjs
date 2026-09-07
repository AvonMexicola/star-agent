import { spawn } from 'node:child_process';
import { createServer as createSocketServer } from 'node:net';
import { fileURLToPath } from 'node:url';

// One local integration entry, with its own ephemeral multiplayer service.
const cwd=fileURLToPath(new URL('..',import.meta.url));
const port=Number(process.env.DEV_PORT??5178),apiPort=Number(process.env.DEV_API_PORT??8087);
for(const value of [port,apiPort])if(!Number.isInteger(value)||value<1024||value>65535)throw new Error('Development ports must be between 1024 and 65535.');
if(port===apiPort)throw new Error('Frontend and API need different ports.');
const origin='http://127.0.0.1:'+port;
async function available(value){await new Promise((resolve,reject)=>{const server=createSocketServer();server.once('error',()=>reject(new Error('Port '+value+' is already in use. Keep that preview running or choose DEV_PORT / DEV_API_PORT.')));server.listen(value,'127.0.0.1',()=>server.close(resolve));});}
await Promise.all([available(port),available(apiPort)]);
console.log('All-features local build: '+origin+'\nShip and location selector opens after preload. F2 / controller Menu reopens it.\nTest flights use temporary saves. Local multiplayer accounts reset when this process stops.');
const children=[];let stopping=false;
function stop(code=0){if(stopping)return;stopping=true;process.exitCode=code;for(const child of children)child.kill('SIGTERM');}
function run(args,env){const child=spawn(process.execPath,args,{cwd,env:{...process.env,...env},stdio:'inherit'});children.push(child);child.once('error',error=>{console.error(error.message);stop(1);});child.once('exit',code=>{if(!stopping)stop(code??1);});return child;}
// No production database or SMTP settings are consumed by this isolated service.
run(['server/index.js'],{NODE_ENV:'development',STAR_AGENT_MEMORY:'1',PUBLIC_ORIGIN:origin,HOST:'127.0.0.1',PORT:String(apiPort),DATABASE_URL:'',SMTP_HOST:'',SMTP_FROM:'',SMTP_USER:'',SMTP_PASSWORD:''});
run(['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{VITE_DEV_TOOLS:'1',MULTIPLAYER_SERVER:'http://127.0.0.1:'+apiPort});
process.once('SIGINT',()=>stop());process.once('SIGTERM',()=>stop());
