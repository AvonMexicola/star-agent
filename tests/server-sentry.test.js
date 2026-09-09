import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createWorld} from '../server/world.js';
import {createRoom} from '../server/room.js';
import {createMemoryStore} from '../server/database.js';
import {SENTRY_LAYOUT as L} from '../src/sentry/layout.js';

const worldPromise=createWorld();
async function fixture(t,count=2){
  const world=await worldPromise,store=createMemoryStore();let time=100000,requestId=0;
  const errors=[],messages=new Map(),room=createRoom({world,store,autoStart:false,now:()=>time,onError:e=>errors.push(e)});
  t.after(async()=>{await room.close();assert.deepEqual(errors,[]);});
  const players=[];
  for(let i=0;i<count;i++){
    const account=await store.createAccount({email:`sentry${i}@example.test`,callsign:`Sentry_${i}`,passwordHash:'test-only'});
    messages.set(account.id,[]);await room.join(account,m=>messages.get(account.id).push(m));players.push(room.players.get(account.id));
  }
  const request=async(p,fields)=>{await room.receive(p.id,{type:'request',requestId:String(++requestId),action:'sentry',...fields});return messages.get(p.id).findLast(m=>m.type==='ack');};
  const input=(p,value={})=>room.receive(p.id,{type:'input',sequence:p.sequence+1,input:{vehicleReady:true,...value}});
  const advance=(seconds,held=new Map())=>{for(let i=0;i<Math.ceil(seconds*30);i++){for(const [p,value]of held)input(p,value);time+=1000/30;room.tick();}};
  async function deploy(p=players[0]){const reply=await request(p,{command:'deploy',position:[0,0,0],quaternion:[0,0,0,0]});assert.equal(reply.ok,true,reply.error);return room.sentries.vehicles.get('sentry:'+p.id);}
  async function board(p,rover,role){
    // Server fixture placement isolates the request/physics boundary. Browser
    // acceptance separately traverses the real path using standard controls.
    p.nav.position.copy(rover.ground(role));p.nav.mode='walk';p.nav.insideShip=false;
    const reply=await request(p,{command:'board',id:rover.id,role});assert.equal(reply.ok,true,reply.error);
    advance(11);assert.equal(rover.seats[role].phase,'seated');input(p,{});advance(.1);return p;
  }
  return {world,store,room,players,messages,request,input,advance,deploy,board};
}

test('deployment is server placed, hull clear and proximity validated; simultaneous seat claims cannot share a seat',async t=>{
  const f=await fixture(t,3),[p,g,other]=f.players,rover=await f.deploy();
  assert.ok(rover.physics.state.position.length()>1e6);assert.equal(rover.physics.state.supported,true);
  assert.equal((await f.request(g,{command:'board',id:rover.id,role:'gunner'})).ok,false);
  p.nav.position.copy(rover.ground('pilot'));other.nav.position.copy(p.nav.position);
  const claims=await Promise.all([f.request(p,{command:'board',id:rover.id,role:'pilot'}),f.request(other,{command:'board',id:rover.id,role:'pilot'})]);
  assert.equal(claims.filter(x=>x.ok).length,1);assert.equal(rover.seats.pilot.id,p.id);
  assert.equal((await f.request(other,{command:'board',id:rover.id,role:'__proto__'})).ok,false);
  assert.equal((await f.request(g,{command:'exit',id:rover.id})).ok,false);
  assert.equal((await f.request(p,{command:'deploy'})).ok,false);
});

