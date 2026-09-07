import * as THREE from 'three';
import {bodyAltitude} from '../celestial.js';

/** Shared camera/muzzle obstruction query for ground and ship weapons. */
export function createWeaponTarget({nav,mining}){
  const raycaster=new THREE.Raycaster();
  return (start,direction,origin,range=1600)=>{
    let hit=mining.raycast(start,direction,range);
    const building=nav.buildingRaycast?.(start,direction,range);
    if(building&&(!hit||building.distance<hit.distance))hit=building;
    if(nav.station&&nav.stationDistance<range+200){
      raycaster.set(start.clone().sub(origin),direction);raycaster.far=range;
      const wall=raycaster.intersectObject(nav.station.group,true).find(h=>{
        let object=h.object;while(object){if(!object.visible)return false;object=object.parent;}
        return h.object.material?.depthWrite!==false;
      });
      if(wall&&(!hit||wall.distance<hit.distance))hit={distance:wall.distance,point:wall.point.clone().add(origin),normal:wall.face?.normal.clone().transformDirection(wall.object.matrixWorld)};
    }
    let previous=0;
    // Fine near the muzzle to catch close surface obstruction; larger distant
    // steps remain an approximation of distant terrain, using its real height.
    for(let d=.05;d<Math.min(range,hit?.distance??range);d+=d<10?.2:4){
      if(bodyAltitude(start.clone().addScaledVector(direction,d),nav.body)<=0){
        let lo=previous,hi=d;
        for(let i=0;i<10;i++){const mid=(lo+hi)*.5;if(bodyAltitude(start.clone().addScaledVector(direction,mid),nav.body)>0)lo=mid;else hi=mid;}
        return {distance:lo,point:start.clone().addScaledVector(direction,lo),normal:nav.normal.clone()};
      }
      previous=d;
    }
    return hit;
  };
}
