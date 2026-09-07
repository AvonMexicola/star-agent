import * as THREE from 'three';
import {bodyAltitude} from '../celestial.js';

/** Shared camera/muzzle obstruction query for ground and ship weapons. */
export function createWeaponTarget({nav,mining}){
  const raycaster=new THREE.Raycaster();
  return (start,direction,origin,range=1600)=>{
    let hit=mining.raycast(start,direction,range);
    const building=nav.buildingRaycast?.(start,direction,range);
    if(building&&(!hit||building.distance<hit.distance))hit=building;
    if(nav.station){
      raycaster.set(start.clone().sub(origin),direction);raycaster.far=range;
      // The supplied muzzle can belong to an NPC or sit beside a distant
      // exterior ring. Player-to-berth distance cannot gate this query; each
      // visible mesh's own bounding sphere rejects distant rays in Three.js.
      // StationComplex owns several scene roots rather than the original
      // Station.group. Traverse only currently visible meshes, including LODs.
      const station=nav.station,roots=station.group?[station.group]:[station.exterior?.group,station.hub?.group,station.lodGroup,...(station.pods??[]).map(p=>p.group)];
      const meshes=[];
      for(const root of roots)root?.traverseVisible(object=>{if(object.isMesh&&object.material?.depthWrite!==false)meshes.push(object);});
      const wall=raycaster.intersectObjects(meshes,false)[0];
      if(wall&&(!hit||wall.distance<hit.distance)){
        const matrix=wall.object.matrixWorld.clone();
        if(wall.object.isInstancedMesh&&wall.instanceId!==undefined){const instance=new THREE.Matrix4();wall.object.getMatrixAt(wall.instanceId,instance);matrix.multiply(instance);}
        hit={distance:wall.distance,point:wall.point.clone().add(origin),normal:wall.face?.normal.clone().transformDirection(matrix)};
      }
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
