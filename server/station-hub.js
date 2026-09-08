import * as THREE from 'three';
import {stationPhysicsAt} from '../src/station-physics.js';
import {updateElevator} from '../src/station-architecture.js';
import {STATION_HUB_FRAME,STATION_TRANSFER_SECONDS,isHandsFree,elevatorLocation,createHubFireGate} from '../src/station-hub-policy.js';

/** Room-owned passenger transit. Only cabin entry and a destination identifier
 * cross the protocol; no supplied position, frame or hands-free flag is used. */
export function createStationHub({world,players=new Map(),send=(p,event)=>p.send?.(event)}){
  const station=world?.station,transits=new Map(),locks=new Map(),gates=new Map();
  const available=()=>Boolean(station?.ready&&station.hub?.lift&&station.pods?.length);
  const frames=()=>available()?[...station.pods,station.hub]:[];
  const idOf=frame=>frame===station.hub?STATION_HUB_FRAME:`hangar:${frame.id}`;
  const frameFor=id=>id===STATION_HUB_FRAME?station?.hub:station?.pods?.find(p=>`hangar:${p.id}`===id);
  const alive=p=>p?.health>0&&p.shipHealth>0;
  const current=p=>available()?stationPhysicsAt(station,p.nav.position):null;
  const location=(frame,p)=>elevatorLocation(frame,p.nav.position,p.nav.layout?.eyeHeight??1.75);
  const notice=(p,message)=>send(p,{type:'event',event:'notice',message});
  const gate=p=>{let value=gates.get(p.id);if(!value){value=createHubFireGate();gates.set(p.id,value);}return value;};
  function blockedDoor(frame){return [...players.values()].some(p=>alive(p)&&['walk','eva'].includes(p.nav.mode)&&location(frame,p)?.threshold);}
  function occupied(frame,except){return [...players.values()].some(p=>p!==except&&alive(p)&&['walk','eva'].includes(p.nav.mode)&&(location(frame,p)?.occupiesCabin||location(frame,p)?.threshold));}
  function neutral(p,receivedInput=false){
    const restricted=isHandsFree(p.nav);
    // Only the protocol receipt may prove physical neutral. Timeout/respawn
    // resets of p.input and frame observation can restrict, never rearm.
    gate(p).update(restricted,receivedInput?p.input?.fire===true:true,p.sequence??0);
    if(restricted)p.weapon=null;
    return restricted;
  }
  function cancel(p){
    const trip=transits.get(p.id);if(!trip)return;
    for(const id of [trip.from,trip.to])if(locks.get(id)===p.id){locks.delete(id);const frame=frameFor(id);if(frame)frame.lift.open=true;}
    transits.delete(p.id);p.nav.stationHubTransit=null;
  }
  function publish(p,trip){p.nav.stationHubTransit=trip?{from:trip.from,to:trip.to,phase:trip.phase,progress:trip.phase==='travel'?Math.min(1,trip.elapsed/STATION_TRANSFER_SECONDS):0}:null;}
  return {
    isHandsFree,
    input(p){neutral(p,true);},
    action(p){
      if(!available())return false;
      if(transits.has(p.id))return true;
      if(!alive(p)||p.nav.mode!=='walk'||p.nav.insideShip)return false;
      const interaction=p.nav.station?.interaction?.(p.nav);
      if(interaction?.kind==='shop'){
        send(p,{type:'event',event:'stationHub',action:'equipmentRetail',shopId:interaction.shopId});return true;
      }
      const grid=current(p),frame=grid?.frame,at=frame&&location(frame,p);if(!at)return false;
      if(!at.cabin&&!at.door)return false;
      if(locks.has(grid.id)){notice(p,'Passenger elevator busy. Wait for it to arrive.');return true;}
      if(at.cabin){send(p,{type:'event',event:'stationHub',action:'destinations',frame:grid.id});return true;}
      if(frame.lift.open&&at.threshold){notice(p,'Step clear of the elevator doorway.');return true;}
      if(frame.lift.open&&blockedDoor(frame)){notice(p,'Elevator doorway occupied.');return true;}
      frame.lift.open=!frame.lift.open;return true;
    },
    request(p,{destination}={}){
      if(!available())throw new Error('Passenger transit unavailable.');
      if(!alive(p)||p.nav.mode!=='walk'||p.nav.insideShip||p.nav.travel)throw new Error('Enter the passenger elevator on foot.');
      if(transits.has(p.id))throw new Error('Passenger transit already in progress.');
      const grid=current(p),from=grid?.frame;
      if(!from||!location(from,p)?.cabin)throw new Error('Walk fully inside the passenger elevator.');
      const to=destination==='hub'?station.hub:Number.isInteger(destination)?station.pods.find(frame=>frame.id===destination):null;
      if(!to||to===from)throw new Error('Choose another station destination.');
      const a=idOf(from),b=idOf(to);
      if(locks.has(a)||locks.has(b)||occupied(from,p)||occupied(to,p))throw new Error('That passenger cabin is occupied. Wait until it is clear.');
      const trip={player:p,from:a,to:b,phase:'closing',elapsed:0,position:p.nav.position.clone()};
      transits.set(p.id,trip);locks.set(a,p.id);locks.set(b,p.id);from.lift.open=false;to.lift.open=false;
      p.nav.velocity.set(0,0,0);p.nav.angularVelocity?.set(0,0,0);p.nav.keys.clear();p.nav.resetSteering?.();
      p.lookYaw=p.lookPitch=0;
      publish(p,trip);neutral(p);return {ok:true,message:'Passenger transit started.'};
    },
    tick(dt){
      if(!available())return;
      for(const trip of transits.values())if(!players.has(trip.player.id)||!alive(trip.player))cancel(trip.player);
      for(const id of gates.keys())if(!players.has(id))gates.delete(id);
      const step=Number.isFinite(dt)?Math.max(0,Math.min(.25,dt)):0;
      for(const frame of frames()){
        // Hold closing leaves while a body straddles them, including a bystander
        // arriving after a trip was accepted. Neither doors nor transit crush it.
        if(!frame.lift.open&&blockedDoor(frame))continue;
        updateElevator(frame.lift,step);
      }
    },
    update(p,dt){
      if(!available())return false;
      neutral(p);
      const trip=transits.get(p.id);if(!trip)return false;
      if(!alive(p)){cancel(p);return false;}
      const from=frameFor(trip.from),to=frameFor(trip.to),n=p.nav;
      n.position.copy(trip.position);n.velocity.set(0,0,0);n.angularVelocity?.set(0,0,0);n.keys.clear();n.resetSteering?.();
      p.lookYaw=p.lookPitch=0;
      const step=Number.isFinite(dt)?Math.max(0,Math.min(.25,dt)):0;
      if(trip.phase==='closing'&&from.lift.progress<=.001&&to.lift.progress<=.001){trip.phase='travel';trip.elapsed=0;}
      else if(trip.phase==='travel'){
        trip.elapsed+=step;
        if(trip.elapsed>=STATION_TRANSFER_SECONDS&&!occupied(to,p)){
          trip.position.copy(to.toWorld(new THREE.Vector3(0,to.lift.floor+(n.layout?.eyeHeight??1.75),to.lift.z+1.65),new THREE.Vector3()));
          n.position.copy(trip.position);n.orientation.copy(to.quaternion);n.insideShip=false;n.jumpHeight=0;n.jumpVelocity=0;n.mode='walk';
          to.lift.open=true;trip.phase='opening';
        }
      }else if(trip.phase==='opening'&&to.lift.progress>=.999){
        transits.delete(p.id);locks.delete(trip.from);locks.delete(trip.to);publish(p,null);neutral(p);
        notice(p,trip.to===STATION_HUB_FRAME?'Community hub. Weapons and tools remain stowed.':`Berth ${to.id}. Your parked ship has not moved.`);
        return true;
      }
      publish(p,trip);return true;
    },
    canFire(p){return !neutral(p)&&gate(p).armed&&!transits.has(p.id);},
    snapshot(p){
      const grid=current(p);
      return {frame:grid?.id??null,transit:p.nav.stationHubTransit?{...p.nav.stationHubTransit}:null,handsFree:isHandsFree(p.nav),elevators:frames().map(frame=>({frame:idOf(frame),open:frame.lift.open,progress:frame.lift.progress}))};
    },
    leave(p,{preserveGate=false}={}){cancel(p);if(preserveGate)gate(p).update(true,true,p.sequence??0);else gates.delete(p.id);},
  };
}
