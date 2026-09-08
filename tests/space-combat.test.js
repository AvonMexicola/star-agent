import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Vector3,Quaternion} from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {integrity,damage,recharge,segmentSphere,interceptPoint,projectileSpan,CombatSimulation} from '../src/combat/simulation.js';
import {shipWeaponProfile,SHIP_WEAPON_SIZES} from '../src/ship-weapon-profiles.js';
import {prepareShipWeaponKit,attachShipWeapons} from '../src/ship-weapons.js';
const pose=(p=new Vector3())=>({position:p,velocity:new Vector3(),orientation:new Quaternion()});
function arm(enemy,{position=new Vector3(2,1,-4),direction=new Vector3(0,0,-1),type='pulse'}={}){
 const profile=shipWeaponProfile(type,SHIP_WEAPON_SIZES[enemy.ship]);
 const muzzle={position,direction,type,profile,size:profile.size,mount:'HP_Test',index:0};
 const armament={requests:0,shots:0,nextMuzzle(options){assert.deepEqual(options,{local:true});this.requests++;return muzzle;},fired(value){assert.equal(value,muzzle);this.shots++;}};
 enemy.armament=armament;return armament;
}
test('shields absorb, excess damages hull, recharge waits six seconds and death is terminal',()=>{
 const hp=integrity('kestrel');assert.equal(damage(hp,150),150);assert.equal(hp.shield,0);assert.equal(hp.hull,150);
 recharge(hp,5.9);assert.equal(hp.shield,0);recharge(hp,.2);assert.ok(Math.abs(hp.shield-2)<1e-8);
 damage(hp,Infinity);assert.equal(hp.hull,150);damage(hp,9999);assert.equal(hp.hull,0);recharge(hp,100);assert.equal(hp.shield,0);
});
test('sweeps hit thin targets at orbital coordinates and reject near misses',()=>{
 const c=new Vector3(25e9,3e9,-5e9),a=c.clone().add(new Vector3(-100,0,0)),b=c.clone().add(new Vector3(100,0,0));
 assert.equal(segmentSphere(a,b,c,10),.45);assert.equal(segmentSphere(a,b,c.clone().add(new Vector3(0,11,0)),10),null);assert.equal(segmentSphere(c,b,c,10),0);
});
test('lead predicts a crossing target and handles hitscan and impossible interception',()=>{
 const p=interceptPoint(new Vector3(),new Vector3(0,0,-450),new Vector3(100,0,0),450);assert.ok(p.x>100&&p.x<104);
 assert.deepEqual(interceptPoint(new Vector3(),p,new Vector3(100,0,0),Infinity),p);
 assert.ok(interceptPoint(new Vector3(),p,new Vector3(1000,0,0),110).toArray().every(Number.isFinite));
});
test('mission requires arrival, supports suspension, two distinct pilots, abandonment and one debrief',()=>{
 const sim=new CombatSimulation();assert.ok(sim.accept(new Vector3(0,0,-3000),new Quaternion()));assert.equal(sim.accept(new Vector3(),new Quaternion()),false);
 sim.update(.1,pose());assert.equal(sim.phase,'transit');sim.update(.1,{...pose(new Vector3(0,0,-2200)),active:false});assert.equal(sim.phase,'transit');
 sim.update(.1,pose(new Vector3(0,0,-2200)));assert.equal(sim.phase,'engage');assert.deepEqual(sim.enemies.map(e=>e.ship),['nomad','kestrel']);
 const selected=sim.targetId;sim.cycle();assert.notEqual(sim.targetId,selected);
 for(const e of sim.enemies)e.integrity.hull=0;sim.update(.1,pose());assert.equal(sim.phase,'complete');assert.ok(sim.debrief());assert.equal(sim.debrief(),false);assert.equal(sim.completed,1);
 assert.ok(sim.accept(new Vector3(),new Quaternion()));assert.ok(sim.abort());assert.equal(sim.enemies.length,0);
});
test('projectiles travel, sweep targets, obey obstructions and stop damaging destroyed hulls',()=>{
 const sim=new CombatSimulation();sim.accept(new Vector3(),new Quaternion());sim.spawn();const e=sim.enemies[0];e.position.set(0,0,-100);e.previous.copy(e.position);sim.enemies[1].position.set(1000,0,0);
 sim.fire(new Vector3(),new Vector3(0,0,-1),'pulse');assert.equal(e.integrity.shield,180);
 sim.update(.1,pose());assert.equal(sim.hits,0);sim.update(.2,pose());assert.equal(sim.hits,1);assert.equal(e.integrity.shield,156);
 sim.fire(new Vector3(),new Vector3(0,0,-1),'laser',{distance:20});assert.equal(sim.hits,1);
 e.position.set(0,0,-100);sim.fire(new Vector3(),new Vector3(0,0,-1),'laser');assert.equal(sim.hits,2);
});
test('NPCs maneuver and hit a stationary player; death fails and repair restores',()=>{
 const sim=new CombatSimulation();sim.accept(new Vector3(0,0,-500),new Quaternion());
 let strategies=new Set();for(let i=0;i<1800&&sim.phase!=='failed';i++){sim.update(.05,pose());for(const e of sim.enemies){strategies.add(e.strategy);if(!e.armament)arm(e);}}
 assert.ok(sim.incomingHits>0);assert.ok(strategies.has('attack'));assert.ok(strategies.has('break'));assert.equal(sim.phase,'failed');assert.equal(sim.player.hull,0);assert.equal(sim.projectiles.length,0);sim.repair();assert.equal(sim.player.hull,sim.player.maxHull);
});
test('ship size chooses canonical damage, speed and range; an explicit fitted profile wins',()=>{
 for(const [ship,size,factor] of [['nomad',1,1],['kestrel',2,1.75],['atlas',3,3]]){
  const events=[],sim=new CombatSimulation({onHit:hit=>events.push(hit)});sim.setShip(ship);sim.accept(new Vector3(),new Quaternion());sim.spawn();
  const e=sim.enemies[0];e.position.set(0,0,-100);e.previous.copy(e.position);sim.enemies[1].position.set(1000,0,0);
  sim.fire(new Vector3(),new Vector3(0,0,-1),'laser');
  assert.equal(e.integrity.shield,180-48*factor);assert.equal(events[0].profile.size,size);assert.equal(events[0].weapon,'laser');
  const projectile=sim.fire(new Vector3(),new Vector3(0,0,-1),'pulse');
  assert.equal(projectile.damage,24*factor);assert.equal(projectile.speed,450*[1,1.11,1.22][size-1]);assert.equal(projectile.remaining,[1600,1900,2200][size-1]);
 }
 const sim=new CombatSimulation(),profile=shipWeaponProfile('void',3);
 const shot=sim.fire(new Vector3(),new Vector3(0,0,-1),'void',null,profile);
 assert.equal(sim.shipId,'nomad');assert.equal(shot.profile,profile);assert.equal(shot.damage,300);assert.equal(shot.speed,110*1.22);
});
test('a projectile tail starts at its actual muzzle and stays behind its travelling tip',()=>{
 const start=new Vector3(25e9,3e9,-5e9),direction=new Vector3(1,2,-3).normalize();
 for(const type of ['pulse','void'])for(const size of [1,2,3]){
  const sim=new CombatSimulation(),profile=shipWeaponProfile(type,size),shot=sim.fire(start,direction,type,null,profile);
  assert.equal(projectileSpan(shot).length,0);
  const maximum=(type==='void'?1.4:8)*profile.effectScale;
  for(const travelled of [.001,.1,1,8,100]){
   shot.travelled=travelled;shot.position.copy(start).addScaledVector(direction,travelled);
   const span=projectileSpan(shot,maximum),tail=span.position.clone().addScaledVector(direction,-span.length*.5),tip=span.position.clone().addScaledVector(direction,span.length*.5);
   assert.ok(span.length<=travelled&&span.length<=maximum);
   assert.ok(tail.clone().sub(start).dot(direction)>-1e-5,'tail never crosses behind the barrel, including at astronomical origins');
   assert.ok(tip.distanceTo(shot.position)<1e-5);assert.ok(span.position.toArray().every(Number.isFinite));
  }
 }
});
test('NPC shots require a fitted muzzle and use the just-updated simulation pose with a fixed bore',()=>{
 const shots=[],queries=[],sim=new CombatSimulation({onShot:shot=>shots.push({start:shot.position.clone(),direction:shot.direction.clone(),profile:shot.profile}),obstruction:(...args)=>{queries.push(args);return null;}});
 const origin=new Vector3(25e9,3e9,-5e9),q=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),.7);
 sim.accept(origin,q);sim.spawn();sim.enemies=sim.enemies.slice(0,1);const e=sim.enemies[0];
 e.position.copy(origin);e.orientation.copy(q);e.velocity.set(30,2,0);e.cooldown=0;
 const player=origin.clone().add(new Vector3(0,0,-600).applyQuaternion(q));
 sim.update(.1,pose(player));assert.equal(shots.length,0,'no kit means no invisible fallback barrel');
 e.armament={status:'unavailable'};sim.update(.1,pose(player));assert.equal(shots.length,0,'an unavailable armament cannot fire or crash the simulation');
 const localPosition=new Vector3(2,1,-4),localDirection=new Vector3(0,0,-1),armament=arm(e,{position:localPosition,direction:localDirection});
 const previous=e.position.clone(),previousOrientation=e.orientation.clone();
 e.cooldown=0;sim.update(.1,pose(player));assert.equal(shots.length,1);assert.equal(armament.shots,1);
 const expectedStart=localPosition.clone().applyQuaternion(e.orientation).add(e.position),expectedDirection=localDirection.clone().applyQuaternion(e.orientation).normalize();
 assert.ok(shots[0].start.distanceTo(expectedStart)<1e-6);assert.ok(shots[0].direction.distanceTo(expectedDirection)<1e-10);
 assert.ok(shots[0].start.distanceTo(localPosition.clone().applyQuaternion(previousOrientation).add(previous))>.1,'previous rendered pose would be observably wrong');
 assert.ok(queries[0][0].distanceTo(expectedStart)<1e-6);assert.equal(queries[0][2],1600);assert.ok(Math.abs(e.cooldown-1.5)<1e-12);
 arm(e,{direction:new Vector3(1,0,0)});e.cooldown=0;sim.update(.1,pose(player));assert.equal(shots.length,1,'a sideways barrel is not aimed artificially at the player');
});
test('NPC barrel obstruction caps travel and creates a sized wall impact without damaging a covered player',()=>{
 const impacts=[],sim=new CombatSimulation({onHit:hit=>impacts.push(hit),obstruction:(start,direction)=>({distance:10,point:start.clone().addScaledVector(direction,10),normal:direction.clone().negate()})});
 sim.accept(new Vector3(),new Quaternion());sim.spawn();sim.enemies=sim.enemies.slice(1);const e=sim.enemies[0];
 e.position.set(0,0,0);e.orientation.identity();e.cooldown=0;const armament=arm(e,{position:new Vector3(0,0,-4)});
 sim.update(.1,pose(new Vector3(0,0,-600)));
 assert.equal(armament.shots,1);assert.equal(sim.incomingHits,0);assert.equal(sim.player.shield,180);assert.equal(sim.projectiles.length,0);
 assert.equal(impacts.length,1);assert.equal(impacts[0].entity,null);assert.equal(impacts[0].profile.size,2);assert.equal(impacts[0].profile.damage,42);assert.ok(Math.abs(e.cooldown-1.75)<1e-12);
});
test('ballistics and hitscan stop at a wall and carry the fitted profile to its impact',()=>{
 for(const type of ['pulse','laser','void']){
  const impacts=[],sim=new CombatSimulation({onHit:hit=>impacts.push(hit)});sim.accept(new Vector3(),new Quaternion());sim.spawn();
  sim.enemies[0].position.set(0,0,-100);sim.enemies[0].previous.copy(sim.enemies[0].position);sim.enemies[1].position.set(1000,0,0);
  const profile=shipWeaponProfile(type,3),wall={distance:10,point:new Vector3(0,0,-10),normal:new Vector3(0,0,1)};
  sim.fire(new Vector3(),new Vector3(0,0,-1),type,wall,profile);if(type!=='laser')sim.update(.1,pose());
  assert.equal(sim.hits,0);assert.equal(impacts.length,1);assert.equal(impacts[0].entity,null);assert.equal(impacts[0].profile,profile);assert.deepEqual(impacts[0].point,wall.point);
 }
});
test('actual fitted NPC barrels fire from the current physics pose despite an unrelated rendered pose',async()=>{
 globalThis.ProgressEvent??=class{constructor(type,init={}){this.type=type;Object.assign(this,init);}};
 const loadGeometry=async path=>{
  const bytes=await readFile(new URL('../'+path,import.meta.url)),length=bytes.readUInt32LE(12),data=JSON.parse(bytes.subarray(20,20+length));
  data.buffers[0].uri='data:application/octet-stream;base64,'+bytes.subarray(28+length).toString('base64');
  // The actual mesh/node buffers are retained. This CPU check has no image
  // decoder or renderer and does not claim material validation.
  for(const material of data.materials??[]){
   for(const key of ['normalTexture','occlusionTexture','emissiveTexture'])delete material[key];
   delete material.pbrMetallicRoughness?.baseColorTexture;delete material.pbrMetallicRoughness?.metallicRoughnessTexture;
  }
  return new GLTFLoader().parseAsync(JSON.stringify(data),'');
 };
 const kit=prepareShipWeaponKit(await loadGeometry('public/models/ship-weapons.glb'));
 for(const [ship,path] of [['nomad','public/models/nomad.glb'],['kestrel','assets/kestrel/kestrel.glb']]){
  const model=(await loadGeometry(path)).scene,armament=attachShipWeapons(model,ship,kit),local=armament.muzzle(0,{local:true});
  model.position.set(230,-45,87);model.quaternion.setFromAxisAngle(new Vector3(1,0,0),1.2);
  const shots=[],sim=new CombatSimulation({onShot:shot=>shots.push(shot.start.clone())}),origin=new Vector3(25e9,3e9,-5e9),orientation=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),.7);
  sim.accept(origin,orientation);sim.spawn();sim.enemies=sim.enemies.filter(e=>e.ship===ship);const e=sim.enemies[0];
  e.position.copy(origin);e.orientation.copy(orientation);e.velocity.set(30,2,0);e.cooldown=0;e.armament=armament;
  const player=origin.clone().add(new Vector3(0,0,-600).applyQuaternion(orientation));
  sim.update(.1,pose(player));
  assert.equal(shots.length,1,ship+' fitted gun did not fire');assert.equal(armament.state.shots,1);assert.equal(armament.state.lastShot.mount,local.mount);
  const expected=local.position.clone().applyQuaternion(e.orientation).add(e.position);
  assert.ok(shots[0].distanceTo(expected)<1e-5,ship+' used stale rendered muzzle coordinates');
  assert.ok(shots[0].distanceTo(armament.muzzle(0,{origin}).position)>1,'rendered pose fixture must differ from the simulation');
  armament.dispose();
 }
});

