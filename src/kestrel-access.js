import * as THREE from 'three';
import flightLayout from '../assets/kestrel/flight-layout.json' with {type:'json'};
import { crossesWall } from './boarding.js';
import { bodyOffset, bodySurfacePoint } from './celestial.js';

// Ground-contact origin and PilotEye are the exported Kestrel contract.
// These are conservative collision envelopes, not a second walkable cabin.
const parts=flightLayout.flightParts;
export const KESTREL_LAYOUT=Object.freeze({
  flightBounds:Object.freeze({min:Object.freeze([-4.5,0,-6.752]),max:Object.freeze([4.5,3.2,6.75])}),
  flightParts:Object.freeze(parts),eyeHeight:1.75,capsuleRadius:.25,
  seatEye:Object.freeze([0,2.49,-1.9]),entryEye:Object.freeze([-2.45,1.75,-1.75]),
  landingClearance:2.84,
});

/** Swept capsule envelope: the fighter has no Nomad floor, aft hatch or ramp. */
export function constrainKestrelStep(previous,proposed){
  for(const p of flightLayout.walkingParts){
    if(Math.min(previous.y,proposed.y)-1.75>=p.max[1]||Math.max(previous.y,proposed.y)+.12<=p.min[1])continue;
    if(crossesWall(previous,proposed,[p.min[0]-.25,p.max[0]+.25,p.min[2]-.25,p.max[2]+.25]))return previous.clone();
  }
  return proposed.clone();
}

/** EVA can approach the parked hull from above or below. A swept 3D suit
 * envelope must also stop purely vertical travel, which walking walls ignore. */
export function constrainKestrelEVA(previous,proposed){
  const delta=proposed.clone().sub(previous);
  for(const p of flightLayout.walkingParts){
    const min=p.min.map(v=>v-.45),max=p.max.map(v=>v+.45);
    const inside=previous.toArray().every((v,i)=>v>min[i]&&v<max[i]);
    if(inside){
      if(proposed.toArray().some((v,i)=>v<=min[i]||v>=max[i]))continue;
      return previous.clone();
    }
    let enter=0,leave=1;
    for(let i=0;i<3;i++){
      const start=previous.getComponent(i),d=delta.getComponent(i);
      if(Math.abs(d)<1e-12){if(start<=min[i]||start>=max[i]){enter=2;break;}continue;}
      const a=(min[i]-start)/d,b=(max[i]-start)/d;
      enter=Math.max(enter,Math.min(a,b));leave=Math.min(leave,Math.max(a,b));
    }
    if(enter<leave&&leave>0&&enter<1)return previous.clone();
  }
  return proposed.clone();
}

