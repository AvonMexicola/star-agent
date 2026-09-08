// CPU rehearsal of the normal spawn-to-hub route. Only clean protocol controls,
// interaction and destination requests move the player; pose reads steer them.
import * as THREE from 'three';
import assert from 'node:assert/strict';
import {createWorld} from '../server/world.js';
import {createRoom} from '../server/room.js';
import {createMemoryStore} from '../server/database.js';
const world=await createWorld(),store=createMemoryStore(),messages=[],errors=[];
let now=100000,sequence=0;const room=createRoom({world,store,now:()=>now,autoStart:false,onError:e=>errors.push(e.message)});
const account=await store.createAccount({email:'hub-route@example.test',callsign:'HubRoute',passwordHash:'isolated fixture'});
await room.join(account,m=>messages.push(m));const p=room.players.get(account.id),ship=p.nav.shipPosition.clone(),pod=world.pods[p.hangarId-1];
const tick=async(input={})=>{room.receive(p.id,{type:'input',sequence:++sequence,input});now+=1000/30;room.tick();if(sequence%30===0)await new Promise(r=>setImmediate(r));};
async function walk(frame,x,z){
  let last;
  for(let i=0;i<900;i++){
    const local=frame.toLocal(p.nav.position,new THREE.Vector3());last=local.toArray();
    if(Math.hypot(local.x-x,local.z-z)<.10){await tick();console.log(JSON.stringify({point:[x,z],actual:last,frame:p.nav.physicsFrame,steps:i}));return;}
    const delta=frame.toWorld(new THREE.Vector3(x,local.y,z),new THREE.Vector3()).sub(p.nav.position);
    const forward=new THREE.Vector3(0,0,-1).applyQuaternion(p.nav.orientation),right=new THREE.Vector3(1,0,0).applyQuaternion(p.nav.orientation);
    await tick({forward:THREE.MathUtils.clamp(delta.dot(forward)*2,-1,1),strafe:THREE.MathUtils.clamp(delta.dot(right)*2,-1,1)});
  }
  throw new Error(`Physical route blocked before ${x},${z}; last ${last}`);
}
async function travel(destination,frame){
  room.receive(p.id,{type:'action',action:'interact'});await tick();
  assert.equal(messages.findLast(m=>m.event==='stationHub')?.action,'destinations');
  const requestId='travel-'+sequence;await room.receive(p.id,{type:'request',requestId,action:'stationHub',destination});
  const ack=messages.findLast(m=>m.type==='ack'&&m.requestId===requestId);assert.equal(ack.ok,true,ack.error);
  for(let i=0;i<180;i++)await tick();assert.equal(p.nav.stationHubTransit,null);assert.equal(p.nav.physicsFrame,frame);
}
try{
  console.log(JSON.stringify({spawn:pod.toLocal(p.nav.position,new THREE.Vector3()).toArray(),orientation:p.nav.orientation.clone().premultiply(pod.quaternion.clone().invert()).toArray()}));
  await walk(pod,8,-5.32);await walk(pod,8,20.4);await walk(pod,0,20.4);
  room.receive(p.id,{type:'action',action:'interact'});for(let i=0;i<40;i++)await tick();assert.equal(pod.lift.progress,1);
  await walk(pod,0,24);await travel('hub','station:hub');
  const hub=world.station.hub;await walk(hub,0,9.5);await walk(hub,0,-8.5);await walk(hub,-5.5,-10.2);
  assert.equal(room.hub.isHandsFree(p.nav),true);assert.equal(p.weapon,null);assert.ok(p.nav.shipPosition.distanceTo(ship)<1e-8);
  await walk(hub,0,-8.5);await walk(hub,0,12.5);await walk(hub,0,15.95);await travel(p.hangarId,`hangar:${p.hangarId}`);
  await walk(pod,0,20.4);await walk(pod,8,20.4);await walk(pod,8,-5.32);assert.ok(p.nav.shipPosition.distanceTo(ship)<1e-8);assert.deepEqual(errors,[]);
  console.log('PASS: physical berth → hub exchange approach → same berth; ship unchanged.');
}finally{await room.close();}