test('all fifteen regional sorties advertise their exact waves and report only after the final kill',async()=>{
 const {ENCOUNTER_REGIONS,DIFFICULTIES,encounterContract}=await import('../src/combat/encounters.js');
 const names=new Set();
 for(const region of ENCOUNTER_REGIONS)for(const tier of Object.keys(DIFFICULTIES)){
  const contract=encounterContract(region.id,tier),sim=new CombatSimulation();names.add(contract.title);
  sim.accept(new Vector3(),new Quaternion(),contract);sim.update(.1,pose());
  assert.equal(sim.phase,'engage');assert.equal(sim.wave,1);assert.equal(sim.enemies.length,contract.waves[0].length);
  for(let wave=0;wave<contract.waves.length;wave++){
   assert.deepEqual(sim.living.map(e=>e.ship),contract.waves[wave]);
   const target=sim.targetId;sim.cycle();assert.ok(sim.living.some(e=>e.id===sim.targetId));
   if(sim.living.length>1)assert.notEqual(sim.targetId,target);
   for(const enemy of sim.living){assert.equal(enemy.integrity.maxHull,integrity(enemy.ship).maxHull*contract.difficulty.integrity);damage(enemy.integrity,9999);}
   sim.update(.1,pose());
   if(wave<contract.waves.length-1){
    assert.equal(sim.phase,'engage');assert.equal(sim.reinforcementIn,10);assert.equal(sim.debrief(),false);
    for(let i=0;i<200;i++)sim.update(.1,{...pose(),active:false});assert.equal(sim.reinforcementIn,10);
    for(let i=0;i<49;i++)sim.update(.2,pose());assert.equal(sim.wave,1);assert.ok(sim.reinforcementIn>0);
    sim.update(.2,pose());assert.equal(sim.wave,2);assert.equal(sim.reinforcementIn,0);
   }
  }
  assert.equal(sim.phase,'complete');assert.equal(sim.enemies.length,contract.total);
  assert.equal(sim.debrief(),true);assert.equal(sim.debrief(),false);assert.equal(sim.completed,1);
  assert.equal(sim.reports[0].kills,contract.total);assert.equal(sim.reports[0].waves,contract.waves.length);
  assert.equal(sim.reports[0].contractId,contract.id);assert.ok(Number.isFinite(sim.reports[0].seconds));
 }
 assert.equal(names.size,15);
});

