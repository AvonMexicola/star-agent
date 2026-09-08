import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Vector3,Quaternion} from 'three';
import {PiratePerimeter} from '../src/pirate-compound/perimeter.js';
import {PIRATE_MARKET,PERIMETER as P} from '../src/pirate-compound/catalog.js';
import {pirateLayout} from '../src/pirate-compound/layout.js';
import {normalizePirateMarket} from '../src/pirate-compound/market.js';
import {SETTLEMENTS,settlementById} from '../src/settlements/catalog.js';
import {emptyCommerce,normalizeSettlementMarkets,validCommerce} from '../src/trading/model.js';
import {integrity,damage} from '../src/combat/simulation.js';
import {SELENE,bodySurfacePoint} from '../src/celestial.js';
import {terminalFrames} from '../src/trading/terminal-frames.js';
import {getWorldBoxes} from '../src/build/collision.js';
import {getPieceDefinition} from '../src/build/definitions.js';
const step=(sim,seconds,context={})=>{for(let i=0;i<Math.ceil(seconds/.05);i++)sim.update(.05,{distance:120,altitude:30,ship:true,...context});};
test('single shot and complete burst preserve every supported full-health hull',()=>{
 for(const ship of ['nomad','kestrel','atlas','gannet','stratum']){
  const state=integrity(ship);let hits=0;const p=new PiratePerimeter({onShot:({damage:amount})=>{hits++;damage(state,amount);}});
  step(p,5);assert.equal(hits,0);step(p,3);assert.equal(hits,P.burstShots);assert.equal(state.hull,state.maxHull);assert.ok(state.shield>0,ship);assert.equal(state.maxShield-state.shield,54);
 }
});
test('retreat, ground route, pause and long frame cannot preserve a stale volley',()=>{
 let shots=0;const p=new PiratePerimeter({onShot:()=>shots++});step(p,6.8);assert.ok(shots>0);const before=shots;
 step(p,.1,{distance:221});assert.equal(p.phase,'warning');assert.ok(p.timer>=4.9);step(p,5,{distance:170});assert.equal(shots,before);
 p.update(999,{distance:120,altitude:30,ship:true});assert.ok(shots<=before+1);
 step(p,.1,{active:false});assert.equal(p.phase,'idle');step(p,5);assert.ok(shots<=before+1);
 step(p,60,{ship:false});assert.equal(p.phase,'idle');const low=new PiratePerimeter();step(low,8,{altitude:2});assert.equal(low.shots,3,'A still-piloted landed ship is not immune.');
 p.isolate();step(p,60);assert.equal(p.phase,'disabled');assert.ok(shots<=before+1);
});
test('obstruction and turning require a fresh telegraph, burst stays bounded',()=>{
 let shots=0;const p=new PiratePerimeter({onShot:()=>shots++});step(p,7,{clear:false});assert.equal(shots,0);step(p,7,{aligned:false});assert.equal(shots,0);step(p,1);assert.equal(shots,0);step(p,2.1);assert.equal(shots,3);step(p,4);assert.equal(shots,3);
});
test('secret market initialization is additive, idempotent, depleted stock stays depleted',()=>{
 const previous=normalizeSettlementMarkets(emptyCommerce()),copy=structuredClone(previous),next=normalizePirateMarket(previous);
 assert.deepEqual(previous,copy);assert.equal(SETTLEMENTS.length,4);assert.equal(settlementById(PIRATE_MARKET.id),PIRATE_MARKET);assert.ok(validCommerce(next));assert.equal(normalizePirateMarket(next),next);
 next.markets[PIRATE_MARKET.id].stock.ice=0;assert.equal(normalizePirateMarket(next).markets[PIRATE_MARKET.id].stock.ice,0);delete next.markets[PIRATE_MARKET.id];assert.throws(()=>normalizePirateMarket(next),/Original save retained/);
});
test('survey supports both physical slabs and ramps reach canonical terrain',()=>{
 const s=pirateLayout(),q=new Quaternion(...s.claim.quaternion),up=new Vector3(0,1,0).applyQuaternion(q),origin=new Vector3(...s.claim.origin);
 assert.ok(s.terrain.core.range<6.8&&s.terrain.pad.range<6.8);assert.ok(s.approach[2]>P.disengage);assert.ok(s.panel[1]-s.deck<1.8);
 for(const claim of [s.claim,s.outerClaim]){assert.ok(claim.pieces.every(p=>getPieceDefinition(p.type)));const ramps=claim.pieces.filter(p=>p.type==='foundation-ramp'),last=ramps.at(-1);assert.ok(last);const end=new Vector3(last.position[0],0,last.position[2]+2).applyQuaternion(q).add(new Vector3(...claim.origin)),surface=bodySurfacePoint(end.clone().sub(new Vector3(...SELENE.center)).normalize(),SELENE).sub(origin).dot(up);assert.ok(last.position[1]-.6<surface+.12);}
});
test('tower export is original, budgeted and retains named panel/mount anchors',()=>{
 const manifest=JSON.parse(readFileSync(new URL('../assets/pirate-tower/manifest.json',import.meta.url))),data=readFileSync(new URL('../public/models/pirate-tower.glb',import.meta.url)),g=JSON.parse(data.subarray(20,20+data.readUInt32LE(12)));
 assert.equal(createHash('sha256').update(data).digest('hex'),manifest.sha256);assert.equal(data.length,manifest.bytes);assert.ok(manifest.triangles<10000&&data.length<1000000);assert.equal(g.images,undefined);assert.ok(g.nodes.some(n=>n.name==='TowerMount'));assert.ok(g.nodes.some(n=>n.name==='ServicePanel'));for(const mesh of g.meshes)for(const p of mesh.primitives){assert.ok(p.attributes.NORMAL!==undefined);assert.ok(p.attributes.TEXCOORD_0!==undefined);assert.ok(p.attributes.COLOR_0!==undefined);}
});