test('server-created neutral cannot arm a new seat or driver epoch; only newer real neutral packets can',async t=>{
  const f=await fixture(t),[p]=f.players,r=await f.deploy();
  p.nav.position.copy(r.ground('pilot'));
  assert.equal((await f.request(p,{command:'board',id:r.id,role:'pilot'})).ok,true);
  // Neutral received during the door animation cannot arm the final seat.
  f.advance(1,new Map([[p,{}]]));
  for(let i=0;i<400&&r.seats.pilot.phase!=='seated';i++)f.advance(1/30,new Map([[p,{fire:true,forward:1}]]));
  assert.equal(r.seats.pilot.phase,'seated');assert.equal(r.state.shots,0);assert.equal(r.controls.throttle,0);
  const sequence=p.sequence;p.input={vehicleReady:true,fire:false,forward:0};f.advance(.1);
  assert.equal(p.sequence,sequence);assert.equal(r.state.armed,false);assert.equal(r.seats.pilot.armed,false);
  f.input(p,{});f.advance(.1);assert.equal(r.state.armed,true);assert.equal(r.seats.pilot.armed,true);
  f.advance(.2,new Map([[p,{fire:true}]]));assert.ok(r.state.shots>0);
  assert.equal(f.messages.get(p.id).some(e=>e.event==='fire'),false,'seated RT never fires a hidden handheld weapon');
  f.advance(.6);assert.equal(r.state.armed,false);assert.equal(r.controls.throttle,0,'stale connection input brakes');
});

test('gunner priority, pilot heading and disconnect fallback are authoritative in actual room snapshots',async t=>{
  const f=await fixture(t),[p,g]=f.players,r=await f.deploy();await f.board(p,r,'pilot');
  f.advance(.3,new Map([[p,{fire:true}]]));const before=r.state.shots;
  g.nav.position.copy(r.ground('gunner'));
  assert.equal((await f.request(g,{command:'board',id:r.id,role:'gunner'})).ok,true);
  f.advance(11,new Map([[p,{fire:true}], [g,{fire:true,forward:1}]]));assert.equal(r.state.shots,before);assert.equal(r.state.controllerId,g.id);assert.equal(r.controls.throttle,0);
  f.input(g,{});f.advance(.1);f.advance(.35,new Map([[g,{fire:true,yaw:.5}],[p,{fire:true}]]));
  assert.ok(r.state.shots>before);assert.equal(r.state.lastShot.by,g.id);
  assert.ok(p.nav.orientation.angleTo(r.physics.state.quaternion)<1e-7);
  const snapshot=f.room.state(p).sentries.find(x=>x.id===r.id);assert.equal(snapshot.seats.gunner.id,g.id);assert.equal(snapshot.controllerId,g.id);
  const shots=r.state.shots;await f.room.leave(g.id);f.advance(2,new Map([[p,{fire:true,forward:1}]]));
  assert.equal(r.state.controllerId,p.id);assert.equal(r.state.shots,shots);assert.equal(r.controls.throttle,0);
  f.input(p,{});f.advance(.1);f.advance(.25,new Map([[p,{fire:true}]]));assert.ok(r.state.shots>shots);assert.equal(r.state.lastShot.by,p.id);
});

test('owner disconnect retains a crewed rover, then last crew disconnect removes the orphan',async t=>{
  const f=await fixture(t),[p,g]=f.players,r=await f.deploy();await f.board(p,r,'pilot');await f.board(g,r,'gunner');
  await f.room.leave(p.id);assert.equal(f.room.sentries.vehicles.size,1);assert.equal(r.seats.pilot.id,null);assert.equal(r.seats.gunner.id,g.id);
  await f.room.leave(g.id);assert.equal(f.room.sentries.vehicles.size,0);assert.deepEqual(f.room.sentries.snapshot(),[]);
});

test('a disconnected owner rover expires after the remaining gunner physically exits and the hatch closes',async t=>{
  const f=await fixture(t),[p,g]=f.players,r=await f.deploy();await f.board(g,r,'gunner');
  await f.room.leave(p.id);assert.equal(f.room.sentries.vehicles.size,1);
  assert.equal((await f.request(g,{command:'exit',id:r.id})).ok,true);f.advance(12);
  assert.equal(g.nav.sentrySeat,null);assert.equal(f.room.sentries.vehicles.size,0);
});

