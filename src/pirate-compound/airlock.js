import {Vector3,Quaternion} from 'three';

/** World-owned door targets only. The existing BuildSystem owns leaf motion,
 * swept closing safety and collision. No pressure or atmosphere simulation. */
export class PirateAirlock{
 constructor(layout,nav,buildings,collision,enabled=()=>true){
  this.layout=layout;this.nav=nav;this.buildings=buildings;this.enabled=enabled;
  this.doors=layout.claim.pieces.filter(piece=>piece.airlock);
  this.requested=null;this.q=new Quaternion(...layout.claim.quaternion);
  collision.doorMotion=buildings.doorMotion;
  for(const door of this.doors)buildings.doorMotion.ensure(door.id,false);
 }
 point(piece){return new Vector3(...piece.position).add(new Vector3(0,1.2,0)).applyQuaternion(this.q).add(new Vector3(...this.layout.claim.origin));}
 fraction(piece){return this.buildings.doorMotion.fraction(piece.id,piece.doorOpen);}
 nearby(){
  const n=this.nav;if(!this.enabled()||n.mode!=='walk'||n.insideShip||n.buildActive)return null;
  const direction=new Vector3(0,0,-1).applyQuaternion(n.orientation);
  return this.doors.map(piece=>{const delta=this.point(piece).sub(n.position),distance=delta.length();return {piece,distance,facing:delta.normalize().dot(direction)};}).filter(hit=>hit.distance<3.5&&hit.facing>.15).sort((a,b)=>a.distance-b.distance)[0]?.piece??null;
 }
 get hint(){const door=this.nearby();return door?`F / X · ${door.doorOpen?'Close':'Open'} ${door.airlock} airlock door`:'';}
 interact(){
  const door=this.nearby();if(!door)return false;
  if(door.doorOpen){door.doorOpen=false;this.requested=null;}
  else{this.requested=door.id;for(const other of this.doors)if(other!==door)other.doorOpen=false;}
  this.nav.keys.clear();this.nav.gamepad.suspend();
  this.nav.notify(this.requested?'Airlock interlock · opposite door closes before opening.':'Closing airlock door.');return true;
 }
 update(){
  if(!this.enabled())return;
  if(this.requested){const door=this.doors.find(piece=>piece.id===this.requested),other=this.doors.find(piece=>piece!==door);if(this.fraction(other)<.001){door.doorOpen=true;this.requested=null;}}
  for(const door of this.doors)if(door.doorOpen&&this.point(door).distanceTo(this.nav.position)>5)door.doorOpen=false;
 }
 get state(){return {requested:this.requested,doors:this.doors.map(piece=>({id:piece.id,side:piece.airlock,position:this.point(piece).toArray(),open:piece.doorOpen,fraction:this.fraction(piece),blocked:this.buildings.doorMotion.doors.get(piece.id)?.blocked??false}))};}
}
