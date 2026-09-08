import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ROVER_LAYOUT as L } from './rover-layout.js';
import { createRoverPhysics, roverFitsPlatform, roverSweptBounds, roverFootprint } from './rover-physics.js';
import { sampleRoverSupport } from './rover-support.js';
import { createRoverPower } from './rover-power.js';
import { createRoverUI } from './rover-ui.js';
import { createRoverDisplays } from './rover-display.js';
import { bodyOffset } from './celestial.js';
import { MATERIAL_IDS } from './inventory/containers.js';
import { RoverCuttingBeam } from './rover-cutting-beam.js';
import { createWeaponTarget } from './effects/weapon-target.js';
import { clipTerrainCamera } from './ship-camera.js';
import { roverSurfaceStart } from './rover-surface-start.js';
import { roverCarrierStart, roverCarrierClear, guardRoverCarrier } from './rover-carrier.js';
import {garageRetrievalStatus} from './settlements/garage-policy.js';

const UP=new THREE.Vector3(0,1,0),FWD=new THREE.Vector3(0,0,-1),clamp=THREE.MathUtils.clamp;
const v=p=>new THREE.Vector3(...p);
const boxOverlap=(a,b)=>a.min.every((n,i)=>n<b.max[i])&&a.max.every((n,i)=>n>b.min[i]);
const bounds=points=>({min:[0,1,2].map(i=>Math.min(...points.map(p=>p.getComponent(i)))),max:[0,1,2].map(i=>Math.max(...points.map(p=>p.getComponent(i))))});

/** Offline vehicle adapter. Navigation remains the sole owner of the player;
 * this hook claims its seated/access step and keeps every world pose in doubles. */