export class KestrelAccess {
  constructor(){this.reset();}
  reset(){this.canopy=0;this.ladder=0;this.open=false;this.phase='idle';this.direction=null;this.route=[];this.index=0;}
  get busy(){return this.phase!=='idle';}
  get secured(){return !this.busy&&!this.open&&this.canopy===0&&this.ladder===0;}
  get snapshot(){return {canopy:this.canopy,ladder:this.ladder,open:this.open,phase:this.phase,direction:this.direction,routeIndex:this.index,secured:this.secured};}
  groundEye(nav,x=KESTREL_LAYOUT.entryEye[0]){
    const point=nav.fromShipLocal(new THREE.Vector3(x,KESTREL_LAYOUT.eyeHeight,KESTREL_LAYOUT.entryEye[2]));
    const ground=nav.dockedAtStation?nav.station.deckPoint(point,KESTREL_LAYOUT.eyeHeight):bodySurfacePoint(bodyOffset(point,nav.body).normalize(),nav.body,KESTREL_LAYOUT.eyeHeight);
    return ground?nav.toShipLocal(ground):null;
  }
  reachable(nav){
    if(!nav.shipPosition||nav.mode!=='walk'||this.busy)return false;
    const ground=this.groundEye(nav),local=nav.toShipLocal();
    return Boolean(ground)&&Math.hypot(local.x-ground.x,local.z-ground.z)<1.05&&Math.abs(local.y-ground.y)<.35;
  }
  interact(nav){
    if(this.busy){nav.notify('Kestrel access sequence in progress.');return;}
    if(nav.mode==='flight'||nav.mode==='eva'){nav.notify('Land or dock Kestrel, then use its port ladder.');return;}
    if(nav.mode!=='landed'&&!this.reachable(nav)){nav.notify('Approach the foot of the port boarding ladder.');return;}
    if(nav.gearProgress<.999){nav.notify('Deploy landing gear before using the ladder.');return;}
    const ground=this.groundEye(nav);if(!ground){nav.notify('No safe landing surface beside the ladder.');return;}
    this.direction=nav.mode==='landed'?'out':'in';this.open=true;this.phase='opening';
    if(this.direction==='in'&&this.ladder<1){
      this.staging=this.groundEye(nav,-3.1);
      if(!this.staging){this.open=false;this.phase='idle';nav.notify('Step to a clear landing surface beside the port ladder.');return;}
      this.phase='staging';
    }
    // Continuous eye trajectory: rise from the chair, step over the sill and
    // bridge, then climb down outside the rung axis. Ground uses canonical
    // station/terrain support. The avatar has no ladder animation yet.
    const exit=[new THREE.Vector3(...KESTREL_LAYOUT.seatEye),new THREE.Vector3(0,3.55,-1.9),new THREE.Vector3(-.62,3.55,-1.75),new THREE.Vector3(-.95,3.65,-1.75),new THREE.Vector3(-1.30,4.05,-1.75),new THREE.Vector3(-1.65,4.18,-1.75),new THREE.Vector3(-2.08,4.18,-1.75),new THREE.Vector3(-2.08,ground.y,-1.75),ground];
    this.route=this.direction==='out'?exit:exit.reverse();
    this.route.unshift(nav.toShipLocal());this.index=1;
    nav.velocity.set(0,0,0);nav.angularVelocity.set(0,0,0);nav.keys.clear();nav.jumpHeight=0;nav.jumpVelocity=0;
    nav.notify(this.direction==='out'?'Opening canopy and deploying the port ladder.':'Boarding Kestrel via the port ladder.');
  }
  update(dt,nav){
    if(!this.busy)return false;
    if(!nav.shipPosition){this.reset();return false;}
    if(this.phase==='staging'){
      const local=nav.toShipLocal(),delta=this.staging.clone().sub(local),distance=delta.length(),step=Math.min(distance,dt*.9);
      if(distance>0)local.addScaledVector(delta,step/distance);nav.position.copy(nav.fromShipLocal(local));
      if(distance<=step+1e-9)this.phase='opening';
    }else if(this.phase==='opening'){
      if(this.canopy<1)this.canopy=Math.min(1,this.canopy+dt/3);
      else this.ladder=Math.min(1,this.ladder+dt/1.8);
      if(this.canopy===1&&this.ladder===1){this.phase='traversing';nav.mode='walk';nav.insideShip=false;}
    }else if(this.phase==='traversing'){
      const local=nav.toShipLocal(),target=this.route[this.index],delta=target.clone().sub(local),distance=delta.length();
      const step=Math.min(distance,dt*.9);
      if(distance>0)local.addScaledVector(delta,step/distance);
      nav.position.copy(nav.fromShipLocal(local));
      if(distance<=step+1e-9&&++this.index===this.route.length){
        if(this.direction==='in'){
          nav.mode='landed';nav.insideShip=true;nav.orientation.copy(nav.shipOrientation);this.open=false;this.phase='closing';
          nav.notify('Pilot seated. Stowing ladder and sealing canopy.');
        }else{
          this.phase='idle';nav.insideShip=false;
          nav.orientation.copy(nav.shipOrientation).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),-Math.PI/2));
          nav.notify('On the ground. F near the port ladder to board Kestrel.');
        }
      }
    }else if(this.phase==='closing'){
      if(this.ladder>0)this.ladder=Math.max(0,this.ladder-dt/1.8);
      else this.canopy=Math.max(0,this.canopy-dt/3);
      if(this.ladder===0&&this.canopy===0){this.phase='idle';nav.notify('Kestrel secured. B / controller Y launches.');}
    }
    nav.doorOpen=this.open;nav.doorProgress=this.canopy;nav.velocity.set(0,0,0);nav.keys.clear();
    return true;
  }
}
