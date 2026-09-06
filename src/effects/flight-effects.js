import * as THREE from 'three';
import { SHIP_LAYOUT } from '../boarding.js';
import { bodyAltitude } from '../celestial.js';

/** Input/pose adapter. Flight simulation remains authoritative. */
export function createFlightEffects({effects,nav,mining,camera}){
  let cooldown=0,side=1;
  const position=new THREE.Vector3(),forward=new THREE.Vector3(),collector=new THREE.Vector3();
  const raycaster=new THREE.Raycaster();
  function target(start,direction,origin){
    let hit=mining.raycast(start,direction,1600);
    // Respect station walls without querying every terrain triangle in the world.
    if(nav.stationDistance<1800){
      raycaster.set(start.clone().sub(origin),direction);raycaster.far=1600;
      const wall=raycaster.intersectObject(nav.station.group,true).find(h=>h.object.visible&&h.object.material?.depthWrite!==false);
      if(wall&&(!hit||wall.distance<hit.distance))hit={distance:wall.distance,point:wall.point.clone().add(origin),normal:wall.face?.normal.clone().transformDirection(wall.object.matrixWorld)};
    }
    // Ground impacts sample the same body height function used by navigation.
    let previous=0;
    for(let d=2;d<Math.min(1600,hit?.distance??1600);d+=12){
      const p=start.clone().addScaledVector(direction,d);
      if(bodyAltitude(p,nav.body)<=0){
        let lo=previous,hi=d;
        for(let i=0;i<10;i++){const mid=(lo+hi)*.5;if(bodyAltitude(start.clone().addScaledVector(direction,mid),nav.body)>0)lo=mid;else hi=mid;}
        return {point:start.clone().addScaledVector(direction,lo),normal:nav.normal.clone()};
      }
      previous=d;
    }
    return hit;
  }
  return {
    update(dt,origin,{suspended=false}={}){
      const flying=nav.mode==='flight',ready=flying&&nav.enabled&&nav.focused&&!document.hidden&&!document.querySelector('dialog[open]')&&!suspended;
      position.set(...SHIP_LAYOUT.seatEye).applyQuaternion(nav.orientation).negate().add(nav.position);
      forward.set(0,0,-1).applyQuaternion(nav.orientation);
      cooldown=Math.max(0,cooldown-dt);
      if(ready&&nav.keys.has('KeyJ')&&cooldown===0){
        const start=new THREE.Vector3(side*2.35,1.55,-3.3).applyQuaternion(nav.orientation).add(position);
        // Two hardpoints converge on the reticle at useful short range.
        const direction=nav.position.clone().addScaledVector(forward,400).sub(start).normalize();
        effects.fire(start,direction,{hit:target(start,direction,origin)});side*=-1;cooldown=.14;
      }
      collector.set(.2,-.35,-.15).applyQuaternion(nav.orientation).add(nav.position);
      const throttle=ready?Math.max(nav.keys.has('KeyW')?1:0,Math.min(1,Math.abs(nav.velocity.dot(forward))/200)):0;
      effects.update(dt,{origin,camera,shipPosition:position,shipQuaternion:nav.orientation,velocity:nav.velocity,flying:ready,boost:nav.boost,throttle,mining:effects.miningInput,collector,suspended:suspended||!nav.focused||document.hidden});
    },
  };
}
