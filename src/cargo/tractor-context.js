import * as THREE from 'three';
import { aimedCrate,detachedPose,tractorStep,tractorSlot,tractorClear } from './tractor-physics.js';
/** Same geometry/intent rules for solo and authoritative multiplayer. */
export function tractorContext({nav,ships,loose,worldClear,enabled=()=>true}){
  const active=()=>enabled()&&['walk','eva'].includes(nav.mode)&&!nav.travel&&!nav.roverOccupied&&nav.shipSpeed<1;
  return {
    grab(c,source){
      if(!active())return false;
      const all=ships(),ship=source&&all.find(s=>s.id===source.id);
      if(source&&(!ship?.pose||ship.speed>=1))return false;
      const target=aimedCrate(nav.position,nav.orientation,all,loose(),worldClear);
      if(target?.id!==c.id)return false;
      return source?detachedPose(ship,c):true;
    },
    move(c,distance,elapsed){
      if(!active())return null;
      return tractorStep(c,nav.position,nav.orientation,distance,elapsed,ships(),loose(),worldClear)?.toArray()??null;
    },
    stow(c,source){
      if(!active())return null;
      const all=ships(),ship=all.find(s=>s.id===source.id);if(!ship?.pose||ship.speed>=1)return null;
      return tractorSlot(ship,c,nav.position,all,loose(),worldClear)?.placed??null;
    },
    align(c,source){
      if(!active())return null;
      const all=ships(),ship=all.find(s=>s.id===source.id);if(!ship?.pose||ship.speed>=1||ship.pose.position.distanceTo(nav.position)>40)return null;
      const start=new THREE.Quaternion(...c.quaternion),end=ship.pose.quaternion,point=new THREE.Vector3(...c.position);
      for(let i=1;i<=24;i++){const test={...c,quaternion:start.clone().slerp(end,i/24).toArray()};if(!tractorClear(point,point,test,all,loose(),{worldClear}))return null;}
      return end.toArray();
    },
  };
}