test('reinforcement countdown cannot revive an abandoned or destroyed encounter',async()=>{
 const {encounterContract}=await import('../src/combat/encounters.js');
 for(const end of ['abort','death']){
  const sim=new CombatSimulation();sim.accept(new Vector3(),new Quaternion(),encounterContract('belt','hard'));sim.spawn();
  for(const enemy of sim.enemies)damage(enemy.integrity,9999);sim.update(.1,pose());
  assert.equal(sim.reinforcementIn,10);
  if(end==='abort')assert.equal(sim.abort(),true);else damage(sim.player,9999);
  for(let i=0;i<100;i++)sim.update(.2,pose());
  assert.equal(sim.phase,end==='abort'?'aborted':'failed');assert.equal(sim.wave,1);assert.equal(sim.debrief(),false);assert.equal(sim.completed,0);
 }
});

test('regional dispatch keeps beacons over the current body and above the asteroid plane without moving the pilot',async()=>{
 const {ENCOUNTER_REGIONS,encounterRegion,encounterWaypoint}=await import('../src/combat/encounters.js');
 const {bodySurfacePoint,bodyAltitude,SELENE,STAR}=await import('../src/celestial.js');
 const {RING_RADIUS,RING_ROTATION,RING_THICKNESS}=await import('../src/ring-world.js');
 for(const region of ENCOUNTER_REGIONS.filter(r=>r.id!=='belt'))for(const altitude of [180,100000]){
  const position=bodySurfacePoint(new Vector3(0,1,0),region.body,altitude),before=position.clone();
  // Deliberately point directly at the ground: dispatch must still be safe.
  const orientation=new Quaternion().setFromUnitVectors(new Vector3(0,0,-1),new Vector3(0,-1,0));
  assert.equal(encounterRegion(position).id,region.id);
  const point=encounterWaypoint({position,orientation,stationDistance:Infinity},region);
  assert.ok(bodyAltitude(point,region.body)>=20000-1e-6,region.id);assert.equal(encounterRegion(point).id,region.id);assert.deepEqual(position,before);
 }
 const region=ENCOUNTER_REGIONS.find(r=>r.id==='belt'),center=new Vector3(...SELENE.center);
 for(const side of [-1,1]){
  const position=new Vector3(RING_RADIUS,0,side*100).applyQuaternion(RING_ROTATION).add(center),before=position.clone();
  assert.equal(encounterRegion(position).id,'belt');
  const point=encounterWaypoint({position,orientation:new Quaternion()},region),local=point.clone().sub(center).applyQuaternion(RING_ROTATION.clone().invert());
  assert.ok(Math.abs(local.z)>RING_THICKNESS/2+2000);assert.equal(encounterRegion(point).id,'belt');assert.deepEqual(position,before);
 }
 assert.equal(encounterRegion(new Vector3(...STAR.center)),null);
});

