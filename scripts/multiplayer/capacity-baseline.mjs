// Synthetic CPU/JSON baseline only: no sockets, SQL, rendering or live room access.
// Run on the intended host; results are not a latency/FPS or capacity guarantee.
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import os from 'node:os';
import { createWorld } from '../../server/world.js';
import { createRoom } from '../../server/room.js';
import { createMemoryStore } from '../../server/database.js';
const results=[];
for (const count of [10,20]) {
  const world=await createWorld(),store=createMemoryStore(),errors=[];
  let time=100000,bytes=0,messages=0,measuring=false;
  const room=createRoom({world,store,autoStart:false,now:()=>time,onError:e=>errors.push(e.message)});
  try {
    const ids=[];
    for(let i=0;i<count;i++) {
      const account=await store.createAccount({email:`baseline-${i}@example.test`,callsign:`Baseline_${i}`,passwordHash:'in-memory-fixture-only'});
      ids.push(await room.join(account,m=>{
        const encoded=JSON.stringify(m);
        if(measuring&&m.type==='state'){bytes+=Buffer.byteLength(encoded);messages++;}
      }));
    }
    const timings=[];let sequence=0;
    for(let i=0;i<2100;i++) {
      if(i===300)measuring=true;
      time+=1000/30;
      const started=performance.now();
      // Modest continuous steering near the initial orbital approach, 30 Hz.
      for(const id of ids)room.receive(id,{type:'input',sequence:++sequence,input:{forward:.1,yaw:.02}});
      room.tick();
      if(measuring)timings.push(performance.now()-started);
      if(i%30===0)await new Promise(resolve=>setImmediate(resolve));
    }
    assert.equal(room.players.size,count);assert.deepEqual(errors,[]);
    timings.sort((a,b)=>a-b);
    const mean=timings.reduce((a,b)=>a+b,0)/timings.length;
    results.push({players:count,simulatedSeconds:60,samples:timings.length,meanTickMs:mean,p95TickMs:timings[Math.floor(timings.length*.95)],maxTickMs:timings.at(-1),estimatedSingleCorePercentAt30Hz:mean*3,snapshotMessages:messages,rawJsonBytesPerSecond:bytes/60,rawJsonMbitPerSecond:bytes/60*8/1e6,rssMiB:process.memoryUsage().rss/1024**2,errors});
  } finally {await room.close();}
}
console.log(JSON.stringify({timestamp:new Date().toISOString(),node:process.version,cpu:os.cpus()[0].model,vcpus:os.cpus().length,limitations:'Synthetic in-memory simulation plus JSON serialization. No WebSocket/TLS/SQL/network/client rendering costs; no realtime scheduling, combat, packet loss or human-player FPS claim.',results},null,2));
