import {Vector3,Quaternion} from 'three';
import {tractorClear} from '../cargo/tractor-physics.js';

/** Authored pad coordinates shared by local and server contexts. The candidate
 * sits on the actual deck and is rejected if an existing hull or crate blocks it. */
export function transportPickup(settlements,id,ships,loose){
  const s=settlements?.layouts.find(s=>s.id===id);if(!s||!settlements.terminalPosition(id))return null;
  const q=new Quaternion(...s.claim.quaternion),origin=new Vector3(...s.claim.origin);
  for(const [x,z] of [[6,32],[-6,32],[20,36],[-20,36],[20,4],[-20,4]]){
    const position=new Vector3(x,s.pad.position[1]+.31,z).applyQuaternion(q).add(origin);
    const c={id:'freight-pickup-probe',sbu:1,quaternion:q.toArray()};
    if(tractorClear(position,position,c,ships,loose))return {position:position.toArray(),quaternion:q.toArray()};
  }
  return null;
}
