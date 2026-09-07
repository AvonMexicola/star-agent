import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createStationSecurity} from '../server/security.js';
import {shoot} from '../server/combat.js';
import {SHIP_LAYOUT} from '../src/boarding.js';
import {AEON_STATION_ID,STATION_PROTECTION_RADIUS,STATION_DEFENSE_MOUNTS,protectionAt,securityStations,defensePose} from '../src/station-security-policy.js';

const center=new THREE.Vector3(25_000_000_000,1_900_000,0);
function player(id,offset=[0,0,0]) {
  return {id,account:{id},health:100,shipHealth:100,weapon:'rifle-laser',inventory:{revision:0,containers:{pack:{'rifle-laser':1,'carbine-charge':10}}},
    nav:{position:center.clone().add(new THREE.Vector3(...offset)),orientation:new THREE.Quaternion(),shipOrientation:new THREE.Quaternion(),
      velocity:new THREE.Vector3(),shipVelocity:new THREE.Vector3(),mode:'walk',normal:new THREE.Vector3(0,1,0),layout:SHIP_LAYOUT}};
}
function setup(areFriends=async()=>false) {
  const strikes=[],errors=[],world={center};
  const service=createStationSecurity({world,areFriends,onStrike:(a,b,e)=>strikes.push(e),onError:e=>errors.push(e)});
  return {service,strikes,errors,world};
}
const incident=(attacker,victim,extra={})=>({id:'shot:1',attacker,victim,kind:'player',cause:'shot',point:victim.nav.position.clone(),damage:25,...extra});

test('Aeon is a fixed inclusive 30 km sphere; other stations require registry entries',()=>{
  const stations=securityStations({center});
  assert.equal(stations[0].id,AEON_STATION_ID);
  for(const delta of [STATION_PROTECTION_RADIUS-.001,STATION_PROTECTION_RADIUS])assert.ok(protectionAt(stations,center.clone().add(new THREE.Vector3(delta,0,0))));
  assert.equal(protectionAt(stations,center.clone().add(new THREE.Vector3(30000.001,0,0))),null);
  assert.equal(protectionAt(stations,new THREE.Vector3(Infinity,0,0)),null);
  const future={id:'selene-port',center:center.clone().add(new THREE.Vector3(100000,0,0)),radius:4000};
  assert.equal(protectionAt(securityStations({center,securityStations:[future]}),center),null);
  assert.equal(protectionAt([future],future.center),future);
});

test('a nonfriend shooting in from outside is killed once, from an actual named barrel',async()=>{
  const {service,strikes}=setup(),a=player('a',[30010,0,0]),b=player('b',[29990,0,0]);
  const attack=incident(a,b);
  const result=await service.submit(attack);
  assert.equal(result.damage,25);assert.equal(b.health,75);
  assert.equal(a.health,0);assert.equal(a.shipHealth,0);assert.equal(a.nav.mode,'crashed');assert.equal(a.weapon,null);
  assert.equal(strikes.length,1);assert.equal(strikes[0].stationId,AEON_STATION_ID);
  assert.ok(STATION_DEFENSE_MOUNTS.some(m=>m.id===strikes[0].mountId));
  assert.ok(new THREE.Vector3(...strikes[0].origin).distanceTo(center)>600);
  await service.submit(attack);assert.equal(strikes.length,1);
});

test('a protected attacker cannot extend the sphere around a victim outside',async()=>{
  let reads=0;const {service,strikes}=setup(async()=>{reads++;return false;});
  const a=player('a',[29990,0,0]),b=player('b',[30001,0,0]);
  await service.submit(incident(a,b));
  assert.equal(a.health,100);assert.equal(b.health,75);assert.equal(strikes.length,0);assert.equal(reads,0);
});

test('friendship is awaited: accepted friends take ordinary damage without retaliation',async()=>{
  let resolve;const {service,strikes}=setup(()=>new Promise(r=>resolve=r));
  const a=player('a'),b=player('b',[0,0,-20]);
  const task=service.submit(incident(a,b));
  assert.equal(service.pending(a),true);assert.equal(b.health,100);assert.equal(a.health,100);
  resolve(true);const result=await task;
  assert.equal(result.friend,true);assert.equal(b.health,75);assert.equal(a.health,100);assert.deepEqual(strikes,[]);
  await service.settle(a);assert.equal(service.pending(a),false);
});

