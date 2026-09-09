import * as THREE from 'three';
import {createSentrySimulation,neutralSentryInput,constrainSentryWalker} from '../src/sentry/simulation.js';
import {createSentryEnvironment,sentryDeploymentPoses} from '../src/sentry/environment.js';
import {sentryBodyDistance} from '../src/sentry/occlusion.js';
import {SENTRY_LAYOUT as L} from '../src/sentry/layout.js';
import {worldDistance,capsuleDistance,playerUp,shipDistance,shipPose} from './combat.js';
import {isHandsFree,HANDS_FREE_REASON} from '../src/station-hub-policy.js';
import {betweenFrames,frameRotation,rotationFrameAt} from '../src/planet-rotation.js';
import {sentryFrame,sentryPoseFrame,sentryPoseInFrame} from '../src/sentry/frames.js';

/** Room-owned session vehicles. A station pilot or surface walker may deploy
 * one supported rover; the command contains no transforms or target fields. */
export function createSentries({players,world,send,impact,security,broadcast,canFire=()=>true,now=Date.now}){
  const vehicles=new Map(),carrierGuards=new WeakSet();
  const environmentFor=getFrame=>createSentryEnvironment({carrierGuards,getFrame:world.rotationClock?getFrame:null,getTime:()=>world.rotationClock?.seconds??0,station:world.station,getRovers:()=>[...vehicles.values()],getWalkers:()=>[...players.values()].filter(p=>p.health>0),getHulls:()=>[...players.values()].filter(p=>!p.nav.freighter).map(shipPose).filter(Boolean).map(s=>({...s,quaternion:s.rotation})),getCarriers:()=>[...players.values()].filter(p=>p.nav.freighter&&shipPose(p)).map(p=>{const ship=shipPose(p);return {id:p.id,systems:p.nav.freighter,planetFrame:ship.frame?.id??null,frame:{position:ship.position,quaternion:ship.rotation},inFlight:p.nav.mode==='flight'||p.nav.cabinFlight||p.nav.spaceParked,cargoConstrain:p.nav.cargoConstrain};}),getObstacles:()=>players.values().next().value?.nav.surfaceObstacles,buildingRaycast:(...args)=>players.values().next().value?.nav.buildingRaycast?.(...args)});
  const environment=environmentFor(point=>rotationFrameAt(point));
  function current(id){return [...vehicles.values()].find(r=>r.occupant(id));}
  function validPlayer(p){if(!p||p.health<=0||p.shipHealth<=0||p.nav.stationHubTransit||security.pending(p))throw new Error('A living pilot outside station transit or a pending defense response is required.');}
  function vehicleHit(origin,direction,range,nav=null){
    let result=null;for(const r of vehicles.values()){
      const pose=nav?.rotationClock?sentryPoseInFrame(r.physics.state,sentryPoseFrame(r),nav.rotationFrame,nav.rotationTime):r.physics.state;
      const distance=sentryBodyDistance(origin,direction,pose.position,pose.quaternion);
      if(distance<range){range=distance;result={id:r.id,distance,health:r.state.health};}
    }return result;
  }
  function hit(shooter,roverId,damage,point,event,id){
    const rover=vehicles.get(roverId);if(!rover||rover.state.health<=0||!Number.isFinite(damage)||damage<=0)return;
    if(shooter.nav.rotationClock){const from=Object.hasOwn(event,'planetFrame')?sentryFrame(event.planetFrame):shooter.nav.rotationFrame;point=betweenFrames(point,from,rotationFrameAt(point),shooter.nav.rotationTime);}
    const victims=[...new Set([...Object.values(rover.seats).map(s=>players.get(s.id)),players.get(rover.state.ownerId)])].filter(p=>p&&p.id!==shooter.id&&p.health>0&&p.shipHealth>0),victim=victims[0];
    const resolve=result=>{
      if(!result.accepted)return;
      if(rover.state.health<=0){rover.state.destroyed=true;rover.state.charge=0;for(const s of Object.values(rover.seats))if(s.id)rover.release(s.id);}
      broadcast({...event,kind:'vehicle',targetId:rover.id,damage:result.damage,hull:rover.state.health});
    };
    if(victim)security.submit({id,attacker:shooter,victim,vehicleVictims:victims,kind:'vehicle',vehicle:rover.state,cause:'shot',damage,point},resolve);
    else{const applied=Math.min(damage,rover.state.health);rover.state.health-=applied;resolve({accepted:true,damage:applied});}
  }
  function fire(poses,shooterId,sequence,rover){
    const shooter=players.get(shooterId);if(!shooter||!canFire(shooter))return;
    for(let barrel=0;barrel<poses.length;barrel++){
      const {start,direction}=poses[barrel];let distance=worldDistance(world,start,direction,L.turret.range),victim=null,kind=null;
      const frame=sentryFrame(rover.state.planetFrame),shotNav=shooter.nav.rotationClock?{rotationClock:shooter.nav.rotationClock,rotationFrame:frame,rotationTime:shooter.nav.rotationTime}:null;
      const vehicle=vehicleHit(start,direction,distance,shotNav);if(vehicle){distance=vehicle.distance;if(vehicle.id!==rover.id&&vehicle.health>0){victim=vehicle;kind='vehicle';}}
      for(const p of players.values()){
        const ship=shipPose(p);
        if(ship){if(shotNav){betweenFrames(ship.position,ship.frame,frame,shotNav.rotationTime,ship.position);ship.rotation=frameRotation(ship.frame,frame,shotNav.rotationTime).multiply(ship.rotation);}const d=shipDistance(start,direction,ship.position,ship.rotation,ship.bounds);if(d<distance){distance=d;victim=p.id!==shooterId&&p.shipHealth>0?p:null;kind=victim?'ship':null;}}
        if(p.id===shooterId||rover.occupant(p.id)||p.health<=0||!['walk','eva'].includes(p.nav.mode))continue;
        const eye=shotNav?betweenFrames(p.nav.position,p.nav.rotationFrame,frame,shotNav.rotationTime):p.nav.position,up=playerUp(p.nav);if(shotNav)up.applyQuaternion(frameRotation(p.nav.rotationFrame,frame,shotNav.rotationTime));
        const d=capsuleDistance(start,direction,eye,up);if(d<distance){distance=d;victim=p;kind='player';}
      }
      const point=start.clone().addScaledVector(direction,distance),packet={type:'event',event:'sentryFire',planetFrame:rover.state.planetFrame,roverId:rover.id,sequence,barrel,peerId:shooterId,start:start.toArray(),end:point.toArray(),targetId:victim?.id??null,kind};
      rover.state.lastHit=victim?{id:victim.id,kind,sequence}:null;
      // Station friendship/protection and durable death handling use the same
      // security pipeline as handheld shots. Presentation never grants damage.
      if(kind==='vehicle')hit(shooter,victim.id,L.turret.damage,point,packet,`sentry:${rover.id}:${sequence}:${barrel}`);
      else if(victim)impact({id:`sentry:${rover.id}:${sequence}:${barrel}`,attacker:shooter,victim,kind,cause:'shot',damage:L.turret.damage,point},packet);
      else broadcast(packet);
    }
  }
  function construct(p,pose){
    let rover;const environment=environmentFor(()=>rover?sentryFrame(rover.state.planetFrame):p.nav.rotationFrame);
    rover=createSentrySimulation({planetFrame:p.nav.rotationFrame?.id??null,id:'sentry:'+p.id,ownerId:p.id,...pose,sampleSupport:environment.support,referenceUp:environment.up,constrain:movement=>environment.constrain(movement,'sentry:'+p.id),accessClear:environment.accessClear,
      getCarriers:environment.carriers,getTime:()=>world.rotationClock?.seconds??0,getPlayer:id=>players.get(id),getInput:id=>{const user=players.get(id);return user&&!user.busy&&now()-user.lastInput<500?{...user.input,mouseYaw:user.lookYaw,mousePitch:user.lookPitch,sequence:user.sequence,enabled:user.input.vehicleReady===true}:neutralSentryInput();},
      canFire:id=>{const user=players.get(id);return Boolean(user&&canFire(user));},onFire:fire,
      onSeat:(id,role)=>{const user=players.get(id);if(user){user.input=neutralSentryInput();user.lookYaw=user.lookPitch=0;send(user,{type:'event',event:'notice',message:role?`Burrow Sentry: ${role} access. Release controls before taking command.`:'Left Burrow Sentry. Pilot control resumes only after neutral input.'});}},
    });return rover;
  }
  const api={vehicles,current,vehicleHit,hit,
    request(p,m){
      validPlayer(p);
      if(m.command==='deploy'){
        if(isHandsFree(p.nav))throw new Error(HANDS_FREE_REASON);
        if(p.nav.mode!=='walk'||p.nav.roverOccupied||p.nav.carryingCargo||p.nav.insideShip)throw new Error('Deploy on foot outside your ship with empty hands.');
        const prior=vehicles.get('sentry:'+p.id);if(!prior&&vehicles.size>=10)throw new Error('The room already has ten Sentry rovers.');if(prior?.occupied||prior?.busy)throw new Error('Your Sentry is occupied or its doors are moving.');
        if(prior&&prior.physics.state.position.distanceTo(p.nav.position)>20)throw new Error('Return within 20 m of your Sentry before relocating it.');
        for(const pose of sentryDeploymentPoses(p.nav)){
          if(!environment.clearPose(pose.position,pose.quaternion,prior?.id)||[...vehicles.values()].some(r=>r!==prior&&r.physics.state.position.distanceTo(pose.position)<7))continue;
          const rover=construct(p,pose);rover.physics.step(1/30,{brake:1});
          if(!rover.physics.state.supported||rover.physics.state.blocked||!rover.ground('pilot')||!rover.ground('gunner'))continue;
          vehicles.set(rover.id,rover);return;
        }
        throw new Error('No clear supported space nearby for the Sentry and both boarding routes.');
      }
      const rover=vehicles.get(m.id);if(!rover)throw new Error('That Sentry is no longer available.');
      if(m.command==='board')return rover.request(p.id,m.role);
      if(m.command==='exit')return rover.exit(p.id);
      throw new Error('Unknown Sentry command.');
    },
    interact(p){
      const seat=current(p.id);if(seat){try{seat.exit(p.id);}catch(e){send(p,{type:'event',event:'notice',message:e.message});}return true;}
      for(const rover of vehicles.values()){const role=rover.nearest(p);if(role){try{rover.request(p.id,role);}catch(e){send(p,{type:'event',event:'notice',message:e.message});}return true;}}
      return false;
    },
    attach(p){
      const previous=p.nav.vehicle;
      p.nav.vehicle={step:(dt,pad)=>current(p.id)?true:previous?.step?.(dt,pad)??false,
        look:(...args)=>Boolean(current(p.id))||previous?.look?.(...args)||false,key:(...args)=>Boolean(current(p.id))||previous?.key?.(...args)||false,
        interact:()=>api.interact(p)||previous?.interact?.(),
        constrainWalker:(a,b)=>{let end=previous?.constrainWalker?.(a,b)??b;for(const r of vehicles.values()){const frame=sentryFrame(r.state.planetFrame),from=p.nav.rotationFrame,t=p.nav.rotationTime;if(p.nav.rotationClock){const x=betweenFrames(a,from,frame,t),y=betweenFrames(end,from,frame,t);end=betweenFrames(constrainSentryWalker(r,x,y,p.id),frame,from,t);}else end=constrainSentryWalker(r,a,end,p.id);}return end;}};
    },
    tick(dt){for(const [id,r]of vehicles){r.tick(dt);if(!r.occupied&&!r.busy&&!players.has(r.state.ownerId))vehicles.delete(id);}},
    snapshot(){return [...vehicles.values()].map(r=>r.snapshot());},
    leave(id){for(const [key,r]of vehicles){r.release(id);if(!r.occupied&&(r.state.ownerId===id||!players.has(r.state.ownerId)))vehicles.delete(key);}},
    clear(){for(const r of vehicles.values())for(const s of Object.values(r.seats))if(s.id)r.release(s.id);vehicles.clear();},
  };return api;
}