test('difficulty affects real NPC handling and firing pressure while retaining sized weapon damage',async()=>{
 const {encounterContract}=await import('../src/combat/encounters.js');
 const results=[];
 for(const tier of ['easy','standard','hard']){
  const sim=new CombatSimulation();sim.accept(new Vector3(),new Quaternion(),encounterContract('aeon',tier));sim.spawn();sim.enemies=sim.enemies.slice(0,1);
  const e=sim.enemies[0];e.position.set(0,0,0);e.orientation.identity();e.cooldown=0;arm(e,{position:new Vector3(0,0,-4)});
  sim.update(.1,pose(new Vector3(0,0,-600)));
  assert.equal(e.armament.shots,1);assert.equal(sim.projectiles[0].damage,24);
  results.push({cooldown:e.cooldown,hull:e.integrity.maxHull});
 }
 assert.ok(results[0].cooldown>results[1].cooldown&&results[1].cooldown>results[2].cooldown);
 assert.ok(results[0].hull<results[1].hull&&results[1].hull<results[2].hull);
});

test('reports isolate each sortie, stay bounded and cannot be edited through a state snapshot',async()=>{
 const {encounterContract}=await import('../src/combat/encounters.js');
 const sim=new CombatSimulation();
 for(let i=0;i<14;i++){
  sim.accept(new Vector3(),new Quaternion(),encounterContract('aeon','easy'));sim.spawn();
  sim.fire(new Vector3(),new Vector3(0,0,-1));sim.enemies[0].integrity.hull=0;sim.update(.1,pose());
  assert.ok(sim.debrief());assert.equal(sim.reports[0].shots,1);
 }
 assert.equal(sim.completed,14);assert.equal(sim.reports.length,12);assert.equal(sim.reports.at(-1).id,3);
 const snapshot=sim.state;snapshot.reports[0].kills=999;assert.equal(sim.state.reports[0].kills,1);
});

test('filing later preserves the actual finish hull, ship and shot count',async()=>{
 const {encounterContract}=await import('../src/combat/encounters.js');
 const sim=new CombatSimulation();sim.accept(new Vector3(),new Quaternion(),encounterContract('pyre','easy'));sim.spawn();
 damage(sim.player,190);sim.fire(new Vector3(),new Vector3(0,0,-1));sim.enemies[0].integrity.hull=0;sim.update(.1,pose());
 const hull=sim.player.hull;sim.repair();sim.setShip('atlas');sim.fire(new Vector3(),new Vector3(0,0,-1));
 sim.update(.2,pose());assert.ok(sim.debrief());assert.equal(sim.reports[0].hull,hull);assert.equal(sim.reports[0].ship,'nomad');assert.equal(sim.reports[0].shots,1);
});
