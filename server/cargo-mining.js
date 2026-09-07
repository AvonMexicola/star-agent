import * as THREE from 'three';
import { nearbyConstructionDeposits } from '../src/mining/construction-deposits.js';
import { nearbySurfaceDeposits } from '../src/mining/surface-deposits.js';
import { createDensity,decodeDensity,encodeDensity,carve,meshVolume } from '../src/mining/volume.js';
import { asteroidField } from '../src/ring-world.js';
import { RockCollision } from '../src/mining/collision.js';
import { bodyAltitude } from '../src/celestial.js';
const cache=new Map();
export function cargoDeposit(position,id){return [...nearbyConstructionDeposits(position,16),...nearbySurfaceDeposits(position,16)].find(d=>d.id===id);}
export function mineCargoRock(state,player,id,now,world){
  const n=player.nav;
  if(n.mode!=='walk'||n.insideShip||player.health<=0||player.weapon!=='mining-laser-tool'||!player.input.fire||state.accounts[player.id].carried)throw new Error('Equip the mining laser and hold fire on an exposed outcrop.');
  const elapsed=Math.max(0,Math.min(.5,(now-(player.lastCargoMine??now-500))/1000));
  if(elapsed<.2)throw new Error('Mining laser is cycling.');
  player.lastCargoMine=now;
  const d=cargoDeposit(n.position,id);if(!d)throw new Error('Aim at a nearby common mineral outcrop.');
  const previous=state.rocks?.[id];
  if(!previous&&Object.keys(state.rocks??{}).length>=128)throw new Error('Shared excavation storage is full; existing deposits remain mineable.');
  const key=`${id}:${previous?.revision??0}`;
  let entry=cache.get(key);if(!entry){const field=previous?decodeDensity(previous.field):createDensity((x,y,z)=>asteroidField(x,y,z,d.variant));entry={field,collision:new RockCollision(meshVolume(field,d.resourceWeights).positions)};cache.set(key,entry);if(cache.size>16)cache.delete(cache.keys().next().value);}
  const inv=d.quaternion.clone().invert(),direction=new THREE.Vector3(0,0,-1).applyQuaternion(n.orientation),start=n.position.clone().sub(d.position).applyQuaternion(inv),ray=direction.clone().applyQuaternion(inv),hit=entry.collision.raycast(start,ray,8);
  if(!hit)throw new Error('Aim at the exposed rock within8m.');
  const point=hit.point.clone().applyQuaternion(d.quaternion).add(d.position);
  if(bodyAltitude(point)<.04)throw new Error('Terrain covers that part of the deposit.');
  for(let distance=.15;distance<hit.distance;distance+=.15)if(bodyAltitude(n.position.clone().addScaledVector(direction,distance))<.02)throw new Error('Terrain blocks the cutter.');
  const obstruction=world.occludes?.(n.position,direction,hit.distance);if(obstruction!==null&&obstruction!==undefined&&obstruction<hit.distance-.05)throw new Error('An obstacle blocks the cutter.');
  const account=state.accounts[player.id],resources=account.resources??{},free=48-Object.values(resources).reduce((a,b)=>a+b,0);
  if(free<.001)throw new Error('Resource pouch full. Pack cargo at a terminal.');
  const result=carve(entry.field,hit.point.clone().addScaledVector(ray,.08).toArray(),Math.min(free,.35*elapsed),.48,d.resourceWeights);if(!result)throw new Error('Aim at a fresh part of the deposit.');
  const next=structuredClone(state);next.rocks??={};next.rocks[id]={revision:(previous?.revision??0)+1,field:encodeDensity(result.field),position:d.position.toArray()};
  next.accounts[player.id].resources={...resources};['basalt','copper','ice'].forEach((r,i)=>next.accounts[player.id].resources[r]=(resources[r]??0)+result.yieldVolume[i]);next.revision++;
  return {state:next,message:'Resources recovered.',rock:{id,...next.rocks[id]}};
}
