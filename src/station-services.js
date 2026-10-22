import * as THREE from 'three';
import { createStationShopUI } from './station-shop-ui.js';
import { createStationCargoUI } from './station-cargo-ui.js';

export function createStationServices(nav,station,inventory){
  station.nav=nav;
  const openCargo=createStationCargoUI(nav,inventory);
  const shopUI=createStationShopUI(nav,inventory);
  const dialog=document.createElement('dialog');dialog.id='station-elevator-dialog';dialog.setAttribute('aria-labelledby','elevator-title');
  dialog.innerHTML='<button class="station-close" aria-label="Close elevator destinations">✕</button><p class="eyebrow">AEON ORBITAL / PASSENGER TRANSIT</p><h2 id="elevator-title">Elevator destinations</h2><p class="elevator-location"></p><button data-destination="hub">Central hub</button><div class="station-destinations"></div>';
  document.body.append(dialog);
  const fade=document.createElement('div');fade.className='station-transfer';fade.setAttribute('aria-live','polite');document.body.append(fade);
  let travelling=false;
  const release=()=>{nav.keys.clear();nav.velocity.set(0,0,0);nav.enabled=true;nav.canvas.focus();};
  dialog.querySelector('.station-close').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{if(!travelling)release();});
  function openDestinations(){
    if(document.querySelector('dialog[open]'))return;
    nav.keys.clear();nav.velocity.set(0,0,0);nav.enabled=false;
    if(document.pointerLockElement)document.exitPointerLock();
    dialog.querySelector('.elevator-location').textContent=`${station.location==='hub'?'Central concourse':`Berth ${station.activeIndex+1}`} · Your ship remains at berth ${station.parkedPod+1}.`;
    dialog.querySelector('[data-destination="hub"]').disabled=station.location==='hub';
    dialog.querySelector('.station-destinations').innerHTML=station.pods.map((pod,i)=>`<button data-destination="${i}" ${station.location==='hangar'&&station.activeIndex===i?'disabled':''}>Berth ${String(pod.id).padStart(2,'0')}${i===station.parkedPod?' · Your ship':''}</button>`).join('');
    dialog.showModal();
  }
  dialog.addEventListener('click',async event=>{
    const button=event.target.closest('[data-destination]');if(!button||travelling||button.disabled)return;
    const destination=button.dataset.destination;
    if(destination!=='hub'&&(!Number.isInteger(Number(destination))||Number(destination)<0||Number(destination)>=station.pods.length))return;
    travelling=true;station.lift.open=false;
    fade.innerHTML=`PASSENGER TRANSIT<small>${destination==='hub'?'CENTRAL CONCOURSE':`BERTH ${Number(destination)+1}`}</small>`;
    fade.classList.add('active');dialog.close();nav.enabled=false;nav.keys.clear();nav.velocity.set(0,0,0);
    await new Promise(resolve=>setTimeout(resolve,1300));
    station.location=destination==='hub'?'hub':'hangar';
    if(destination!=='hub')station.activeIndex=Number(destination);
    const floor=station.interiorBox.min.y;
    station.toWorld(new THREE.Vector3(0,floor+nav.layout.eyeHeight,station.lift.z+1.65),nav.position);
    nav.orientation.copy(station.quaternion);nav.insideShip=false;nav.jumpHeight=0;nav.jumpVelocity=0;
    station.lift.open=true;station.lift.progress=0;
    station.rebase(nav.position);
    await new Promise(resolve=>setTimeout(resolve,500));
    fade.classList.remove('active');travelling=false;release();
    nav.notify(destination==='hub'?'Central concourse. Armory to the left, ship components to the right. Purchases go to station storage.':`Berth ${Number(destination)+1}. Your ship remains at berth ${station.parkedPod+1}.`);
  });
  nav.stationAction=()=>{
    const interaction=station.interaction(nav);if(!interaction)return false;
    if(interaction.kind==='cargo')openCargo();
    else if(interaction.kind==='shop')shopUI.open(interaction.shopId);
    else if(interaction.kind==='door'){
      // Closing is only available from outside the doorway; never crush a walker.
      const p=station.toLocal(nav.position,new THREE.Vector3());
      if(Math.abs(p.z-station.lift.z)<.5){nav.notify('Step clear of the elevator doorway.');return true;}
      station.lift.open=!station.lift.open;
    }else if(interaction.kind==='travel')openDestinations();
    else nav.notify(interaction.label);
    return true;
  };
  return {dialog};
}
