import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Quaternion} from 'three';
import {integrity,damage,recharge,segmentSphere,interceptPoint,CombatSimulation} from '../src/combat/simulation.js';
const pose=(p=new Vector3())=>({position:p,velocity:new Vector3(),orientation:new Quaternion()});
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
 let strategies=new Set();for(let i=0;i<1800&&sim.phase!=='failed';i++){sim.update(.05,pose());for(const e of sim.enemies)strategies.add(e.strategy);}
 assert.ok(sim.incomingHits>0);assert.ok(strategies.has('attack'));assert.ok(strategies.has('break'));assert.equal(sim.phase,'failed');assert.equal(sim.player.hull,0);assert.equal(sim.projectiles.length,0);sim.repair();assert.equal(sim.player.hull,sim.player.maxHull);
});
