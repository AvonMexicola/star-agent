import {Quaternion,Vector3} from 'three';
import {ROVER_LAYOUT} from './rover-layout.js';
import {roverFootprint,roverSweptBounds} from './rover-physics.js';
import {roverShipLocal,roverLiftMayMove} from './rover-support.js';

const UP=new Vector3(0,1,0);
const bounds=points=>({min:[0,1,2].map(i=>Math.min(...points.map(p=>p.getComponent(i)))),max:[0,1,2].map(i=>Math.max(...points.map(p=>p.getComponent(i))))});
const overlap=(a,b)=>a.min.every((n,i)=>n<b.max[i])&&a.max.every((n,i)=>n>b.min[i]);

/** Park in the authored clear aft cargo lane, facing the loading ramp. */
export function roverCarrierStart(freighter){
  const profile=freighter?.carrier;
  if(profile){const lift=freighter.lifts?.find(l=>l.id===profile.liftId);if(!lift)return null;const position=new Vector3(...profile.park);position.y=lift.y;return {position,quaternion:new Quaternion().setFromAxisAngle(UP,profile.heading),lift:lift.id};}
  const ramp=freighter?.ramps?.find(r=>r.id==='aft'),cargo=freighter?.layout?.cargo;
  if(ramp&&cargo)return {position:new Vector3(ramp.pivot[0],cargo.floor,ramp.pivot[2]-ramp.outward*7),quaternion:new Quaternion().setFromAxisAngle(UP,ramp.outward===1?Math.PI:0),lift:null};
  const lift=freighter?.lifts?.find(l=>l.id==='main');
  if(!lift)return null;
  const position=new Vector3(...ROVER_LAYOUT.atlas.park);position.y=lift.y;
  return {position,quaternion:new Quaternion().setFromAxisAngle(UP,ROVER_LAYOUT.atlas.heading),lift:lift.id};
}

/** Whole rover envelope blocks either direction of the visible ramp sweep. */
export function roverObstructsRamp(state,ramp,frame,{spawned=true}={}){
  if(!spawned||!ramp)return false;
  const b=bounds(roverFootprint(state.position,state.quaternion).map(p=>roverShipLocal(p,frame)));
  const end=ramp.pivot[2]+ramp.outward*ramp.length;
  return overlap(b,{min:[ramp.pivot[0]-ramp.width/2-.35,Math.min(0,ramp.pivot[1]-Math.abs(Math.sin(ramp.openAngle))*ramp.length)-.35,Math.min(ramp.pivot[2],end)-.45],max:[ramp.pivot[0]+ramp.width/2+.35,ramp.pivot[1]+ramp.length+.35,Math.max(ramp.pivot[2],end)+.45]});
}

/** Compose shared mechanism vetoes. A crew lift keeps its own guard intact. */
export function guardRoverCarrier(freighter,getRover){
  if(freighter?.lifts?.some(l=>l.id===(freighter.carrier?.liftId??'main'))){
    const canMove=freighter.canMove;
    freighter.canMove=(platform,rider)=>{
      const rover=getRover();
      if(canMove?.call(freighter,platform,rider)===false)return false;
      if(platform.kind==='hatch'){if(!rover.spawned)return true;const b=bounds(roverFootprint(rover.state.position,rover.state.quaternion).map(p=>roverShipLocal(p,rover.frame)));const h=freighter.layout.hatch;return !overlap(b,{min:[h.minX,h.bottom,h.closedZ-.15],max:[h.maxX,h.top+1,h.closedZ+.15]});}
      return roverLiftMayMove(rover.state,platform,rover.frame,{...rover,carrierId:freighter.carrier?.id??'atlas',ceiling:freighter.carrier?.ceiling??platform.ceiling??9.2});
    };
  }
  if(freighter?.ramps){
    const obstructed=freighter.rampObstructed;
    freighter.rampObstructed=id=>{
      const rover=getRover();
      return obstructed?.call(freighter,id)===true||roverObstructsRamp(rover.state,freighter.ramps.find(r=>r.id===id),rover.frame,rover);
    };
  }
}

/** Use authored cargo props and the same wall/ramp/crew-gate owner as walking.
 * The four-wheel support solver remains the only owner of floor contact. */
export function roverCarrierClear({previous,proposed,previousCorners,corners},freighter,frame,{cargoConstrain=null}={}){
  if((!freighter?.ramps&&!freighter?.carrier)||!freighter.constrain)return true;
  const a=roverShipLocal(previous.position,frame),b=roverShipLocal(proposed.position,frame);
  if(Math.min(a.length(),b.length())>50)return true;
  const localBounds=bounds([...(previousCorners??roverFootprint(previous.position,previous.quaternion)),...(corners??roverFootprint(proposed.position,proposed.quaternion))].map(p=>roverShipLocal(p,frame)));
  if(freighter.colliders.some(c=>overlap(localBounds,c)))return false;
  const decks=freighter.carrier?[{...freighter.layout.interior,floor:freighter.layout.floorY},{...freighter.lift,floor:freighter.lift.y}]:[freighter.layout.cargo,freighter.layout.upper];
  for(const deck of decks){
    if(localBounds.min[1]>=deck.floor-.5&&localBounds.min[1]<deck.ceiling&&localBounds.max[1]>deck.ceiling
      &&overlap(localBounds,{min:[deck.minX,deck.floor,deck.minZ],max:[deck.maxX,deck.ceiling,deck.maxZ]}))return false;
  }
  // Sample vertical body edges at two heights, covering its full 2.7 m
  // suspension envelope with the floor owner's 1.75 m walking capsule.
  const {min,max}=roverSweptBounds(),height=freighter.eyeHeight??1.75;
  for(const x of [min[0],max[0]])for(const z of [min[2],max[2]])for(const y of [min[1]+height,max[1]]){
    const local=new Vector3(x,y,z);
    const from=roverShipLocal(local.clone().applyQuaternion(previous.quaternion).add(previous.position),frame);
    const to=roverShipLocal(local.clone().applyQuaternion(proposed.quaternion).add(proposed.position),frame);
    if(!freighter.constrain(from,to).equals(to))return false;
  }
  if(cargoConstrain){
    // Loaded crates can be as small as one 0.6 m cell. Perimeter spacing is
    // tighter than that cell plus the shared cargo sweep's 0.25 m suit radius.
    const nx=Math.ceil((max[0]-min[0])/.9),nz=Math.ceil((max[2]-min[2])/.9);
    for(let ix=0;ix<=nx;ix++)for(let iz=0;iz<=nz;iz++){
      if(ix>0&&ix<nx&&iz>0&&iz<nz)continue;
      for(const y of [min[1]+height,max[1]]){
        const point=new Vector3(min[0]+(max[0]-min[0])*ix/nx,y,min[2]+(max[2]-min[2])*iz/nz);
        const from=roverShipLocal(point.clone().applyQuaternion(previous.quaternion).add(previous.position),frame);
        const to=roverShipLocal(point.clone().applyQuaternion(proposed.quaternion).add(proposed.position),frame);
        if(!cargoConstrain(from,to).equals(to))return false;
      }
    }
  }
  return true;
}
