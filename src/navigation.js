import {constrainShipAttachments} from './ship-attachment-collision.js';
import { MIASMA_ARRIVAL_ALTITUDE, miasmaArrivalDirection, constrainMiasmaStep } from './miasma-world.js';
import * as THREE from 'three';
import { SUN_POSITION, SUN_AXIS, sunStandoffPoint } from './stellar-world.js';
import { createStellarThermal, stepStellarThermal, stellarIncursion } from './stellar-thermal.js';
import { gearStep, GEAR_FLIGHT } from './gear-flight.js';
import { shipHandling, steeringStep } from './ship-handling.js';
import { combatSpeed } from './combat/flight-policy.js';
import { ringPathIntervals } from './ring-world.js';
import { stepEVA, constrainEVAShip, canAttachRamp } from './eva.js';
import { stationPhysicsAt, stationDeckPoint } from './station-physics.js';
import { GamepadInput } from './gamepad.js';
import { MOON_LANDING_DIRECTION, constrainMoonStep } from './moon-world.js';
import { PYRE_ARRIVAL_ALTITUDE, pyreArrivalDirection, pyreLandingDirection, constrainPyreStep, pyreFrame } from './pyre-world.js';
import { RADIUS, SUN_DISTANCE, SUN_DIRECTION, terrainHeight, latLonDirection, clamp } from './world.js';
import { SELENE, PYRE, MIASMA, bodyAt, bodyOffset, bodyHeight, bodyAltitude, bodySurfacePoint, bodySurfaceNormal } from './celestial.js';
import { environmentAt, step as stepFlight } from './flight-model.js';
import { assessImpact, terrainSurfaceNormal } from './impact.js';
import { SHIP_LAYOUT, shipFloorAt, constrainShipStep, interactionAt } from './boarding.js';
import { constrainKestrelStep, constrainKestrelEVA } from './kestrel-access.js';

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
    this.shipId='nomad';this.pendingLook=new THREE.Vector2();this.frameLook=new THREE.Vector2();this.assistedTurn=new THREE.Vector3();this.layout=SHIP_LAYOUT;this.freighter=null;
    this.station=null;this.dockedAtStation=false;this.stationLift=false;this.kestrelAccess=null;
    this.spaceParked=false;this.evaBraking=false;this.surfaceObstacles=null;this.toolTrigger=0;
    this.combatMode=true;this.flightAssist=true;this.angularVelocity=new THREE.Vector3();
    this.travel=null;this.travelTarget=null;
    this.stellarThermal=createStellarThermal();this.destruction=null;
    this.powered=true;this.cabinFlight=false;this.gearDeployed=true;this.gearProgress=1;this.shipLightsOn=false;this.flashlightOn=false;
    this.berthRest=false;this.berthTransition=null;this.gearContactHold=false;
    this.shipVelocity=new THREE.Vector3();this.shipAngularVelocity=new THREE.Vector3();
    this.cruiseVelocity=new THREE.Vector3();
    this.engineAcceleration=new THREE.Vector3();
    this.crash=null;
    this.orbit();
    document.addEventListener('pointerlockchange',()=>{this.locked=document.pointerLockElement===canvas;document.body.classList.toggle('piloting',this.locked);if(!this.locked)this.keys.clear();});
    document.addEventListener('mousemove',e=>{if(this.locked&&this.enabled){this.controllerActive=false;this.look(-e.movementX*.0018,-e.movementY*.0018);}});
    document.addEventListener('keydown',e=>{
      this.physicalKeys.add(e.code);
      if(!this.enabled||this.mode==='destroyed'||document.querySelector('dialog[open]')){this.resetSteering();return;}
      if(this.openingActive){this.onOpeningKey?.(e);return;}
      if(['Space','Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
    if(this.mode==='crashed')return;
      if(['KeyW','KeyA','KeyS','KeyD','Space','KeyC'].includes(e.code))this.onTakeControl?.();
      this.controllerActive=false;this.keys.add(e.code);if(e.repeat)return;
      if(this.buildActive)return;
      if(e.code==='KeyG'){if(this.mode==='eva'||this.mode==='walk'&&!this.insideShip)this.toggleEVA();else this.toggleGear();return;}
      if(e.code==='KeyL'){this.toggleLights();return;}
      if(e.code==='KeyN'){this.travel?this.cancelTravel():this.beginFreeTravel();return;}
      if(e.code==='KeyP'){this.togglePower();return;}
      if(e.code==='KeyJ'){this.travel?this.cancelTravel():this.beginTravel();return;}
      if(this.travel){if(e.code==='KeyX')this.cancelTravel();return;}
      if(e.code==='KeyV')this.toggleFlightAssist();
      if(e.code==='KeyZ')this.toggleCombatMode();
      if(e.code==='KeyB')this.landOrLaunch();if(e.code==='KeyF')this.embark();
      if(e.code==='KeyX'&&this.mode!=='eva')this.brake();
    });
    document.addEventListener('keyup',e=>{this.keys.delete(e.code);this.physicalKeys.delete(e.code);});
    window.addEventListener('blur',()=>{this.focused=false;this.resetSteering();this.physicalKeys.clear();this.gamepad.suspend();this.keys.clear();});
    window.addEventListener('focus',()=>{this.focused=true;});
    document.addEventListener('visibilitychange',()=>{if(document.hidden){this.resetSteering();this.gamepad.suspend();this.keys.clear();}});
    canvas.addEventListener('wheel',e=>{if(!this.locked||this.travel)return;e.preventDefault();this.speedScale=clamp(this.speedScale*Math.exp(-e.deltaY*.002),.05,1);this.notify(`Throttle ${Math.round(this.speedScale*100)}%`);},{passive:false});
  }
  get canTogglePower(){return !this.openingActive&&!this.travel&&(this.mode==='flight'||this.mode==='landed');}
  get shipSpeed(){return this.cabinFlight?this.shipVelocity.length():this.mode==='walk'?0:this.speed;}
  togglePower(){
    if(!this.canTogglePower){this.notify(this.travel?'Disengage the travel drive before switching main power.':'Return to the pilot chair to switch main power.');return false;}
    this.powered=!this.powered;this.resetSteering();this.boost=false;this.keys.clear();
    if(!this.powered){this.autoland=false;this.stationLift=false;}
    this.notify(this.powered?'Main power on. Propulsion available.':'Main power off. Propulsion disabled; emergency cabin power remains.');
    return true;
  }
  brake(){
    if(this.mode==='flight'&&!this.powered){this.notify('Main power off. Power on with P to use ship brakes.');return;}
    if(this.mode==='flight'){this.autoland=false;this.notify('Hold X / controller LT for full braking thrust.');return;}
    this.velocity.set(0,0,0);this.angularVelocity.set(0,0,0);this.autoland=false;this.resetSteering();
    this.notify(this.cabinFlight?'Stopped walking. Ship remains on course.':'Brakes engaged.');
  }
  beginFrame(dt){
    // Mouse deltas arrive once per rendered frame. Spread their requested rate
    // across every physics substep before applying the hull's turn-rate cap.
    this.frameLook.copy(this.pendingLook).multiplyScalar(dt>0?1/dt:0);this.pendingLook.set(0,0);
  }
  resetSteering(){this.frameLook.set(0,0);this.pendingLook.set(0,0);this.assistedTurn.set(0,0,0);}
  resetCabinFlight(){this.resetSteering();this.cabinFlight=false;this.berthRest=false;this.berthTransition=null;this.gearContactHold=false;this.shipVelocity.set(0,0,0);this.shipAngularVelocity.set(0,0,0);this.cruiseVelocity.set(0,0,0);}
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
    this.flightAssist=!this.flightAssist;this.resetSteering();this.angularVelocity.set(0,0,0);
    this.notify(this.flightAssist?'Fly-by-wire. Thrusters correct drift and brake on release; allow stopping distance.':'Unlocked. Thrust off to coast; turn and fire while drifting. Hold X / LT to brake; V / R3 restores fly-by-wire.');
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
  get gearLimited(){return this.gearDeployed||this.gearProgress>0;}
  toggleCombatMode(){
    if(this.mode!=='flight'||this.travel||this.autoland||this.stationLift)return false;
    this.combatMode=!this.combatMode;
    this.notify(this.combatMode?'Combat mode. Slowing to weapon speed; momentum is preserved during deceleration.':'Cruise mode. Weapons locked; higher flight speeds available.');
    return true;
  }
  get speedProfile(){
    const profile=this.cruiseSpeedProfile;
    if(!this.combatMode)return profile;
    const limit=Math.min(profile.limit,combatSpeed(this.shipId));
    return {...profile,limit,speed:Math.min(profile.speed,limit*this.speedScale)};
  }
  get cruiseSpeedProfile(){
    if(this.body.star&&!this.gearLimited){const cruise=THREE.MathUtils.lerp(50000,2000000,THREE.MathUtils.smoothstep(this.altitude,30000000,500000000)),boosted=cruise*4,limit=this.boost?boosted:cruise;return {cruise,boosted,limit,speed:limit*this.speedScale,regime:'STELLAR'};}
    return flightSpeedProfile({shipId:this.shipId,gearLimited:this.gearLimited,airless:this.body.airless,altitude:this.flightEnvironment.altitude,
      clearance:this.altitude,stationDistance:this.stationDistance,boost:this.boost,throttle:this.speedScale});
  }
  toggleLights(){
    if(this.mode==='crashed'||this.openingActive)return false;
    const key=this.mode==='walk'||this.mode==='eva'?'flashlightOn':'shipLightsOn';
    this[key]=!this[key];this.notify(`${key==='flashlightOn'?'Suit flashlight':'Landing floodlights'} ${this[key]?'on':'off'}.`);return true;
  }
  toggleGear(){
    if(this.kestrelAccess&&!this.kestrelAccess.secured){this.notify('Secure the canopy and ladder before changing landing gear.');return false;}
    if(this.mode!=='flight'||this.autoland||this.stationLift||this.travel||!this.powered){this.notify('Change landing gear during powered manual flight.');return false;}
    this.gearDeployed=!this.gearDeployed;this.notify(`Landing gear ${this.gearDeployed?'deploying':'retracting'}.`);return true;
  }
  freeTravelRoute(){
    if(this.gearLimited)return {ok:false,reason:'Retract landing gear before engaging the drive: G / LB+RB + D-pad down.'};
    if(!this.powered||this.mode!=='flight'||this.autoland||this.stationLift)return {ok:false,reason:'Launch and leave landing assist with main power on before spooling.'};
    const obstacles=[{name:'the star',center:new THREE.Vector3(...SUN_DIRECTION).multiplyScalar(SUN_DISTANCE).toArray(),radius:2.5e8}];
    if(this.station?.ready)obstacles.push({name:'Aeon Orbital',center:(this.station.centre??this.station.worldPosition).toArray(),radius:2000});
    return planFreeTravel(this.position,FORWARD.clone().applyQuaternion(this.orientation),{body:this.body,altitude:this.altitude,outsideAtmosphere:this.flightEnvironment.atmosphereFraction===0,obstacles});
  }
  beginFreeTravel(){
    if(this.targeting?.hasTarget)return this.targeting.engage();
    if(!this.enabled||this.travel)return false;
    const route=this.freeTravelRoute();if(!route.ok){this.notify(route.reason);return false;}
    this.travel={plan:route.plan,elapsed:0,targetId:null,manual:true,obstruction:route.obstruction};
    this.keys.clear();this.velocity.set(0,0,0);this.angularVelocity.set(0,0,0);this.boost=false;this.flightAssist=true;this.combatMode=false;
    this.notify('Heading locked. Drive spooling · N disengages.'+(route.obstruction?` Automatic braking before ${route.obstruction}.`:''));return true;
  }
  travelRoute(){
    if(this.targeting)return this.targeting.route();
    if(!this.powered)return {ok:false,reason:'Power on with P before engaging the travel drive.',plan:null};
    if(this.gearLimited)return {ok:false,reason:'Retract landing gear before engaging the drive: G / LB+RB + D-pad down.',plan:null};
    if(!this.travelTarget)return {ok:false,reason:'Select a world on the map (M).',plan:null};
    if(this.mode!=='flight'||this.autoland||this.stationLift)return {ok:false,reason:'Launch and leave landing assist before engaging the drive.',plan:null};
    const obstacles=[];
    if(this.station?.ready)obstacles.push({name:'Aeon Orbital',center:(this.station.centre??this.station.worldPosition).toArray(),radius:2000});
    return planTravel(this.position,this.travelTarget,{obstacles});
  }
  beginTravel(){
    if(this.targeting)return this.targeting.engage();
    if(!this.enabled||this.travel)return false;
    const route=this.travelRoute();
    if(!route.ok){this.notify(route.reason);return false;}
    this.travel={plan:route.plan,elapsed:0,targetId:this.travelTarget};this.combatMode=false;
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
      manual:Boolean(this.travel.manual),targetName:this.travel.targetName??(this.travel.manual?'FREE HEADING':TRAVEL_TARGETS.find(t=>t.id===this.travel.targetId)?.name??'Navigation target'),
      aborting:this.travel.plan.kind==='abort',eta:Math.max(0,this.travel.plan.duration-this.travel.elapsed)};
  }
  updateTravel(dt){
    const travel=this.travel;
    travel.elapsed+=Math.max(0,Number.isFinite(dt)?dt:0);
    const sample=sampleTravel(travel.plan,travel.elapsed);
    if(!travel.manual&&travel.plan.direction.lengthSq()>0){
      matrix.lookAt(new THREE.Vector3(),travel.plan.direction,travel.targetId==='pyre'||travel.targetId==='miasma'?new THREE.Vector3(...pyreFrame().y):UP);
      const aligned=new THREE.Quaternion().setFromRotationMatrix(matrix);
      this.orientation.slerp(aligned,sample.phase==='spooling'?1-Math.exp(-4*dt):1);
    }
    this.position.copy(sample.position);this.velocity.copy(travel.plan.direction).multiplyScalar(sample.speed);
    if(sample.done){
      if(travel.targeted){this.gamepad.suspend();this.targeting?.reset();}
      this.travel=null;this.keys.clear();this.velocity.set(0,0,0);this.angularVelocity.set(0,0,0);
      if(travel.plan.kind==='travel'&&(travel.targetId==='pyre'||travel.targetId==='miasma'))this.orientToward(new THREE.Vector3(...(travel.targetId==='pyre'?PYRE:MIASMA).center),new THREE.Vector3(...pyreFrame().y));
      this.notify(travel.plan.kind==='abort'?'Drive disengaged. Normal flight restored.':travel.targetId==='star'?'Stellar observation distance reached. Watch shield temperature; Space + Shift retreats.':'Approach reached. Normal flight restored; descend to land.');
    }
  }
  startStation(){
    if(!this.station?.ready)throw new Error('Station is not ready for deck spawn.');
    if('location' in this.station)this.station.location='hangar';
    if(Number.isInteger(this.station.activeIndex))this.station.parkedPod=this.station.activeIndex;
    this.gearDeployed=true;this.gearProgress=1;
    this.resetCabinFlight();this.travel=null;this.keys.clear();this.velocity.set(0,0,0);this.angularVelocity.set(0,0,0);
    this.gearProgress=1;this.gearDeployed=true;
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
    if(this.mode==='destroyed'&&this.stellarThermal?.destroyed)return;
    this.kestrelAccess?.reset();
    this.crash=null;
    this.gearDeployed=false;this.gearProgress=0;
    this.spaceParked=false;
    this.resetCabinFlight();
    this.gearProgress=0;this.gearDeployed=false;
    this.travel=null;this.keys.clear();
    this.dockedAtStation=false;this.stationLift=false;this.combatMode=true;this.flightAssist=true;this.angularVelocity.set(0,0,0);
    this.position.set(...latLonDirection(20,25)).multiplyScalar(RADIUS*2.8);
    const right=new THREE.Vector3().crossVectors(UP,this.position).normalize();
    const target=right.multiplyScalar(-RADIUS*.42);
    this.orientToward(target,UP);
    this.velocity.set(0,0,0);this.mode='flight';this.autoland=false;this.shipPosition=null;this.speedScale=1;this.doorOpen=false;this.doorProgress=0;this.insideShip=false;
  }
  orientToward(target,up){matrix.lookAt(this.position,target,up);this.orientation.setFromRotationMatrix(matrix);}
  transitStar(){
    this.orbit();this.position.copy(sunStandoffPoint());
    this.orientToward(new THREE.Vector3(...SUN_POSITION),new THREE.Vector3(...SUN_AXIS));
  }
  recoverFromStar(){this.stellarThermal=createStellarThermal();this.destruction=null;this.orbit();this.enabled=true;this.notify('Replacement ship ready in Aeon orbit.');}
  destroyFromStar(reason){
    if(this.mode==='destroyed')return;
    this.stellarThermal={...this.stellarThermal,hull:0,destroyed:true,reason};
    this.destruction={position:this.position.toArray(),normal:this.sunDirection.clone().negate().toArray(),reason};
    this.mode='destroyed';this.travel=null;this.autoland=false;this.shipPosition=null;this.dockedAtStation=false;this.stationLift=false;
    this.keys.clear();this.physicalKeys.clear();this.velocity.set(0,0,0);this.angularVelocity.set(0,0,0);
    this.notify('Ship destroyed. Thermal protection failed.');
  }
  updateStellarThermal(dt,previous=this.position){
    const contact=stellarIncursion(previous,this.position);
    if(contact){this.position.copy(contact);this.destroyFromStar('Photosphere incursion');return;}
    this.stellarThermal=stepStellarThermal(this.stellarThermal,this.position.distanceTo(new THREE.Vector3(...SUN_POSITION)),dt);
    if(this.stellarThermal.destroyed)this.destroyFromStar(this.stellarThermal.reason);
  }
  look(yaw,pitch,direct=this.brakeFlight??false){
    if(this.mode==='destroyed'||this.mode==='crashed'||this.travel||this.openingActive||!this.enabled)return;
    if(this.mode==='flight'&&!this.powered)return;
    const handling=shipHandling(this.shipId);
    if(this.mode==='flight'){yaw*=handling.turn;pitch*=handling.turn;}
    if(!direct&&this.mode==='flight'&&this.flightAssist&&!this.autoland&&!this.stationLift&&handling.steeringLag){this.pendingLook.x+=yaw;this.pendingLook.y+=pitch;return;}
    if(!direct&&this.mode==='flight'&&!this.flightAssist&&!this.autoland&&!this.stationLift){
      this.angularVelocity.x+=pitch*4;this.angularVelocity.y+=yaw*4;return;
    }
    this.applyLook(yaw,pitch);
  }
  applyLook(yaw,pitch){
    // Spacecraft and EVA yaw around their own up axis, so horizontal input
    // always turns the nose sideways even when the nearest moon is overhead.
    // Surface walking and assisted atmospheric flight retain gravity-relative yaw.
    const normal=this.cabinFlight&&this.insideShip?UP.clone().applyQuaternion(this.shipOrientation):this.mode==='walk'&&this.stationPhysics?this.stationPhysics.up:this.mode==='eva'||this.spaceFlightAttitude?UP.clone().applyQuaternion(this.orientation):this.spaceParked&&this.mode==='walk'?UP.clone().applyQuaternion(this.shipOrientation):this.normal;rotation.setFromAxisAngle(normal,yaw);this.orientation.premultiply(rotation);
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
  shipInteraction(local){return this.kestrelAccess?(this.kestrelAccess.reachable(this)?'ladder':null):this.freighter?this.freighter.interaction(local):interactionAt(local,this.doorOpen);}
  get landingClearance(){return this.layout.landingClearance??Math.max(3.2,this.layout.seatEye[1]+.35);}
  get interaction(){
    if(this.kestrelAccess?.busy)return `KESTREL · ${this.kestrelAccess.phase.toUpperCase()} · PORT LADDER`;
    if(this.kestrelAccess&&this.mode==='flight')return 'SINGLE-SEAT COCKPIT · LAND OR DOCK TO DISEMBARK';
    if(this.kestrelAccess&&this.mode==='landed')return 'F · OPEN CANOPY & DESCEND PORT LADDER';
    if(this.buildActive)return 'BUILD MODE · SELECT A PIECE OR EXIT TO INTERACT';
    const baseInteraction=this.baseInteraction?.();if(baseInteraction)return baseInteraction;
    if(this.mode==='flight')return this.autoland||this.stationLift||this.travel?'FINISH MANEUVER TO LEAVE SEAT':'F · LEAVE PILOT SEAT';
    if(this.mode==='eva')return `EVA · ${this.shipPosition?Math.round(this.position.distanceTo(this.shipPosition))+' M TO SHIP · ':''}G / Y · SUIT THRUSTERS`;
    if(this.mode==='landed')return 'F · LEAVE PILOT SEAT';
    if(this.mode!=='walk'||!this.shipPosition)return '';
    if(this.berthTransition)return this.berthRest?'SETTLING INTO BERTH':'LEAVING BERTH';
    if(this.berthRest)return 'F · LEAVE BERTH';
    const service=!this.cabinFlight&&this.station?.interaction?.(this);if(service)return service.label;
    const hit=this.shipInteraction(this.toShipLocal());
    if(hit==='ladder')return 'F · CLIMB LADDER & BOARD KESTREL';
    if(hit==='lift:main'&&this.cabinFlight)return 'BELLY ELEVATOR · SECURED IN FLIGHT';
    if(hit?.startsWith('lift:')){const lift=this.freighter.lifts.find(l=>l.id===hit.slice(5));return `F · ${lift.name.toUpperCase()} · ${Math.abs(lift.y-lift.target)>.001?'MOVING':lift.y===lift.low?'RAISE':'LOWER'}`;}
    if(hit==='seat')return 'F · SIT IN PILOT CHAIR';
    if(hit==='storage')return 'F · OPEN CARGO STORAGE';
    if(hit==='berth')return 'F · REST IN BERTH';
    if(hit==='door')return this.cabinFlight&&!this.spaceParked?'HATCH · SECURED IN FLIGHT':this.doorOpen?'F · CLOSE HATCH & RAMP':'F · OPEN HATCH & LOWER RAMP';
    if(this.cabinFlight)return 'IN-FLIGHT CABIN · RETURN TO CHAIR TO PILOT';
    if(this.dockedAtStation&&!this.insideShip)return this.station?.location==='hub'?'CENTRAL CONCOURSE · ELEVATORS AT REAR':'CARGO TERMINAL & CENTRAL HUB · AFT WALL';
    if(this.kestrelAccess)return 'APPROACH THE PORT LADDER TO BOARD KESTREL';
    if(this.freighter)return this.insideShip?'F AT LIFT CONTROLS · U FLEET':'APPROACH THE REAR ELEVATOR · F TO CALL';
    return this.insideShip?'WALK AFT TO THE HATCH':'APPROACH THE REAR HATCH TO BOARD';
  }
  transit(direction,altitude=100){
    this.kestrelAccess?.reset();
    this.spaceParked=false;
    this.resetCabinFlight();
    this.travel=null;this.keys.clear();
    this.crash=null;
    this.dockedAtStation=false;this.stationLift=false;this.combatMode=true;this.flightAssist=true;this.angularVelocity.set(0,0,0);
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
  /** High arrival matches the Aeon approach: sunlight left, night right. */
  transitPyre(altitude=PYRE_ARRIVAL_ALTITUDE,direction=altitude===PYRE_ARRIVAL_ALTITUDE?pyreArrivalDirection():pyreLandingDirection()){
    this.orbit();
    const d=new THREE.Vector3(...direction).normalize();
    this.position.copy(bodySurfacePoint(d,PYRE,altitude));
    const sun=this.sunDirection,along=new THREE.Vector3().crossVectors(d,sun).normalize();
    if(along.lengthSq()<.5)along.crossVectors(Math.abs(d.y)<.9?UP:RIGHT,d).normalize();
    if(along.dot(new THREE.Vector3(...pyreFrame().y))<0)along.negate();
    const dip=Math.acos(PYRE.radius/(PYRE.radius+Math.max(0,altitude))),pitch=Math.min(1.3,dip+.06);
    this.orientToward(this.position.clone().addScaledVector(along,1000*Math.cos(pitch)).addScaledVector(d,-1000*Math.sin(pitch)),d);
    if(altitude===PYRE_ARRIVAL_ALTITUDE)this.orientToward(new THREE.Vector3(...PYRE.center),new THREE.Vector3(...pyreFrame().y));
    this.jumpHeight=0;this.jumpVelocity=0;
  }
  transitMiasma(altitude=MIASMA_ARRIVAL_ALTITUDE,direction=miasmaArrivalDirection()){
    if(this.mode==='destroyed')return;
    this.orbit();const d=new THREE.Vector3(...direction).normalize();
    this.position.copy(bodySurfacePoint(d,MIASMA,altitude));
    if(altitude>100000)this.orientToward(new THREE.Vector3(...MIASMA.center),new THREE.Vector3(...pyreFrame().y));
    else {const east=new THREE.Vector3().crossVectors(Math.abs(d.y)<.9?UP:RIGHT,d).normalize();this.orientToward(this.position.clone().addScaledVector(east,1000).addScaledVector(d,-180),d);}
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
    this.position.copy(eye);this.velocity.set(0,0,0);this.angularVelocity.set(0,0,0);this.gearDeployed=true;this.gearProgress=1;this.mode='landed';this.autoland=false;
    this.dockedAtStation=true;this.stationLift=false;this.doorOpen=false;this.doorProgress=0;this.gearContactHold=false;
    this.kestrelAccess?.reset();
    this.notify(this.kestrelAccess?'Docked. F opens the canopy and descends the port ladder.':this.freighter?'Docked. F to stand; walk aft to the belly elevator controls.':'Docked. F to stand; walk aft and open the hatch to explore the hangar.');
    this.onVoyage?.('dock');
  }
  dryGround(){if(!this.body.water)return true;const n=this.normal;return terrainHeight(n.x,n.y,n.z)>=0||Math.abs(n.y)>.86;}
  landOrLaunch(){
    if(this.mode==='destroyed')return;
    if(this.body.star){this.notify('Stars have no landing surface. Maintain observation distance.');return;}
    if(this.kestrelAccess&&!this.kestrelAccess.secured){this.notify('Wait for the ladder to stow and the canopy to seal before launch.');return;}
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
    if(this.speed>10){this.notify('Slow below 10 m/s before landing assist. Hold X / LT to brake.');return;}
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
    this.gearProgress=1;this.gearDeployed=true;this.gearContactHold=false;
    const body=this.body,radial=this.normal;
    const n=body.water?radial:bodySurfaceNormal(this.position,body);
    const surface=bodySurfacePoint(radial,body);
    this.position.copy(surface).addScaledVector(n,3.2);
    this.gearDeployed=true;this.gearProgress=1;this.mode='landed';this.autoland=false;this.velocity.set(0,0,0);this.angularVelocity.set(0,0,0);
    this.shipPosition=surface;
    let forward=FORWARD.clone().applyQuaternion(this.orientation).projectOnPlane(n);if(forward.lengthSq()<.01)forward.crossVectors(RIGHT,n);forward.normalize();
    matrix.lookAt(new THREE.Vector3(),forward,n);this.shipOrientation.setFromRotationMatrix(matrix);this.orientation.copy(this.shipOrientation);
    this.position.copy(this.fromShipLocal(new THREE.Vector3(...this.layout.seatEye)));this.doorOpen=false;this.doorProgress=0;
    this.onVoyage?.('surface');
    this.kestrelAccess?.reset();
    this.notify(this.kestrelAccess?'Touchdown. F opens the canopy and descends the port ladder.':this.freighter?'Touchdown. F leaves the pilot chair; walk aft to lower the belly elevator.':'Touchdown. F leaves the pilot chair; walk aft to open the hatch.');
  }
  get gearReady(){return this.gearProgress>=1;}
  updateLandingGear(dt){
    // Landing/parking are explicit requests. Ordinary flight and moving-cabin
    // posture retain the pilot's selection, independent of altitude or thrust.
    if(this.mode==='landed'||(this.mode==='walk'&&!this.cabinFlight&&!this.spaceParked)||this.autoland||this.stationLift)this.gearDeployed=true;
    if(!this.autoland)this.gearContactHold=false;
    // Soft contact has emergency lowering power. Ordinary unpowered flight
    // still pauses a selected transition; a held contact must never deadlock.
    if(this.powered||this.gearContactHold)this.gearProgress=gearStep(this.gearProgress,this.gearDeployed,dt);
  }
  holdForLandingGear(){
    // Hold the existing conservative contact clearance until the real feet are
    // down. Physics, cockpit indication and the Blender rig share this progress.
    if(this.gearReady)return false;
    this.gearDeployed=true;this.autoland=true;this.gearContactHold=true;
    this.velocity.set(0,0,0);this.angularVelocity.set(0,0,0);return true;
  }
  finishLanding(){if(!this.holdForLandingGear())this.touchDown();}
  finishDocking(){if(!this.holdForLandingGear())this.dock();}
  toggleEVA(){
    if(this.kestrelAccess?.busy)return;
    if(this.mode==='walk'&&!this.insideShip&&!this.stationPhysics){this.mode='eva';this.jumpHeight=0;this.jumpVelocity=0;this.notify('Suit thrusters active. WASD / left stick · Space/C or A/B vertical · X or LT brakes.');}
    else if(this.mode==='eva'){
      if(this.altitude<2.3){this.mode='walk';this.position.copy(bodySurfacePoint(this.normal,this.body,SHIP_LAYOUT.eyeHeight));this.velocity.set(0,0,0);this.notify('Boots on terrain. G / Y enables suit thrusters.');}
      else this.notify(this.kestrelAccess?'Return to the ground beside the port ladder to board. Thrust toward terrain before disabling suit thrusters.':'Return through the open rear ramp to board. Thrust toward terrain before disabling suit thrusters.');
    }
  }
  get evaState(){return {active:this.mode==='eva',spaceParked:this.spaceParked,braking:this.evaBraking,shipDistance:this.shipPosition?this.position.distanceTo(this.shipPosition):null,speed:this.speed};}
  get stationPhysics(){return stationPhysicsAt(this.station,this.position);}
  get physicsFrame(){return ['walk','eva'].includes(this.mode)?this.stationPhysics?.id??null:null;}
  enterStationGravity(grid){
    this.mode='walk';this.insideShip=false;this.evaBraking=false;
    this.jumpHeight=Math.max(0,grid.local.y-grid.frame.interiorBox.min.y-this.layout.eyeHeight);
    this.jumpVelocity=this.velocity.dot(grid.up);
    const forward=FORWARD.clone().applyQuaternion(this.orientation).projectOnPlane(grid.up);
    if(forward.lengthSq()<.001)forward.set(0,0,-1).applyQuaternion(grid.frame.quaternion);
    this.orientToward(this.position.clone().add(forward),grid.up);
    this.notify('Hangar gravity engaged. Walk / jump; the open doorway leads to EVA.');
  }
  embark(){
    if(this.mode==='destroyed')return;
    if(this.mode==='crashed')return;
    if(this.travel)return;
    if(this.berthTransition)return;
    if(this.berthRest){this.useBerth(false);return;}
    if(this.buildActive)return;
    if(this.mode==='walk'&&!this.insideShip&&this.baseAction?.())return;
    if(this.mode==='walk'&&!this.cabinFlight&&this.stationAction?.())return;
    if(this.kestrelAccess){this.kestrelAccess.interact(this);return;}
    if(this.mode==='flight'){
      if(this.autoland||this.stationLift){this.notify('Finish landing or undocking before leaving the pilot seat.');return;}
      this.resetSteering();
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
      }else if(hit==='berth'){
        this.useBerth(true);
      }else if(hit==='seat'){
        this.position.copy(this.fromShipLocal(new THREE.Vector3(...this.layout.seatEye)));this.orientation.copy(this.shipOrientation);
        this.mode=this.cabinFlight||this.spaceParked?'flight':'landed';this.insideShip=!this.cabinFlight;this.keys.clear();this.boost=false;
        if(this.cabinFlight){this.velocity.copy(this.shipVelocity);this.angularVelocity.copy(this.shipAngularVelocity);this.cabinFlight=false;this.spaceParked=false;this.shipPosition=null;this.doorOpen=false;this.doorProgress=0;}
        else {this.velocity.set(0,0,0);if(this.spaceParked){this.spaceParked=false;this.shipPosition=null;this.doorOpen=false;this.doorProgress=0;this.insideShip=false;}}
        this.notify('Pilot seat engaged. P main power · F stand · B land / launch.');
      }else this.notify(this.interaction||'Approach the ship’s rear hatch.');
    }
  }
  useBerth(rest){
    const berth=this.layout.berth;
    if(!berth||this.mode!=='walk'||!this.shipPosition||this.berthTransition)return false;
    if(rest&&(!this.insideShip||this.shipInteraction(this.toShipLocal())!=='berth'))return false;
    if(!rest&&!this.berthRest)return false;
    const from=this.toShipLocal();
    const target=new THREE.Vector3(...(rest?berth.eye:berth.stand));
    const targetLook=rest?new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(target,new THREE.Vector3(...berth.lookAt),UP)):new THREE.Quaternion().setFromAxisAngle(UP,Math.PI);
    this.berthRest=rest;
    this.berthTransition={from,target,look:this.shipOrientation.clone().invert().multiply(this.orientation),targetLook,elapsed:0};
    this.keys.clear();this.velocity.set(0,0,0);this.jumpHeight=0;this.jumpVelocity=0;this.boost=false;this.toolTrigger=0;
    this.gamepad.suspend();
    this.notify(rest?`Resting in the berth. F / interact to stand.${this.cabinFlight?' Ship continues its current course.':''}`:'Standing beside the berth.');
    return true;
  }
  updateBerth(dt){
    if(!this.berthRest&&!this.berthTransition)return false;
    this.velocity.set(0,0,0);this.boost=false;this.toolTrigger=0;
    const transition=this.berthTransition;
    if(transition){
      transition.elapsed+=Math.max(0,dt);
      const t=clamp(transition.elapsed/.65,0,1),smooth=t*t*(3-2*t);
      this.position.copy(this.fromShipLocal(transition.from.clone().lerp(transition.target,smooth)));
      this.orientation.copy(this.shipOrientation).multiply(transition.look.clone().slerp(transition.targetLook,smooth));
      if(t===1)this.berthTransition=null;
    }else this.position.copy(this.fromShipLocal(new THREE.Vector3(...this.layout.berth.eye)));
    return true;
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
    if(this.mode==='crashed'||this.mode==='destroyed')return;
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
    const handling=shipHandling(this.shipId);
    if(this.powered&&this.flightAssist&&!this.autoland&&!this.stationLift&&!this.brakeFlight&&handling.steeringLag&&dt>0){
      const targets=[this.frameLook.y+this.pendingLook.y/dt,this.frameLook.x+this.pendingLook.x/dt,-roll*.8*handling.turn];
      const angles=targets.map((target,i)=>{const result=steeringStep(this.assistedTurn.getComponent(i),clamp(target,-handling.turn*1.2,handling.turn*1.2),dt,handling.steeringLag);this.assistedTurn.setComponent(i,result.rate);return result.angle;});
      this.applyLook(angles[1],angles[0]);
      this.orientation.multiply(rotation.setFromAxisAngle(new THREE.Vector3(0,0,1),angles[2])).normalize();
      this.pendingLook.set(0,0);
    }else this.resetSteering();
    const oldNormal=this.normal;
    const forward=FORWARD.clone().applyQuaternion(this.orientation),right=RIGHT.clone().applyQuaternion(this.orientation);
    const input=forward.clone().multiplyScalar(moveForward).addScaledVector(right,strafe);
      const altitude=this.altitude;
      if(this.autoland||this.stationLift)this.engineAcceleration.copy(this.flightEnvironment.gravity).negate();
      if(this.brakeFlight&&this.powered){
        const flight=stepFlight(this,{shipId:this.shipId,assist:true,brake:true},this.flightEnvironment,dt);
        this.velocity.copy(flight.velocity);this.engineAcceleration.copy(flight.engineAcceleration);this.angularVelocity.set(0,0,0);this.autoland=false;
        if(roll){rotation.setFromAxisAngle(forward,roll*dt*.8*handling.turn);this.orientation.premultiply(rotation).normalize();}
      }else if(this.stationLift){
        // Lift the landing gear one metre, rather than raising every pilot eye
        // to six metres. Limit the final step so low frame rates cannot overshoot.
        const remaining=this.layout.seatEye[1]+1-this.deckClearance;
        if(remaining<=1e-5){this.stationLift=false;this.velocity.set(0,0,0);}
        else this.velocity.copy(this.station.up).multiplyScalar(dt>0?Math.min(3,remaining/dt):0);
      }else if(this.autoland && this.stationDistance<500){
        if(!this.canDock){this.autoland=false;this.velocity.set(0,0,0);this.notify('Docking cancelled: move over the central pad.');}
        else if(this.deckClearance<this.layout.seatEye[1]+.05){this.finishDocking();return;}
        else this.velocity.copy(this.station.up).multiplyScalar(-Math.max(.5,Math.min(3,(this.deckClearance-this.layout.seatEye[1])*.8)));
      }else if(this.autoland){
        if(!this.dryGround()){this.autoland=false;this.notify('Landing cancelled: open water.');}
        else if(altitude<this.landingClearance+.4){this.finishLanding();return;}
        else this.velocity.copy(oldNormal).multiplyScalar(-Math.min(GEAR_FLIGHT.speed,Math.max(1,(altitude-this.landingClearance)*.65)));
      }else{
        input.addScaledVector(this.spaceFlightAttitude?UP.clone().applyQuaternion(this.orientation):oldNormal,vertical);input.clampLength(0,1);
        const profile=this.speedProfile,maxSpeed=Math.min(profile.speed,this.debrisSpeedLimit);
        const stationLimit=Math.min(stationSpeedLimit(this.stationDistance),this.debrisSpeedLimit);
        // Station approach is a commanded limit; swept collisions still protect contact.
        // Assisted flight brakes toward lower commanded limits continuously.
        // Retain the swept guard for overspeed states loaded from older builds.
        const flight=stepFlight(this,{shipId:this.shipId,assist:this.powered&&this.flightAssist,targetVelocity:cruiseTarget??input.multiplyScalar(maxSpeed),
          translation:this.powered?new THREE.Vector3(strafe,vertical,-moveForward):new THREE.Vector3(),
          rotation:this.powered?new THREE.Vector3(tilt,turn,-roll):new THREE.Vector3(),
          boost:this.powered&&this.boost,maxSpeed:!this.powered?Infinity:Math.min(profile.limit,stationLimit)},this.flightEnvironment,dt);
        this.engineAcceleration.copy(flight.engineAcceleration);
        this.velocity.copy(flight.velocity);this.orientation.copy(flight.orientation);this.angularVelocity.copy(flight.angularVelocity);
        if(this.powered&&this.flightAssist&&!handling.steeringLag&&roll){rotation.setFromAxisAngle(forward,roll*dt*.8*handling.turn);this.orientation.premultiply(rotation);}
      }
      // Adaptive substeps prevent high-speed descent tunnelling through the globe.
      const steps=clamp(Math.ceil(this.speed*dt/Math.max(10,altitude*.2)),1,96);
      for(let i=0;i<steps;i++){
        const previous=this.position.clone(),proposed=previous.clone().addScaledVector(this.velocity,dt/steps);
        const solar=stellarIncursion(previous,proposed);
        if(solar){this.position.copy(solar);this.destroyFromStar('Photosphere incursion');break;}
        const rockHit=this.surfaceObstacles?.constrainFlight(previous,proposed);
        if(rockHit?.hit){this.position.copy(rockHit.point);this.velocity.set(0,0,0);this.autoland=false;if(rockHit.debrisBrake)this.notify('Debris proximity brake. Approach at controlled speed.');break;}
        const lunar=constrainMoonStep(previous,proposed,this.landingClearance);
        if(lunar.hit){
          this.position.copy(lunar.point);
          const normal=bodySurfaceNormal(this.position,SELENE),impact=assessImpact(this.velocity,normal,'lunar regolith');
          if(!this.crashAt(impact,normal))this.finishLanding();break;
        }
        if(lunar.limited){proposed.copy(lunar.point);this.velocity.set(0,0,0);}
        const pyre=constrainPyreStep(previous,proposed,this.landingClearance);
        if(pyre.hit){this.position.copy(pyre.point);const normal=bodySurfaceNormal(this.position,PYRE);if(!this.crashAt(assessImpact(this.velocity,normal,'volcanic rock'),normal))this.finishLanding();break;}
        if(pyre.limited){proposed.copy(pyre.point);this.velocity.set(0,0,0);}
        const toxic=constrainMiasmaStep(previous,proposed,this.landingClearance);
        if(toxic.hit){this.position.copy(toxic.point);const normal=bodySurfaceNormal(this.position,MIASMA);if(!this.crashAt(assessImpact(this.velocity,normal,'toxic regolith'),normal))this.finishLanding();break;}
        if(toxic.limited){proposed.copy(toxic.point);this.velocity.set(0,0,0);}
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
        if(!this.stationLift && this.canDock && this.speed<=3 && this.deckClearance<this.layout.seatEye[1]+.1 && this.velocity.dot(this.station.up)<0){this.finishDocking();break;}
        const n=this.normal;const ground=this.groundHeight;
        const height=bodyAltitude(this.position,this.body);
        if(height<this.landingClearance){
          this.position.copy(bodySurfacePoint(n,this.body,this.landingClearance));
          const surfaceNormal=this.body.id==='aeon'?terrainSurfaceNormal(this.position):bodySurfaceNormal(this.position,this.body);
          const surface=this.dryGround()?(ground===0&&Math.abs(n.y)>.86?'ice':'terrain'):'water';
          const impact=assessImpact(this.velocity,surfaceNormal,surface);
          if(impact.crashed){this.crashAt(impact,surfaceNormal);break;}
          this.velocity.set(0,0,0);this.angularVelocity.set(0,0,0);
          if(this.dryGround())this.finishLanding();else this.notify('Surface hover. Open water — landing unavailable.');
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
    if(this.mode==='destroyed'){if(pad.pressed.has(0))this.onRecovery?.();return;}
    if(this.mode==='crashed')return;
    this.toolTrigger=pad.mine||0;
    if(!this.gamepad.connected)this.controllerActive=false;
    if(pad.used)this.controllerActive=true;
    if(this.openingActive){if(this.enabled)this.onOpeningInput?.(pad);return;}
    if(pad.scroll)this.onControllerScroll?.(pad.scroll*dt*500);
    if(!this.enabled||document.querySelector('dialog[open]')){this.resetSteering();return;}
    this.updateLandingGear(dt);
    if(Math.hypot(pad.strafe,pad.forward)>.1)this.onTakeControl?.();
    if(this.travel){const before=this.position.clone();this.resetSteering();if(pad.brake)this.cancelTravel();this.updateTravel(dt);this.updateStellarThermal(dt,before);return;}
    if(pad.pressed.has(11))this.toggleFlightAssist();
    if(pad.pressed.has(3)){if(this.mode==='eva'||(this.mode==='walk'&&!this.insideShip))this.toggleEVA();else this.landOrLaunch();}
    if(pad.pressed.has(2))this.embark();
    // Interactions may open a modal and disable navigation in this same frame.
    if(!this.enabled||document.querySelector('dialog[open]')){this.resetSteering();return;}
    if(this.kestrelAccess?.update(dt,this))return;
    if(pad.brake&&this.mode!=='eva'&&this.mode!=='flight'){this.velocity.set(0,0,0);this.angularVelocity.set(0,0,0);this.autoland=false;}
    if(this.mode==='flight'&&pad.speed)this.speedScale=clamp(this.speedScale*Math.exp(pad.speed*dt),.05,1);
    const axis=(positive,negative,analog=0)=>clamp(Number(this.keys.has(positive))-Number(this.keys.has(negative))+analog,-1,1);
    const moveForward=axis('KeyW','KeyS',pad.forward),strafe=axis('KeyD','KeyA',pad.strafe);
    const turn=axis('ArrowLeft','ArrowRight',pad.yaw),tilt=axis('ArrowUp','ArrowDown',pad.pitch);
    if(!this.kestrelAccess)this.doorProgress=clamp(this.doorProgress+(this.doorOpen?dt:-dt)/1.1,0,1);
    const brakeFlight=this.brakeFlight=Boolean((pad.brake||this.keys.has('KeyX'))&&this.mode==='flight'&&this.powered);
    if(this.cabinFlight&&!this.spaceParked)this.updateCabinFlight(dt);
    if(this.mode==='crashed'||this.mode==='destroyed')return;
    const oldBody=this.body,oldNormal=this.normal,spaceFlight=this.spaceFlightAttitude;
    const yaw=turn*dt*.85;
    const pitch=tilt*dt*.85;
    const inertial=this.mode==='flight'&&(!this.powered||!this.flightAssist)&&!this.autoland&&!this.stationLift&&!brakeFlight;
    if(!inertial&&(yaw||pitch))this.look(yaw,pitch,brakeFlight);
    // Rest is a supported ship-local posture, never a flight mode or teleport.
    // The shared flight step above continues carrying and colliding the hull.
    if(this.updateBerth(dt))return;
    this.boost=!brakeFlight&&(this.mode==='walk'||this.powered)&&(this.keys.has('ShiftLeft')||this.keys.has('ShiftRight')||pad.boost);
    const rider=this.mode==='walk'?this.toShipLocal():null;
    if(this.freighter&&this.shipPosition&&this.powered){const carry=this.freighter.update(dt,rider);if(carry){rider.y+=carry;this.position.copy(this.fromShipLocal(rider));this.velocity.set(0,0,0);}}
    if(this.mode==='landed'){this.updateStellarThermal(dt);return;}
    const forward=FORWARD.clone().applyQuaternion(this.orientation),right=RIGHT.clone().applyQuaternion(this.orientation);
    const input=new THREE.Vector3();
    input.addScaledVector(forward,moveForward);
    input.addScaledVector(right,strafe);
    const stationGrid=this.stationPhysics;
    if(this.mode==='eva'&&stationGrid)this.enterStationGravity(stationGrid);
    if(this.mode==='eva'){
      this.evaBraking=this.keys.has('KeyX')||Boolean(pad.evaBrake);
      const vertical=axis('Space','KeyC',pad.evaVertical||0),roll=axis('KeyQ','KeyE',pad.roll);
      if(roll){rotation.setFromAxisAngle(forward,roll*dt*.85);this.orientation.premultiply(rotation).normalize();}
      const result=stepEVA(this.velocity,this.orientation,new THREE.Vector3(strafe,vertical,-moveForward),dt,{boost:this.boost,brake:this.evaBraking});
      const previous=this.position.clone();let proposed=previous.clone().add(result.displacement);this.velocity.copy(result.velocity);
      if(this.shipPosition){
        const hit=this.kestrelAccess?{point:constrainKestrelEVA(this.toShipLocal(previous),this.toShipLocal(proposed))}:constrainEVAShip(this.toShipLocal(previous),this.toShipLocal(proposed),this.doorProgress>.98);
        if(this.kestrelAccess)hit.hit=!hit.point.equals(this.toShipLocal(proposed));
        const fitted=constrainShipAttachments(this.toShipLocal(previous),hit.point,this.layout?.weaponParts,{eva:true});
        hit.hit||=!fitted.equals(hit.point);hit.point=fitted;
        if(hit.hit){proposed=this.fromShipLocal(hit.point);this.velocity.set(0,0,0);}
      }
      const obstacle=this.surfaceObstacles?.constrainEVA?.(previous,proposed);
      if(obstacle?.hit){proposed.copy(obstacle.point);this.velocity.set(0,0,0);}
      const station=this.station?.constrainStep(previous,proposed,this.orientation,true);
      if(station?.hit){proposed.copy(station.point);this.velocity.set(0,0,0);}
      this.position.copy(proposed);this.insideShip=false;
      const enteredGrid=this.stationPhysics;
      if(enteredGrid)this.enterStationGravity(enteredGrid);
      else if(!this.kestrelAccess&&this.shipPosition&&canAttachRamp(this.toShipLocal(),this.doorProgress>.98,this.speed)){
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
      const shipUp=stationGrid?.up??(localBefore&&localBefore.length()<50?UP.clone().applyQuaternion(this.shipOrientation):oldNormal);
      const magnitude=Math.min(1,input.length());input.projectOnPlane(shipUp);if(input.lengthSq()>0)input.setLength(magnitude);input.multiplyScalar(this.insideShip?2.3:this.boost?9:4.5);
      this.velocity.lerp(input,1-Math.exp(-12*dt));
      let proposed=this.position.clone().addScaledVector(this.velocity,dt);
      const previous=this.position.clone();
      let local=null,floor=null;
      if(localBefore&&localBefore.length()<55){
        local=this.kestrelAccess?constrainKestrelStep(localBefore,this.toShipLocal(proposed)):this.freighter?this.freighter.constrain(localBefore,this.toShipLocal(proposed)):constrainShipStep(localBefore,this.toShipLocal(proposed),this.doorProgress>.98);
        local=constrainShipAttachments(localBefore,local,this.layout?.weaponParts,{eyeHeight:this.layout?.eyeHeight??1.75});
        proposed=this.fromShipLocal(local);floor=this.kestrelAccess?null:this.freighter?this.freighter.floorAt(local):shipFloorAt(local.x,local.z,this.doorProgress>.98);
      }
      if(this.cabinFlight&&!this.spaceParked&&floor===null&&!stationGrid){
        // Moving-ship EVA is a separate transition. Never let a missing cabin
        // support point fall through into the planet-floor walking branch.
        this.velocity.set(0,0,0);return;
      }
      if(this.spaceParked&&floor===null&&localBefore&&localBefore.length()<35&&!stationGrid){
        this.position.copy(proposed);this.mode='eva';this.insideShip=false;this.jumpHeight=0;this.jumpVelocity=0;this.velocity.projectOnPlane(UP.clone().applyQuaternion(this.shipOrientation));
        this.notify('EVA. Release thrust to coast; X / LT brakes. Return slowly to the open ramp.');return;
      }
      const dir=bodyOffset(proposed,this.body).normalize(),h=this.body.water?terrainHeight(dir.x,dir.y,dir.z):0;
      if(floor!==null||stationGrid||h>=0||Math.abs(dir.y)>.86)this.position.copy(proposed);
      else{this.velocity.set(0,0,0);if(!this.shoreNotice||performance.now()-this.shoreNotice>4000){this.notify('Waterline reached. Swimming is outside this prototype.');this.shoreNotice=performance.now();}}
      this.insideShip=floor!==null&&(this.freighter?local.z<=10:local.z<=4);
      if((stationGrid||!this.spaceParked)&&(this.keys.has('Space')||pad.jump)&&(this.jumpHeight===0||this.surfaceObstacles?.grounded)&&!this.insideShip){this.jumpVelocity=4.5;this.jumpHeight=Math.max(.001,this.jumpHeight);}
      this.jumpVelocity-=(stationGrid?.gravity??this.body.gravity)*dt;this.jumpHeight=Math.max(0,this.jumpHeight+this.jumpVelocity*dt);if(this.jumpHeight===0)this.jumpVelocity=0;
      if(floor!==null){local.y=floor+this.layout.eyeHeight+this.jumpHeight;this.position.copy(this.fromShipLocal(local));}
      else if(stationGrid){
        const deck=stationDeckPoint(stationGrid,this.position,this.layout.eyeHeight+this.jumpHeight);
        if(deck)this.position.copy(deck);
      }
      else{this.position.copy(bodySurfacePoint(this.normal,this.body,this.layout.eyeHeight+this.jumpHeight));}
      if(stationGrid){
        const result=this.station.constrainStep(previous,this.position,this.orientation,true);
        this.position.copy(result.point);
        if(floor===null&&!this.stationPhysics){
          this.mode='eva';this.jumpHeight=0;this.jumpVelocity=0;
          this.notify('Outside hangar gravity. Suit thrusters active.');
        }
      }
      if(floor===null&&!stationGrid&&this.surfaceObstacles){
        const result=this.surfaceObstacles.constrainWalker(previous,this.position);
        this.position.copy(result.point);
        if(result.hit){this.jumpHeight=Math.max(0,bodyAltitude(this.position,this.body)-SHIP_LAYOUT.eyeHeight);if(result.grounded&&this.jumpVelocity<0)this.jumpVelocity=0;}
      }
      this.velocity.copy(this.position).sub(previous).divideScalar(Math.max(dt,.001));
    }else{
      this.advanceFlight(dt,{moveForward,strafe,vertical:axis('Space','KeyC',pad.vertical),turn,tilt,roll:axis('KeyE','KeyQ',pad.roll)});
    }
    if(this.mode!=='destroyed')this.updateStellarThermal(dt);
    if(pad.brake&&this.mode!=='eva'&&this.mode!=='flight'){this.velocity.set(0,0,0);this.angularVelocity.set(0,0,0);}
    const newNormal=this.normal;
    if(!stationGrid&&!spaceFlight&&!this.spaceParked&&!inertial&&!this.cabinFlight&&oldBody===this.body&&this.mode!=='landed'&&this.mode!=='crashed'&&this.mode!=='destroyed'){rotation.setFromUnitVectors(oldNormal,newNormal);this.orientation.premultiply(rotation).normalize();}
    if(!Number.isFinite(this.position.length())||this.position.length()>SUN_DISTANCE*4){this.orbit();this.notify('Navigation envelope exceeded. Returned to orbit.');}
  }
}