test('barrel hits use fixed damage and preserve the station friendship/protection pipeline',async t=>{
  const f=await fixture(t),[p,victim]=f.players,r=await f.deploy();await f.board(p,r,'pilot');
  // Aim aft and place a peer capsule within a clear station bay ray. This is
  // geometry fixture setup, never a client target/damage upload.
  r.state.yaw=Math.PI;r.state.pitch=0;
  const muzzle=r.muzzlePoses()[0],up=new THREE.Vector3(0,1,0).applyQuaternion(r.physics.state.quaternion);
  victim.nav.mode='eva';victim.nav.insideShip=false;victim.nav.position.copy(muzzle.start).addScaledVector(muzzle.direction,3).addScaledVector(up,.2);victim.nav.velocity.set(0,0,0);
  f.input(p,{});f.advance(.05);f.input(p,{fire:true,damage:1e9,targetId:victim.id});f.advance(1/30);
  await f.room.security.settle(p);
  assert.equal(p.health,0,'station destroys a nonfriend aggressor through the existing security service');
  assert.equal(victim.health,100-L.turret.damage,'only the validated barrel damage is applied before station retaliation');
  assert.ok(f.messages.get(p.id).some(e=>e.event==='stationStrike'));
  assert.ok(L.turret.damage<100);
});

test('ordinary handheld hits damage the Sentry hull, preserve its owner ship and clear both seats on destruction',async t=>{
  const f=await fixture(t,3),[p,g,attacker]=f.players,r=await f.deploy();await f.board(p,r,'pilot');await f.board(g,r,'gunner');
  f.store.areFriends=async()=>true;
  const target=r.world([0,1.8,1.4]),up=new THREE.Vector3(0,1,0).applyQuaternion(r.physics.state.quaternion);
  attacker.nav.mode='eva';attacker.nav.insideShip=false;attacker.nav.position.copy(r.world([-4,1.8,1.4]));attacker.nav.orientation.setFromRotationMatrix(new THREE.Matrix4().lookAt(attacker.nav.position,target,up));attacker.nav.velocity.set(0,0,0);
  const shipHealth=p.shipHealth,crewHealth=[p.health,g.health];
  f.input(attacker,{fire:true});f.advance(1/30);await f.room.security.settle(attacker);
  assert.equal(r.state.health,L.hull-25);assert.equal(p.shipHealth,shipHealth);assert.deepEqual([p.health,g.health],crewHealth);
  assert.equal(attacker.health,100,'friends are exempt from station retaliation');
  assert.ok(f.messages.get(attacker.id).some(e=>e.event==='fire'&&e.kind==='vehicle'&&e.targetId===r.id&&e.damage===25));
  // Keep the gunner firing while real rifle pulses destroy the cabin. No client
  // target or damage fields participate in either weapon path.
  f.input(g,{});f.advance(.1);
  for(let i=0;i<10&&r.state.health>0;i++){
    f.advance(.4,new Map([[attacker,{fire:true}],[g,{fire:true}]]));await f.room.security.settle(attacker);
  }
  assert.equal(r.state.health,0);assert.equal(r.state.destroyed,true);assert.equal(r.state.armed,false);assert.equal(r.state.lastShot,null);
  assert.ok(Object.values(r.seats).every(s=>s.id===null));assert.equal(p.nav.sentrySeat,null);assert.equal(g.nav.sentrySeat,null);
  assert.equal(p.shipHealth,shipHealth);assert.deepEqual([p.health,g.health],crewHealth);
  const shots=r.state.shots;f.advance(1);assert.equal(r.state.shots,shots);
  assert.equal((await f.request(p,{command:'board',id:r.id,role:'pilot'})).ok,false);
  await f.room.leave(p.id);assert.equal(f.room.sentries.vehicles.size,0,'ownerless empty wreck is removed');
});

test('a nonfriend hull shot retaliates against the shooter without damaging the rover owner ship',async t=>{
  const f=await fixture(t),[owner,attacker]=f.players,r=await f.deploy();
  const target=r.world([0,1.8,0]),up=new THREE.Vector3(0,1,0).applyQuaternion(r.physics.state.quaternion);
  attacker.nav.mode='eva';attacker.nav.position.copy(r.world([-4,1.8,0]));attacker.nav.orientation.setFromRotationMatrix(new THREE.Matrix4().lookAt(attacker.nav.position,target,up));attacker.nav.velocity.set(0,0,0);
  const hp=owner.shipHealth;f.input(attacker,{fire:true});f.advance(1/30);await f.room.security.settle(attacker);
  assert.equal(r.state.health,L.hull-25);assert.equal(owner.shipHealth,hp);assert.equal(owner.health,100);assert.equal(attacker.health,0);
});

