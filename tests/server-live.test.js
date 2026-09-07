import test from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import {createWorld} from '../server/world.js';
import {createRoom} from '../server/room.js';
import {createMemoryStore} from '../server/database.js';
import {createServer} from '../server/index.js';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn){for(let i=0;i<100;i++){if(fn())return;await pause(25);}assert.fail('Timed out waiting for authoritative socket state.');}

test('ten real authenticated sockets share live simulation, unique hangars and disconnect cleanup',async t=>{
  const store=createMemoryStore(),world=await createWorld(),errors=[];
  const room=createRoom({store,world,onError:error=>errors.push(error.message)});
  const origin='http://127.0.0.1:5300';
  const app=await createServer({store,room,publicOrigin:origin,secureCookies:false});
  const address=await app.listen(0),url=`http://127.0.0.1:${address.port}`;
  const sockets=[];t.after(async()=>{for(const ws of sockets)ws.terminate();await app.close();});
  const cookies=[];
  // Account hashing is intentionally concurrency-limited; pre-register the ten
  // pilots before simultaneously connecting their gameplay sockets.
  for(let i=0;i<10;i++){
    const response=await fetch(`${url}/api/auth/register`,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email:`load${i}@example.test`,callsign:`Load_${i}`,password:'Synthetic-test-password-123'})});
    assert.equal(response.status,201);
    cookies.push(response.headers.get('set-cookie').split(';')[0]);
  }
  const peers=await Promise.all(cookies.map(async cookie=>{
    const messages=[];
    const ws=new WebSocket(url.replace('http:','ws:')+'/ws',{headers:{Origin:origin,Cookie:cookie}});sockets.push(ws);
    ws.on('message',data=>messages.push(JSON.parse(data)));ws.on('error',error=>errors.push(error.message));
    await until(()=>messages.some(m=>m.type==='welcome'));
    const welcome=messages.find(m=>m.type==='welcome');
    ws.send(JSON.stringify({type:'request',requestId:'hangar',action:'hangar'}));
    ws.send(JSON.stringify({type:'input',sequence:1,input:{forward:.4}}));
    return {ws,messages,id:welcome.id,color:welcome.colorIndex};
  }));
  await until(()=>peers.every(p=>p.messages.some(m=>m.type==='state'&&m.players.length===10&&m.players.find(q=>q.id===p.id)?.sequence===1&&m.hangar)));
  assert.equal(new Set(peers.map(p=>p.color)).size,10);
  assert.equal(new Set(peers.map(p=>p.messages.findLast(m=>m.type==='state').hangar.id)).size,10);
  assert.equal(room.players.size,10);assert.deepEqual(errors,[]);
  peers[0].ws.close();await until(()=>room.players.size===9&&room.leases.size===9);
  assert.deepEqual(errors,[]);
});
