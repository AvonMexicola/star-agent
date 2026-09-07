import { SHIPS } from './fleet.js';
import { MERIDIAN } from './ship-manufacturers.js';
import './fleet.css';

export function createFleetUI(nav, fleet, selectShip) {
  const button=document.createElement('button');button.id='fleet-button';button.textContent='FLEET · U';document.body.append(button);
  const dialog=document.createElement('dialog');dialog.id='fleet-dialog';dialog.setAttribute('aria-labelledby','fleet-title');
  dialog.innerHTML=`<button class="fleet-close" aria-label="Close fleet">✕</button><div class="meridian-lockup"><img src="${MERIDIAN.emblemURL}" alt=""><div><strong>MERIDIAN</strong><span>SHIPWORKS</span></div></div><p class="eyebrow">AEON ORBITAL / SHIP REGISTRY</p><h2 id="fleet-title">Your fleet</h2><p class="fleet-progress"></p><div class="fleet-ships"></div><p class="fleet-message" role="status"></p><p class="fleet-save"></p>`;
  document.body.append(dialog);
  function render() {
    dialog.querySelector('.fleet-progress').textContent=fleet.unlocked?'Exploration milestone complete. Atlas is yours.':fleet.surfaceVisited?'Surface landing recorded. Dock at Aeon Orbital to unlock Atlas.':'Unlock Atlas: land on Aeon or Selene, then dock at Aeon Orbital. Quick transit to an approach is allowed; you must land and dock.';
    const canSelect=nav.mode==='landed'&&nav.dockedAtStation;
    dialog.querySelector('.fleet-ships').innerHTML=Object.entries(SHIPS).map(([id,ship])=>`<article><span>${ship.registry}</span><h3>${ship.name}</h3><p>${ship.description}</p><button data-ship="${id}" ${!canSelect||!fleet.allows(id)||nav.shipId===id?'disabled':''}>${nav.shipId===id?'ACTIVE SHIP':fleet.allows(id)?'BOARD '+ship.name.toUpperCase():'LOCKED'}</button></article>`).join('');
    dialog.querySelector('.fleet-message').textContent=canSelect?'Switch ships while seated on the station pad. Your supplies transfer with you; a smaller ship needs enough free capacity.':'Dock at the station and sit in the pilot seat to switch ships.';
    dialog.querySelector('.fleet-save').textContent=nav.testFlight?'Test flight · temporary session · your regular save is unchanged.':fleet.saved?'Unlock and selected ship saved in this browser.':'Browser storage unavailable. Unlock progress lasts for this session.';
  }
  function open() {
    if(document.querySelector('dialog[open]')||!nav.enabled||nav.openingActive)return;
    nav.enabled=false;nav.keys.clear();nav.velocity.set(0,0,0);
    if(document.pointerLockElement)document.exitPointerLock();render();dialog.showModal();
  }
  button.onclick=open;dialog.querySelector('.fleet-close').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{nav.keys.clear();nav.enabled=true;nav.canvas.focus();});
  dialog.addEventListener('click',async event=> {
    const id=event.target.closest('[data-ship]')?.dataset.ship;if(!id)return;
    const result=await selectShip(id);render();dialog.querySelector('.fleet-message').textContent=result;
  });
  document.addEventListener('keydown',event=>{if(event.code==='KeyU'&&!event.repeat&&nav.mode!=='eva'&&(nav.mode!=='walk'||nav.insideShip)){if(dialog.open)dialog.close();else open();}});
  return {openMenu:open,get open(){return dialog.open;}};
}