for(const ownerDisconnected of [false,true])test(`non-owner crew remains a valid hull victim with owner ${ownerDisconnected?'disconnected':'elsewhere'}`,async t=>{
  const f=await fixture(t,3),[owner,gunner,attacker]=f.players,r=await f.deploy();await f.board(gunner,r,'gunner');
  if(ownerDisconnected)await f.room.leave(owner.id);
  f.store.areFriends=async()=>true;
  const target=r.world([0,1.8,1.4]),up=new THREE.Vector3(0,1,0).applyQuaternion(r.physics.state.quaternion);
  attacker.nav.mode='eva';attacker.nav.position.copy(r.world([-4,1.8,1.4]));attacker.nav.orientation.setFromRotationMatrix(new THREE.Matrix4().lookAt(attacker.nav.position,target,up));attacker.nav.velocity.set(0,0,0);
  f.input(attacker,{fire:true});f.advance(1/30);await f.room.security.settle(attacker);
  assert.equal(r.state.health,L.hull-25);assert.equal(gunner.health,100);assert.equal(attacker.health,100);
});

test('one hull debit checks every real crew relationship; a friendly pilot cannot shield a nonfriend gunner',async t=>{
  const f=await fixture(t,3),[pilot,gunner,attacker]=f.players,r=await f.deploy();await f.board(pilot,r,'pilot');await f.board(gunner,r,'gunner');
  const relationships=[];f.store.areFriends=async(a,b)=>{relationships.push([a,b]);return b===pilot.id;};
  const target=r.world([0,1.8,1.4]),up=new THREE.Vector3(0,1,0).applyQuaternion(r.physics.state.quaternion);
  attacker.nav.mode='eva';attacker.nav.position.copy(r.world([-4,1.8,1.4]));attacker.nav.orientation.setFromRotationMatrix(new THREE.Matrix4().lookAt(attacker.nav.position,target,up));attacker.nav.velocity.set(0,0,0);
  f.input(attacker,{fire:true});f.advance(1/30);await f.room.security.settle(attacker);
  assert.equal(r.state.health,L.hull-25,'one validated shot debits the hull once');assert.equal(attacker.health,0);assert.equal(pilot.health,100);assert.equal(gunner.health,100);
  assert.deepEqual(relationships.map(x=>x[1]).sort(),[pilot.id,gunner.id].sort());
  assert.equal(f.messages.get(attacker.id).findLast(e=>e.event==='stationStrike').victimId,gunner.id);
});

test('all crew participate in pending friendship resolution and a leaving nonfriend cannot erase the impact',async t=>{
  const f=await fixture(t,3),[pilot,gunner,attacker]=f.players,r=await f.deploy();await f.board(pilot,r,'pilot');await f.board(gunner,r,'gunner');
  let resolveFriend;const held=new Promise(resolve=>resolveFriend=resolve);f.store.areFriends=async(a,b)=>b===gunner.id?held:true;
  const target=r.world([0,1.8,1.4]),up=new THREE.Vector3(0,1,0).applyQuaternion(r.physics.state.quaternion);
  attacker.nav.mode='eva';attacker.nav.position.copy(r.world([-4,1.8,1.4]));attacker.nav.orientation.setFromRotationMatrix(new THREE.Matrix4().lookAt(attacker.nav.position,target,up));attacker.nav.velocity.set(0,0,0);
  f.input(attacker,{fire:true});f.advance(1/30);assert.equal(r.state.health,L.hull);
  assert.equal(f.room.security.pending(gunner),true);assert.equal(f.room.security.pending(pilot),true);
  let left=false;const departure=f.room.leave(gunner.id).then(()=>left=true);await Promise.resolve();assert.equal(left,false);
  resolveFriend(false);await departure;await f.room.security.settle(attacker);
  assert.equal(r.state.health,L.hull-25);assert.equal(attacker.health,0);assert.equal(pilot.shipHealth,100);
});

