import * as THREE from 'three';
import {createSentrySimulation,neutralSentryInput,constrainSentryWalker} from './simulation.js';
import {createSentryEnvironment,sentryDeploymentPoses} from './environment.js';
import {sentryBodyDistance} from './occlusion.js';
import {SENTRY_LAYOUT as L} from './layout.js';
import {createSentryRenderer} from './render.js';
import {createSentryUI} from './ui.js';
import {createWeaponTarget} from '../effects/weapon-target.js';
import {roverSurfaceStart} from '../rover-surface-start.js';
import {clipTerrainCamera} from '../ship-camera.js';
import {isHandsFree,HANDS_FREE_REASON} from '../station-hub-policy.js';
import {createSentryInputSuspension} from './input-suspension.js';
import {navigationShipFrame} from '../navigation-rotation.js';
import {betweenFrames,rotationFrameAt} from '../planet-rotation.js';
import {sentryFrame,sentryPoseInFrame} from './frames.js';

const UP=new THREE.Vector3(0,1,0),FWD=new THREE.Vector3(0,0,-1),v=p=>new THREE.Vector3(...p),clamp=THREE.MathUtils.clamp;
/** Input adapter and presentation. Online simulation lives exclusively in the
 * room; solo uses exactly the same drive/seat/turret machine locally. */
