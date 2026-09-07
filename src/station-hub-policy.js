import * as THREE from 'three';

export const STATION_HUB_FRAME='station:hub';
export const STATION_HUB_BOUNDS=Object.freeze({min:Object.freeze([-22,-8,-19]),max:Object.freeze([22,1.5,19])});
export const HANDS_FREE_REASON='Community hub: weapons and tools must remain stowed.';
export const STATION_TRANSFER_SECONDS=1.3;

/** A physical volume in the station's double-precision world frame. Neither a
 * selected berth nor a client-supplied location label establishes membership. */
export function stationHubAt(station,position){
  const hub=station?.hub;
  if(!station?.ready||!hub?.ready||!position?.isVector3||![position.x,position.y,position.z].every(Number.isFinite))return null;
  const local=hub.toLocal(position,new THREE.Vector3());
  return hub.interiorBox.containsPoint(local)?{id:STATION_HUB_FRAME,frame:hub,local,up:hub.up??station.up,gravity:9.81}:null;
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
