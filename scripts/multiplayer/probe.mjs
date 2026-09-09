// Run on the server after sourcing its private environment. Creates one clearly
// synthetic account, checks the public HTTPS/WS path, then deletes only that account.
import WebSocket from 'ws';
import pg from 'pg';
import {randomBytes} from 'node:crypto';
import {MULTIPLAYER_VERSION,MAX_PLAYERS,WORLD_SEED} from '../../src/multiplayer/protocol.js';
const origin=process.env.PUBLIC_ORIGIN;
if(!origin||!process.env.DATABASE_URL)throw new Error('PUBLIC_ORIGIN and DATABASE_URL are required.');
const suffix=randomBytes(5).toString('hex'),email=`qa-${suffix}@example.test`,callsign=`QA_${suffix}`;
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});let ws;
try{
  const response=await fetch(`${origin}/api/auth/register`,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email,callsign,password:randomBytes(24).toString('base64url')})});
  if(response.status!==201)throw new Error(`Registration failed (${response.status}).`);
  const cookie=response.headers.get('set-cookie')?.split(';')[0];if(!cookie)throw new Error('No session cookie.');
  ws=new WebSocket(`${origin.replace('https:','wss:').replace('http:','ws:')}/ws`,{headers:{Origin:origin,Cookie:cookie}});
  await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error('Public socket check timed out.')),15000);
    ws.on('error',reject);
    ws.on('message',raw=>{
      const m=JSON.parse(raw);
      if(m.type==='welcome'){
        if(m.maxPlayers!==MAX_PLAYERS||m.seed!==WORLD_SEED||m.version!==MULTIPLAYER_VERSION){clearTimeout(timeout);reject(new Error('Unexpected world contract.'));return;}
        ws.send(JSON.stringify({type:'request',requestId:'probe',action:'hangar'}));
      }
      if(m.type==='ack'&&m.requestId==='probe'){clearTimeout(timeout);m.ok?resolve():reject(new Error('Hangar request rejected.'));}
    });
  });
  console.log(JSON.stringify({publicHTTPSRegistration:true,authenticatedWSS:true,hangarAssignment:true,multiplayerVersion:MULTIPLAYER_VERSION,maxPlayers:MAX_PLAYERS,seed:WORLD_SEED}));
}finally{
  if(ws&&ws.readyState!==WebSocket.CLOSED)await new Promise(resolve=>{ws.once('close',resolve);ws.close();setTimeout(()=>{ws.terminate();resolve();},2000).unref();});
  // Let the server finish its departure checkpoint before deleting the fixture.
  await new Promise(resolve=>setTimeout(resolve,500));
  await pool.query('DELETE FROM accounts WHERE email=$1 AND callsign=$2',[email,callsign]);await pool.end();
}