test('community hub refuses armed rover deployment using the existing hands-free policy',async t=>{
  const f=await fixture(t),[p]=f.players,hub=f.world.station.hub;
  p.nav.position.copy(hub.toWorld(new THREE.Vector3(0,-6,0),new THREE.Vector3()));p.nav.mode='walk';p.nav.insideShip=false;
  const reply=await f.request(p,{command:'deploy'});assert.equal(reply.ok,false);assert.match(reply.error,/Community hub/);assert.equal(f.room.sentries.vehicles.size,0);
});


test('authoritative driving stops before a walker and another Sentry without phantom parked-ship damage',async t=>{
  const f=await fixture(t,3),[pilot,other,walker]=f.players,r=await f.deploy(),second=await f.deploy(other);
  await f.board(pilot,r,'pilot');
  // Fixture placement arranges real bodies on the same authored hangar deck.
  // All movement below is the actual room input and canonical rover solver.
  const origin=r.physics.state.position.clone(),q=r.physics.state.quaternion.clone();
  walker.nav.mode='walk';walker.nav.insideShip=false;walker.nav.position.copy(r.world([0,1.75,-5]));walker.nav.velocity.set(0,0,0);
  const hp=f.players.map(p=>[p.health,p.shipHealth]);
  f.advance(3,new Map([[pilot,{forward:1}]]));
  assert.ok(r.physics.state.distance>.5,JSON.stringify({physics:r.snapshot(),controls:r.controls,walker:walker.nav.position.toArray(),mode:walker.nav.mode}));assert.equal(r.physics.state.reason,'collision');
  const clearance=walker.nav.position.clone().sub(r.physics.state.position).applyQuaternion(q.clone().invert());
  assert.ok(clearance.z<=L.bounds.min[2]-.29);assert.deepEqual(f.players.map(p=>[p.health,p.shipHealth]),hp);
  walker.nav.position.copy(r.world([8,1.75,0]));r.physics.setPose(origin,q);
  second.physics.setPose(r.world([0,0,-7]),q);f.input(pilot,{});f.advance(.1);
  f.advance(4,new Map([[pilot,{forward:1}]]));
  assert.ok(r.physics.state.distance>.5,JSON.stringify({physics:r.snapshot(),controls:r.controls,walker:walker.nav.position.toArray(),mode:walker.nav.mode}));assert.equal(r.physics.state.reason,'collision');
  const gap=second.physics.state.position.clone().sub(r.physics.state.position).applyQuaternion(q.clone().invert());
  assert.ok(-gap.z>=L.bounds.max[2]-L.bounds.min[2]+.04);assert.deepEqual(f.players.map(p=>[p.health,p.shipHealth]),hp);
  assert.ok(f.players.every(p=>!f.room.security.pending(p)));assert.equal(f.messages.get(pilot.id).some(e=>e.event==='stationStrike'),false);
});


test('actual room access positions follow the bounded physical route at every server tick',async t=>{
  const f=await fixture(t),[p]=f.players,r=await f.deploy();
  p.nav.position.copy(r.world([-2.5,1.75,.2]));p.nav.velocity.set(0,0,0);
  assert.equal((await f.request(p,{command:'board',id:r.id,role:'pilot'})).ok,true);
  let previous=p.nav.position.clone(),max=0;const phases=new Set();
  for(let i=0;i<500&&r.seats.pilot.phase!=='seated';i++){
    f.advance(1/30);const delta=p.nav.position.distanceTo(previous);max=Math.max(max,delta);
    assert.ok(delta<=.85/30+.004,JSON.stringify({delta,phase:r.seats.pilot.phase}));previous.copy(p.nav.position);phases.add(r.seats.pilot.phase);
  }
  assert.equal(r.seats.pilot.phase,'seated');assert.ok(max>.02);assert.ok(phases.has('traversing'));assert.ok(phases.has('closing'));assert.ok(p.nav.position.distanceTo(r.world(L.seats.pilot.eye))<1e-8);
});