export function createMiningRover({scene,canvas,nav,mining,effects,inventoryUI,getShip,available=()=>true,construction=null,terrainObstacles=null}){
  const object=new THREE.Group();object.name='Meridian Burrow';object.visible=false;scene.add(object);
  const touch=new Set(),power=createRoverPower(),beams=[new RoverCuttingBeam(scene),new RoverCuttingBeam(scene)],targetRay=createWeaponTarget({nav,mining});
  let model=null,ready=false,error=null,spawned=false,occupied=false,phase='idle',door=0,route=[],routeIndex=0;
  let anchorHull=null,anchor=null,anchorRotation=null,lastLiftY=4,anchorLift=null,aimYaw=0,aimPitch=-.20,held=false,keyHeld=false,trigger=false,time=0;
  let renderedOrigin=new THREE.Vector3(),message='Approach the port door to board.',lastHits=[],sampledBeams=[];
  const wheels=[],cutters=[],rays=new THREE.Raycaster();
  let driveInput={throttle:0,steer:0,brake:0};
  let deploying=false;
  const shipPose=()=>({position:nav.shipPosition?.clone()??nav.position.clone().sub(v(nav.layout.seatEye).applyQuaternion(nav.orientation)),quaternion:(nav.shipPosition?nav.shipOrientation:nav.orientation).clone()});
  function shipLocal(p){const s=shipPose();return p.clone().sub(s.position).applyQuaternion(s.quaternion.invert());}
  function fromShip(p){const s=shipPose();return p.clone().applyQuaternion(s.quaternion).add(s.position);}
  const carrierSystems=()=>nav.shipId==='atlas'||nav.freighter?.carrier?nav.freighter:null;
  const carrierPrefix=()=>nav.shipId+'-';
  const lift=()=>carrierSystems()?.lifts?.find(l=>l.id===(carrierSystems()?.carrier?.liftId??'main'))??null;
  const ramp=()=>nav.shipId==='atlas'?nav.freighter?.ramps?.find(r=>r.id==='aft'):null;
  const carrierControl=()=>carrierSystems()?.carrier?.controlLabel??(ramp()?'Atlas rear ramp':'Atlas lift');
  function toLocal(p){return p.clone().sub(physics.state.position).applyQuaternion(physics.state.quaternion.clone().invert());}
  function toWorld(p){return p.clone().applyQuaternion(physics.state.quaternion).add(physics.state.position);}
  const support=point=>sampleRoverSupport(point,{freighter:carrierSystems(),frame:carrierSystems()?shipPose():null,construction:construction?.sample});
  function constrain({previous,proposed,previousCorners,corners}){
    if(construction&&!construction.clearPose(previous,proposed))return false;
    if(!carrierSystems()&&nav.shipPosition&&nav.layout.flightBounds&&boxOverlap(bounds(corners.map(shipLocal)),nav.layout.flightBounds))return false;
    if(carrierSystems()&&!roverCarrierClear({previous,proposed,previousCorners,corners},nav.freighter,shipPose(),{cargoConstrain:nav.cargoConstrain}))return false;
    const l=lift();
    if(l&&nav.shipId==='atlas'){
      const b=bounds(corners.map(shipLocal)),near=b.max[2]>-.5&&b.min[2]<10.15&&b.max[0]>-4.1&&b.min[0]<4.1;
      if(near&&b.min[1]<3.5){
        if(b.min[0]<-3.88||b.max[0]>3.88||b.min[2]<.12)return false;
        if((l.y>.001||Math.abs(l.y-l.target)>.001)&&b.max[2]>9.86)return false;
      }
      if(b.min[1]>3.4&&b.min[2]<10.1&&b.max[2]>-12&&b.min[0]<6&&b.max[0]>-6){
        if(b.min[0]<-5.85||b.max[0]>5.85||b.min[2]<-9.4||b.max[2]>9.85||b.max[1]>9.15)return false;
      }
      // Measured solid posts/chest from the actual flyable Atlas, in its frame.
      const obstacles=[{min:[.510,0,10.885],max:[.790,1.215,11.115]},
        {min:[.510,l.y, .885],max:[.790,l.y+1.215,1.115]},
        {min:[2.3,4,-8.4],max:[3.3,5.4,-6.6]}];
      if(obstacles.some(o=>boxOverlap(b,o)))return false;
    }
    const delta=proposed.position.clone().sub(previous.position),distance=delta.length();
    if(distance<1e-8)return true;
    const envelope={...roverSweptBounds(),orientation:proposed.quaternion};
    if(!construction&&nav.buildingRaycast?.(previous.position,delta.clone().normalize(),distance,envelope))return false;
    // A grid across the body stops small rocks as well as corner obstructions.
    for(const x of [-1.15,0,1.15])for(const z of [-2.35,0,1.85])for(const height of [1.75,2.4]){
      const p=new THREE.Vector3(x,height,z).applyQuaternion(previous.quaternion).add(previous.position);
      const q=new THREE.Vector3(x,height,z).applyQuaternion(proposed.quaternion).add(proposed.position);
      if((terrainObstacles??nav.surfaceObstacles??mining).constrainWalker(p,q).hit)return false;
    }
    return true;
  }
  const physics=createRoverPhysics({sampleSupport:support,referenceUp:point=>{
    const s=support(point);return s?.source.startsWith(carrierPrefix())?UP.clone().applyQuaternion(shipPose().quaternion):bodyOffset(point).normalize();
  },constrain});
  function clear(){driveInput={throttle:0,steer:0,brake:0};held=false;keyHeld=false;trigger=false;touch.clear();power.state.active=false;beams.forEach(b=>b.mesh.visible=false);if(occupied)mining.budget=0;}
  function usable(){return spawned&&ready&&available()&&nav.enabled&&nav.focused&&!document.hidden&&!document.querySelector('dialog[open]')&&!nav.travel;}
  function carrier(){
    if(!spawned||!anchor||nav.shipId!==anchorHull||!carrierSystems())return;
    const l=lift();if(anchorLift===l?.id&&l){anchor.y+=l.y-lastLiftY;}
    lastLiftY=l?.y??0;const s=shipPose();physics.setPose(anchor.clone().applyQuaternion(s.quaternion).add(s.position),s.quaternion.multiply(anchorRotation),{preserveMotion:true});
  }
  function saveAnchor(){
    const ws=physics.state.wheels;
    if(ws.every(w=>w.source?.startsWith(carrierPrefix()))){anchorHull=nav.shipId;anchor=shipLocal(physics.state.position);anchorRotation=shipPose().quaternion.invert().multiply(physics.state.quaternion);lastLiftY=lift()?.y??0;}
    else anchor=null;
    const l=lift();anchorLift=l&&ws.every(w=>w.source===carrierPrefix()+'lift:'+l.id)?l.id:null;
  }
  function groundEntry(){const p=toWorld(v(L.cabin.entryGround)),probe=p.clone().addScaledVector(UP.clone().applyQuaternion(physics.state.quaternion),-1.75),s=support(probe);return s?s.point.addScaledVector(s.normal,1.75):p;}
  function nearby(){return spawned&&!occupied&&nav.mode==='walk'&&nav.position.distanceTo(groundEntry())<1.15;}
  function posePilot(){nav.position.copy(toWorld(v(L.cabin.pilotEye)));nav.orientation.copy(physics.state.quaternion).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(aimPitch,aimYaw,0,'YXZ')));nav.velocity.copy(FWD).applyQuaternion(physics.state.quaternion).multiplyScalar(physics.state.speed);nav.insideShip=true;nav.roverOccupied=true;}
  function accessBlocked(a,b){
    const contact=nav.surfaceObstacles?.constrainWalker(a,b);
    if(contact?.hit&&(!contact.grounded||contact.point.clone().sub(b).projectOnPlane(UP.clone().applyQuaternion(physics.state.quaternion)).length()>.02))return true;
    const delta=b.clone().sub(a),distance=delta.length();if(distance<.0001)return false;
    const direction=delta.divideScalar(distance),up=UP.clone().applyQuaternion(physics.state.quaternion),right=new THREE.Vector3(1,0,0).applyQuaternion(physics.state.quaternion);
    return [[0,0],[.12,0],[-.12,0],[0,.12],[0,-.12]].some(([x,y])=>shipRay(a.clone().addScaledVector(right,x).addScaledVector(up,y),direction,distance));
  }
  function updateAccess(dt){
    const opening=phase==='opening-in'||phase==='opening-out';
    if(opening){door=Math.min(1,door+dt/1.1);if(door===1){phase=phase==='opening-in'?'climbing-in':'climbing-out';routeIndex=0;}}
    else if(phase==='closing-in'||phase==='closing-out'){
      if(phase==='closing-in')nav.orientation.slerp(physics.state.quaternion.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(aimPitch,aimYaw,0,'YXZ'))),1-Math.exp(-dt*4));
      door=Math.max(0,door-dt/1.1);
      if(door===0){const seated=phase==='closing-in';phase='idle';if(seated){occupied=true;nav.roverOccupied=true;posePilot();message=anchor?`Parking brake · Y / G operates ${carrierControl()}.`:'Surface drive ready · RT / T operates twin cutters.';}else{nav.roverOccupied=false;message='Cabin secured. X / F boards.';}nav.keys.clear();nav.gamepad.suspend();}
    }else if(phase==='climbing-in'||phase==='climbing-out'){
      const target=route[routeIndex](),delta=target.clone().sub(nav.position),distance=delta.length();
      if(distance<.003){routeIndex++;if(routeIndex===route.length){const seated=phase==='climbing-in';phase=seated?'closing-in':'closing-out';if(!seated){occupied=false;nav.roverOccupied=false;nav.insideShip=Boolean(anchor);nav.jumpHeight=0;nav.jumpVelocity=0;}}}
      else{const proposed=nav.position.clone().addScaledVector(delta,Math.min(distance,dt*.85)/distance);if(accessBlocked(nav.position,proposed)){message='Cabin access obstructed · F cancels entry.';return;}nav.position.copy(proposed);}
      nav.orientation.slerp(physics.state.quaternion,1-Math.exp(-dt*4));nav.velocity.set(0,0,0);
    }
  }
  function syncModel(origin){
    object.position.copy(physics.state.position).sub(origin);object.quaternion.copy(physics.state.quaternion);object.visible=spawned&&ready&&available();
    if(!ready)return;
    model.getObjectByName('CabinDoor').rotation.y=door*1.65;
    model.getObjectByName('BoardingSteps').rotation.z=0;
    for(let i=0;i<wheels.length;i++){const w=wheels[i],state=physics.state.wheels[i];w.suspension.position.y=w.baseY+state.suspension;w.steer.rotation.y=state.steer;w.spin.rotation.x=state.spin;}
    for(const link of L.links){
      const index=L.wheels.findIndex(w=>w.id===link.wheel),w=physics.state.wheels[index];
      const end=v(link.wheelOffset).applyAxisAngle(UP,w.steer).add(v(L.wheels[index].position));end.y+=w.suspension;
      const delta=end.sub(v(link.anchor)),node=model.getObjectByName(link.node);node.quaternion.setFromUnitVectors(UP,delta.clone().normalize());node.scale.y=delta.length()/node.userData.restLength;
    }
    object.updateMatrixWorld(true);
  }
  function shipRay(start,direction,range){
    if(start.distanceTo(shipPose().position)>100)return null;
    const ship=getShip();ship.updateWorldMatrix(true,true);
    const a=shipLocal(start).applyMatrix4(ship.matrixWorld),d=direction.clone().applyQuaternion(shipPose().quaternion.invert()).transformDirection(ship.matrixWorld);
    rays.set(a,d);rays.far=range;const meshes=[];ship.traverseVisible(o=>{if(o.isMesh&&o.material?.depthWrite!==false)meshes.push(o);});
    const hit=rays.intersectObjects(meshes,false)[0];return hit?{point:start.clone().addScaledVector(direction,hit.distance),distance:hit.distance}:null;
  }
  const api={object,physics,power,touch,
    get acceptInput(){return occupied&&phase==='idle'&&usable();},get occupied(){return occupied;},get busy(){return phase!=='idle';},
    get interaction(){return phase!=='idle'?'BURROW · CABIN ACCESS MOVING':occupied?`BURROW · X / F EXIT${anchor?' · Y / G '+carrierControl().toUpperCase():''}`:nearby()?'X / F · BOARD BURROW CABIN':'';},
    async spawn(){
      await api.readyPromise;if(!ready||!carrierSystems()||!available())return false;
      const start=roverCarrierStart(nav.freighter);
      if(!start){nav.notify('This Atlas has no compatible rover deck. Choose Burrow mining — Selene surface in F2.');return false;}
      clear();anchorHull=nav.shipId;anchor=start.position;anchorLift=start.lift;anchorRotation=start.quaternion;lastLiftY=lift()?.y??0;spawned=true;carrier();physics.step(1/60,{brake:1});
      if(physics.state.blocked||!physics.state.supported){spawned=false;anchor=null;nav.notify('Burrow cargo start unavailable: clear the rover parking lane.');return false;}
      syncModel(renderedOrigin);message=nav.shipId==='gannet'?'Burrow secured on Gannet vehicle elevator.':ramp()?'Rover secured on Atlas cargo deck · rear ramp access.':'Rover secured on Atlas belly elevator.';return true;
    },
    /** A garage request places the unoccupied existing vehicle, never its pilot.
     * The caller revalidates terminal reach after the model finishes loading. */
    async deployAt({position,quaternion,validate=()=>true}){
      if(deploying)return {ok:false,message:'A vehicle request is already in progress.'};
      deploying=true;
      try{
        await api.readyPromise;
        if(!available()||!validate())return {ok:false,message:'Return to the garage terminal to retrieve Burrow.'};
        const policy=garageRetrievalStatus(api.state);if(!policy.ok)return policy;
        const pose={position:position.clone(),quaternion:quaternion.clone()};
        if(nav.shipPosition&&nav.layout.flightBounds&&boxOverlap(bounds(roverFootprint(pose.position,pose.quaternion).map(shipLocal)),nav.layout.flightBounds))return {ok:false,message:'Move the parked ship clear of the garage bay first.'};
        if(spawned&&physics.state.position.distanceTo(position)<1)return {ok:true,message:'Burrow is already in the bay. Approach its port-side door.'};
        if(construction&&!construction.clearPose(pose))return {ok:false,message:'Garage bay obstructed. Clear the vehicle lane before retrieval.'};
        const world=p=>v(p).applyQuaternion(pose.quaternion).add(pose.position),obstacles=terrainObstacles??nav.surfaceObstacles??mining;
        for(const x of [-1.4,0,1.4])for(const y of [1.75,2.4]){
          if(obstacles.constrainWalker(world([x,y,2.5]),world([x,y,-3])).hit||shipRay(world([x,y,2.5]),FWD.clone().applyQuaternion(pose.quaternion),5.5))return {ok:false,message:'Garage bay obstructed. Clear rocks, cargo or the parked ship first.'};
        }
        const entry=[L.cabin.entryGround,...L.cabin.entryRoute].map(world);
        if(entry.some((p,i)=>i&&accessBlocked(entry[i-1],p)))return {ok:false,message:'Clear the port-side boarding path before retrieval.'};
        const trial=createRoverPhysics({...pose,sampleSupport:support,referenceUp:p=>bodyOffset(p).normalize(),constrain});
        trial.step(1/60,{brake:1});
        if(!trial.state.supported||trial.state.blocked)return {ok:false,message:'Garage bay has no clear four-wheel support.'};
        if(!validate())return {ok:false,message:'Garage request cancelled. Return to the terminal.'};
        clear();anchor=null;anchorHull=null;anchorLift=null;anchorRotation=null;
        physics.setPose(trial.state.position,trial.state.quaternion);physics.step(1/60,{brake:1});
        spawned=true;phase='idle';door=0;route=[];routeIndex=0;
        syncModel(renderedOrigin);message='Garage deployment ready · approach the port-side door to board.';
        nav.keys.clear();nav.gamepad.suspend();
        return {ok:true,message:'Burrow is ready in the bay. Board at the port-side door, then drive down the outer ramp.'};
      }finally{deploying=false;}
    },
    /** Explicit dev start only. Ordinary boarding still follows the door/steps. */
    async spawnSurface({target=mining.ground.position}={}){
      await api.readyPromise;if(!ready||!available()||nav.travel)return false;
      const obstacle=nav.surfaceObstacles??mining;
      const pose=roverSurfaceStart(target,{isClear:({position,quaternion})=>{
        const world=point=>v(point).applyQuaternion(quaternion).add(position);
        for(const x of [-1.4,0,1.4])for(const y of [1.75,2.4]){
          if(obstacle.constrainWalker(world([x,y,2.35]),world([x,y,-2.8])).hit)return false;
        }
        const route=[L.cabin.entryGround,...L.cabin.entryRoute].map(world);
        return route.every((point,i)=>i===0||!obstacle.constrainWalker(route[i-1],point).hit);
      }});
      if(!pose){nav.notify('Burrow surface start unavailable: no clear, supported terrain by the outcrop.');return false;}
      clear();anchor=null;anchorLift=null;anchorRotation=null;
      physics.setPose(pose.position,pose.quaternion);physics.step(1/60,{brake:1});
      if(physics.state.blocked||!physics.state.supported){nav.notify('Burrow surface start could not settle its wheels.');return false;}
      nav.resetCabinFlight();nav.resetSteering();nav.mode='walk';nav.dockedAtStation=false;nav.stationLift=false;nav.autoland=false;nav.spaceParked=false;
      nav.jumpHeight=0;nav.jumpVelocity=0;nav.boost=false;nav.velocity.set(0,0,0);nav.angularVelocity.set(0,0,0);nav.toolTrigger=0;
      nav.keys.clear();nav.physicalKeys?.clear();nav.gamepad.suspend();
      spawned=true;occupied=true;phase='idle';door=0;route=[];routeIndex=0;aimYaw=0;
      const aim=toLocal(target).sub(v(L.cabin.pilotEye));aimPitch=clamp(Math.atan2(aim.y,Math.hypot(aim.x,aim.z)),L.mining.pitchMin,L.mining.pitchMax);
      posePilot();syncModel(renderedOrigin);message='Selene surface drive ready · twin cutters face the Crescent deposit.';
      nav.notify('Burrow mining — Selene surface. LS / WASD drives; RT / T mines; View / I opens ore bins; X / F exits.');return true;
    },
    interact(){
      if(!usable())return phase!=='idle';
      if(phase!=='idle'){
        if(phase.endsWith('-in')){route=L.cabin.entryRoute.slice(0,Math.max(0,routeIndex-1)).reverse().map(p=>()=>toWorld(v(p)));route.push(groundEntry);routeIndex=0;phase='climbing-out';nav.notify('Entry cancelled. Returning along the boarding steps.');}
        return true;
      }
      if(!occupied&&!nearby())return false;
      if(nav.cabinFlight||nav.spaceParked){nav.notify('Land the carrier before using its ground vehicle.');return true;}
      if(Math.abs(physics.state.speed)>.2){nav.notify('Brake to a stop before opening the cabin.');return true;}
      const l=lift();if(anchor&&l&&Math.abs(l.y-l.target)>.001){nav.notify('Wait for the cargo lift to stop.');return true;}
      const waypoints=occupied?[nav.position.clone(),...L.cabin.entryRoute.slice(0,-1).reverse().map(p=>toWorld(v(p))),groundEntry()]:[nav.position.clone(),groundEntry(),...L.cabin.entryRoute.map(p=>toWorld(v(p)))];
      if(waypoints.some((point,i)=>i>0&&accessBlocked(waypoints[i-1],point))){nav.notify('Clear the port boarding path before opening the cabin.');return true;}
      clear();physics.step(0,{active:false});nav.keys.clear();nav.gamepad.suspend();nav.roverOccupied=true;
      if(occupied){phase='opening-out';route=[...L.cabin.entryRoute.slice(0,-1)].reverse().map(p=>()=>toWorld(v(p)));route.push(groundEntry);}
      else{phase='opening-in';route=[groundEntry,...L.cabin.entryRoute.map(p=>()=>toWorld(v(p)))];}
      nav.notify(occupied?'Opening pressure door. Climbing down the steps.':'Opening pressure door. Climbing into the pilot seat.');return true;
    },
    look(y,p){if(!occupied||phase!=='idle')return false;aimYaw=clamp(aimYaw+y,-L.mining.yawLimit,L.mining.yawLimit);aimPitch=clamp(aimPitch+p,L.mining.pitchMin,L.mining.pitchMax);return true;},
    key(event){if(!occupied&&phase==='idle')return false;if(event.code==='KeyT'&&api.acceptInput)keyHeld=true;if(event.code==='KeyF')api.interact();if(event.code==='KeyG')api.toggleLift();if(event.code==='KeyI'){event.stopImmediatePropagation();api.openCargo();}return true;},
    toggleLift(){
      if(!spawned||!anchor||!occupied||phase!=='idle'||!usable())return false;
      if(carrierSystems()?.carrier){
        if(Math.abs(physics.state.speed)>.1){nav.notify('Brake before operating the vehicle elevator.');return false;}
        const result=nav.freighter.operate(nav.freighter.carrier.control,null,{powered:nav.powered,inFlight:nav.cabinFlight||nav.spaceParked||!nav.shipPosition});
        clear();nav.keys.clear();nav.gamepad.suspend();nav.notify(result.reason);return result.ok;
      }
      if(ramp()){
        if(Math.abs(physics.state.speed)>.1){nav.notify('Brake to a stop before operating the rear ramp.');return false;}
        const result=nav.freighter.operate('ramp:aft',shipLocal(nav.position),{powered:nav.powered,inFlight:nav.cabinFlight||nav.spaceParked||!nav.shipPosition});
        clear();nav.keys.clear();nav.gamepad.suspend();nav.notify(result.ok?'Atlas rear ramp moving. Parking brake engaged.':result.reason);return result.ok;
      }
      const l=lift();if(!l)return false;
      if(nav.cabinFlight||nav.spaceParked||!nav.shipPosition||!nav.powered){nav.notify('Land Atlas and enable main power to use its lift.');return false;}
      if(Math.abs(physics.state.speed)>.1||!api.fitsLift()){nav.notify('Park the entire rover inside the lift safety lines before moving it.');return false;}
      const moved=nav.freighter.toggle('main',null);clear();nav.keys.clear();nav.gamepad.suspend();nav.notify(moved?'Atlas belly elevator moving. Parking brake engaged.':'Wait for the elevator to stop.');return moved;
    },
    fitsLift(){const l=lift();return Boolean(l&&roverFitsPlatform(physics.state.position,physics.state.quaternion,{...l,...shipPose(),ceiling:carrierSystems()?.carrier?.ceiling??l.ceiling??9.2}));},
    openCargo(){if(spawned&&(occupied||nearby())){clear();inventoryUI.openStorage(L.cargo.id);return true;}return false;},
    step(dt,pad){
      if(!spawned)return false;carrier();
      if(!available()){clear();if(occupied){occupied=false;nav.roverOccupied=false;}object.visible=false;return false;}
      if(!occupied&&phase==='idle')return false;
      if(!usable()){clear();physics.step(0,{active:false});return true;}
      if(pad.pressed.has(2))api.interact();if(pad.pressed.has(3))api.toggleLift();
      // Occupied navigation returns before the normal walking lift step.
      if(anchor&&nav.freighter&&nav.shipPosition&&nav.powered){nav.freighter.update(dt,null);carrier();}
      if(phase!=='idle'){updateAccess(dt);return true;}
      const l=lift(),moving=anchor&&(carrierSystems()?.moving||ramp()?.moving||l&&Math.abs(l.y-l.target)>.001);
      const axis=(a,b,n=0)=>clamp(Number(nav.keys.has(a))-Number(nav.keys.has(b))+n,-1,1);
      // The shared stick is radially normalized. Full diagonal input should
      // still reach the wheel's steering stop while supplying forward drive.
      const throttle=axis('KeyW','KeyS',pad.forward+Number(touch.has('forward'))-Number(touch.has('reverse'))),steer=axis('KeyD','KeyA',pad.strafe*1.5+Number(touch.has('right'))-Number(touch.has('left')));
      api.look((axis('ArrowLeft','ArrowRight',pad.yaw)+Number(touch.has('aimLeft'))-Number(touch.has('aimRight')))*dt*.6,(axis('ArrowUp','ArrowDown',pad.pitch)+Number(touch.has('up'))-Number(touch.has('down')))*dt*.6);
      driveInput={throttle:moving?0:throttle,steer:moving?0:steer,brake:moving||pad.brake||nav.keys.has('KeyX')||touch.has('brake')?1:0};
      physics.step(dt,driveInput);saveAnchor();posePilot();
      trigger=Boolean(held||keyHeld||touch.has('mine')||nav.gamepad.armed&&pad.mine>.1);
      return true;
    },
    update(dt,origin){
      renderedOrigin.copy(origin);if(!spawned){ui.update();return;}carrier();if(occupied&&phase==='idle')posePilot();syncModel(origin);
      time+=dt;const allowed=api.acceptInput&&!anchor&&!mining.store.blocked&&(mining.store.freeFor?.(L.cargo.id)??0)>.001;
      if(!usable())clear();power.step(dt,{trigger:trigger&&allowed,allowed:api.acceptInput});const firing=allowed&&power.state.active;
      const centerDirection=FWD.clone().applyQuaternion(nav.orientation);
      if(occupied)mining.inspectTarget(nav.position,centerDirection,L.mining.range);
      const inspected=occupied?targetRay(nav.position,centerDirection,origin,L.mining.range):null;
      const target=inspected?.point??nav.position.clone().addScaledVector(centerDirection,L.mining.range);
      lastHits=[];sampledBeams=[];
      for(let i=0;i<cutters.length;i++){
        const c=cutters[i],targetLocal=toLocal(target).sub(v(L.cutters[i].position));
        const y=!occupied?0:clamp(Math.atan2(-targetLocal.x,-targetLocal.z),-L.mining.yawLimit,L.mining.yawLimit),p=!occupied?0:clamp(Math.atan2(targetLocal.y,Math.hypot(targetLocal.x,targetLocal.z)),L.mining.pitchMin,L.mining.pitchMax);
        c.pivot.quaternion.setFromEuler(new THREE.Euler(p,y,0,'YXZ'));object.updateMatrixWorld(true);
        const start=c.muzzle.getWorldPosition(new THREE.Vector3()).add(origin),direction=FWD.clone().applyQuaternion(c.muzzle.getWorldQuaternion(new THREE.Quaternion())).normalize();
        let hit=firing?targetRay(start,direction,origin,L.mining.range):null;const wall=firing?shipRay(start,direction,hit?.distance??L.mining.range):null;if(wall)hit=wall;
        const end=hit?.point??start.clone().addScaledVector(direction,L.mining.range);
        beams[i].mesh.visible=false;if(firing)beams[i].set(start,end,origin,time,{hit:Boolean(hit),normal:hit?.normal,reducedMotion:effects.reducedMotion});
        sampledBeams.push({start:start.toArray(),direction:direction.toArray(),end:end.toArray(),active:firing,rock:hit?.rock?.rockId??null});
        if(firing&&hit?.rock){
          mining.onMine({point:hit.point.clone(),normal:hit.normal?.clone(),target:hit.rock,dt,rate:L.mining.cutRatePerBeam,destination:L.cargo.id,direction});lastHits.push(hit.rock.rockId);
          effects.spray(hit.point,hit.normal??direction.clone().negate(),effects.budget('rover'+i,effects.reducedMotion?12:45,dt),{color:0xffc07a,size:.025,speed:2,life:.35});
        }
      }
      if(!firing)mining.budget=0;
      const survey=toLocal(mining.position),bearing=Math.atan2(survey.x,-survey.z)*180/Math.PI;
      const surveyHint=`${mining.targetName} · ${Math.hypot(survey.x,survey.z).toFixed(0)} m · ${Math.abs(bearing).toFixed(0)}° ${bearing<0?'left':'right'}`;
      message=phase!=='idle'?'Cabin access moving…':!occupied?'Approach the port door to board.':anchor?`${nav.shipId==='gannet'?'Gannet vehicle bay':'Atlas cargo deck'} · Y / G operates ${carrierControl()}`:physics.state.blocked?`Drive blocked · ${{collision:'obstacle',unsupported:'no wheel support',slope:'slope too steep',step:'terrain step',suspension:'suspension limit'}[physics.state.reason]??physics.state.reason}`:driveInput.brake?'Brake held · release keyboard X / controller LT to drive':power.state.depleted?'Cutter charge depleted · release trigger to recharge':lastHits.length?'Twin cutters active · ore collected into rover bins':mining.store.freeFor?.(L.cargo.id)<.001?'Ore bins full · View / I opens storage':surveyHint;
      ui.update();document.body.classList.toggle('rover-occupied',occupied);
      displays?.update(dt,api.state);
    },
    camera(camera,clipShip){
      if(!occupied&&phase==='idle')return;
      camera.position.copy(nav.position);camera.orientation.copy(nav.orientation);camera.active=false;
      if(phase!=='idle'||!camera.playerExternal)return;
      const up=UP.clone().applyQuaternion(physics.state.quaternion),target=toWorld(new THREE.Vector3(0,1,-.6));
      let end=toWorld(new THREE.Vector3(3.0,4.0,6.5));if(clipShip)end=clipShip(nav.position,end);end=clipTerrainCamera(nav.position,end);
      if(end.distanceTo(nav.position)<2)return;
      camera.position.copy(end);camera.orientation.setFromRotationMatrix(new THREE.Matrix4().lookAt(end.clone().sub(target),new THREE.Vector3(),up));camera.active=true;
    },
    constrainWalker(previous,proposed){
      if(!spawned||occupied||phase!=='idle')return proposed;
      const a=toLocal(previous),b=toLocal(proposed),delta=b.clone().sub(a);let enter=0,leave=1;
      const min=[-1.97,-.12,-2.80],max=[1.76,4.25,2.35];
      // A suit's eye must clear the solid body; the door owns its physical route.
      for(let i=0;i<3;i++){const n=a.getComponent(i),d=delta.getComponent(i);if(Math.abs(d)<1e-10){if(n<min[i]||n>max[i])return proposed;}else{const x=(min[i]-n)/d,y=(max[i]-n)/d;enter=Math.max(enter,Math.min(x,y));leave=Math.min(leave,Math.max(x,y));}}
      const inside=a.toArray().every((n,i)=>n>min[i]&&n<max[i]);if(inside&&b.toArray().some((n,i)=>n<=min[i]||n>=max[i]))return proposed;
      return enter<leave&&leave>0&&enter<1?previous.clone():proposed;
    },
    get audioMining(){const b=sampledBeams.find(b=>b.active);return b?{active:true,start:v(b.start),end:v(b.end),hit:Boolean(b.rock)}:null;},
    get state(){const container=mining.store.container(L.cargo.id);return {name:L.name,ready,error,spawned,occupied,busy:phase!=='idle',phase,door,near:nearby(),aboard:Boolean(anchor),carrierControl:carrierControl(),fitsLift:spawned&&api.fitsLift(),message,charge:power.state.charge,cutSeconds:power.state.cutSeconds,beaming:sampledBeams.filter(b=>b.active).length,mass:container?MATERIAL_IDS.reduce((s,id)=>s+(container.items[id]??0),0):0,speed:physics.state.speed,controls:{...driveInput},position:physics.state.position.toArray(),quaternion:physics.state.quaternion.toArray(),local:spawned?shipLocal(physics.state.position).toArray():null,wheels:physics.state.wheels.map(w=>({...w,contact:w.contact?.toArray(),normal:w.normal?.toArray()})),distance:physics.state.distance,blocked:physics.state.blocked,reason:physics.state.reason,beamPoses:sampledBeams,hitIds:lastHits};},
  };
  const ui=createRoverUI(api);let displays=null;
  api.readyPromise=new GLTFLoader().loadAsync('/models/mining-rover.glb').then(gltf=>{
    model=gltf.scene;const required=['CabinDoor','BoardingSteps','RoverDisplay',...L.links.map(l=>l.node),...L.wheels.flatMap(w=>[w.node,'Suspension_'+w.id,w.steer||'Axle_'+w.id]),...L.cutters.flatMap(c=>[c.pivot,c.muzzle])];
    for(const name of required)if(!model.getObjectByName(name))throw new Error('Missing rover mechanism '+name);
    object.add(model);model.traverse(o=>{if(o.isMesh){const materials=Array.isArray(o.material)?o.material:[o.material];o.castShadow=materials.some(m=>!m.transparent||m.alphaTest>0);o.receiveShadow=true;}});
    for(const w of L.wheels){const s=model.getObjectByName('Suspension_'+w.id);wheels.push({spin:model.getObjectByName(w.node),steer:model.getObjectByName(w.steer||'Axle_'+w.id),suspension:s,baseY:s.position.y});}
    for(const c of L.cutters)cutters.push({pivot:model.getObjectByName(c.pivot),muzzle:model.getObjectByName(c.muzzle)});
    displays=createRoverDisplays(model);
    ready=true;return model;
  }).catch(e=>{error=e.message;nav.notify('Burrow unavailable: '+error);return null;});
  const guarded=new WeakSet();
  api.bindCarrier=()=>{const systems=carrierSystems();if(!systems||guarded.has(systems))return;guarded.add(systems);guardRoverCarrier(systems,()=>({state:physics.state,frame:shipPose(),spawned,busy:phase!=='idle'}));};
  api.bindCarrier();
  inventoryUI.registerContainer({id:L.cargo.id,name:L.cargo.name,kind:'ship',boxes:L.cargo.boxes,available:()=>spawned&&(occupied||nearby())});
  canvas.addEventListener('pointerdown',e=>{if(e.button===0&&nav.locked&&api.acceptInput)held=true;});
  document.addEventListener('keyup',e=>{if(e.code==='KeyT')keyHeld=false;});
  window.addEventListener('pointerup',()=>held=false);window.addEventListener('blur',clear);document.addEventListener('visibilitychange',clear);document.addEventListener('pointerlockchange',clear);
  return api;
}
