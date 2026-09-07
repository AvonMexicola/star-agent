import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {ParticlePool} from '../src/effects/particles.js';
import {EnergyEffects} from '../src/effects/energy-effects.js';
import {ENGINE_EXHAUST,enginePresentation} from '../src/effects/engine-state.js';
import {SHIP_LAYOUT} from '../src/boarding.js';
import {shipHandling} from '../src/ship-handling.js';
const v=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);

test('particle pool stays bounded and preserves centimetres at stellar coordinates',()=>{
 const pool=new ParticlePool(new THREE.Scene(),8),origin=v(25e9,-3e9,4e9);
 for(let i=0;i<100;i++)pool.emit(origin.clone().add(v(.03125,0,0)),v(),{life:1});
 pool.update(.02,origin);assert.equal(pool.count,8);
 assert.equal(pool.geometry.attributes.end.getX(0),.03125);
 pool.update(2,origin);assert.equal(pool.count,0);pool.dispose();
});
test('reused travel slots cannot drag world sparks with the camera',()=>{
 const pool=new ParticlePool(new THREE.Scene(),1);
 pool.emit(v(),v()).cameraLocal=true;
 assert.equal(pool.emit(v(),v()).cameraLocal,false);pool.dispose();
});
test('reused engine slots cannot retire a later weapon or mining particle',()=>{
 const pool=new ParticlePool(new THREE.Scene(),1);
 assert.equal(pool.emit(v(),v(),{engine:true}).engine,true);
 assert.equal(pool.emit(v(),v()).engine,false);pool.dispose();
});
test('ore converges on a moving collector and retires without adding inventory',()=>{
 const pool=new ParticlePool(new THREE.Scene(),16),collector=v(3,0,0);
 pool.emit(v(),v(0,2,0),{attract:true,life:2});
 for(let i=0;i<120;i++){collector.x+=.002;pool.update(1/120,v(),collector);}
 assert.equal(pool.count,0);pool.dispose();
});
test('missed beams emit no contact sparks or collection; committed yields do',()=>{
 const fx=new EnergyEffects(new THREE.Scene()),camera=new THREE.PerspectiveCamera();
 fx.update(.05,{origin:v(),camera,mining:{active:true,start:v(),end:v(0,0,-5),hit:false}});
 assert.equal(fx.state.miningContacts,0);assert.equal(fx.state.particles,0);
 fx.collect(v(),[0,0,0]);assert.equal(fx.state.collectedBursts,0);
 fx.collect(v(),[.01,0,0]);assert.equal(fx.state.collectedBursts,1);
 fx.update(.02,{origin:v(),camera});assert.ok(fx.state.particles>0);fx.dispose();
});
test('weapon impact happens at arrival, once, and bolts expire on misses',()=>{
 const fx=new EnergyEffects(new THREE.Scene());let impacts=0;fx.impact=()=>impacts++;
 fx.fire(v(),v(0,0,-1),{speed:100,hit:{point:v(0,0,-10)}});
 fx.update(.05,{origin:v()});assert.equal(impacts,0);
 fx.update(.05,{origin:v()});assert.equal(impacts,1);assert.equal(fx.state.bolts,0);
 fx.fire(v(),v(0,0,-1),{speed:100,range:5});fx.update(.1,{origin:v()});assert.equal(fx.state.bolts,0);assert.equal(impacts,1);fx.dispose();
});
test('transit reset and suspended frames clear trails, light, jets and bolts',()=>{
 const fx=new EnergyEffects(new THREE.Scene());fx.fire(v(),v(0,0,-1));
 fx.update(.02,{origin:v()});assert.ok(fx.state.particles>0);
 fx.update(.02,{origin:v(25e9),suspended:true});assert.equal(fx.state.particles,0);assert.equal(fx.state.bolts,0);assert.equal(fx.light.intensity,0);fx.dispose();
});
test('travel responds to speed and reduced motion suppresses speed streaks',()=>{
 const fx=new EnergyEffects(new THREE.Scene()),camera=new THREE.PerspectiveCamera();
 for(let i=0;i<60;i++)fx.update(1/60,{origin:v(),camera,flying:true,inSpace:true,velocity:v(0,0,-1e6)});
 assert.ok(fx.state.travel>.8);assert.ok(fx.state.particles>10);
 fx.reducedMotion=true;fx.reset();fx.update(.1,{origin:v(),camera,flying:true,inSpace:true,velocity:v(0,0,-1e6)});
 assert.equal(fx.state.travel,0);assert.equal(fx.state.particles,0);fx.dispose();
});