test('pending, removed and blocked relationships follow the current authoritative predicate',async()=>{
  let accepted=true;const {service,strikes}=setup(async()=>accepted);
  const a=player('a'),b=player('b');
  await service.submit(incident(a,b));assert.equal(a.health,100);
  accepted=false;
  await service.submit(incident(a,b,{id:'shot:2'}));
  assert.equal(a.health,0);assert.equal(b.health,50);assert.equal(strikes.length,1);
});

test('a friendship outage or invalid response cannot guess that a friend is hostile',async()=>{
  for(const relation of [async()=>{throw new Error('unavailable');},async()=>({friend:true})]) {
    const {service,strikes,errors}=setup(relation),a=player('a'),b=player('b');
    const result=await service.submit(incident(a,b));
    assert.equal(result.reason,'friendship-unavailable');assert.equal(a.health,100);assert.equal(b.health,100);
    assert.equal(strikes.length,0);assert.equal(errors.length,1);
  }
});

test('late decisions cannot hit a respawn, but moving outside does not erase an incident',async()=>{
  for(const respawn of ['attacker','victim',null]) {
    let finish;const {service,strikes}=setup(()=>new Promise(r=>finish=r)),a=player('a'),b=player('b');
    const task=service.submit(incident(a,b));
    if(respawn==='attacker')a.nav={...a.nav};
    if(respawn==='victim')b.nav={...b.nav};
    a.nav.position.addScalar(100000);b.nav.position.addScalar(100000);
    finish(false);await task;
    assert.equal(strikes.length,respawn?0:1);assert.equal(b.health,respawn?100:75);
  }
});

test('a disconnected aggressor can still settle against the captured player before persistence',async()=>{
  let finish;const {service,strikes}=setup(()=>new Promise(r=>finish=r)),a=player('a'),b=player('b');
  service.submit(incident(a,b));
  const left=service.settle(a);finish(false);await left;
  assert.equal(a.health,0);assert.equal(strikes.length,1);
});

test('damaging hull rams and hull shots use the same penalty; harmless and invalid reports do nothing',async()=>{
  for(const cause of ['shot','ram']) {
    const {service}=setup(),a=player('a'),b=player('b');
    await service.submit(incident(a,b,{kind:'ship',cause,damage:7}));
    assert.equal(b.health,100);assert.equal(b.shipHealth,93);assert.equal(a.health,0);
  }
  for(const extra of [{damage:0},{damage:NaN},{cause:'clientHit'},{kind:'planet'},{id:null},{point:new THREE.Vector3(Infinity,0,0)}]) {
    const {service}=setup(),a=player('a'),b=player('b');
    assert.equal((await service.submit(incident(a,b,extra))).accepted,false);
    assert.equal(a.health,100);assert.equal(b.health,100);
  }
});

test('real combat can defer damage until protection resolves; occluded shots create no incident',async()=>{
  const a=player('a'),b=player('b',[0,0,-20]),{service}=setup();
  const shot=shoot({shooter:a,players:[a,b],world:{},now:1000,deferDamage:true});
  assert.equal(shot.targetId,'b');assert.equal(b.health,100);assert.equal(a.inventory.containers.pack['carbine-charge'],9);
  await service.submit(incident(a,b,{damage:shot.damage}));assert.equal(b.health,75);assert.equal(a.health,0);
  const c=player('c'),d=player('d',[0,0,-20]);
  const blocked=shoot({shooter:c,players:[c,d],world:{occludes:()=>5},now:1000,deferDamage:true});
  assert.equal(blocked.targetId,undefined);assert.equal(d.health,100);
});

test('turret transforms stay accurate after station rotation and world-origin rebasing',()=>{
  const orientation=new THREE.Quaternion().setFromEuler(new THREE.Euler(.5,.8,-.4));
  const station={center,orientation};
  for(const mount of STATION_DEFENSE_MOUNTS)for(const barrel of [0,1])for(const offset of [[1000,1000,3000],[-23000,-7000,11000]]) {
    const target=center.clone().add(new THREE.Vector3(...offset).applyQuaternion(orientation));
    const pose=defensePose(station,mount,target,barrel);
    assert.ok(pose.direction.angleTo(target.clone().sub(pose.origin).normalize())<1e-6);
    const localStation={...station,center:new THREE.Vector3()},local=defensePose(localStation,mount,target.clone().sub(center),barrel);
    assert.ok(local.origin.distanceTo(pose.origin.clone().sub(center))<1e-5);
  }
});
