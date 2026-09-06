import * as THREE from 'three';
import { ringPathIntervals } from './ring-world.js';
import { stepEVA, constrainEVAShip, canAttachRamp } from './eva.js';
import { GamepadInput } from './gamepad.js';
import { MOON_LANDING_DIRECTION, constrainMoonStep } from './moon-world.js';
import { PYRE_ARRIVAL_ALTITUDE, pyreLandingDirection, constrainPyreStep, pyreFrame, VOLCANOES, fromPyreBody } from './pyre-world.js';
import { RADIUS, SUN_DISTANCE, SUN_DIRECTION, terrainHeight, latLonDirection, clamp } from './world.js';
import { SELENE, PYRE, bodyAt, bodyOffset, bodyHeight, bodyAltitude, bodySurfacePoint, bodySurfaceNormal } from './celestial.js';
import { environmentAt, step as stepFlight } from './flight-model.js';
import { assessImpact, terrainSurfaceNormal } from './impact.js';
import { SHIP_LAYOUT, shipFloorAt, constrainShipStep, interactionAt } from './boarding.js';

import { TRAVEL_TARGETS, flightSpeedProfile, stationSpeedLimit, planTravel, planFreeTravel, sampleTravel, abortTravel } from './travel-model.js';

const UP=new THREE.Vector3(0,1,0),FORWARD=new THREE.Vector3(0,0,-1),RIGHT=new THREE.Vector3(1,0,0);
const rotation=new THREE.Quaternion(),matrix=new THREE.Matrix4();
// The narrow finite belt gets a local maneuvering envelope. The extra 300 m
// margin also captures a ship stopped just before the swept debris-entry brake.
export const DEBRIS_SPEED_LIMIT=400;
export function debrisSpeedLimit(position){return ringPathIntervals(position,position,600).length?DEBRIS_SPEED_LIMIT:Infinity;}
export class Navigation {
  constructor(canvas,notify){
    this.canvas=canvas;this.notify=notify;this.position=new THREE.Vector3();this.orientation=new THREE.Quaternion();this.velocity=new THREE.Vector3();
    this.gamepad=new GamepadInput();this.controllerActive=false;this.focused=true;
    this.physicalKeys=new Set();this.keys=new Set();this.mode='flight';this.autoland=false;this.locked=false;this.speedScale=1;this.shipPosition=null;this.shipOrientation=new THREE.Quaternion();this.jumpVelocity=0;this.jumpHeight=0;this.boost=false;this.enabled=true;
    this.doorOpen=false;this.doorProgress=0;this.insideShip=false;
    this.shipId='nomad';this.layout=SHIP_LAYOUT;this.freighter=null;
    this.station=null;this.dockedAtStation=false;this.stationLift=false;
    this.spaceParked=false;this.evaBraking=false;this.surfaceObstacles=null;this.toolTrigger=0;
    this.flightAssist=true;this.angularVelocity=new THREE.Vector3();
    this.travel=null;this.travelTarget=null;
    this.powered=true;this.cabinFlight=false;this.gearDeployed=true;this.shipLightsOn=false;this.flashlightOn=false;
    this.shipVelocity=new THREE.Vector3();this.shipAngularVelocity=new THREE.Vector3();
    this.cruiseVelocity=new THREE.Vector3();
    this.engineAcceleration=new THREE.Vector3();
    this.crash=null;
    this.orbit();
    document.addEventListener('pointerlockchange',()=>{this.locked=document.pointerLockElement===canvas;document.body.classList.toggle('piloting',this.locked);if(!this.locked)this.keys.clear();});
    document.addEventListener('mousemove',e=>{if(this.locked&&this.enabled){this.controllerActive=false;this.look(-e.movementX*.0018,-e.movementY*.0018);}});
    document.addEventListener('keydown',e=>{
      this.physicalKeys.add(e.code);
      if(!this.enabled||document.querySelector('dialog[open]'))return;
      if(this.openingActive){this.onOpeningKey?.(e);return;}
      if(['Space','Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
    if(this.mode==='crashed')return;
      if(['KeyW','KeyA','KeyS','KeyD','Space','KeyC'].includes(e.code))this.onTakeControl?.();
      this.controllerActive=false;this.keys.add(e.code);if(e.repeat)return;
      if(e.code==='KeyG'){if(this.mode==='eva'||this.mode==='walk'&&!this.insideShip)this.toggleEVA();else this.toggleGear();return;}
      if(e.code==='KeyL'){this.toggleLights();return;}
      if(e.code==='KeyN'){this.travel?this.cancelTravel():this.beginFreeTravel();return;}
      if(e.code==='KeyP'){this.togglePower();return;}
      if(e.code==='KeyJ'){this.travel?this.cancelTravel():this.beginTravel();return;}
      if(this.travel){if(e.code==='KeyX')this.cancelTravel();return;}
      if(e.code==='KeyV')this.toggleFlightAssist();
      if(e.code==='KeyB')this.landOrLaunch();if(e.code==='KeyF')this.embark();
      if(e.code==='KeyX'&&this.mode!=='eva')this.brake();
    });
    document.addEventListener('keyup',e=>{this.keys.delete(e.code);this.physicalKeys.delete(e.code);});
    window.addEventListener('blur',()=>{this.focused=false;this.physicalKeys.clear();this.gamepad.suspend();this.keys.clear();if(this.powered&&this.flightAssist)this.velocity.set(0,0,0);});
    window.addEventListener('focus',()=>{this.focused=true;});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){this.gamepad.suspend();this.keys.clear();}});
    canvas.addEventListener('wheel',e=>{if(!this.locked||this.travel)return;e.preventDefault();this.speedScale=clamp(this.speedScale*Math.exp(-e.deltaY*.002),.05,1);this.notify(`Throttle ${Math.round(this.speedScale*100)}%`);},{passive:false});
  }
  get canTogglePower(){return !this.openingActive&&!this.travel&&(this.mode==='flight'||this.mode==='landed');}
  get shipSpeed(){return this.cabinFlight?this.shipVelocity.length():this.mode==='walk'?0:this.speed;}
  togglePower(){
    if(!this.canTogglePower){this.notify(this.travel?'Disengage the travel drive before switching main power.':'Return to the pilot chair to switch main power.');return false;}
    this.powered=!this.powered;this.boost=false;this.keys.clear();
    if(!this.powered){this.autoland=false;this.stationLift=false;}
    this.notify(this.powered?'Main power on. Propulsion available.':'Main power off. Propulsion disabled; emergency cabin power remains.');
    return true;
  }
  brake(){
    if(this.mode==='flight'&&!this.powered){this.notify('Main power off. Power on with P to use ship brakes.');return;}
    this.velocity.set(0,0,0);this.angularVelocity.set(0,0,0);this.autoland=false;
    this.notify(this.cabinFlight?'Stopped walking. Ship remains on course.':'Brakes engaged.');
  }
  resetCabinFlight(){this.cabinFlight=false;this.shipVelocity.set(0,0,0);this.shipAngularVelocity.set(0,0,0);this.cruiseVelocity.set(0,0,0);}
  crashAt(impact,normal){
    if(this.mode!=='flight'||!impact.crashed)return false;
    this.crash={...impact,position:this.position.toArray(),normal:normal.toArray()};
    this.resetCabinFlight();this.spaceParked=false;this.travel=null;
    this.mode='crashed';this.autoland=false;this.stationLift=false;this.dockedAtStation=false;
    this.velocity.set(0,0,0);this.angularVelocity.set(0,0,0);this.keys.clear();this.boost=false;
    this.shipPosition=null;this.insideShip=false;this.doorOpen=false;this.doorProgress=0;
    if(document.pointerLockElement===this.canvas)document.exitPointerLock?.();
    this.notify(`Ship destroyed: ${impact.impactSpeed.toFixed(1)} m/s impact. Return to orbit to try again.`);
    return true;
  }
  toggleFlightAssist(){
    if(!this.powered){this.notify('Power on with P to enable flight control.');return;}
    if(this.travel||this.mode!=='flight'||this.autoland||this.stationLift){this.notify('Change flight assist while freely flying.');return;}
    this.flightAssist=!this.flightAssist;this.angularVelocity.set(0,0,0);
    this.notify(this.flightAssist?'Flight assist on. Releasing thrust brakes the ship.':'Inertial flight. Release thrust to coast; X brakes. V restores assist.');
  }
  get flightEnvironment(){
    const body=this.body;
    if(body.id==='aeon')return environmentAt(this.position,RADIUS);
    const local=bodyOffset(this.position,body),r=Math.max(body.radius,local.length());
    if(body.atmosphere)return environmentAt(local,body.radius,body.atmosphere,body.gravity);
    return {groundRadius:body.radius,altitude:Math.max(0,r-body.radius),density:0,regime:'SPACE',atmosphereFraction:0,
      gravity:local.normalize().multiplyScalar(-body.gravity*(body.radius/r)**2)};
  }
  capture(){if(!this.enabled||this.mode==='crashed')return;try{const result=this.canvas.requestPointerLock();result?.catch(()=>this.notify('Mouse capture unavailable. Drag to look, or use the arrow keys.'));}catch{this.notify('Use arrow keys to steer.');}}
  get speedProfile(){
    return flightSpeedProfile({airless:this.body.airless,altitude:this.flightEnvironment.altitude,
      clearance:this.altitude,stationDistance:this.stationDistance,boost:this.boost,throttle:this.speedScale});
  }
  toggleLights(){
    if(this.mode==='crashed'||this.openingActive)return false;
    const key=this.mode==='walk'||this.mode==='eva'?'flashlightOn':'shipLightsOn';
    this[key]=!this[key];this.notify(`${key==='flashlightOn'?'Suit flashlight':'Landing floodlights'} ${this[key]?'on':'off'}.`);return true;
  }
  toggleGear(){
    if(this.mode!=='flight'||this.autoland||this.stationLift||this.travel||!this.powered){this.notify('Change landing gear during powered manual flight.');return false;}
    this.gearDeployed=!this.gearDeployed;this.notify(`Landing gear ${this.gearDeployed?'deploying':'retracting'}.`);return true;
  }
  freeTravelRoute(){
    if(!this.powered||this.mode!=='flight'||this.autoland||this.stationLift)return {ok:false,reason:'Launch and leave landing assist with main power on before spooling.'};
    const obstacles=[{name:'the star',center:new THREE.Vector3(...SUN_DIRECTION).multiplyScalar(SUN_DISTANCE).toArray(),radius:2.5e8}];
    if(this.station?.ready)obstacles.push({name:'Aeon Orbital',center:(this.station.centre??this.station.worldPosition).toArray(),radius:2000});
    return planFreeTravel(this.position,FORWARD.clone().applyQuaternion(this.orientation),{body:this.body,altitude:this.altitude,outsideAtmosphere:this.flightEnvironment.atmosphereFraction===0,obstacles});
  }
  beginFreeTravel(){
    if(!this.enabled||this.travel)return false;
    const route=this.freeTravelRoute();if(!route.ok){this.notify(route.reason);return false;}
    this.travel={plan:route.plan,elapsed:0,targetId:null,manual:true,obstruction:route.obstruction};
    this.keys.clear();this.velocity.set(0,0,0);this.angularVelocity.set(0,0,0);this.boost=false;this.flightAssist=true;
    this.notify('Heading locked. Drive spooling · N disengages.'+(route.obstruction?` Automatic braking before ${route.obstruction}.`:''));return true;
  }
  travelRoute(){
    if(!this.powered)return {ok:false,reason:'Power on with P before engaging the travel drive.',plan:null};
    if(!this.travelTarget)return {ok:false,reason:'Select a world on the map (M).',plan:null};
    if(this.mode!=='flight'||this.autoland||this.stationLift)return {ok:false,reason:'Launch and leave landing assist before engaging the drive.',plan:null};
    const obstacles=[{name:'the star',center:new THREE.Vector3(...SUN_DIRECTION).multiplyScalar(SUN_DISTANCE).toArray(),radius:2.5e8}];
    if(this.station?.ready)obstacles.push({name:'Aeon Orbital',center:(this.station.centre??this.station.worldPosition).toArray(),radius:2000});
    return planTravel(this.position,this.travelTarget,{obstacles});
  }
  beginTravel(){
    if(!this.enabled||this.travel)return false;
    const route=this.travelRoute();
    if(!route.ok){this.notify(route.reason);return false;}
    this.travel={plan:route.plan,elapsed:0,targetId:this.travelTarget};
    this.keys.clear();this.velocity.set(0,0,0);this.angularVelocity.set(0,0,0);this.boost=false;this.flightAssist=true;
    this.notify('Drive spooling. Automatic alignment · X aborts.');
    return true;
  }
  cancelTravel(){
    if(!this.travel||this.travel.plan.kind==='abort')return;
    this.travel.plan=abortTravel(this.travel.plan,this.travel.elapsed);this.travel.elapsed=0;
    this.keys.clear();this.notify('Drive aborting. Braking to normal flight.');
  }
  get travelState(){
    if(!this.travel)return null;
    const sample=sampleTravel(this.travel.plan,this.travel.elapsed);
    return {...sample,position:sample.position.toArray(),targetId:this.travel.targetId,
      manual:Boolean(this.travel.manual),targetName:this.travel.manual?'FREE HEADING':TRAVEL_TARGETS.find(t=>t.id===this.travel.targetId)?.name,
      aborting:this.travel.plan.kind==='abort',eta:Math.max(0,this.travel.plan.duration-this.travel.elapsed)};
  }
  updateTravel(dt){
    const travel=this.travel;
    travel.elapsed+=Math.max(0,Number.isFinite(dt)?dt:0);
    const sample=sampleTravel(travel.plan,travel.elapsed);
    if(!travel.manual&&travel.plan.direction.lengthSq()>0){
      matrix.lookAt(new THREE.Vector3(),travel.plan.direction,UP);
      const aligned=new THREE.Quaternion().setFromRotationMatrix(matrix);
      this.orientation.slerp(aligned,sample.phase==='spooling'?1-Math.exp(-4*dt):1);
    }
    this.position.copy(sample.position);this.velocity.copy(travel.plan.direction).multiplyScalar(sample.speed);
    if(sample.done){
      this.travel=null;this.keys.clear();this.velocity.set(0,0,0);this.angularVelocity.set(0,0,0);
      this.notify(travel.plan.kind==='abort'?'Drive disengaged. Normal flight restored.':'Approach reached. Normal flight restored; descend to land.');
    }
  }
  startStation(){
    if(!this.station?.ready)throw new Error('Station is not ready for deck spawn.');
    if('location' in this.station)this.station.location='hangar';
    if(Number.isInteger(this.station.activeIndex))this.station.parkedPod=this.station.activeIndex;
    this.resetCabinFlight();this.travel=null;this.keys.clear();this.velocity.set(0,0,0);this.angularVelocity.set(0,0,0);
    this.mode='walk';this.autoland=false;this.flightAssist=true;this.dockedAtStation=true;this.stationLift=false;
    this.shipPosition=this.station.padWorldPosition.clone();this.shipOrientation.copy(this.station.padQuaternion);
    this.orientation.copy(this.shipOrientation);this.doorOpen=false;this.doorProgress=0;this.insideShip=false;
    this.jumpHeight=0;this.jumpVelocity=0;
    // Spawn ahead of the complete selected hull, including the Atlas cockpit
    // overhang. Interior bounds alone would put a saved freighter under its nose.
    const nose=this.layout.flightBounds.min[2]-.5;
    const point=this.fromShipLocal(new THREE.Vector3(2.5,this.layout.eyeHeight,nose));
    const deck=this.station.deckPoint(point,this.layout.eyeHeight);
    if(!deck)throw new Error('Opening spawn must have authored deck support.');
    this.position.copy(deck);
  }
  orbit(){
    this.crash=null;
    this.spaceParked=false;
    this.resetCabinFlight();
    this.travel=null;this.keys.clear();
    this.dockedAtStation=false;this.stationLift=false;this.flightAssist=true;this.angularVelocity.set(0,0,0);
    this.position.set(...latLonDirection(20,25)).multiplyScalar(RADIUS*2.8);
    const right=new THREE.Vector3().crossVectors(UP,this.position).normalize();
    const target=right.multiplyScalar(-RADIUS*.42);
    this.orientToward(target,UP);
    this.velocity.set(0,0,0);this.mode='flight';this.autoland=false;this.shipPosition=null;this.speedScale=1;this.doorOpen=false;this.doorProgress=0;this.insideShip=false;
  }
  orientToward(target,up){matrix.lookAt(this.position,target,up);this.orientation.setFromRotationMatrix(matrix);}
  look(yaw,pitch,direct=this.brakeFlight??false){
    if(this.mode==='crashed'||this.travel||this.openingActive||!this.enabled)return;
    if(this.mode==='flight'&&!this.powered)return;
    if(!direct&&this.mode==='flight'&&!this.flightAssist&&!this.autoland&&!this.stationLift){
      this.angularVelocity.x+=pitch*4;this.angularVelocity.y+=yaw*4;return;
    }
    // Spacecraft and EVA yaw around their own up axis, so horizontal input
    // always turns the nose sideways even when the nearest moon is overhead.
    // Surface walking and assisted atmospheric flight retain gravity-relative yaw.
    const normal=this.cabinFlight?UP.clone().applyQuaternion(this.shipOrientation):this.dockedAtStation?this.station.up:this.mode==='eva'||this.spaceFlightAttitude?UP.clone().applyQuaternion(this.orientation):this.spaceParked&&this.mode==='walk'?UP.clone().applyQuaternion(this.shipOrientation):this.normal;rotation.setFromAxisAngle(normal,yaw);this.orientation.premultiply(rotation);
    const right=RIGHT.clone().applyQuaternion(this.orientation);rotation.setFromAxisAngle(right,pitch);this.orientation.premultiply(rotation).normalize();
    if(this.mode==='walk'){
      const forward=FORWARD.clone().applyQuaternion(this.orientation);const dot=forward.dot(normal);
      if(Math.abs(dot)>.985){rotation.setFromAxisAngle(right,-pitch);this.orientation.premultiply(rotation).normalize();}
    }
  }
  get spaceFlightAttitude(){return this.mode==='flight'&&!this.autoland&&!this.stationLift&&this.flightEnvironment.regime==='SPACE';}
  get body(){return bodyAt(this.position);}
  get normal(){return bodyOffset(this.position,this.body).normalize();}
  get groundHeight(){return bodyHeight(this.normal,this.body);}
  get altitude(){return Math.max(0,bodyAltitude(this.position,this.body));}
  get speed(){return this.velocity.length();}
  get debrisSpeedLimit(){return debrisSpeedLimit(this.position);}
  get sunDirection(){return new THREE.Vector3(...SUN_DIRECTION).multiplyScalar(SUN_DISTANCE).sub(this.position).normalize();}
  toShipLocal(point=this.position){return this.shipPosition?point.clone().sub(this.shipPosition).applyQuaternion(this.shipOrientation.clone().invert()):null;}
  fromShipLocal(point){return point.clone().applyQuaternion(this.shipOrientation).add(this.shipPosition);}
  shipInteraction(local){return this.freighter?this.freighter.interaction(local):interactionAt(local,this.doorOpen);}
  get landingClearance(){return Math.max(3.2,this.layout.seatEye[1]+.35);}
  get interaction(){
    if(this.mode==='flight')return this.autoland||this.stationLift||this.travel?'FINISH MANEUVER TO LEAVE SEAT':'F · LEAVE PILOT SEAT';
    if(this.mode==='eva')return `EVA · ${this.shipPosition?Math.round(this.position.distanceTo(this.shipPosition))+' M TO SHIP · ':''}G / Y · SUIT THRUSTERS`;
    if(this.mode==='landed')return 'F · LEAVE PILOT SEAT';
    if(this.mode!=='walk'||!this.shipPosition)return '';
    const service=!this.cabinFlight&&this.station?.interaction?.(this);if(service)return service.label;
    const hit=this.shipInteraction(this.toShipLocal());
    if(hit==='lift:main'&&this.cabinFlight)return 'BELLY ELEVATOR · SECURED IN FLIGHT';
    if(hit?.startsWith('lift:')){const lift=this.freighter.lifts.find(l=>l.id===hit.slice(5));return `F · ${lift.name.toUpperCase()} · ${Math.abs(lift.y-lift.target)>.001?'MOVING':lift.y===lift.low?'RAISE':'LOWER'}`;}
    if(hit==='seat')return 'F · SIT IN PILOT CHAIR';
    if(hit==='storage')return 'F · OPEN CARGO STORAGE';
    if(hit==='door')return this.cabinFlight&&!this.spaceParked?'HATCH · SECURED IN FLIGHT':this.doorOpen?'F · CLOSE HATCH & RAMP':'F · OPEN HATCH & LOWER RAMP';
    if(this.cabinFlight)return 'IN-FLIGHT CABIN · RETURN TO CHAIR TO PILOT';
    if(this.dockedAtStation&&!this.insideShip)return this.station?.location==='hub'?'CENTRAL CONCOURSE · ELEVATORS AT REAR':'CARGO TERMINAL & CENTRAL HUB · AFT WALL';
    if(this.freighter)return this.insideShip?'F AT LIFT CONTROLS · U FLEET':'APPROACH THE REAR ELEVATOR · F TO CALL';
    return this.insideShip?'WALK AFT TO THE HATCH':'APPROACH THE REAR HATCH TO BOARD';
  }
  transit(direction,altitude=100){
    this.spaceParked=false;
    this.resetCabinFlight();
    this.travel=null;this.keys.clear();
    this.crash=null;
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
  /** Arrive above the dusk terminator looking north along it: day side to the right,
   * glowing night side to the left. Pitch follows the horizon dip at any altitude. */
  transitPyre(altitude=PYRE_ARRIVAL_ALTITUDE,direction=pyreLandingDirection()){
    this.orbit();
    const d=new THREE.Vector3(...direction).normalize();
    this.position.copy(bodySurfacePoint(d,PYRE,altitude));
    const sun=this.sunDirection,along=new THREE.Vector3().crossVectors(d,sun).normalize();
    if(along.lengthSq()<.5)along.crossVectors(Math.abs(d.y)<.9?UP:RIGHT,d).normalize();
    if(along.dot(new THREE.Vector3(...pyreFrame().y))<0)along.negate();
    const dip=Math.acos(PYRE.radius/(PYRE.radius+Math.max(0,altitude))),pitch=Math.min(1.3,dip+.06);
    this.orientToward(this.position.clone().addScaledVector(along,1000*Math.cos(pitch)).addScaledVector(d,-1000*Math.sin(pitch)),d);
    // Frame the nearby shield at arrival so the destination opens on geography.
    if(altitude===PYRE_ARRIVAL_ALTITUDE){
      const landmark=new THREE.Vector3(...fromPyreBody(...VOLCANOES[0].direction));
      this.orientToward(bodySurfacePoint(landmark,PYRE),d);
    }
    this.jumpHeight=0;this.jumpVelocity=0;
  }
  get stationDistance(){return this.station?.ready?this.position.distanceTo(this.station.worldPosition):Infinity;}
  get canDock(){return Boolean(this.station?.canDock(this.position,this.layout,this.orientation));}
  get stationLocal(){return this.station?.ready?this.station.toLocal(this.position,new THREE.Vector3()):null;}
  get deckClearance(){return this.stationLocal?this.stationLocal.y-this.station.interiorBox.min.y:Infinity;}
  dock(){
    if(this.mode==='crashed')return;
    const station=this.station;
    if(!this.canDock)return;
    const up=station.up;
    let forward=FORWARD.clone().applyQuaternion(this.orientation).projectOnPlane(up);
    if(forward.lengthSq()<.01)forward.set(0,0,1).applyQuaternion(station.quaternion);
    forward.normalize();matrix.lookAt(new THREE.Vector3(),forward,up);
    this.shipOrientation.setFromRotationMatrix(matrix);this.orientation.copy(this.shipOrientation);
    const eye=station.deckPoint(this.position,this.layout.seatEye[1]);
    this.shipPosition=eye.clone().sub(new THREE.Vector3(...this.layout.seatEye).applyQuaternion(this.shipOrientation));
    this.position.copy(eye);this.velocity.set(0,0,0);this.angularVelocity.set(0,0,0);this.gearDeployed=true;this.mode='landed';this.autoland=false;
    this.dockedAtStation=true;this.stationLift=false;this.doorOpen=false;this.doorProgress=0;
    this.notify(this.freighter?'Docked. F to stand; walk aft to the belly elevator controls.':'Docked. F to stand; walk aft and open the hatch to explore the hangar.');
    this.onVoyage?.('dock');
  }
  dryGround(){if(!this.body.water)return true;const n=this.normal;return terrainHeight(n.x,n.y,n.z)>=0||Math.abs(n.y)>.86;}
  landOrLaunch(){
    if(this.mode==='crashed')return;
    if(this.travel)return;
    if(this.mode==='eva'){this.notify('Return to the pilot chair before controlling the ship.');return;}
    if(this.mode==='walk'){this.notify('Walk to the cockpit and sit in the pilot chair with F before launch.');return;}
    if(!this.powered){this.notify('Power on with P before using launch or landing assist.');return;}
    if(this.mode==='landed'){
      if(this.freighter&&!this.freighter.secured){this.notify('Stow the belly elevator and lower both cargo lifts before launch.');return;}
      if(this.dockedAtStation){
        this.mode='flight';this.dockedAtStation=false;this.stationLift=true;this.autoland=false;
        this.station.openDoors();
        this.doorOpen=false;this.doorProgress=0;this.insideShip=false;this.shipPosition=null;
        this.velocity.copy(this.station.up).multiplyScalar(3);
        this.notify('Undocking. One-metre lift; fly through the hangar doors. W forward / S reverse · bay limit 20 m/s.');return;
      }
      this.mode='flight';this.doorOpen=false;this.doorProgress=0;this.insideShip=false;this.position.addScaledVector(this.normal,12);this.velocity.copy(this.normal).multiplyScalar(12);this.shipPosition=null;this.notify('Hatch secured. Liftoff. Space ascends; Shift boosts.');return;
    }
    if(this.autoland){this.autoland=false;this.notify('Landing assist disengaged.');return;}
    if(this.stationDistance<500){
      if(!this.canDock){this.notify('Fly through the open doors and over the central landing pad, then press B.');return;}
      this.gearDeployed=true;this.autoland=true;this.velocity.set(0,0,0);this.angularVelocity.set(0,0,0);this.notify('Docking assist. Settling onto the hangar deck.');return;
    }
    if(!this.dryGround()){this.notify('Open water below. Find dry ground or polar ice to land.');return;}
    if(this.altitude>12000){this.notify('Descend below 12 km to engage landing assist.');return;}
    this.gearDeployed=true;this.autoland=true;this.velocity.set(0,0,0);this.angularVelocity.set(0,0,0);this.notify('Landing assist engaged. Descending vertically.');
  }
  touchDown(){
    if(this.mode==='crashed')return;
    if(!this.dryGround())return;
    const body=this.body,radial=this.normal;
    const n=body.water?radial:bodySurfaceNormal(this.position,body);
    const surface=bodySurfacePoint(radial,body);
    this.position.copy(surface).addScaledVector(n,3.2);
    this.gearDeployed=true;this.mode='landed';this.autoland=false;this.velocity.set(0,0,0);this.angularVelocity.set(0,0,0);
    this.shipPosition=surface;
    let forward=FORWARD.clone().applyQuaternion(this.orientation).projectOnPlane(n);if(forward.lengthSq()<.01)forward.crossVectors(RIGHT,n);forward.normalize();
    matrix.lookAt(new THREE.Vector3(),forward,n);this.shipOrientation.setFromRotationMatrix(matrix);this.orientation.copy(this.shipOrientation);
    this.position.copy(this.fromShipLocal(new THREE.Vector3(...this.layout.seatEye)));this.doorOpen=false;this.doorProgress=0;
    this.onVoyage?.('surface');
    this.notify(this.freighter?'Touchdown. F leaves the pilot chair; walk aft to lower the belly elevator.':'Touchdown. F leaves the pilot chair; walk aft to open the hatch.');
  }
  toggleEVA(){
    if(this.mode==='walk'&&!this.insideShip&&!this.dockedAtStation){this.mode='eva';this.jumpHeight=0;this.jumpVelocity=0;this.notify('Suit thrusters active. WASD / left stick · Space/C or A/B vertical · X or LT brakes.');}
    else if(this.mode==='eva'){
      if(this.altitude<2.3){this.mode='walk';this.position.copy(bodySurfacePoint(this.normal,this.body,SHIP_LAYOUT.eyeHeight));this.velocity.set(0,0,0);this.notify('Boots on terrain. G / Y enables suit thrusters.');}
      else this.notify('Return through the open rear ramp to board. Thrust toward terrain before disabling suit thrusters.');
    }
  }
  get evaState(){return {active:this.mode==='eva',spaceParked:this.spaceParked,braking:this.evaBraking,shipDistance:this.shipPosition?this.position.distanceTo(this.shipPosition):null,speed:this.speed};}
  embark(){
    if(this.mode==='crashed')return;
    if(this.travel)return;
    if(this.mode==='walk'&&!this.cabinFlight&&this.stationAction?.())return;
    if(this.mode==='flight'){
      if(this.autoland||this.stationLift){this.notify('Finish landing or undocking before leaving the pilot seat.');return;}
      this.shipOrientation.copy(this.orientation);
      this.shipPosition=this.position.clone().sub(new THREE.Vector3(...this.layout.seatEye).applyQuaternion(this.shipOrientation));
      this.shipVelocity.copy(this.velocity);this.shipAngularVelocity.copy(this.angularVelocity);this.cruiseVelocity.copy(this.velocity);
      this.spaceParked=this.altitude>120&&this.speed<=2;
      this.cabinFlight=true;this.mode='landed';this.doorOpen=false;this.doorProgress=0;
    }
    if(this.mode==='eva'){this.notify('Approach the open ramp slowly at deck height to board.');return;}
    if(this.mode==='landed'){
      this.position.copy(this.fromShipLocal(new THREE.Vector3(...this.layout.stand)));
      this.mode='walk';this.insideShip=true;this.jumpHeight=0;this.jumpVelocity=0;this.velocity.set(0,0,0);
      this.orientation.copy(this.shipOrientation).multiply(new THREE.Quaternion().setFromAxisAngle(UP,Math.PI));
      this.keys.clear();this.boost=false;
      this.notify(this.cabinFlight?'Standing in the cabin. Ship continues flying; return to the chair with F.':this.freighter?'Standing on the cargo deck. Walk aft to the elevator pedestal; F lowers it.':'Standing in the cabin. Walk aft; F opens the hatch and lowers the ramp.');
    }else{
      if(!this.shipPosition)return;
      const local=this.toShipLocal(),hit=this.shipInteraction(local);
      if(hit?.startsWith('lift:')){
        if(this.cabinFlight&&hit==='lift:main'){this.notify('Belly elevator secured in flight. Land or dock to lower it.');return;}
        if(!this.powered){this.notify('Main power is required to operate cargo lifts.');return;}
        const moved=this.freighter.toggle(hit.slice(5),local);this.velocity.set(0,0,0);
        this.notify(moved?'Lift moving. Stay inside the guard rails.':'Lift busy, or you are standing on its edge. Step fully on or off.');
      }else if(hit==='door'){
        if(this.cabinFlight&&!this.spaceParked){this.notify('Hatch secured in flight. Land or dock to open it.');return;}
        if(this.doorOpen&&Math.abs(local.x)<1.2&&local.z>3.3&&local.z<7.5){this.notify('Step clear of the ramp before closing it.');return;}
        this.doorOpen=!this.doorOpen;this.notify(this.doorOpen?'Hatch opening. Ramp lowering — walk through when clear.':'Hatch closing. Ramp retracting.');
      }else if(hit==='storage'){
        this.keys.clear();this.velocity.set(0,0,0);this.openInventory?.();
      }else if(hit==='seat'){
        this.position.copy(this.fromShipLocal(new THREE.Vector3(...this.layout.seatEye)));this.orientation.copy(this.shipOrientation);
        this.mode=this.cabinFlight||this.spaceParked?'flight':'landed';this.insideShip=!this.cabinFlight;this.keys.clear();this.boost=false;
        if(this.cabinFlight){this.velocity.copy(this.shipVelocity);this.angularVelocity.copy(this.shipAngularVelocity);this.cabinFlight=false;this.spaceParked=false;this.shipPosition=null;this.doorOpen=false;this.doorProgress=0;}
        else {this.velocity.set(0,0,0);if(this.spaceParked){this.spaceParked=false;this.shipPosition=null;this.doorOpen=false;this.doorProgress=0;this.insideShip=false;}}
        this.notify('Pilot seat engaged. P main power · F stand · B land / launch.');
      }else this.notify(this.interaction||'Approach the ship’s rear hatch.');
    }
  }
  updateCabinFlight(dt){
    // Keep the walker in the hull's rigid local frame, but advance the hull via
    // the same pilot-eye physics/contact path used while seated. All rebasing
    // stays in JS doubles, well before rendering uploads any float matrices.
    const local=this.toShipLocal(),oldShipOrientation=this.shipOrientation.clone();
    const localLook=oldShipOrientation.clone().invert().multiply(this.orientation);
    const walkVelocity=this.velocity.clone().applyQuaternion(oldShipOrientation.clone().invert());
    this.position.copy(this.fromShipLocal(new THREE.Vector3(...this.layout.seatEye)));
    this.orientation.copy(this.shipOrientation);this.velocity.copy(this.shipVelocity);this.angularVelocity.copy(this.shipAngularVelocity);
    this.mode='flight';
    this.advanceFlight(dt,{cruiseTarget:this.cruiseVelocity});
    if(this.mode==='crashed')return;
    const landed=this.mode==='landed';
    this.shipOrientation.copy(this.orientation);
    if(!landed)this.shipPosition.copy(this.position).sub(new THREE.Vector3(...this.layout.seatEye).applyQuaternion(this.shipOrientation));
    this.shipVelocity.copy(this.velocity);this.shipAngularVelocity.copy(this.angularVelocity);
    // Contact/approach braking becomes the new hold speed; never keep pushing
    // back into a wall with a stale captured cruise target.
    this.cruiseVelocity.copy(this.velocity);
    this.cabinFlight=!landed;this.mode='walk';
    this.position.copy(this.fromShipLocal(local));this.orientation.copy(this.shipOrientation).multiply(localLook).normalize();
    this.velocity.copy(walkVelocity).applyQuaternion(this.shipOrientation);this.angularVelocity.set(0,0,0);
  }
  // Shared physics and swept contacts for piloted flight and an occupied cabin.
  // position is the pilot-eye reference for both; no second collision floor.
  advanceFlight(dt,{moveForward=0,strafe=0,vertical=0,turn=0,tilt=0,roll=0,cruiseTarget=null}={}){
    const oldNormal=this.normal;
    const forward=FORWARD.clone().applyQuaternion(this.orientation),right=RIGHT.clone().applyQuaternion(this.orientation);
    const input=forward.clone().multiplyScalar(moveForward).addScaledVector(right,strafe);
      const altitude=this.altitude;
      if(this.autoland||this.stationLift)this.engineAcceleration.copy(this.flightEnvironment.gravity).negate();
      if(this.brakeFlight&&this.powered){
        this.velocity.set(0,0,0);this.angularVelocity.set(0,0,0);
        if(roll){rotation.setFromAxisAngle(forward,roll*dt*.8);this.orientation.premultiply(rotation).normalize();}
      }else if(this.stationLift){
        // Lift the landing gear one metre, rather than raising every pilot eye
        // to six metres. Limit the final step so low frame rates cannot overshoot.
        const remaining=this.layout.seatEye[1]+1-this.deckClearance;
        if(remaining<=1e-5){this.stationLift=false;this.velocity.set(0,0,0);}
        else this.velocity.copy(this.station.up).multiplyScalar(dt>0?Math.min(3,remaining/dt):0);
      }else if(this.autoland && this.stationDistance<500){
        if(!this.canDock){this.autoland=false;this.velocity.set(0,0,0);this.notify('Docking cancelled: move over the central pad.');}
        else if(this.deckClearance<this.layout.seatEye[1]+.05){this.dock();return;}
        else this.velocity.copy(this.station.up).multiplyScalar(-Math.max(.5,Math.min(3,(this.deckClearance-this.layout.seatEye[1])*.8)));
      }else if(this.autoland){
        if(!this.dryGround()){this.autoland=false;this.notify('Landing cancelled: open water.');}
        else if(altitude<this.landingClearance+.4){this.touchDown();return;}
        else this.velocity.copy(oldNormal).multiplyScalar(-Math.min(800,Math.max(1,(altitude-this.landingClearance)*.65)));
      }else{
        input.addScaledVector(this.spaceFlightAttitude?UP.clone().applyQuaternion(this.orientation):oldNormal,vertical);input.clampLength(0,1);
        const profile=this.speedProfile,maxSpeed=Math.min(profile.speed,this.debrisSpeedLimit);
        const stationLimit=Math.min(stationSpeedLimit(this.stationDistance),this.debrisSpeedLimit);
        if(this.powered&&this.speed>stationLimit)this.velocity.setLength(stationLimit);
        // Assisted flight brakes toward lower commanded limits continuously.
        // Retain the swept guard for overspeed states loaded from older builds.
        const flight=stepFlight(this,{assist:this.powered&&this.flightAssist,targetVelocity:cruiseTarget??input.multiplyScalar(maxSpeed),
          translation:this.powered?new THREE.Vector3(strafe,vertical,-moveForward):new THREE.Vector3(),
          rotation:this.powered?new THREE.Vector3(tilt,turn,-roll):new THREE.Vector3(),
          boost:this.powered&&this.boost,maxSpeed:!this.powered?Infinity:Math.max(this.speed,profile.limit)},this.flightEnvironment,dt);
        this.engineAcceleration.copy(flight.engineAcceleration);
        this.velocity.copy(flight.velocity);this.orientation.copy(flight.orientation);this.angularVelocity.copy(flight.angularVelocity);
        if(this.powered&&this.flightAssist&&roll){rotation.setFromAxisAngle(forward,roll*dt*.8);this.orientation.premultiply(rotation);}
      }
      // Adaptive substeps prevent high-speed descent tunnelling through the globe.
      const steps=clamp(Math.ceil(this.speed*dt/Math.max(10,altitude*.2)),1,96);
      for(let i=0;i<steps;i++){
        const previous=this.position.clone(),proposed=previous.clone().addScaledVector(this.velocity,dt/steps);
        const rockHit=this.surfaceObstacles?.constrainFlight(previous,proposed);
        if(rockHit?.hit){this.position.copy(rockHit.point);this.velocity.set(0,0,0);this.autoland=false;if(rockHit.debrisBrake)this.notify('Debris proximity brake. Approach at controlled speed.');break;}
        const lunar=constrainMoonStep(previous,proposed,this.landingClearance);
        if(lunar.hit){
          this.position.copy(lunar.point);
          const normal=bodySurfaceNormal(this.position,SELENE),impact=assessImpact(this.velocity,normal,'lunar regolith');
          if(!this.crashAt(impact,normal))this.touchDown();break;
        }
        if(lunar.limited){proposed.copy(lunar.point);this.velocity.set(0,0,0);}
        const pyre=constrainPyreStep(previous,proposed,this.landingClearance);
        if(pyre.hit){this.position.copy(pyre.point);const normal=bodySurfaceNormal(this.position,PYRE);if(!this.crashAt(assessImpact(this.velocity,normal,'volcanic rock'),normal))this.touchDown();break;}
        if(pyre.limited){proposed.copy(pyre.point);this.velocity.set(0,0,0);}
        const collision=this.station?.constrainStep(previous,proposed,this.orientation,false,this.layout);
        this.position.copy(collision?collision.point:proposed);
        if(collision?.hit){
          this.velocity.set(0,0,0);this.angularVelocity.set(0,0,0);this.autoland=false;
          // A blocked lift must release manual controls, never keep thrusting
          // into the obstruction and ignore the pilot's departure input forever.
          if(this.stationLift){this.stationLift=false;this.notify('Launch lift stopped by station structure. Manual flight available; move clear carefully.');}
          break;
        }
        // Capture only a gentle deck arrival at this ship's actual parked height.
        // The planetary eye-clearance threshold would re-dock a departing Nomad
        // after just 35 cm of descent, even at full bay speed.
        if(!this.stationLift && this.canDock && this.speed<=3 && this.deckClearance<this.layout.seatEye[1]+.1 && this.velocity.dot(this.station.up)<0){this.dock();break;}
        const n=this.normal;const ground=this.groundHeight;
        const height=bodyAltitude(this.position,this.body);
        if(height<this.landingClearance){
          this.position.copy(bodySurfacePoint(n,this.body,this.landingClearance));
          const surfaceNormal=this.body.id==='aeon'?terrainSurfaceNormal(this.position):bodySurfaceNormal(this.position,this.body);
          const surface=this.dryGround()?(ground===0&&Math.abs(n.y)>.86?'ice':'terrain'):'water';
          const impact=assessImpact(this.velocity,surfaceNormal,surface);
          if(impact.crashed){this.crashAt(impact,surfaceNormal);break;}
          this.velocity.set(0,0,0);this.angularVelocity.set(0,0,0);
          if(this.dryGround())this.touchDown();else this.notify('Surface hover. Open water — landing unavailable.');
          break;
        }
      }
      // Assisted travel and inertial flight share the same swept collision path.
  }
  update(dt){
    this.engineAcceleration.set(0,0,0);
    const pad=this.gamepad.poll({focused:this.focused&&!document.hidden,enabled:this.enabled&&!document.querySelector('dialog[open]'),ui:Boolean(document.querySelector('dialog[open]'))});
    this.controllerShortcutModifier=Boolean(pad.shortcutModifier);
    this.onControllerInput?.(pad,dt);
    if(this.mode==='crashed')return;
    this.toolTrigger=pad.mine||0;
    if(!this.gamepad.connected)this.controllerActive=false;
    if(pad.used)this.controllerActive=true;
    if(this.openingActive){if(this.enabled)this.onOpeningInput?.(pad);return;}
    if(pad.scroll)this.onControllerScroll?.(pad.scroll*dt*500);
    if(!this.enabled||document.querySelector('dialog[open]'))return;
    if(Math.hypot(pad.strafe,pad.forward)>.1)this.onTakeControl?.();
    if(this.travel){if(pad.brake)this.cancelTravel();this.updateTravel(dt);return;}
    if(pad.pressed.has(11))this.toggleFlightAssist();
    if(pad.pressed.has(3)){if(this.mode==='eva'||(this.mode==='walk'&&!this.insideShip))this.toggleEVA();else this.landOrLaunch();}
    if(pad.pressed.has(2))this.embark();
    // Interactions may open a modal and disable navigation in this same frame.
    if(!this.enabled||document.querySelector('dialog[open]'))return;
    if(pad.brake&&this.mode!=='eva'&&(this.powered||this.mode!=='flight')){this.velocity.set(0,0,0);this.angularVelocity.set(0,0,0);this.autoland=false;}
    if(this.mode==='flight'&&pad.speed)this.speedScale=clamp(this.speedScale*Math.exp(pad.speed*dt),.05,1);
    const axis=(positive,negative,analog=0)=>clamp(Number(this.keys.has(positive))-Number(this.keys.has(negative))+analog,-1,1);
    const moveForward=axis('KeyW','KeyS',pad.forward),strafe=axis('KeyD','KeyA',pad.strafe);
    const turn=axis('ArrowLeft','ArrowRight',pad.yaw),tilt=axis('ArrowUp','ArrowDown',pad.pitch);
    this.doorProgress=clamp(this.doorProgress+(this.doorOpen?dt:-dt)/1.1,0,1);
    const brakeFlight=this.brakeFlight=Boolean(pad.brake&&this.mode==='flight'&&this.powered);
    if(this.cabinFlight&&!this.spaceParked)this.updateCabinFlight(dt);
    if(this.mode==='crashed')return;
    const oldBody=this.body,oldNormal=this.normal,spaceFlight=this.spaceFlightAttitude;
    const yaw=turn*dt*.85;
    const pitch=tilt*dt*.85;
    const inertial=this.mode==='flight'&&(!this.powered||!this.flightAssist)&&!this.autoland&&!this.stationLift&&!brakeFlight;
    if(!inertial&&(yaw||pitch))this.look(yaw,pitch,brakeFlight);
    this.boost=!brakeFlight&&(this.mode==='walk'||this.powered)&&(this.keys.has('ShiftLeft')||this.keys.has('ShiftRight')||pad.boost);
    const rider=this.mode==='walk'?this.toShipLocal():null;
    if(this.freighter&&this.shipPosition&&this.powered){const carry=this.freighter.update(dt,rider);if(carry){rider.y+=carry;this.position.copy(this.fromShipLocal(rider));this.velocity.set(0,0,0);}}
    if(this.mode==='landed')return;
    const forward=FORWARD.clone().applyQuaternion(this.orientation),right=RIGHT.clone().applyQuaternion(this.orientation);
    const input=new THREE.Vector3();
    input.addScaledVector(forward,moveForward);
    input.addScaledVector(right,strafe);
    if(this.mode==='eva'){
      this.evaBraking=this.keys.has('KeyX')||Boolean(pad.evaBrake);
      const vertical=axis('Space','KeyC',pad.evaVertical||0),roll=axis('KeyQ','KeyE',pad.roll);
      if(roll){rotation.setFromAxisAngle(forward,roll*dt*.85);this.orientation.premultiply(rotation).normalize();}
      const result=stepEVA(this.velocity,this.orientation,new THREE.Vector3(strafe,vertical,-moveForward),dt,{boost:this.boost,brake:this.evaBraking});
      const previous=this.position.clone();let proposed=previous.clone().add(result.displacement);this.velocity.copy(result.velocity);
      if(this.shipPosition){
        const hit=constrainEVAShip(this.toShipLocal(previous),this.toShipLocal(proposed),this.doorProgress>.98);
        if(hit.hit){proposed=this.fromShipLocal(hit.point);this.velocity.set(0,0,0);}
      }
      const obstacle=this.surfaceObstacles?.constrainEVA?.(previous,proposed);
      if(obstacle?.hit){proposed.copy(obstacle.point);this.velocity.set(0,0,0);}
      const station=this.station?.constrainStep(previous,proposed,this.orientation,true);
      if(station?.hit){proposed.copy(station.point);this.velocity.set(0,0,0);}
      this.position.copy(proposed);this.insideShip=false;
      if(this.shipPosition&&canAttachRamp(this.toShipLocal(),this.doorProgress>.98,this.speed)){
        const local=this.toShipLocal();local.y=shipFloorAt(local.x,local.z,true)+SHIP_LAYOUT.eyeHeight;
        this.position.copy(this.fromShipLocal(local));this.mode='walk';this.jumpHeight=0;this.jumpVelocity=0;this.velocity.set(0,0,0);
        // Magnetic boots align the suit with the deck without moving to the chair.
        const direction=FORWARD.clone().applyQuaternion(this.orientation),up=UP.clone().applyQuaternion(this.shipOrientation);
        direction.projectOnPlane(up);if(direction.lengthSq()<.001)direction.set(0,0,-1).applyQuaternion(this.shipOrientation);
        this.orientToward(this.position.clone().add(direction),up);this.notify('Boots attached to the ramp. Walk through the hatch to the pilot chair.');
      }else if(bodyAltitude(this.position,this.body)<SHIP_LAYOUT.eyeHeight){
        this.position.copy(bodySurfacePoint(this.normal,this.body,SHIP_LAYOUT.eyeHeight));this.mode='walk';this.jumpHeight=0;this.jumpVelocity=0;this.velocity.set(0,0,0);
        this.notify('Surface contact. G / Y enables suit thrusters again.');
      }
      return;
    }
    if(this.mode==='walk'){
      const localBefore=this.toShipLocal();
      const shipUp=this.dockedAtStation?this.station.up:localBefore&&localBefore.length()<50?UP.clone().applyQuaternion(this.shipOrientation):oldNormal;
      const magnitude=Math.min(1,input.length());input.projectOnPlane(shipUp);if(input.lengthSq()>0)input.setLength(magnitude);input.multiplyScalar(this.insideShip?2.3:this.boost?9:4.5);
      this.velocity.lerp(input,1-Math.exp(-12*dt));
      let proposed=this.position.clone().addScaledVector(this.velocity,dt);
      const previous=this.position.clone();
      let local=null,floor=null;
      if(localBefore&&localBefore.length()<55){
        local=this.freighter?this.freighter.constrain(localBefore,this.toShipLocal(proposed)):constrainShipStep(localBefore,this.toShipLocal(proposed),this.doorProgress>.98);
        proposed=this.fromShipLocal(local);floor=this.freighter?this.freighter.floorAt(local):shipFloorAt(local.x,local.z,this.doorProgress>.98);
      }
      if(this.cabinFlight&&!this.spaceParked&&floor===null){
        // Moving-ship EVA is a separate transition. Never let a missing cabin
        // support point fall through into the planet-floor walking branch.
        this.velocity.set(0,0,0);return;
      }
      if(this.spaceParked&&floor===null&&localBefore&&localBefore.length()<35){
        this.position.copy(proposed);this.mode='eva';this.insideShip=false;this.jumpHeight=0;this.jumpVelocity=0;this.velocity.projectOnPlane(UP.clone().applyQuaternion(this.shipOrientation));
        this.notify('EVA. Release thrust to coast; X / LT brakes. Return slowly to the open ramp.');return;
      }
      const dir=bodyOffset(proposed,this.body).normalize(),h=this.body.airless?0:terrainHeight(dir.x,dir.y,dir.z);
      if(floor!==null||this.dockedAtStation||h>=0||Math.abs(dir.y)>.86)this.position.copy(proposed);
      else{this.velocity.set(0,0,0);if(!this.shoreNotice||performance.now()-this.shoreNotice>4000){this.notify('Waterline reached. Swimming is outside this prototype.');this.shoreNotice=performance.now();}}
      this.insideShip=floor!==null&&(this.freighter?local.z<=10:local.z<=4);
      if(!this.spaceParked&&(this.keys.has('Space')||pad.jump)&&(this.jumpHeight===0||this.surfaceObstacles?.grounded)&&!this.insideShip){this.jumpVelocity=4.5;this.jumpHeight=Math.max(.001,this.jumpHeight);}
      this.jumpVelocity-=(this.dockedAtStation?9.81:this.body.gravity)*dt;this.jumpHeight=Math.max(0,this.jumpHeight+this.jumpVelocity*dt);if(this.jumpHeight===0)this.jumpVelocity=0;
      if(floor!==null){local.y=floor+this.layout.eyeHeight+this.jumpHeight;this.position.copy(this.fromShipLocal(local));}
      else if(this.dockedAtStation){
        const deck=this.station.deckPoint(this.position,this.layout.eyeHeight+this.jumpHeight);
        this.position.copy(deck||previous);
      }
      else{this.position.copy(bodySurfacePoint(this.normal,this.body,this.layout.eyeHeight+this.jumpHeight));}
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
      this.advanceFlight(dt,{moveForward,strafe,vertical:axis('Space','KeyC',pad.vertical),turn,tilt,roll:axis('KeyE','KeyQ',pad.roll)});
    }
    if(pad.brake&&this.mode!=='eva'&&(this.powered||this.mode!=='flight')){this.velocity.set(0,0,0);this.angularVelocity.set(0,0,0);}
    const newNormal=this.normal;
    if(!spaceFlight&&!this.spaceParked&&!inertial&&!this.cabinFlight&&oldBody===this.body&&this.mode!=='landed'&&this.mode!=='crashed'){rotation.setFromUnitVectors(oldNormal,newNormal);this.orientation.premultiply(rotation).normalize();}
    if(!Number.isFinite(this.position.length())||this.position.length()>SUN_DISTANCE*4){this.orbit();this.notify('Navigation envelope exceeded. Returned to orbit.');}
  }
}
