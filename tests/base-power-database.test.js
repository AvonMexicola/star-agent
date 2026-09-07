import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp} from 'node:fs/promises';
import {createServer as netServer} from 'node:net';import {Vector3} from 'three';
import {startLocalDatabase} from '../server/local-database.js';import {createPostgresStore} from '../server/database.js';import {createServer} from '../server/index.js';import {createBaseSites} from '../server/base-sites.js';
import {withClaimAnchor} from '../src/build/anchors.js';import {SELENE,bodySurfacePoint} from '../src/celestial.js';import {MOON_LANDING_DIRECTION} from '../src/moon-world.js';import {DECAY_MS} from '../src/build/power.js';
async function port(){const s=netServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const p=s.address().port;await new Promise(r=>s.close(r));return p;}
test('real PostgreSQL keeps account-scoped bases through restart, rolls back conflicts and expires offline sites',{timeout:90000},async t=>{
 const root=await mkdtemp('/home/cees/.cache/star-agent-base-db-'),database=await startLocalDatabase({XDG_DATA_HOME:root,DEV_DATABASE_NAME:'base-power-test',DEV_DATABASE_PORT:String(await port())});let store,app;
 t.after(async()=>{await app?.close();if(!app)await store?.close();await database.close();});
 store=await createPostgresStore({connectionString:database.connectionString});await Promise.all([store.migrate(),store.migrate()]);
 const apiPort=await port(),origin=`http://127.0.0.1:${apiPort}`;app=await createServer({store,room:{async close(){},async revoke(){}},publicOrigin:origin,logger:{error:code=>assert.fail(code)}});await app.listen(apiPort);
 const request=async(path,body,cookie)=>{const r=await fetch(origin+path,{method:body?'POST':'GET',headers:{Origin:origin,...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,cookie:r.headers.get('set-cookie')?.split(';')[0],body:await r.json()};};
 assert.equal((await request('/api/bases')).status,401);
 const a=await request('/api/auth/register',{email:'base-a@example.test',callsign:'Base_A',password:'base test password one'}),b=await request('/api/auth/register',{email:'base-b@example.test',callsign:'Base_B',password:'base test password two'});assert.equal(a.status,201);assert.equal(b.status,201);
 const c=withClaimAnchor({id:'build-claim-1',owner:'local-player',name:'Durable site',body:'selene',radius:64,useBuffer:false,origin:bodySurfacePoint(new Vector3(...MOON_LANDING_DIRECTION),SELENE).toArray(),quaternion:[0,0,0,1],pieces:[{id:'build-piece-2',type:'mainframe',position:[0,0,0],rotation:0,doorOpen:false}]});
 const read=await request('/api/bases',null,a.cookie),command={action:'save',accountId:a.body.account.id,revision:read.body.revision,build:{version:1,nextId:3,claims:[c]},storage:{'build-core-1':{name:'Saved supplies',boxes:2,items:{concrete:30}}}};
 assert.equal((await request('/api/bases',command,b.cookie)).status,409);
 const races=await Promise.all([request('/api/bases',command,a.cookie),request('/api/bases',command,a.cookie)]);assert.deepEqual(races.map(r=>r.status).sort(),[200,409]);
 const saved=races.find(r=>r.status===200).body;assert.equal(saved.storage['build-core-1'].items.concrete,30);assert.equal((await request('/api/bases',null,b.cookie)).body.build.claims.length,0);
 await app.close();app=null;store=await createPostgresStore({connectionString:database.connectionString});await store.migrate();
 const service=createBaseSites({store,now:()=>Date.now()});const restored=await service.command(a.body.account.id,{action:'read'});assert.equal(restored.build.claims.length,1);assert.equal(restored.storage['build-core-1'].items.concrete,30);
 const later=createBaseSites({store,now:()=>Date.now()+DECAY_MS+12*3600000});await later.sweep();const expired=await later.command(a.body.account.id,{action:'read'});assert.equal(expired.build.claims.length,0);assert.deepEqual(expired.storage,{});
 const stale=await later.command(a.body.account.id,{...command,revision:expired.revision});assert.equal(stale.build.claims.length,0);
 console.log('BASE_DB_PASS: real SQL restart, concurrent CAS, authenticated HTTP, account isolation and offline expiry verified.');
});