test('extraction event follows successful commit, rejects replay and quota failure',async()=>{
 const {MineableRock}=await import('../src/mining/rock.js');
 const {createDensity,carve,meshVolume}=await import('../src/mining/volume.js');
 const worker={postMessage(data){this.message=data;},terminate(){}},storage={getItem:()=>null,setItem(){}},rock=new MineableRock(new THREE.Scene(),storage,{worker});
 const field=createDensity(),mesh=meshVolume(field);let events=0;
 rock.onExtract=()=>events++;
 rock.receive({id:worker.message.id,...mesh,field,meshMs:1});assert.equal(events,0);
 rock.request([0,0,1.35],.02);const result=carve(field,[0,0,1.35],.02),reply={id:worker.message.id,...result,...meshVolume(result.field),meshMs:1};
 rock.receive(reply);assert.equal(events,1);assert.ok(rock.store.mass>0);
 rock.receive(reply);assert.equal(events,1);
 rock.request([0,0,1.35],.02);storage.setItem=()=>{throw Error('quota');};
 const next=carve(result.field,[0,0,1.35],.02);rock.receive({id:worker.message.id,...next,...meshVolume(next.field),meshMs:1});assert.equal(events,1);rock.dispose();
});

test('laser is immediate, colored and range-limited; its beam retires on reset',()=>{
 const fx=new EnergyEffects(new THREE.Scene());
 fx.fire(v(),v(0,0,-1),{weapon:'laser',color:0xff2222,hit:{point:v(0,0,-10)}});
 assert.equal(fx.state.weaponImpacts,1);assert.equal(fx.state.lances,1);assert.equal(fx.state.bolts,0);
 assert.ok(fx.lances[0].tint.r>fx.lances[0].tint.g*3);
 fx.fire(v(),v(0,0,-1),{weapon:'laser',range:5,hit:{point:v(0,0,-10)}});assert.equal(fx.state.weaponImpacts,1);
 fx.reset();assert.equal(fx.state.lances,0);fx.dispose();
});
test('singularity retains flight time, produces one impact and obeys the bolt cap',()=>{
 const fx=new EnergyEffects(new THREE.Scene());
 fx.fire(v(),v(0,0,-1),{weapon:'void',hit:{point:v(0,0,-22)}});
 fx.update(.1,{origin:v()});assert.equal(fx.state.weaponImpacts,0);assert.equal(fx.bolts[0].kind,'void');
 fx.update(.1,{origin:v()});assert.equal(fx.state.weaponImpacts,1);
 for(let i=0;i<100;i++)fx.fire(v(),v(0,0,-1),{weapon:'void'});
 assert.equal(fx.state.bolts,32);fx.dispose();
});
test('slipstream geometry rebases locally, preserves log depth and fades completely',async()=>{
 const {Slipstream}=await import('../src/effects/slipstream.js');
 const field=new Slipstream(new THREE.Scene()),origin=v(25e9,2e9,-9e9);
 field.update({origin,velocity:v(0,0,-1e6),intensity:1,time:2},.1);
 assert.ok(field.mesh.visible);assert.ok(field.mesh.position.length()<100);assert.ok(field.material.vertexShader.includes('logdepthbuf_vertex'));assert.ok(field.material.fragmentShader.includes('logdepthbuf_fragment'));
 field.update({origin,velocity:v(),intensity:0,time:3},.1);assert.equal(field.mesh.visible,false);assert.equal(field.material.uniforms.drive.value,0);field.dispose();
});

