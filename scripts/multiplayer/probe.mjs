// Run on the server after sourcing its private environment. Creates one clearly
// synthetic account, checks the public HTTPS/WS path, then deletes only that account.
import WebSocket from 'ws';
import pg from 'pg';
import {randomBytes} from 'node:crypto';
import {MAX_PLAYERS,MULTIPLAYER_VERSION,WORLD_SEED} from '../../src/multiplayer/protocol.js';
const origin=process.env.PUBLIC_ORIGIN;
if(!origin||!process.env.DATABASE_URL)throw new Error('PUBLIC_ORIGIN and DATABASE_URL are required.');
const suffix=randomBytes(5).toString('hex'),email=`qa-${suffix}@example.test`,callsign=`QA_${suffix}`;
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});let ws;
try{
  const response=await fetch(`${origin}/api/auth/register`,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email,callsign,password:randomBytes(24).toString('base64url')})});
  if(response.status!==201)throw new Error(`Registration failed (${response.status}).`);
  const cookieHeader=response.headers.get('set-cookie');
  const cookie=cookieHeader?.split(';')[0];if(!cookie||!cookieHeader.includes('HttpOnly')||!cookieHeader.includes('Secure'))throw new Error('Missing secure session cookie.');
  ws=new WebSocket(`${origin.replace('https:','wss:').replace('http:','ws:')}/ws`,{headers:{Origin:origin,Cookie:cookie}});
  await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error('Public socket check timed out.')),15000);
    ws.on('error',reject);
    ws.on('message',raw=>{
      const m=JSON.parse(raw);
      if(m.type==='welcome'){
        if(m.maxPlayers!==MAX_PLAYERS||m.seed!==WORLD_SEED||m.version!==MULTIPLAYER_VERSION){clearTimeout(timeout);reject(new Error('Unexpected world contract.'));return;}
        const own=m.players?.find(p=>p.id===m.id);
        if(!own||own.mode!=='walk'||own.physicsFrame!==`hangar:${m.hangar?.id}`||!m.commerce?.markets||!Array.isArray(m.defense)){clearTimeout(timeout);reject(new Error('Incomplete authoritative fleet state.'));return;}
        ws.send(JSON.stringify({type:'request',requestId:'probe',action:'hangar'}));
      }
      if(m.type==='ack'&&m.requestId==='probe'){clearTimeout(timeout);m.ok?resolve():reject(new Error('Hangar request rejected.'));}
    });
  });
  console.log(`Public HTTPS registration, secure cookie, protocol ${MULTIPLAYER_VERSION}, ${MAX_PLAYERS}-pilot capacity, authoritative deck spawn, commerce/defense snapshot and WSS hangar assignment passed.`);
}finally{
  if(ws&&ws.readyState!==WebSocket.CLOSED)await new Promise(resolve=>{ws.once('close',resolve);ws.close();setTimeout(()=>{ws.terminate();resolve();},2000).unref();});
  // Let the server finish its departure checkpoint before deleting the fixture.
  await new Promise(resolve=>setTimeout(resolve,500));
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(7291, 2)');
    const account=(await client.query('SELECT id FROM accounts WHERE email=$1 AND callsign=$2 FOR UPDATE',[email,callsign])).rows[0];
    if(account){
      const ledger=(await client.query("SELECT state FROM commerce_state WHERE id='world-7291' FOR UPDATE")).rows[0]?.state;
      if(ledger){
        const owned=Object.values(ledger.ships??{}).filter(s=>s.owner===account.id);
        if(owned.some(s=>s.crates?.length)||Object.values(ledger.loose??{}).some(c=>c.holder===account.id))throw new Error('Synthetic fixture has unexpected cargo; cleanup refused.');
        delete ledger.accounts[account.id];for(const ship of owned)delete ledger.ships[ship.id];
        await client.query("UPDATE commerce_state SET state=$1::jsonb WHERE id='world-7291'",[JSON.stringify(ledger)]);
      }
      await client.query('DELETE FROM accounts WHERE id=$1',[account.id]);
    }
    await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}
  finally{client.release();await pool.end();}
}
