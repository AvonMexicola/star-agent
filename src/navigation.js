import * as THREE from 'three';
import { GamepadInput } from './gamepad.js';
import { MOON_LANDING_DIRECTION, constrainMoonStep } from './moon-world.js';
import { RADIUS, SUN_DISTANCE, SUN_DIRECTION, terrainHeight, latLonDirection, clamp } from './world.js';
import { SELENE, bodyAt, bodyOffset, bodyHeight, bodyAltitude, bodySurfacePoint, bodySurfaceNormal } from './celestial.js';
import { FLIGHT, environmentAt, step as stepFlight } from './flight-model.js';
import { SHIP_LAYOUT, shipFloorAt, constrainShipStep, interactionAt } from './boarding.js';

const UP=new THREE.Vector3(0,1,0),FORWARD=new THREE.Vector3(0,0,-1),RIGHT=new THREE.Vector3(1,0,0);
const rotation=new THREE.Quaternion(),matrix=new THREE.Matrix4();
export class Navigation {
  constructor(canvas,notify){
    this.canvas=canvas;this.notify=notify;this.position=new THREE.Vector3();this.orientation=new THREE.Quaternion();this.velocity=new THREE.Vector3();
    this.gamepad=new GamepadInput();this.controllerActive=false;this.focused=true;
    this.keys=new Set();this.mode='flight';this.autoland=false;this.locked=false;this.speedScale=1;this.shipPosition=null;this.shipOrientation=new THREE.Quaternion();this.jumpVelocity=0;this.jumpHeight=0;this.boost=false;this.enabled=true;
    this.doorOpen=false;this.doorProgress=0;this.insideShip=false;
    this.surfaceObstacles=null;this.toolTrigger=0;this.station=null;this.dockedAtStation=false;this.stationLift=false;
    this.flightAssist=true;this.angularVelocity=new THREE.Vector3();
    this.orbit();
    document.addEventListener('pointerlockchange',()=>{this.locked=document.pointerLockElement===canvas;document.body.classList.toggle('piloting',this.locked);if(!this.locked)this.keys.clear();});
    document.addEventListener('mousemove',e=>{if(this.locked&&this.enabled){this.controllerActive=false;this.look(-e.movementX*.0018,-e.movementY*.0018);}});
    document.addEventListener('keydown',e=>{
      if(!this.enabled||document.querySelector('dialog[open]'))return;
      if(['Space','Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
      this.controllerActive=false;this.keys.add(e.code);if(e.repeat)return;
      if(e.code==='KeyV')this.toggleFlightAssist();
      if(e.code==='KeyL')this.landOrLaunch();if(e.code==='KeyF')this.embark();
      if(e.code==='KeyX'){this.velocity.set(0,0,0);this.angularVelocity.set(0,0,0);this.autoland=false;this.notify('Brakes engaged.');}
    });
    document.addEventListener('keyup',e=>this.keys.delete(e.code));
    window.addEventListener('blur',()=>{this.focused=false;this.gamepad.suspend();this.keys.clear();if(this.flightAssist)this.velocity.set(0,0,0);});
    window.addEventListener('focus',()=>{this.focused=true;});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){this.gamepad.suspend();this.keys.clear();}});
    canvas.addEventListener('wheel',e=>{if(!this.locked)return;e.preventDefault();this.speedScale=clamp(this.speedScale*Math.exp(-e.deltaY*.002),.05,8);this.notify(`Flight speed ×${this.speedScale.toFixed(2)}`);},{passive:false});
  }
  toggleFlightAssist(){
    if(this.mode!=='flight'||this.autoland||this.stationLift){this.notify('Change flight assist while freely flying.');return;}
    this.flightAssist=!this.flightAssist;this.angularVelocity.set(0,0,0);
    this.notify(this.flightAssist?'Flight assist on. Releasing thrust brakes the ship.':'Inertial flight. Release thrust to coast; X brakes. V restores assist.');
  }
  get flightEnvironment(){
    const body=this.body;
    if(!body.airless)return environmentAt(this.position,RADIUS);
    const local=bodyOffset(this.position,body),r=Math.max(body.radius,local.length());
    return {groundRadius:body.radius,altitude:Math.max(0,r-body.radius),density:0,regime:'SPACE',atmosphereFraction:0,
      gravity:local.normalize().multiplyScalar(-body.gravity*(body.radius/r)**2)};
  }
  capture(){if(!this.enabled)return;try{const result=this.canvas.requestPointerLock();result?.catch(()=>this.notify('Mouse capture unavailable. Drag to look, or use the arrow keys.'));}catch{this.notify('Use arrow keys to steer.');}}
  orbit(){
    this.dockedAtStation=false;this.stationLift=false;this.flightAssist=true;this.angularVelocity.set(0,0,0);
    this.position.set(...latLonDirection(20,25)).multiplyScalar(RADIUS*2.8);
    const right=new THREE.Vector3().crossVectors(UP,this.position).normalize();
    const target=right.multiplyScalar(-RADIUS*.42);
    this.orientToward(target,UP);
    this.velocity.set(0,0,0);this.mode='flight';this.autoland=false;this.shipPosition=null;this.speedScale=1;this.doorOpen=false;this.doorProgress=0;this.insideShip=false;
  }
  orientToward(target,up){matrix.lookAt(this.position,target,up);this.orientation.setFromRotationMatrix(matrix);}
  look(yaw,pitch){
    if(this.mode==='flight'&&!this.flightAssist&&!this.autoland&&!this.stationLift){
      this.angularVelocity.x+=pitch*4;this.angularVelocity.y+=yaw*4;return;
    }
    // Yaw around local gravity; pitch about the current camera right vector.
    const normal=this.normal;rotation.setFromAxisAngle(normal,yaw);this.orientation.premultiply(rotation);
    const right=RIGHT.clone().applyQuaternion(this.orientation);rotation.setFromAxisAngle(right,pitch);this.orientation.premultiply(rotation).normalize();
    if(this.mode==='walk'){
      const forward=FORWARD.clone().applyQuaternion(this.orientation);const dot=forward.dot(normal);
      if(Math.abs(dot)>.985){rotation.setFromAxisAngle(right,-pitch);this.orientation.premultiply(rotation).normalize();}
    }
  }
  get body(){return bodyAt(this.position);}
  get normal(){return bodyOffset(this.position,this.body).normalize();}
  get groundHeight(){return bodyHeight(this.normal,this.body);}
  get altitude(){return Math.max(0,bodyAltitude(this.position,this.body));}
  get speed(){return this.velocity.length();}
  get sunDirection(){return new THREE.Vector3(...SUN_DIRECTION).multiplyScalar(SUN_DISTANCE).sub(this.position).normalize();}
  toShipLocal(point=this.position){return this.shipPosition?point.clone().sub(this.shipPosition).applyQuaternion(this.shipOrientation.clone().invert()):null;}
  fromShipLocal(point){return point.clone().applyQuaternion(this.shipOrientation).add(this.shipPosition);}
  get interaction(){
    if(this.mode==='landed')return 'F · LEAVE PILOT SEAT';
    if(this.mode!=='walk'||!this.shipPosition)return '';
    const hit=interactionAt(this.toShipLocal(),this.doorOpen);
    if(hit==='seat')return 'F · SIT IN PILOT CHAIR';
    if(hit==='storage')return 'F · OPEN CARGO STORAGE';
    if(hit==='door')return this.doorOpen?'F · CLOSE HATCH & RAMP':'F · OPEN HATCH & LOWER RAMP';
    return this.insideShip?'WALK AFT TO THE HATCH':'APPROACH THE REAR HATCH TO BOARD';
  }
  transit(direction,altitude=100){
    this.dockedAtStation=false;this.stationLift=false;this.flightAssist=true;this.angularVelocity.set(0,0,0);
    const d=new THREE.Vector3(...direction);const h=Math.max(0,terrainHeight(...direction));
    this.position.copy(d).multiplyScalar(RADIUS+h+altitude);
    const east=new THREE.Vector3().crossVectors(UP,d).normalize();
    const forward=new THREE.Vector3().crossVectors(d,east).normalize().addScaledVector(east,.7).normalize();
    this.orientToward(this.position.clone().addScaledVector(forward,1000).addScaledVector(d,-180),d);
    this.velocity.set(0,0,0);this.mode='flight';this.autoland=false;this.shipPosition=null;this.speedScale=1;this.jumpHeight=0;this.doorOpen=false;this.doorProgress=0;this.insideShip=false;
  }
  transitMoon(altitude=180,direction=MOON_LANDING_DIRECTION){
    this.orbit();
    const d=new THREE.Vector3(...direction).normalize();
    this.position.copy(bodySurfacePoint(d,SELENE,altitude));
    const east=new THREE.Vector3().crossVectors(Math.abs(d.y)<.9?UP:RIGHT,d).normalize();
    this.orientToward(this.position.clone().addScaledVector(east,1000).addScaledVector(d,-180),d);
    this.jumpHeight=0;this.jumpVelocity=0;
  }
  get stationDistance(){return this.station?.ready?this.position.distanceTo(this.station.worldPosition):Infinity;}
  get stationLocal(){return this.station?.ready?this.station.toLocal(this.position,new THREE.Vector3()):null;}
  get deckClearance(){return this.stationLocal?this.stationLocal.y-this.station.interiorBox.min.y:Infinity;}
  dock(){
    const station=this.station;
    if(!station?.canDock(this.position))return;
    const up=station.up;
    let forward=FORWARD.clone().applyQuaternion(this.orientation).projectOnPlane(up);
    if(forward.lengthSq()<.01)forward.set(0,0,1).applyQuaternion(station.quaternion);
    forward.normalize();matrix.lookAt(new THREE.Vector3(),forward,up);
    this.shipOrientation.setFromRotationMatrix(matrix);this.orientation.copy(this.shipOrientation);
    const eye=station.deckPoint(this.position,SHIP_LAYOUT.seatEye[1]);
    this.shipPosition=eye.clone().sub(new THREE.Vector3(...SHIP_LAYOUT.seatEye).applyQuaternion(this.shipOrientation));
    this.position.copy(eye);this.velocity.set(0,0,0);this.angularVelocity.set(0,0,0);this.mode='landed';this.autoland=false;
    this.dockedAtStation=true;this.stationLift=false;this.doorOpen=false;this.doorProgress=0;
    this.notify('Docked. F to stand; walk aft and open the hatch to explore the hangar.');
  }
  dryGround(){if(this.body.airless)return true;const n=this.normal;return terrainHeight(n.x,n.y,n.z)>=0||Math.abs(n.y)>.86;}
  landOrLaunch(){
    if(this.mode==='walk'){this.notify('Walk to the cockpit and sit in the pilot chair with F before launch.');return;}
    if(this.mode==='landed'){
      if(this.dockedAtStation){
        this.mode='flight';this.dockedAtStation=false;this.stationLift=true;this.autoland=false;
        this.doorOpen=false;this.doorProgress=0;this.insideShip=false;this.shipPosition=null;
        this.velocity.copy(this.station.up).multiplyScalar(3);
        this.notify('Undocking. Gentle lift to bay clearance. Reverse with S to leave through the doors.');return;
      }
      this.mode='flight';this.doorOpen=false;this.doorProgress=0;this.insideShip=false;this.position.addScaledVector(this.normal,12);this.velocity.copy(this.normal).multiplyScalar(12);this.shipPosition=null;this.notify('Hatch secured. Liftoff. Space ascends; Shift boosts.');return;
    }
    if(this.autoland){this.autoland=false;this.notify('Landing assist disengaged.');return;}
    if(this.stationDistance<500){
      if(!this.station.canDock(this.position)){this.notify('Fly through the open doors and over the central landing pad, then press L.');return;}
      this.autoland=true;this.velocity.set(0,0,0);this.angularVelocity.set(0,0,0);this.notify('Docking assist. Settling onto the hangar deck.');return;
    }
    if(!this.dryGround()){this.notify('Open water below. Find dry ground or polar ice to land.');return;}
    if(this.altitude>12000){this.notify('Descend below 12 km to engage landing assist.');return;}
    this.autoland=true;this.velocity.set(0,0,0);this.angularVelocity.set(0,0,0);this.notify('Landing assist engaged. Descending vertically.');
  }
  touchDown(){
    if(!this.dryGround())return;
    const body=this.body,radial=this.normal;
    const n=body.airless?bodySurfaceNormal(this.position,body):radial;
    const surface=bodySurfacePoint(radial,body);
    this.position.copy(surface).addScaledVector(n,3.2);
    this.mode='landed';this.autoland=false;this.velocity.set(0,0,0);this.angularVelocity.set(0,0,0);
    this.shipPosition=surface;
    let forward=FORWARD.clone().applyQuaternion(this.orientation).projectOnPlane(n);if(forward.lengthSq()<.01)forward.crossVectors(RIGHT,n);forward.normalize();
    matrix.lookAt(new THREE.Vector3(),forward,n);this.shipOrientation.setFromRotationMatrix(matrix);this.orientation.copy(this.shipOrientation);
    this.position.copy(this.fromShipLocal(new THREE.Vector3(...SHIP_LAYOUT.seatEye)));this.doorOpen=false;this.doorProgress=0;
    this.notify('Touchdown. F leaves the pilot chair; walk aft to open the hatch.');
  }
  embark(){
    if(this.mode==='flight'){this.notify('Land your ship before disembarking. Press L near the surface.');return;}
    if(this.mode==='landed'){
      this.position.copy(this.fromShipLocal(new THREE.Vector3(...SHIP_LAYOUT.stand)));
      this.mode='walk';this.insideShip=true;this.jumpHeight=0;this.jumpVelocity=0;this.velocity.set(0,0,0);
      this.orientation.copy(this.shipOrientation).multiply(new THREE.Quaternion().setFromAxisAngle(UP,Math.PI));
      this.notify('Standing in the cabin. Walk aft; F opens the hatch and lowers the ramp.');
    }else{
      if(!this.shipPosition)return;
      const local=this.toShipLocal(),hit=interactionAt(local,this.doorOpen);
      if(hit==='door'){
        if(this.doorOpen&&Math.abs(local.x)<1.2&&local.z>3.3&&local.z<7.5){this.notify('Step clear of the ramp before closing it.');return;}
        this.doorOpen=!this.doorOpen;this.notify(this.doorOpen?'Hatch opening. Ramp lowering — walk through when clear.':'Hatch closing. Ramp retracting.');
      }else if(hit==='storage'){
        this.keys.clear();this.velocity.set(0,0,0);this.openInventory?.();
      }else if(hit==='seat'){
        this.position.copy(this.fromShipLocal(new THREE.Vector3(...SHIP_LAYOUT.seatEye)));this.orientation.copy(this.shipOrientation);this.mode='landed';this.insideShip=true;this.velocity.set(0,0,0);this.notify('Pilot seat engaged. L to launch · F to stand.');
      }else this.notify(this.interaction||'Approach the ship’s rear hatch.');
    }
  }
  update(dt){
    const pad=this.gamepad.poll({focused:this.focused&&!document.hidden,enabled:this.enabled&&!document.querySelector('dialog[open]')});
    this.toolTrigger=pad.mine||0;
    if(!this.gamepad.connected)this.controllerActive=false;
    if(pad.used)this.controllerActive=true;
    if(pad.pressed.has(9))this.onControllerMenu?.();
    if(pad.scroll)this.onControllerScroll?.(pad.scroll*dt*500);
    if(!this.enabled||document.querySelector('dialog[open]'))return;
    if(pad.pressed.has(8))this.onControllerHud?.();
    if(pad.pressed.has(11))this.toggleFlightAssist();
    if(pad.pressed.has(3))this.landOrLaunch();
    if(pad.pressed.has(2))this.embark();
    // Interactions may open a modal and disable navigation in this same frame.
    if(!this.enabled||document.querySelector('dialog[open]'))return;
    if(pad.brake){this.velocity.set(0,0,0);this.angularVelocity.set(0,0,0);this.autoland=false;}
    if(this.mode==='flight'&&pad.speed)this.speedScale=clamp(this.speedScale*Math.exp(pad.speed*dt),.05,8);
    const axis=(positive,negative,analog=0)=>clamp(Number(this.keys.has(positive))-Number(this.keys.has(negative))+analog,-1,1);
    const moveForward=axis('KeyW','KeyS',pad.forward),strafe=axis('KeyD','KeyA',pad.strafe);
    const turn=axis('ArrowLeft','ArrowRight',pad.yaw),tilt=axis('ArrowUp','ArrowDown',pad.pitch);
    this.doorProgress=clamp(this.doorProgress+(this.doorOpen?dt:-dt)/1.1,0,1);
    if(pad.brake&&this.mode==='flight'){this.boost=false;return;}
    const oldBody=this.body,oldNormal=this.normal;
    const yaw=turn*dt*.85;
    const pitch=tilt*dt*.85;
    const inertial=this.mode==='flight'&&!this.flightAssist&&!this.autoland&&!this.stationLift;
    if(!inertial&&(yaw||pitch))this.look(yaw,pitch);
    this.boost=this.keys.has('ShiftLeft')||this.keys.has('ShiftRight')||pad.boost;
    if(this.mode==='landed')return;
    const forward=FORWARD.clone().applyQuaternion(this.orientation),right=RIGHT.clone().applyQuaternion(this.orientation);
    const input=new THREE.Vector3();
    input.addScaledVector(forward,moveForward);
    input.addScaledVector(right,strafe);
    if(this.mode==='walk'){
      const localBefore=this.toShipLocal();
      const shipUp=localBefore&&localBefore.length()<25?UP.clone().applyQuaternion(this.shipOrientation):oldNormal;
      const magnitude=Math.min(1,input.length());input.projectOnPlane(shipUp);if(input.lengthSq()>0)input.setLength(magnitude);input.multiplyScalar(this.insideShip?2.3:this.boost?9:4.5);
      this.velocity.lerp(input,1-Math.exp(-12*dt));
      let proposed=this.position.clone().addScaledVector(this.velocity,dt);
      const previous=this.position.clone();
      let local=null,floor=null;
      if(localBefore&&localBefore.length()<35){
        local=constrainShipStep(localBefore,this.toShipLocal(proposed),this.doorProgress>.98);
        proposed=this.fromShipLocal(local);floor=shipFloorAt(local.x,local.z,this.doorProgress>.98);
      }
      const dir=bodyOffset(proposed,this.body).normalize(),h=this.body.airless?0:terrainHeight(dir.x,dir.y,dir.z);
      if(floor!==null||this.dockedAtStation||h>=0||Math.abs(dir.y)>.86)this.position.copy(proposed);
      else{this.velocity.set(0,0,0);if(!this.shoreNotice||performance.now()-this.shoreNotice>4000){this.notify('Waterline reached. Swimming is outside this prototype.');this.shoreNotice=performance.now();}}
      this.insideShip=floor!==null&&local.z<=4;
      if((this.keys.has('Space')||pad.jump)&&(this.jumpHeight===0||this.surfaceObstacles?.grounded)&&!this.insideShip){this.jumpVelocity=4.5;this.jumpHeight=Math.max(.001,this.jumpHeight);}
      this.jumpVelocity-=(this.dockedAtStation?9.81:this.body.gravity)*dt;this.jumpHeight=Math.max(0,this.jumpHeight+this.jumpVelocity*dt);if(this.jumpHeight===0)this.jumpVelocity=0;
      if(floor!==null){local.y=floor+SHIP_LAYOUT.eyeHeight+this.jumpHeight;this.position.copy(this.fromShipLocal(local));}
      else if(this.dockedAtStation){
        const deck=this.station.deckPoint(this.position,SHIP_LAYOUT.eyeHeight+this.jumpHeight);
        this.position.copy(deck||previous);
      }
      else{this.position.copy(bodySurfacePoint(this.normal,this.body,SHIP_LAYOUT.eyeHeight+this.jumpHeight));}
      if(this.dockedAtStation){
        const result=this.station.constrainStep(previous,this.position,this.orientation,true);
        this.position.copy(result.point);
      }
      if(floor===null&&!this.dockedAtStation&&this.surfaceObstacles){
        const result=this.surfaceObstacles.constrainWalker(previous,this.position);
        this.position.copy(result.point);
        if(result.hit){this.jumpHeight=Math.max(0,bodyAltitude(this.position,this.body)-SHIP_LAYOUT.eyeHeight);if(result.grounded&&this.jumpVelocity<0)this.jumpVelocity=0;}
      }
      this.velocity.copy(this.position).sub(previous).divideScalar(Math.max(dt,.001));
    }else{
      const altitude=this.altitude;
      if(this.stationLift){
        this.velocity.copy(this.station.up).multiplyScalar(3);
        if(this.deckClearance>=6){this.stationLift=false;this.velocity.set(0,0,0);}
      }else if(this.autoland && this.stationDistance<500){
        if(!this.station.canDock(this.position)){this.autoland=false;this.velocity.set(0,0,0);this.notify('Docking cancelled: move over the central pad.');}
        else if(this.deckClearance<3.25){this.dock();return;}
        else this.velocity.copy(this.station.up).multiplyScalar(-Math.max(.5,Math.min(3,(this.deckClearance-3.2)*.8)));
      }else if(this.autoland){
        if(!this.dryGround()){this.autoland=false;this.notify('Landing cancelled: open water.');}
        else if(altitude<3.6){this.touchDown();return;}
        else this.velocity.copy(oldNormal).multiplyScalar(-Math.min(800,Math.max(1,(altitude-3.2)*.65)));
      }else{
        const vertical=axis('Space','KeyC',pad.vertical);
        input.addScaledVector(oldNormal,vertical);input.clampLength(0,1);
        const cruise=clamp(altitude*.65+25,12,4_000_000)*this.speedScale*(this.boost?7:1);
        const stationLimit=this.stationDistance<20000?Math.max(6,(this.stationDistance-65)*.18):Infinity;
        const approachLimit=stationLimit;
        const maxSpeed=Math.min(cruise,approachLimit);
        if(this.velocity.length()>approachLimit)this.velocity.setLength(approachLimit);
        const roll=axis('KeyQ','KeyE',pad.roll);
        const flight=stepFlight(this,{assist:this.flightAssist,targetVelocity:input.multiplyScalar(maxSpeed),
          translation:new THREE.Vector3(strafe,vertical,-moveForward),
          rotation:new THREE.Vector3(tilt,turn,-roll),
          boost:this.boost,maxSpeed:this.flightAssist?approachLimit:Math.min(FLIGHT.travelSpeed,approachLimit)},this.flightEnvironment,dt);
        this.velocity.copy(flight.velocity);this.orientation.copy(flight.orientation);this.angularVelocity.copy(flight.angularVelocity);
        if(this.flightAssist&&roll){rotation.setFromAxisAngle(forward,roll*dt*.8);this.orientation.premultiply(rotation);}
      }
      // Adaptive substeps prevent high-speed descent tunnelling through the globe.
      const steps=clamp(Math.ceil(this.speed*dt/Math.max(10,altitude*.2)),1,96);
      for(let i=0;i<steps;i++){
        const previous=this.position.clone(),proposed=previous.clone().addScaledVector(this.velocity,dt/steps);
        const rockHit=this.surfaceObstacles?.constrainFlight(previous,proposed);
        if(rockHit?.hit){this.position.copy(rockHit.point);this.velocity.set(0,0,0);this.autoland=false;break;}
        const lunar=constrainMoonStep(previous,proposed);
        if(lunar.hit){
          this.position.copy(lunar.point);this.touchDown();break;
        }
        if(lunar.limited){proposed.copy(lunar.point);this.velocity.set(0,0,0);}
        const collision=this.station?.constrainStep(previous,proposed,this.orientation);
        this.position.copy(collision?collision.point:proposed);
        if(collision?.hit){this.velocity.set(0,0,0);this.angularVelocity.set(0,0,0);this.autoland=false;break;}
        if(!this.stationLift && this.station?.canDock(this.position) && this.deckClearance<3.2 && this.velocity.dot(this.station.up)<0){this.dock();break;}
        const n=this.normal;const ground=this.groundHeight;
        const height=bodyAltitude(this.position,this.body);
        if(height<3.2){this.position.copy(bodySurfacePoint(n,this.body,3.2));this.velocity.set(0,0,0);if(this.dryGround())this.touchDown();else this.notify('Surface hover. Open water — landing unavailable.');break;}
      }
      // Assisted travel and inertial flight share the same swept collision path.
    }
    if(pad.brake){this.velocity.set(0,0,0);this.angularVelocity.set(0,0,0);}
    const newNormal=this.normal;
    if(!inertial&&oldBody===this.body&&this.mode!=='landed'){rotation.setFromUnitVectors(oldNormal,newNormal);this.orientation.premultiply(rotation).normalize();}
    if(!Number.isFinite(this.position.length())||this.position.length()>SUN_DISTANCE*4){this.orbit();this.notify('Navigation envelope exceeded. Returned to orbit.');}
  }
}