test('weapon obstruction follows visible station-complex roots at a large render origin',async()=>{
 const {createWeaponTarget}=await import('../src/effects/weapon-target.js');
 const {AEON}=await import('../src/celestial.js');
 const origin=v(1e9,2e9,3e9),group=new THREE.Group();
 const wall=new THREE.Mesh(new THREE.BoxGeometry(4,4,1),new THREE.MeshBasicMaterial());wall.position.z=-4;group.add(wall);
 const hidden=new THREE.Group();hidden.visible=false;const decoy=wall.clone();decoy.position.z=-1;hidden.add(decoy);group.add(hidden);group.updateMatrixWorld(true);
 const nav={station:{pods:[{group}],hub:{group:new THREE.Group()}},stationDistance:90000,body:AEON,normal:v(0,1,0)};
 const target=createWeaponTarget({nav,mining:{raycast:()=>null}});
 const hit=target(origin,v(0,0,-1),origin,20);
 assert.ok(hit);assert.ok(Math.abs(hit.distance-3.5)<1e-8);assert.ok(hit.point.distanceTo(origin.clone().add(v(0,0,-3.5)))<1e-6);
 group.visible=false;assert.equal(target(origin,v(0,0,-1),origin,20),null);
 wall.geometry.dispose();wall.material.dispose();
});

 test('moving muzzle remains attached to a visible laser while its hit endpoint stays fixed',()=>{
 const fx=new EnergyEffects(new THREE.Scene()),muzzle=v(25e9,0,0),end=muzzle.clone().add(v(0,0,-100));let impacts=0;fx.impact=()=>impacts++;
 fx.fire(muzzle,v(0,0,-1),{weapon:'laser',muzzlePosition:()=>muzzle.clone(),hit:{point:end}});
 muzzle.add(v(2,1,-3));fx.update(.016,{origin:muzzle});
 const lance=fx.lances.find(l=>l.active);assert.deepEqual(lance.start,muzzle);assert.deepEqual(lance.end,end);assert.equal(impacts,1);
 fx.update(.1,{origin:muzzle});assert.equal(fx.state.lances,0);fx.dispose();
});
test('ballistic effects carry shooter velocity and hit along the actual trajectory',()=>{
 const fx=new EnergyEffects(new THREE.Scene()),start=v(25e9,0,0),velocity=v(100,0,-200),direction=v(0,0,-1),end=start.clone().add(v(10,0,-65));let impacts=0;fx.impact=()=>impacts++;
 fx.fire(start,direction,{velocity,hit:{point:end}});fx.update(.05,{origin:start});
 assert.ok(fx.bolts[0].p.distanceTo(start.clone().add(v(5,0,-32.5)))<1e-5);assert.equal(impacts,0);
 fx.update(.05,{origin:start});assert.equal(impacts,1);assert.equal(fx.state.bolts,0);fx.dispose();
});

test('a moving weapon flash follows its barrel and sparks inherit launch velocity',()=>{
 const fx=new EnergyEffects(new THREE.Scene()),muzzle=v(25e9,0,0),velocity=v(100,20,0);
 fx.fire(muzzle,v(0,0,-1),{weapon:'pulse',velocity,muzzlePosition:()=>muzzle.clone()});
 const flash=fx.particles.slots.find(p=>p.alive&&p.anchor);
 assert.ok(flash);assert.ok(fx.particles.slots.filter(p=>p.alive&&!p.anchor).every(p=>p.v.x>90));
 fx.update(.016,{origin:muzzle,velocity});muzzle.add(v(2,1,-3));fx.update(.016,{origin:muzzle,velocity});
 assert.deepEqual(flash.p,muzzle);
 // Pool reuse must not retain a prior weapon's anchor.
 fx.particles.cursor=fx.particles.slots.indexOf(flash);fx.particles.emit(v(),v(1,0,0));assert.equal(flash.anchor,null);fx.dispose();
});

const engineNav=(shipId='nomad')=>({shipId,mode:'flight',powered:true,layout:SHIP_LAYOUT,
 position:v(25e9,2e9,-7e9),orientation:new THREE.Quaternion(),shipOrientation:new THREE.Quaternion(),
 velocity:v(),shipVelocity:v(),engineAcceleration:v(0,0,-shipHandling(shipId).thrust),boost:false});

test('all fleet nozzles emit at their own rotated hull pose while Kestrel adds no duplicate jets',()=>{
 for(const shipId of Object.keys(ENGINE_EXHAUST)){
  const fx=new EnergyEffects(new THREE.Scene()),nav=engineNav(shipId),origin=nav.position.clone();
  nav.orientation.setFromAxisAngle(v(0,1,0),.76);nav.engineAcceleration.applyQuaternion(nav.orientation);
  for(let i=0;i<12;i++)fx.update(.05,{origin,engine:enginePresentation(nav)});
  assert.equal(fx.state.engine.nozzleCount,2,shipId);assert.equal(fx.state.engine.activeEmitters,2,shipId);
  assert.equal(fx.state.engine.activeJets,shipId==='kestrel'?0:2,shipId);
  assert.ok(fx.state.engine.particles>0,shipId);
  const hull=enginePresentation(nav).shipPosition;
  fx.jets.forEach((jet,i)=>{
   const socket=v(...ENGINE_EXHAUST[shipId].sockets[i].position).applyQuaternion(nav.orientation).add(hull).sub(origin);
   assert.ok(jet.mesh.position.distanceTo(socket)<.00001,shipId);
   assert.ok(jet.mesh.position.length()<80,'GPU jet coordinates stay within one full-scale hull, not the billion-metre world origin');
   assert.ok(v(0,0,1).applyQuaternion(jet.mesh.quaternion).distanceTo(v(0,0,1).applyQuaternion(nav.orientation))<.00001);
  });
  nav.boost=true;
  for(let i=0;i<12;i++)fx.update(.05,{origin,engine:enginePresentation(nav)});
  assert.ok(Number.isFinite(fx.state.boost)&&fx.state.boost>.8,shipId);
  assert.ok(fx.jets.every(jet=>Number.isFinite(jet.mesh.scale.z)&&jet.mesh.scale.z>ENGINE_EXHAUST[shipId].length));
  assert.ok(fx.particles.slots.filter(p=>p.alive&&p.engine).every(p=>p.p.toArray().every(Number.isFinite)));
  fx.dispose();
 }
});