for(const targetKind of ['suit','ship'])for(const sign of [-1,1])test(`Sentry lasers hit a ${targetKind} in the other planetary chart (${sign})`,async t=>{
  const {AEON}=await import('../src/celestial.js'),{ROTATION_DOMAIN_RADII,ROTATION_EPOCH_MS,rotationFrameAt,fromInertial,toInertial,planetRotation}=await import('../src/planet-rotation.js');
  const f=await fixture(t),[pilot,victim]=f.players,r=await f.deploy();await f.board(pilot,r,'pilot');
  const clock=f.world.rotationClock,oldNow=clock.now,seconds=900;clock.now=()=>ROTATION_EPOCH_MS+seconds*1000;clock.tick();t.after(()=>{clock.now=oldNow;clock.tick();});
  // Isolate the authoritative ray at the boundary. Actual entry/access/drive
  // are covered above and in the browser; clients cannot upload these poses.
  const root=new THREE.Vector3(AEON.radius*ROTATION_DOMAIN_RADII+sign*10,0,0),frame=rotationFrameAt(root),direction=new THREE.Vector3(-sign,0,0),look=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,-1),direction);
  r.state.planetFrame=frame?.id??null;r.physics.setPose(fromInertial(root,frame,seconds),planetRotation(frame,seconds).invert().multiply(look));
  const muzzle=r.muzzlePoses()[0],eye=toInertial(muzzle.start,frame,seconds).addScaledVector(direction,20).add(new THREE.Vector3(0,.2,0)),targetFrame=rotationFrameAt(eye);
  assert.notEqual(frame,targetFrame);victim.nav.mode='eva';victim.nav.insideShip=false;fromInertial(eye,targetFrame,seconds,victim.nav.position);victim.nav.orientation.copy(planetRotation(targetFrame,seconds).invert()).multiply(look);victim.nav.velocity.set(0,0,0);
  if(targetKind==='ship'){victim.nav.shipPosition=fromInertial(eye.clone().add(new THREE.Vector3(0,-2,0)),targetFrame,seconds);victim.nav.shipOrientation.copy(victim.nav.orientation);}
  f.input(pilot,{});f.advance(.1);f.input(pilot,{fire:true});f.advance(1/30);await f.room.security.settle(pilot);
  assert.ok((targetKind==='ship'?victim.shipHealth:victim.health)<100);assert.ok(f.messages.get(pilot.id).some(m=>m.event==='sentryFire'&&m.targetId===victim.id&&m.kind===(targetKind==='ship'?'ship':'player')&&m.planetFrame===r.state.planetFrame));
});

for(const sign of [-1,1])test(`room handheld rays hit a Sentry hull in the other planetary chart (${sign})`,async t=>{
  const {AEON}=await import('../src/celestial.js'),{ROTATION_DOMAIN_RADII,ROTATION_EPOCH_MS,rotationFrameAt,fromInertial,toInertial,planetRotation}=await import('../src/planet-rotation.js');
  const f=await fixture(t),[owner,attacker]=f.players,r=await f.deploy(),clock=f.world.rotationClock,oldNow=clock.now,seconds=900;clock.now=()=>ROTATION_EPOCH_MS+seconds*1000;clock.tick();t.after(()=>{clock.now=oldNow;clock.tick();});
  const root=new THREE.Vector3(AEON.radius*ROTATION_DOMAIN_RADII+sign*10,0,0),frame=rotationFrameAt(root);r.state.planetFrame=frame?.id??null;r.physics.setPose(fromInertial(root,frame,seconds),planetRotation(frame,seconds).invert());
  const target=toInertial(r.world([0,1.8,0]),frame,seconds),eye=target.clone().add(new THREE.Vector3(-sign*20,0,0)),shooterFrame=rotationFrameAt(eye),look=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,-1),target.clone().sub(eye).normalize());
  assert.notEqual(frame,shooterFrame);attacker.nav.mode='eva';attacker.nav.insideShip=false;fromInertial(eye,shooterFrame,seconds,attacker.nav.position);attacker.nav.orientation.copy(planetRotation(shooterFrame,seconds).invert()).multiply(look);attacker.nav.velocity.set(0,0,0);
  const shipHealth=owner.shipHealth;f.input(attacker,{fire:true});f.advance(1/30);await f.room.security.settle(attacker);
  assert.equal(r.state.health,L.hull-25);assert.equal(owner.shipHealth,shipHealth);assert.equal(f.messages.get(attacker.id).findLast(m=>m.event==='fire').targetId,r.id);
});
