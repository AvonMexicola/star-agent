import * as THREE from 'three';
import {createRoverPhysics} from '../rover-physics.js';
import {SENTRY_LAYOUT as L} from './layout.js';

const UP=new THREE.Vector3(0,1,0),FWD=new THREE.Vector3(0,0,-1),clamp=THREE.MathUtils.clamp;
const v=p=>new THREE.Vector3(...p),rotation=(y,p)=>new THREE.Quaternion().setFromEuler(new THREE.Euler(p,y,0,'YXZ'));
const finite=x=>Number.isFinite(x)?clamp(x,-1,1):0;
export const neutralSentryInput=()=>({forward:0,strafe:0,yaw:0,pitch:0,mouseYaw:0,mousePitch:0,brake:false,fire:false,enabled:false});
function neutral(i){return !i.fire&&[i.forward,i.strafe,i.yaw,i.pitch,i.mouseYaw,i.mousePitch].every(x=>Math.abs(x??0)<.04);}

/** Canonical seat/drive/turret simulation shared by solo and the server. The
 * caller owns characters, support, collision and hit authority. Network input
 * cannot set a pose, choose a victim or change the damage/charge constants. */
export function createSentrySimulation({id,ownerId,position,quaternion,sampleSupport,referenceUp,
  constrain=()=>true,accessClear=()=>true,getPlayer=()=>null,getInput=()=>neutralSentryInput(),onFire=()=>{},onSeat=()=>{},canFire=()=>true,getCarriers=()=>[]}={}){
  const physics=createRoverPhysics({position,quaternion,layout:L,sampleSupport,referenceUp,constrain});
  const seats=Object.fromEntries(Object.keys(L.seats).map(role=>[role,{id:null,phase:'empty',door:0,routeIndex:0,returning:false,armed:false,minSequence:-1}]));
  const state={id,ownerId,health:L.hull,destroyed:false,yaw:0,pitch:0,charge:1,depleted:false,controllerId:null,armed:false,shots:0,lastShot:null,lastHit:null,controlEpoch:0,requiredSequence:-1,carrier:null};
  Object.defineProperty(state,'seats',{value:seats,enumerable:false});
  let anchor=null,cooldown=0,time=0,inputs={},drive={throttle:0,steer:0,brake:1};
  const world=p=>v(p).applyQuaternion(physics.state.quaternion).add(physics.state.position);
  const local=p=>p.clone().sub(physics.state.position).applyQuaternion(physics.state.quaternion.clone().invert());
  const occupant=playerId=>Object.keys(seats).find(role=>seats[role].id===playerId)??null;
  function ground(role){
    const point=world(L.seats[role].ground),up=UP.clone().applyQuaternion(physics.state.quaternion),hit=sampleSupport(point.clone().addScaledVector(up,-1.75));
    return hit?hit.point.clone().addScaledVector(hit.normal,1.75):null;
  }
  function route(role){return [ground(role),...L.seats[role].route.map(world)].filter(Boolean);}
  function stop(){
    state.armed=false;state.requiredSequence=getPlayer(state.controllerId)?.sequence??getInput(state.controllerId)?.sequence??-1;
    for(const s of Object.values(seats)){s.armed=false;s.minSequence=getPlayer(s.id)?.sequence??getInput(s.id)?.sequence??-1;}
    state.controlEpoch++;state.lastShot=null;drive={throttle:0,steer:0,brake:1};
  }
  function pose(role){
    const seat=seats[role],player=getPlayer(seat.id);if(!player)return;
    const nav=player.nav??player;
    nav.mode='walk';nav.roverOccupied=true;nav.sentrySeat={id,role,phase:seat.phase};nav.insideShip=true;
    nav.velocity.set(0,0,0);nav.angularVelocity?.set(0,0,0);nav.jumpHeight=0;nav.jumpVelocity=0;
    nav.sentryBodyOrientation=physics.state.quaternion.toArray();
    nav.sentryFeet=seat.phase==='seated'?world(L.seats[role].feet).toArray():null;
    if(seat.phase==='seated'){
      nav.position.copy(world(L.seats[role].eye));
      nav.orientation.copy(physics.state.quaternion);if(role==='gunner'||!seats.gunner.id)nav.orientation.multiply(rotation(state.yaw,state.pitch));
      if(role==='pilot')nav.velocity.copy(FWD).applyQuaternion(physics.state.quaternion).multiplyScalar(physics.state.speed);
    }
  }
  function clearSeat(role,{place=true}={}){
    const seat=seats[role],player=getPlayer(seat.id),nav=player?.nav??player,old=seat.id;
    if(nav){
      if(place){const point=ground(role);if(point)nav.position.copy(point);}
      nav.roverOccupied=false;nav.sentrySeat=null;nav.sentryBodyOrientation=null;nav.sentryFeet=null;nav.insideShip=false;
      nav.velocity.set(0,0,0);nav.keys?.clear?.();nav.gamepad?.suspend?.();
    }
    Object.assign(seat,{id:null,phase:'closing',returning:false,routeIndex:0});stop();onSeat(old,null);
  }
  function setController(){
    const selected=seats.gunner.id??seats.pilot.id;
    if(state.controllerId!==selected){state.controllerId=selected;stop();}
  }
  function access(role,dt){
    const s=seats[role];
    if(s.phase==='empty'||s.phase==='seated')return;
    if(s.phase==='closing'){
      s.door=Math.max(0,s.door-dt/1.1);if(s.door===0)s.phase=s.id?'seated':'empty';
      if(s.phase==='seated'){stop();onSeat(s.id,role);pose(role);}return;
    }
    const p=getPlayer(s.id),nav=p?.nav??p;if(!nav){clearSeat(role,{place:false});return;}
    if(s.phase==='opening'){
      s.door=Math.min(1,s.door+dt/1.1);if(s.door===1){s.phase='traversing';s.routeIndex=0;}return;
    }
    const points=s.returning?[...L.seats[role].route.slice(0,-1).reverse().map(world),ground(role)]:route(role);
    const target=points[s.routeIndex];if(!target)return;
    const delta=target.clone().sub(nav.position),distance=delta.length();
    if(distance<.003){
      if(++s.routeIndex>=points.length){if(s.returning)clearSeat(role,{place:false});else s.phase='closing';}return;
    }
    const next=nav.position.clone().addScaledVector(delta,Math.min(distance,dt*.85)/distance);
    if(!accessClear(nav.position,next,role))return;
    nav.position.copy(next);nav.orientation.slerp(physics.state.quaternion,1-Math.exp(-dt*4));
  }
  const api={id,physics,seats,state,world,local,ground,occupant,
    get busy(){return Object.values(seats).some(s=>!['empty','seated'].includes(s.phase));},
    get occupied(){return Object.values(seats).some(s=>s.id);},
    get controls(){return {...drive};},
    nearest(player){
      const nav=player?.nav??player;if(!nav||nav.mode!=='walk'||nav.sentrySeat||nav.roverOccupied||nav.carryingCargo)return null;
      return Object.keys(seats).map(role=>({role,point:ground(role)})).filter(s=>s.point&&nav.position.distanceTo(s.point)<1.25).sort((a,b)=>nav.position.distanceTo(a.point)-nav.position.distanceTo(b.point))[0]?.role??null;
    },
    request(playerId,role){
      if(state.health<=0)throw new Error('This Sentry is destroyed. Deploy a replacement with empty seats.');
      const p=getPlayer(playerId),nav=p?.nav??p;if(!nav||p.health<=0)throw new Error('A living pilot is required.');
      if(!Object.hasOwn(seats,role))throw new Error('Choose the pilot or gunner seat.');
      if(nav.sentrySeat||nav.roverOccupied)throw new Error('Leave your current seat first.');
      if(nav.mode!=='walk'||nav.carryingCargo||nav.cabinFlight||nav.spaceParked)throw new Error('Approach the rover on foot with empty hands.');
      const seat=seats[role];if(seat.id||seat.phase!=='empty')throw new Error('That seat is occupied or its door is moving.');
      if(Math.abs(physics.state.speed)>.2||api.busy)throw new Error('Wait for the rover to stop and cabin access to finish.');
      if(api.nearest(p)!==role)throw new Error('Approach the '+role+' door to board.');
      const waypoints=[nav.position.clone(),...route(role)];
      if(waypoints.some((point,i)=>i&& !accessClear(waypoints[i-1],point,role)))throw new Error('The boarding route is obstructed.');
      Object.assign(seat,{id:playerId,phase:'opening',returning:false,routeIndex:0,armed:false,minSequence:p.sequence??getInput(playerId)?.sequence??-1});
      stop();setController();nav.keys?.clear?.();nav.gamepad?.suspend?.();pose(role);onSeat(playerId,role);return true;
    },
    exit(playerId){
      const role=occupant(playerId);if(!role)throw new Error('You are not in this rover.');
      const s=seats[role];if(!['seated','opening'].includes(s.phase))throw new Error('Wait for cabin access to finish.');
      if(Math.abs(physics.state.speed)>.2)throw new Error('Brake to a stop before leaving the rover.');
      const points=[(getPlayer(playerId).nav??getPlayer(playerId)).position.clone(),...L.seats[role].route.slice(0,-1).reverse().map(world),ground(role)];
      if(!points.at(-1)||points.some((point,i)=>i&&!accessClear(points[i-1],point,role)))throw new Error('Clear the exit route before opening the cabin.');
      Object.assign(s,{phase:'opening',returning:true,routeIndex:0});stop();return true;
    },
    release(playerId){const role=occupant(playerId);if(role){clearSeat(role);setController();}return Boolean(role);},
    suspend(){if(state.armed||state.lastShot)stop();for(const s of Object.values(seats))if(s.armed){s.armed=false;s.minSequence=getPlayer(s.id)?.sequence??getInput(s.id)?.sequence??-1;}},
    muzzlePoses(){
      const yawQ=rotation(state.yaw,0),pitchQ=rotation(0,state.pitch),q=physics.state.quaternion.clone().multiply(yawQ).multiply(pitchQ);
      const pivot=v(L.turret.pitch).applyQuaternion(yawQ).add(v(L.turret.yaw));
      return L.turret.muzzle.map(m=>({start:v(m).applyQuaternion(pitchQ).applyQuaternion(yawQ).add(pivot).applyQuaternion(physics.state.quaternion).add(physics.state.position),direction:FWD.clone().applyQuaternion(q),quaternion:q.clone()}));
    },
    tick(dt){
      if(!Number.isFinite(dt)||dt<0)throw new Error('Invalid Sentry step');dt=Math.min(dt,.1);time+=dt;cooldown=Math.max(0,cooldown-dt);
      if(state.health<=0){state.destroyed=true;for(const s of Object.values(seats))if(s.id)api.release(s.id);}
      for(const role of Object.keys(seats)){
        const seat=seats[role],p=getPlayer(seat.id);
        if(seat.id&&(!p||p.health<=0))clearSeat(role);
      }
      setController();inputs={};
      for(const seat of Object.values(seats))if(seat.id)inputs[seat.id]=getInput(seat.id)??neutralSentryInput();
      const control=inputs[state.controllerId]??neutralSentryInput(),controllerRole=occupant(state.controllerId);
      const available=Boolean(controllerRole&&seats[controllerRole].phase==='seated'&&control.enabled!==false&&!api.busy);
      if(!available){if(state.armed)stop();state.lastShot=null;}
      else if(!state.armed&&neutral(control)&&Number.isSafeInteger(control.sequence)&&control.sequence>state.requiredSequence)state.armed=true;
      const driver=inputs[seats.pilot.id]??neutralSentryInput();
      drive={throttle:0,steer:0,brake:1};
      if(driver.enabled===false||seats.pilot.phase!=='seated'||api.busy){if(seats.pilot.armed){seats.pilot.armed=false;seats.pilot.minSequence=driver.sequence??-1;}}
      else if(!seats.pilot.armed&&neutral(driver)&&Number.isSafeInteger(driver.sequence)&&driver.sequence>seats.pilot.minSequence)seats.pilot.armed=true;
      const carriers=getCarriers(),carried=anchor&&carriers.find(c=>c.id===anchor.id);
      if(carried){const lift=carried.systems.lifts?.find(l=>l.id===anchor.lift);if(lift){anchor.position.y+=lift.y-anchor.liftY;anchor.liftY=lift.y;}physics.setPose(anchor.position.clone().applyQuaternion(carried.frame.quaternion).add(carried.frame.position),carried.frame.quaternion.clone().multiply(anchor.quaternion),{preserveMotion:true});}
      if(seats.pilot.phase==='seated'&&seats.pilot.armed&&!api.busy&&driver.enabled!==false&&!carried?.inFlight&&!carried?.systems.moving)drive={throttle:finite(driver.forward),steer:finite(driver.strafe)*1.5,brake:Boolean(driver.brake)};
      physics.step(dt,drive);
      const carrier=carriers.find(c=>physics.state.wheels.every(w=>w.source?.startsWith('carrier:'+c.id+':')));
      if(carrier){const inverse=carrier.frame.quaternion.clone().invert(),lift=carrier.systems.lifts?.find(l=>physics.state.wheels.every(w=>w.source.endsWith('-lift:'+l.id)));anchor={id:carrier.id,position:physics.state.position.clone().sub(carrier.frame.position).applyQuaternion(inverse),quaternion:inverse.multiply(physics.state.quaternion),lift:lift?.id??null,liftY:lift?.y??0};}else anchor=null;state.carrier=anchor?.id??null;
      if(available&&state.armed){
        state.yaw=THREE.MathUtils.euclideanModulo(state.yaw+(finite(control.yaw)*L.turret.turnRate*dt+clamp(control.mouseYaw??0,-.5,.5))+Math.PI,Math.PI*2)-Math.PI;
        state.pitch=clamp(state.pitch+finite(control.pitch)*L.turret.turnRate*dt+clamp(control.mousePitch??0,-.5,.5),L.turret.pitchMin,L.turret.pitchMax);
      }
      for(const role of Object.keys(seats)){access(role,dt);if(seats[role].id)pose(role);}
      const firing=available&&state.armed&&control.fire&&state.charge>0&&!state.depleted&&!anchor&&canFire(state.controllerId);
      if(firing){
        state.charge=Math.max(0,state.charge-dt/L.turret.chargeSeconds);
        if(cooldown===0){
          cooldown=L.turret.interval;state.shots++;state.lastShot={sequence:state.shots,by:state.controllerId,time};
          onFire(api.muzzlePoses(),state.controllerId,state.shots,api);
        }
        if(state.charge===0)state.depleted=true;
      }else{
        state.charge=Math.min(1,state.charge+dt/L.turret.rechargeSeconds);
        if(!control.fire&&state.charge>=.15)state.depleted=false;
      }
      if(state.lastShot&&time-state.lastShot.time>.13)state.lastShot=null;
      return api.snapshot();
    },
    snapshot(){return {...state,position:physics.state.position.toArray(),quaternion:physics.state.quaternion.toArray(),speed:physics.state.speed,distance:physics.state.distance,
      blocked:physics.state.blocked,reason:physics.state.reason,supported:physics.state.supported,controls:{...drive},
      seats:structuredClone(seats),wheels:physics.state.wheels.map(w=>({id:w.id,steer:w.steer,spin:w.spin,suspension:w.suspension,source:w.source})),busy:api.busy};},
  };return api;
}

export function constrainSentryWalker(rover,previous,proposed,playerId){
  if(rover.occupant(playerId))return proposed;
  const a=rover.local(previous),b=rover.local(proposed),delta=b.clone().sub(a);
  let enter=0,leave=1;const min=[-1.97,-.12,-2.07],max=[1.55,4.0,2.88];
  for(let axis=0;axis<3;axis++){
    const n=a.getComponent(axis),d=delta.getComponent(axis);
    if(Math.abs(d)<1e-10){if(n<min[axis]||n>max[axis])return proposed;}
    else{const x=(min[axis]-n)/d,y=(max[axis]-n)/d;enter=Math.max(enter,Math.min(x,y));leave=Math.min(leave,Math.max(x,y));}
  }
  const inside=a.toArray().every((n,i)=>n>min[i]&&n<max[i]);if(inside&&b.toArray().some((n,i)=>n<=min[i]||n>=max[i]))return proposed;
  return enter<leave&&leave>0&&enter<1?previous.clone():proposed;
}