export function createSentrySystem({scene,canvas,nav,mining,effects,inventoryUI,multiplayer,enabled=false}){
  const renderer=createSentryRenderer(scene),carrierGuards=new WeakSet(),touch=new Set(),localId='solo',player={id:localId,health:100,nav};
  const environmentFor=getFrame=>createSentryEnvironment({carrierGuards,getFrame:nav.rotationClock?getFrame:null,getTime:()=>nav.rotationTime,station:nav.station,getRovers:()=>snapshots(),getHulls:()=>nav.shipPosition&&!nav.freighter?[{position:nav.shipPosition,quaternion:nav.shipOrientation,bounds:nav.layout.flightBounds,planetFrame:navigationShipFrame(nav)?.id??null}]:[],getCarriers:()=>nav.freighter?[{id:nav.shipId,systems:nav.freighter,planetFrame:navigationShipFrame(nav)?.id??null,frame:{position:nav.shipPosition??nav.position.clone().sub(v(nav.layout.seatEye).applyQuaternion(nav.orientation)),quaternion:nav.shipPosition?nav.shipOrientation:nav.orientation},inFlight:nav.mode==='flight'||nav.cabinFlight||nav.spaceParked,cargoConstrain:nav.cargoConstrain}]:[],getObstacles:()=>nav.surfaceObstacles,buildingRaycast:(...args)=>nav.buildingRaycast?.(...args)});
  const environment=environmentFor(point=>rotationFrameAt(point));
  const ray=createWeaponTarget({nav,mining});
  let sequence=0,local=null,origin=new THREE.Vector3(),input=neutralSentryInput(),mouseYaw=0,mousePitch=0,keyFire=false,pointerFire=false,pending=false,error=null,wasOnline=false,lastRole=null,lastEpoch=-1;
  const ownId=()=>multiplayer.connected?multiplayer.state.ownId:localId;
  const snapshots=()=>multiplayer.connected?(multiplayer.state.sentries??[]):local?[local.snapshot()]:[];
  const seatOf=s=>Object.keys(L.seats).find(role=>s.seats[role].id===ownId())??null;
  const current=()=>snapshots().find(s=>seatOf(s))??null;
  const usable=()=>nav.enabled&&nav.focused&&!document.hidden&&!document.querySelector('dialog[open]')&&!nav.travel;
  const replica=s=>({local:p=>p.clone().sub(v(s.position)).applyQuaternion(new THREE.Quaternion(...s.quaternion).invert()),occupant:id=>Object.keys(s.seats).find(role=>s.seats[role].id===id)});
  function nearest(){
    if(nav.mode!=='walk'||nav.roverOccupied||nav.carryingCargo)return null;
    for(const s of snapshots())for(const [role,seat]of Object.entries(L.seats)){
      const point=v(seat.ground).applyQuaternion(new THREE.Quaternion(...s.quaternion)).add(v(s.position));if(nav.rotationClock)betweenFrames(point,sentryFrame(s.planetFrame),nav.rotationFrame,nav.rotationTime,point);
      if(nav.position.distanceTo(point)<1.25)return {id:s.id,role,occupied:Boolean(s.seats[role].id),point:point.toArray()};
    }
    return null;
  }
  const suspension=createSentryInputSuspension(()=>{input=neutralSentryInput();mouseYaw=mousePitch=0;keyFire=pointerFire=false;touch.clear();local?.suspend();multiplayer.suspendInput();});
  const suspend=()=>suspension.suspend();
  function reset(){suspend();nav.keys.clear();nav.gamepad.suspend();}
  async function request(command,fields={}){
    if(pending)return;pending=true;error=null;reset();
    try{if(multiplayer.connected)await multiplayer.request('sentry',{command,...fields});else if(command==='board')local.request(localId,fields.role);else if(command==='exit')local.exit(localId);}
    catch(e){error=e.message;nav.notify(error);}finally{pending=false;reset();}
  }
  function createLocal(pose){
    let rover;const environment=environmentFor(()=>rover?sentryFrame(rover.state.planetFrame):rotationFrameAt(pose.position));
    rover=createSentrySimulation({planetFrame:rotationFrameAt(pose.position)?.id??null,id:'solo-sentry',ownerId:localId,...pose,sampleSupport:environment.support,referenceUp:environment.up,constrain:movement=>environment.constrain(movement,'solo-sentry'),accessClear:environment.accessClear,getCarriers:environment.carriers,getTime:()=>nav.rotationTime,getPlayer:id=>id===localId?player:null,getInput:()=>input,
      onSeat:()=>reset(),onFire:(poses,id,sequence,rover)=>{
        for(let barrel=0;barrel<poses.length;barrel++){
          const p=poses[barrel],range=Math.min(L.turret.range,sentryBodyDistance(p.start,p.direction,rover.physics.state.position,rover.physics.state.quaternion)),hit=ray(p.start,p.direction,origin,range),end=hit?.point??p.start.clone().addScaledVector(p.direction,range);
          renderer.fire({planetFrame:rover.state.planetFrame,start:p.start.toArray(),end:end.toArray(),targetId:hit?.entity?.id??hit?.fauna?.id??null});
          if(hit){
            // Existing victim/target adapters own their actual health changes.
            nav.onFaunaWeaponHit?.(hit,'rover-laser');
            rover.state.lastHit={sequence,kind:hit.rock?'rock':'surface',point:end.toArray()};
            effects.spray?.(end,p.direction.clone().negate(),5,{color:0xb6efd1,size:.025,speed:2,life:.25});
          }
        }
      }});return rover;
  }
  const api={touch,renderer,
    get acceptInput(){const c=current(),role=c&&seatOf(c);return Boolean(c&&role&&c.seats[role].phase==='seated'&&usable()&&!pending);},
    get occupied(){return Boolean(current());},get busy(){return pending||Boolean(current()?.busy);},
    get interaction(){const c=current(),n=nearest();return c?'BURROW SENTRY · X / F LEAVE '+seatOf(c).toUpperCase():n?'X / F · '+(n.occupied?'OCCUPIED ':'BOARD SENTRY ')+n.role.toUpperCase():'';},
    async deploy(){
      if(!usable()||pending)return false;
      if(isHandsFree(nav)){nav.notify(HANDS_FREE_REASON);return false;}
      if(multiplayer.connected){await request('deploy');return !error;}
      if(nav.mode!=='walk'||nav.roverOccupied||nav.insideShip||nav.carryingCargo){nav.notify('Deploy on foot outside your ship with empty hands.');return false;}
      if(local?.occupied||local?.busy){nav.notify('Leave the Sentry and close its doors before relocating it.');return false;}
      await renderer.ready();
      for(const pose of sentryDeploymentPoses(nav)){
        if(!environment.clearPose(pose.position,pose.quaternion,'solo-sentry'))continue;
        const candidate=createLocal(pose);candidate.physics.step(1/30,{brake:1});
        if(!candidate.physics.state.supported||candidate.physics.state.blocked||!candidate.ground('pilot')||!candidate.ground('gunner'))continue;
        local=candidate;nav.notify('Sentry deployed. Port door: pilot. Aft ladder: gunner.');return true;
      }
      nav.notify('No clear, supported space nearby for both boarding routes.');return false;
    },
    async spawnSurface(target){
      await renderer.ready();const pose=roverSurfaceStart(target,{isClear:({position,quaternion})=>environment.clearPose(position,quaternion)});if(!pose)return false;
      local=createLocal(pose);local.physics.step(1/30,{brake:1});if(!local.physics.state.supported)return false;
      nav.resetCabinFlight();nav.resetSteering();nav.mode='walk';nav.dockedAtStation=false;nav.autoland=false;nav.stationLift=false;nav.insideShip=false;nav.roverOccupied=false;nav.sentrySeat=null;
      nav.position.copy(local.ground('pilot'));nav.orientation.copy(pose.quaternion);nav.velocity.set(0,0,0);nav.jumpHeight=nav.jumpVelocity=0;reset();
      nav.notify('Burrow Sentry on Selene. X / F enters the port pilot door; walk around to the aft gunner ladder.');return true;
    },
    interact(){const c=current(),n=nearest();if(!c&&!n)return false;if(!usable())return true;void request(c?'exit':'board',c?{id:c.id}:{id:n.id,role:n.role});return true;},
    look(y,p){if(!api.occupied)return false;if(api.acceptInput){mouseYaw+=y;mousePitch+=p;}return true;},
    key(e){if(!api.occupied)return false;if(e.code==='KeyF')api.interact();if(e.code==='KeyI'){e.stopImmediatePropagation();api.openCargo();}if(e.code==='KeyT'&&!e.repeat&&api.acceptInput)keyFire=true;return true;},
    openCargo(){if(!api.occupied)return false;reset();if(multiplayer.connected)nav.openInventory?.();else nav.openBackpack?.();return true;},
    step(dt,pad){
      const c=current();if(!c)return false;
      const role=seatOf(c);nav.roverOccupied=true;nav.insideShip=true;
      if(!usable()){suspend();return true;}
      if(pad.pressed.has(2))api.interact();
      const axis=(positive,negative,analog=0)=>clamp(Number(nav.keys.has(positive))-Number(nav.keys.has(negative))+analog,-1,1);
      input={forward:axis('KeyW','KeyS',pad.forward+Number(touch.has('forward'))-Number(touch.has('reverse'))),strafe:axis('KeyD','KeyA',pad.strafe+Number(touch.has('right'))-Number(touch.has('left'))),yaw:axis('ArrowLeft','ArrowRight',pad.yaw+Number(touch.has('aimLeft'))-Number(touch.has('aimRight'))),pitch:axis('ArrowUp','ArrowDown',pad.pitch+Number(touch.has('up'))-Number(touch.has('down'))),mouseYaw,mousePitch,brake:Boolean(pad.brake||nav.keys.has('KeyX')||touch.has('brake')),fire:Boolean(keyFire||pointerFire||touch.has('fire')||pad.mine>.1),enabled:api.acceptInput&&(!nav.gamepad.connected||nav.gamepad.armed),sequence:++sequence};player.sequence=sequence;
      mouseYaw=mousePitch=0;
      if(!multiplayer.connected)local.tick(dt);
      if(role!==lastRole||c.controlEpoch!==lastEpoch){lastRole=role;lastEpoch=c.controlEpoch;nav.gamepad.suspend();keyFire=pointerFire=false;touch.clear();}
      return true;
    },
    networkInput(base){if(!api.occupied)return base;return {...base,...input,vehicleReady:input.enabled===true,mouseYaw:base.mouseYaw,mousePitch:base.mousePitch,fire:usable()&&api.acceptInput&&(base.fire||input.fire)};},
    update(dt,renderOrigin){
      origin.copy(renderOrigin);
      if(wasOnline&&!multiplayer.connected){local=null;nav.sentrySeat=null;nav.sentryFeet=null;nav.sentryBodyOrientation=null;nav.roverOccupied=false;nav.insideShip=false;suspend();}
      wasOnline=multiplayer.connected;
      if(!multiplayer.connected&&local&&!api.occupied)local.tick(dt);
      if(!usable()||pending)suspend();else suspension.resume();renderer.update(dt,origin,snapshots());ui.update();
    },
    camera(camera){
      const c=current(),role=c&&seatOf(c);if(!role)return;
      camera.active=false;camera.position.copy(nav.position);camera.orientation.copy(nav.orientation);
      if(c.seats[role].phase!=='seated')return;
      const view=nav.rotationClock?sentryPoseInFrame(c,sentryFrame(c.planetFrame),nav.rotationFrame,nav.rotationTime):{position:v(c.position),quaternion:new THREE.Quaternion(...c.quaternion)},q=view.quaternion,aim=q.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(c.pitch,c.yaw,0,'YXZ')));
      const yaw=new THREE.Quaternion().setFromAxisAngle(UP,c.yaw),pitch=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),c.pitch);
      const sight=v(L.turret.sight).applyQuaternion(pitch).add(v(L.turret.pitch)).applyQuaternion(yaw).add(v(L.turret.yaw)).applyQuaternion(q).add(view.position);
      if(role==='pilot'&&c.seats.gunner.id){camera.position.copy(v(L.seats.pilot.eye).applyQuaternion(q).add(view.position));camera.orientation.copy(q);}else{camera.position.copy(sight);camera.orientation.copy(aim);}
      if(camera.playerExternal){const target=view.position.clone().addScaledVector(UP.clone().applyQuaternion(q),1.5),end=v([4,5,7]).applyQuaternion(q).add(view.position);camera.position.copy(clipTerrainCamera(target,end));camera.orientation.setFromRotationMatrix(new THREE.Matrix4().lookAt(camera.position.clone().sub(target),new THREE.Vector3(),UP.clone().applyQuaternion(q)));camera.active=true;}
    },
    constrainWalker(a,b){for(const s of snapshots()){const frame=sentryFrame(s.planetFrame);if(nav.rotationClock){const x=betweenFrames(a,nav.rotationFrame,frame,nav.rotationTime),y=betweenFrames(b,nav.rotationFrame,frame,nav.rotationTime);b=betweenFrames(constrainSentryWalker(replica(s),x,y,ownId()),frame,nav.rotationFrame,nav.rotationTime);}else b=constrainSentryWalker(replica(s),a,b,ownId());}return b;},
    get state(){const c=current(),role=c&&seatOf(c),near=nearest();return {visible:Boolean(enabled||c||near||multiplayer.connected&&nav.mode==='walk'&&!isHandsFree(nav)),canDeploy:Boolean((enabled||multiplayer.connected)&&nav.mode==='walk'&&!nav.roverOccupied&&!nav.insideShip&&!isHandsFree(nav)),occupied:Boolean(c),role,near,busy:api.busy,current:c,vehicles:snapshots(),models:renderer.state(),beams:renderer.beamState(),message:error??(pending?'Waiting for rover authority…':c?c.busy?'Cabin access moving…':c.controllerId===ownId()?`You control the turret · ${c.armed?'ready':'release controls'} · ${c.shots} bursts · Hull ${c.health}/${L.hull}`:`Gunner controls the turret · pilot drives · ${Math.abs(c.speed).toFixed(1)} m/s · Hull ${c.health}/${L.hull}`:near?`Approach ${near.role} door · ${near.occupied?'occupied':'X / F to board'}`:'Two crew seats · gunner priority · pilot fallback')};},
  };
  const ui=createSentryUI(api);
  multiplayer.onEvent(e=>{if(e.event==='sentryFire')renderer.fire(e);});
  canvas.addEventListener('pointerdown',e=>{if(e.button===0&&nav.locked&&api.acceptInput)pointerFire=true;});
  document.addEventListener('keyup',e=>{if(e.code==='KeyT')keyFire=false;});
  window.addEventListener('pointerup',()=>pointerFire=false);window.addEventListener('blur',suspend);document.addEventListener('visibilitychange',suspend);document.addEventListener('pointerlockchange',suspend);
  return api;
}

/** Compose the two variants without replacing another owner's rover instance. */
export function sentryVehicleRouter(sentry,getMining){
  const call=(method,...args)=>sentry[method]?.(...args)||getMining()?.[method]?.(...args);
  return {get interaction(){return sentry.interaction||getMining()?.interaction||'';},key:e=>call('key',e),look:(...args)=>call('look',...args),interact:()=>call('interact'),step:(...args)=>call('step',...args),constrainWalker:(a,b)=>sentry.constrainWalker(a,getMining()?.constrainWalker(a,b)??b)};
}