test('Crimson derivatives retain exact source geometry and three bounded native textures',()=>{
 const m=JSON.parse(readFileSync(new URL('../assets/pirate-props/manifest.json',import.meta.url)));
 const parse=data=>{const n=data.readUInt32LE(12);return {g:JSON.parse(data.subarray(20,20+n)),bin:data.subarray(28+n)};};
 for(const record of m.assets){const source=readFileSync(new URL('../'+record.source,import.meta.url)),runtime=readFileSync(new URL('../'+record.runtime,import.meta.url)),a=parse(source),b=parse(runtime),images=new Set(a.g.images.map(i=>i.bufferView));assert.equal(createHash('sha256').update(source).digest('hex'),record.sourceSha256);assert.equal(createHash('sha256').update(runtime).digest('hex'),record.sha256);assert.ok(runtime.length<=1000000&&record.triangles<=10000);assert.equal(record.textures.length,3);assert.ok(record.textures.every(t=>Math.max(...t.size)<=512));assert.ok(b.g.extensionsRequired.includes('EXT_texture_webp'));
  for(let i=0;i<a.g.bufferViews.length;i++)if(!images.has(i)){const x=a.g.bufferViews[i],y=b.g.bufferViews[i];assert.deepEqual(a.bin.subarray(x.byteOffset??0,(x.byteOffset??0)+x.byteLength),b.bin.subarray(y.byteOffset??0,(y.byteOffset??0)+y.byteLength));}
 }
});

test('ramp supporting foundations reach sampled terrain without protruding through the incline',()=>{
 const s=pirateLayout(),pieces=[...s.claim.pieces,...s.outerClaim.pieces];
 for(const entry of s.rampSupports){const ramp=pieces.find(p=>p.id===entry.rampId),supports=entry.supportIds.map(id=>pieces.find(p=>p.id===id));if(!supports.length)continue;assert.ok(supports.every(p=>p.supportDepth>=.6&&p.supportDepth<=8));assert.equal(supports[0].position[1],ramp.position[1]-.6);assert.ok(supports.every(p=>getWorldBoxes(p).every(b=>b.max[1]<=ramp.position[1]-.6+1e-7)));assert.ok(supports.at(-1).position[1]-supports.at(-1).supportDepth<=entry.terrainLow-.099);}
});
test('locked exchange projection directs players to the isolator',()=>{
 const s=pirateLayout(),frames=terminalFrames({snapshot:{terminals:[]},settlements:{claims:[s.claim],layouts:[s],terminalStatus:()=>({status:'Isolate perimeter tower',available:false})},station:null});assert.equal(frames.length,1);assert.equal(frames[0].status,'Isolate perimeter tower');assert.equal(frames[0].available,false);
});
