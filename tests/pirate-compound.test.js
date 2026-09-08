import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {Vector3,Quaternion,Scene,Group,Mesh,BoxGeometry,MeshStandardMaterial,Matrix4,Texture} from 'three';
import {PirateStaticKit} from '../src/pirate-compound/static-kit.js';
import {createPirateCollision} from '../src/pirate-compound/world-collision.js';
import {SHIP_LAYOUT} from '../src/boarding.js';
import {KESTREL_LAYOUT} from '../src/kestrel-access.js';
import {FREIGHTER_LAYOUT} from '../src/freighter-layout.js';
import {GANNET_LAYOUT} from '../src/gannet-layout.js';
import {STRATUM_LAYOUT} from '../src/stratum-layout.js';
import {createFloodlights} from '../src/build/floodlights.js';
import {PiratePerimeter} from '../src/pirate-compound/perimeter.js';
import {PIRATE_MARKET,PERIMETER as P} from '../src/pirate-compound/catalog.js';
import {pirateLayout} from '../src/pirate-compound/layout.js';
import {normalizePirateMarket} from '../src/pirate-compound/market.js';
import {SETTLEMENTS,settlementById} from '../src/settlements/catalog.js';
import {emptyCommerce,normalizeSettlementMarkets,validCommerce} from '../src/trading/model.js';
import {integrity,damage} from '../src/combat/simulation.js';
import {occupiesShip} from '../src/combat/ship-occupancy.js';
import {SELENE,bodySurfacePoint} from '../src/celestial.js';
import {terminalFrames} from '../src/trading/terminal-frames.js';
import {getWorldBoxes} from '../src/build/collision.js';
import {getPieceDefinition} from '../src/build/definitions.js';
const step=(sim,seconds,context={})=>{for(let i=0;i<Math.ceil(seconds/.05);i++)sim.update(.05,{distance:120,altitude:30,ship:true,...context});};
test('actual rover cabin flags reset the perimeter without making landed ships immune',()=>{
 for(const nav of [{mode:'flight'}, {mode:'landed',insideShip:true}, {mode:'walk',insideShip:true}])assert.equal(occupiesShip(nav),true);
 const rover={mode:'walk',insideShip:true,roverOccupied:true};assert.equal(occupiesShip(rover),false);
 assert.equal(occupiesShip({mode:'walk',insideShip:false}),false);assert.equal(occupiesShip({mode:'eva',insideShip:true}),false);
 let shots=0;const policy=new PiratePerimeter({onShot:()=>shots++});step(policy,6.8);const before=shots;assert.ok(before>0);step(policy,30,{ship:occupiesShip(rover)});assert.equal(policy.phase,'idle');assert.equal(shots,before);
 rover.roverOccupied=false;step(policy,5,{ship:occupiesShip(rover)});assert.equal(shots,before,'Re-entering an aircraft starts a new warning, without queued burst hits.');
});
test('actual world collision accepts the pad, blocks walls, opens the door and carries both ramps',()=>{
 const s=pirateLayout(),q=new Quaternion(...s.claim.quaternion),origin=new Vector3(...s.claim.origin),world=a=>new Vector3(...a).applyQuaternion(q).add(origin),nav={position:world(s.approach),orientation:q,layout:SHIP_LAYOUT,mode:'flight'},collision=createPirateCollision(new Scene(),nav,[s.claim,s.outerClaim]);
 try{
  assert.equal(collision.blocked,false);assert.equal(collision.error,'');assert.equal(collision.claims.length,2);
  for(const layout of [SHIP_LAYOUT,KESTREL_LAYOUT,FREIGHTER_LAYOUT,GANNET_LAYOUT,STRATUM_LAYOUT]){nav.layout=layout;const surface=collision.landingSurface({position:world(s.pad.position),orientation:q});assert.equal(surface?.size,'L',layout.id??'nomad');assert.ok(surface.point.distanceTo(world(s.pad.position))<1e-6);}nav.layout=SHIP_LAYOUT;
  const eye=SHIP_LAYOUT.eyeHeight,wall=collision.constrainWalker(world([20,s.deck+eye,0]),world([24,s.deck+eye-.1,0]));assert.equal(wall.hit,true);assert.ok(collision.toLocal(wall.point,s.claim).x<22);
  const door=collision.constrainWalker(world([6,s.deck+eye,-10]),world([6,s.deck+eye-.1,-14]));assert.ok(collision.toLocal(door.point,s.claim).z< -13.8);assert.equal(door.grounded,true);
  for(const claim of [s.claim,s.outerClaim]){const ramps=claim.pieces.filter(p=>p.type==='foundation-ramp'),first=ramps[0],last=ramps.at(-1),point=a=>collision.toWorld(new Vector3(...a),claim);let previous=point([first.position[0],first.position[1]+eye,first.position[2]-2]);
   for(let z=first.position[2]-1.9;z<last.position[2]+1.9;z+=.1){const local=collision.toLocal(previous,claim),result=collision.constrainWalker(previous,point([first.position[0],local.y-.06,z]));assert.ok(collision.toLocal(result.point,claim).z>z-.02,`${claim.name} ramp blocked at${z}`);assert.equal(result.grounded,true,`${claim.name} ramp lacks real support at${z}`);previous=result.point;}
  }
 }finally{collision.dispose();}
});
test('readonly kit instancing preserves local nested transforms and releases without changing collision sources',()=>{
 const group=new Group();group.position.set(22e9,4e8,-3e6);group.rotation.y=.7;const geometry=new BoxGeometry(4,3,.3),material=new MeshStandardMaterial(),models=new Map(),pieces=[];
 for(let i=0;i<7;i++){const root=new Group(),nested=new Group(),mesh=new Mesh(geometry,material.clone());if(i===3)mesh.material.color.set('red');if(i===4)mesh.material.roughness=.17;if(i>=5){mesh.material.map=new Texture();mesh.material.map.toJSON=()=>{throw Error('Instancing must not encode texture pixels');};}root.position.set(i*4,5,-12);root.rotation.y=i*Math.PI/2;nested.position.set(.2,.3,-.1);root.add(nested);nested.add(mesh);group.add(root);pieces.push({id:`p${i}`,type:i===2?'doorway':'wall'});models.set(`p${i}`,{ready:true,group:root});}
 const buildings={claims:[{id:'c',pieces}],groups:new Map([['c',group]]),models},kit=new PirateStaticKit(buildings);kit.update();assert.deepEqual(kit.state,{originalDraws:2,instancedDraws:1});
 const batch=group.children.find(o=>o.isInstancedMesh),actual=new Matrix4();for(let i=0;i<2;i++){batch.getMatrixAt(i,actual);const root=models.get(`p${i}`).group,nested=root.children[0];root.updateMatrix();nested.updateMatrix();const expected=root.matrix.clone().multiply(nested.matrix);actual.elements.forEach((n,j)=>assert.ok(Math.abs(n-expected.elements[j])<1e-5));assert.equal(nested.children[0].visible,false);}
 for(const id of ['p2','p3','p4','p5','p6'])assert.equal(models.get(id).group.children[0].children[0].visible,true,'Door and differently coloured/rough materials retain independent draws');kit.update();assert.equal(group.children.filter(o=>o.isInstancedMesh).length,1);
 buildings.groups.clear();buildings.claims=[];kit.update();assert.deepEqual(kit.state,{originalDraws:0,instancedDraws:0});assert.equal(group.children.filter(o=>o.isInstancedMesh).length,0);assert.equal(models.get('p0').group.children[0].children[0].visible,true);kit.dispose();
});
test('short tripod lighting stays capped and reused pooled slots restore mast defaults',()=>{
 const scene=new Scene(),lights=createFloodlights(scene),zero=new Vector3(),fixture={id:'tripod',position:new Vector3(0,1.5,0),target:new Vector3(0,0,-11),intensity:90,range:28};
 lights.update([fixture],zero,zero);const light=scene.children.find(o=>o.isSpotLight);assert.equal(light.intensity,90);assert.equal(light.distance,28);assert.equal(light.shadow.camera.far,28);
 lights.update([{...fixture,intensity:9000,range:999}],zero,zero);assert.equal(light.intensity,1500);assert.equal(light.distance,75);
 lights.update([{id:'mast',position:new Vector3(0,6,0),target:new Vector3(0,0,-18)}],zero,zero);assert.equal(light.intensity,1500);assert.equal(light.distance,75);assert.equal(light.shadow.camera.far,75);assert.equal(scene.children.filter(o=>o.isSpotLight).length,6);lights.dispose();
});
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
