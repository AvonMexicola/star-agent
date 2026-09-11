import * as THREE from 'three';

export const STATION_HUB_FRAME='station:hub';
export const STATION_HUB_BOUNDS=Object.freeze({min:Object.freeze([-22,-8,-19]),max:Object.freeze([22,1.5,19])});
/** The walk-through opening in the concourse aft wall onto the promenade.
 * station-concourse.js omits the wall there; station-promenade.js lines it. */
export const STATION_HUB_PORTAL=Object.freeze({halfWidth:4.6,head:-3.45,z:-19,wallTop:1.25});
export const HANDS_FREE_REASON='Community hub: weapons and tools must remain stowed.';
export const STATION_TRANSFER_SECONDS=1.3;

const scratch=new THREE.Vector3();

/** Every walkable volume of the hub frame: the concourse, plus any annex the
 * architecture attached. The retail promenade is an L of a corridor and a wider
 * shop band; one rectangular hull over both would hand the suit a floor out in
 * the open space beside the corridor. */
const NO_VOLUMES=Object.freeze([]);
export function hubVolumes(frame){
  if(!frame)return NO_VOLUMES;
  const annex=frame.volumes;
  if(!frame.interiorBox)return annex??NO_VOLUMES;
  // Membership is tested every frame from several callers; keep the combined
  // list on the frame rather than rebuilding an array each time.
  if(frame._hubVolumes===undefined||frame._hubVolumeSource!==annex){
    frame._hubVolumeSource=annex;
    frame._hubVolumes=annex?.length?[frame.interiorBox,...annex]:[frame.interiorBox];
  }
  return frame._hubVolumes;
}

/** Containment and deck support for a frame with more than one authored volume.
 * station-complex.js assigns these onto the hub instead of Station's single-box
 * implementations; the berths keep theirs. */
export function hubFrameMethods(){
  return {
    isInsideHangar(world){
      const local=this.toLocal(world,scratch);
      return hubVolumes(this).some(box=>box.containsPoint(local));
    },
    deckPoint(world,eyeHeight=0){
      const local=this.toLocal(world,new THREE.Vector3());
      for(const box of hubVolumes(this)){
        if(local.x<box.min.x+.3||local.x>box.max.x-.3||local.z<box.min.z+.3||local.z>box.max.z-.3||local.y<box.min.y-1||local.y>box.max.y)continue;
        local.y=box.min.y+eyeHeight;return this.toWorld(local,local);
      }
      return null;
    },
    deckHeightAt(world){
      const local=this.toLocal(world,scratch);
      for(const box of hubVolumes(this)){
        if(local.x<box.min.x||local.x>box.max.x||local.z<box.min.z||local.z>box.max.z)continue;
        if(local.y<box.min.y-2||local.y>box.max.y+6)continue;
        local.y=box.min.y;return this.toWorld(local,local).length();
      }
      return null;
    },
  };
}

/** A physical volume in the station's double-precision world frame. Neither a
 * selected berth nor a client-supplied location label establishes membership. */
export function stationHubAt(station,position){
  const hub=station?.hub;
  if(!station?.ready||!hub?.ready||!position?.isVector3||![position.x,position.y,position.z].every(Number.isFinite))return null;
  const local=hub.toLocal(position,new THREE.Vector3());
  return hubVolumes(hub).some(box=>box.containsPoint(local))?{id:STATION_HUB_FRAME,frame:hub,local,up:hub.up??station.up,gravity:9.81}:null;
}

export function isHandsFree(nav){return Boolean(nav&&(nav.stationHubTransit||stationHubAt(nav.station,nav.position)));}

export function elevatorLocation(frame,position,eyeHeight=1.75){
  if(!frame?.ready||!frame.lift||!position?.isVector3)return null;
  const p=frame.toLocal(position,new THREE.Vector3()),lift=frame.lift;
  if(![p.x,p.y,p.z,eyeHeight].every(Number.isFinite))return null;
  const z=p.z-lift.z,onFloor=Math.abs(p.y-lift.floor-eyeHeight)<=.5;
  const bodyAtDoorHeight=p.y+.15>lift.floor&&p.y-eyeHeight<lift.floor+3.1;
  return {local:p,cabin:onFloor&&Math.abs(p.x)<1.65&&z>.65&&z<3.1,door:onFloor&&Math.abs(p.x)<3.4&&z>-3&&z<.6,
    occupiesCabin:bodyAtDoorHeight&&Math.abs(p.x)<1.9&&z>.3&&z<3.4,threshold:bodyAtDoorHeight&&Math.abs(p.x)<2.35&&Math.abs(z)<.5};
}

/** Gate input until a neutral observation after the last restricted sample.
 * A sequence distinguishes a fresh network packet from a server timeout reset. */
export function createHubFireGate(){
  let armed=true,lastBlocked=-1,lastSeen=-1;
  return {
    update(restricted,held,sequence=0){
      const fresh=Number.isSafeInteger(sequence)&&sequence>lastSeen;
      if(fresh)lastSeen=sequence;
      if(restricted){armed=false;lastBlocked=Math.max(lastBlocked,sequence);}
      else if(fresh&&!held&&sequence>lastBlocked)armed=true;
      return armed&&!restricted;
    },
    get armed(){return armed;},
  };
}