test('engine stop, reverse, travel and hull changes retire exhaust without deleting combat or mining',()=>{
 const fx=new EnergyEffects(new THREE.Scene()),nav=engineNav(),origin=nav.position.clone();
 const refill=()=>{nav.shipId='nomad';nav.powered=true;nav.travel=null;nav.engineAcceleration.set(0,0,-35);
  for(let i=0;i<8;i++)fx.update(.05,{origin,engine:enginePresentation(nav)});
  assert.ok(fx.state.engine.particles>0);
  fx.fire(origin,v(0,0,-1),{weapon:'laser'});fx.collect(origin,[.01,0,0]);
  return fx.particles.slots.filter(p=>p.alive&&!p.engine);
 };
 for(const change of [()=>{nav.engineAcceleration.set(0,0,0);nav.velocity.set(0,0,-1e6);},
  ()=>nav.engineAcceleration.set(0,0,35),()=>{nav.powered=false;},()=>{nav.travel={};},
  ()=>{nav.shipId='atlas';nav.engineAcceleration.set(0,0,0);}
 ]){
  const other=refill();change();fx.update(.016,{origin,engine:enginePresentation(nav),relativistic:Boolean(nav.travel)});
  assert.equal(fx.state.engine.particles,0);assert.equal(fx.state.engine.activeJets,0);
  assert.equal(fx.state.engine.activeEmitters,0);assert.ok(other.some(p=>p.alive&&!p.engine));
  assert.ok(fx.state.lances>0,'engine lifecycle cannot extinguish a weapon lance');
 }
 fx.dispose();
});

test('suspension and transit jumps clear every effect and restarting stays local',()=>{
 const fx=new EnergyEffects(new THREE.Scene()),nav=engineNav();
 for(let i=0;i<10;i++)fx.update(.05,{origin:nav.position,engine:enginePresentation(nav)});
 assert.ok(fx.state.engine.particles>0);
 fx.update(.05,{origin:nav.position,engine:enginePresentation(nav,{suspended:true}),suspended:true});
 assert.equal(fx.state.engine.particles,0);assert.equal(fx.state.engine.activeJets,0);
 assert.equal(fx.state.engine.state,'suspended');
 nav.position.add(v(0,1e9,3e9));
 fx.update(.05,{origin:nav.position,engine:enginePresentation(nav)});
 assert.ok(fx.jets.every(jet=>jet.mesh.position.length()<15));
 fx.reset();assert.equal(fx.state.particles,0);assert.equal(fx.state.engine.activeEmitters,0);fx.dispose();
});

test('unseated engine particles inherit hull momentum and keep their GPU streaks bounded',()=>{
 const fx=new EnergyEffects(new THREE.Scene()),nav=engineNav('atlas');
 Object.assign(nav,{mode:'walk',cabinFlight:true,insideShip:true,shipPosition:nav.position.clone()});
 nav.shipOrientation.setFromAxisAngle(v(0,1,0),Math.PI/2);nav.engineAcceleration.copy(v(-14,0,0));
 nav.shipVelocity.set(-2e6,0,0);nav.velocity.set(1,0,0);
 for(let i=0;i<12;i++){
  nav.shipPosition.addScaledVector(nav.shipVelocity,.05);nav.position.copy(nav.shipPosition).add(v(0,6,-8));
  fx.update(.05,{origin:nav.position,engine:enginePresentation(nav)});
 }
 const particles=fx.particles.slots.filter(p=>p.alive&&p.engine);
 assert.ok(particles.length>0);assert.ok(particles.every(p=>p.v.x<-1e6));
 assert.ok(particles.every(p=>p.stretch*p.v.length()<=2.00001));
 const attributes=fx.particles.geometry.attributes;
 for(let i=0;i<fx.particles.geometry.instanceCount;i++){
  const start=v().fromBufferAttribute(attributes.start,i),end=v().fromBufferAttribute(attributes.end,i);
  assert.ok(start.distanceTo(end)<=2.001,'large-world velocity cannot draw a solar-system line');
 }
 fx.dispose();
});
