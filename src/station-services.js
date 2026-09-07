import * as THREE from 'three';
import {createStationShopUI} from './station-shop-ui.js';
import {createStationCargoUI} from './station-cargo-ui.js';
import {STATION_HUB_FRAME,STATION_TRANSFER_SECONDS,isHandsFree,elevatorLocation} from './station-hub-policy.js';

export function createStationServices(nav,station,inventory,{loadout=null,online=()=>Boolean(nav.multiplayer?.connected),request=null}={}){
  station.nav=nav;
  if(loadout){const allowed=loadout.canSelect.bind(loadout);loadout.canSelect=()=>allowed()&&!isHandsFree(nav);}
  const openCargo=createStationCargoUI(nav,inventory),shopUI=createStationShopUI(nav,inventory);
  const dialog=document.createElement('dialog');dialog.id='station-elevator-dialog';dialog.setAttribute('aria-labelledby','elevator-title');
  dialog.innerHTML='<button class="station-close" aria-label="Close elevator destinations">✕</button><p class="eyebrow">AEON ORBITAL / PASSENGER TRANSIT</p><h2 id="elevator-title">Elevator destinations</h2><p class="elevator-location"></p><p class="elevator-status" role="status"></p><button data-destination="hub" data-controller-key="elevator-hub">Central hub · Hands free</button><div class="station-destinations"></div>';
  document.body.append(dialog);
  const fade=document.createElement('div');fade.className='station-transfer';fade.setAttribute('aria-live','polite');document.body.append(fade);
  let travelling=false,pending=false;
  const stop=()=>{nav.keys.clear();nav.velocity.set(0,0,0);nav.angularVelocity?.set(0,0,0);nav.resetSteering?.();nav.gamepad.suspend();};
  const release=()=>{stop();nav.enabled=!nav.multiplayerDead&&!nav.openingActive&&!document.querySelector('dialog[open]');if(nav.enabled)nav.canvas.focus();};
  dialog.querySelector('.station-close').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{if(!travelling&&!pending)release();});
  function openDestinations(){
    if(travelling||pending||document.querySelector('dialog[open]'))return;
    stop();nav.enabled=false;
    if(document.pointerLockElement)document.exitPointerLock();
    dialog.querySelector('.elevator-status').textContent='';
    dialog.querySelector('.elevator-location').textContent=`${station.location==='hub'?'Central concourse':`Berth ${station.activeIndex+1}`} · Your ship remains at berth ${station.parkedPod+1}.`;
    dialog.querySelector('[data-destination="hub"]').disabled=station.location==='hub';
    dialog.querySelector('.station-destinations').innerHTML=station.pods.map((pod,i)=>`<button data-destination="${pod.id}" data-controller-key="elevator-${pod.id}" ${station.location==='hangar'&&station.activeIndex===i?'disabled':''}>Berth ${String(pod.id).padStart(2,'0')}${i===station.parkedPod?' · Your ship':''}</button>`).join('');
    dialog.showModal();
  }
  function showTransit(trip){
    travelling=true;nav.stationHubTransit={...trip};stop();nav.enabled=false;
    const hub=trip.to===STATION_HUB_FRAME,berth=Number(trip.to?.split(':')[1]);
    fade.innerHTML=`PASSENGER TRANSIT<small>${hub?'CENTRAL CONCOURSE':`BERTH ${berth}`}</small>`;
    // Watch the real source leaves close before the inter-deck fade. The camera
    // reaches the destination cabin before its leaves open.
    fade.classList.toggle('active',trip.phase==='travel');
    if(dialog.open)dialog.close();
  }
  nav.onStationHubEvent=event=>{
    if(event?.action==='destinations')openDestinations();
    else if(event?.action==='equipmentRetail')nav.notify('Equipment retail is available in local play. Use a commodity exchange for shared cargo trading.');
  };
  nav.onStationHubState=snapshot=>{
    if(snapshot?.transit){showTransit(snapshot.transit);return;}
    nav.stationHubTransit=null;
    if(travelling){travelling=false;pending=false;fade.classList.remove('active');release();}
  };
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  dialog.addEventListener('click',async event=>{
    const button=event.target.closest('[data-destination]');if(!button||travelling||pending||button.disabled)return;
    const destination=button.dataset.destination==='hub'?'hub':Number(button.dataset.destination);
    const target=destination==='hub'?station.hub:station.pods.find(p=>p.id===destination);
    if(!target)return;
    pending=true;button.disabled=true;
    try{
      if(online()){
        if(!request)throw new Error('Passenger transit connection unavailable.');
        const result=await request({destination});
        if(result?.ok===false)throw new Error(result.error||'Passenger transit was refused.');
        // The acknowledgement's authoritative state owns pose and fade.
        pending=false;return;
      }
      const from=station.frame;
      if(target===from||!elevatorLocation(from,nav.position,nav.layout.eyeHeight)?.cabin)throw new Error('Walk fully inside the passenger elevator.');
      const trip={from:station.location==='hub'?STATION_HUB_FRAME:`hangar:${from.id}`,to:destination==='hub'?STATION_HUB_FRAME:`hangar:${destination}`,phase:'closing',progress:0};
      from.lift.open=false;target.lift.open=false;showTransit(trip);
      // The existing scene animation continues while player controls are held.
      while(from.lift.progress>.001||target.lift.progress>.001)await wait(33);
      trip.phase='travel';showTransit(trip);await wait(STATION_TRANSFER_SECONDS*1000);
      station.location=destination==='hub'?'hub':'hangar';if(destination!=='hub')station.activeIndex=station.pods.indexOf(target);
      target.toWorld(new THREE.Vector3(0,target.lift.floor+nav.layout.eyeHeight,target.lift.z+1.65),nav.position);
      nav.orientation.copy(target.quaternion);nav.insideShip=false;nav.jumpHeight=0;nav.jumpVelocity=0;
      station.rebase(nav.position);target.lift.open=true;trip.phase='opening';showTransit(trip);
      while(target.lift.progress<.999)await wait(33);
      pending=false;nav.onStationHubState(null);
      nav.notify(destination==='hub'?'Community hub. Weapons and tools remain stowed.':`Berth ${destination}. Your ship remains at berth ${station.parkedPod+1}.`);
    }catch(error){
      pending=false;if(travelling)nav.onStationHubState(null);
      button.disabled=false;dialog.querySelector('.elevator-status').textContent=error.message;nav.notify(error.message);
      if(!dialog.open)release();
    }
  });
  nav.stationAction=()=>{
    const interaction=station.interaction(nav);if(!interaction)return false;
    if(interaction.kind==='cargo')openCargo();
    else if(interaction.kind==='shop')shopUI.open(interaction.shopId);
    else if(interaction.kind==='door'){
      const p=station.toLocal(nav.position,new THREE.Vector3());
      if(Math.abs(p.z-station.lift.z)<.5){nav.notify('Step clear of the elevator doorway.');return true;}
      station.lift.open=!station.lift.open;
    }else if(interaction.kind==='travel')openDestinations();
    else nav.notify(interaction.label);
    return true;
  };
  return {dialog};
}
