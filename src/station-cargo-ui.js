import { ITEMS } from './ship-inventory.js';
import './station-interior.css';

export function createStationCargoUI(nav,inventory){
  const dialog=document.createElement('dialog');dialog.id='station-cargo-dialog';dialog.setAttribute('aria-labelledby','station-cargo-title');
  dialog.innerHTML='<button class="station-close" aria-label="Close cargo terminal">✕</button><p class="eyebrow">AEON ORBITAL / FREIGHT SERVICES</p><h2 id="station-cargo-title">Cargo transfer terminal</h2><p>Your station warehouse ↔ your docked ship. Load supplies aboard or store them ashore.</p><button class="cargo-patrol" data-controller-key="cargo-patrol">Patrol console · Security contracts</button><div class="cargo-bulk"><button data-bulk="station">Take all</button><button data-bulk="ship">Store all</button></div><p class="terminal-capacity"></p><div class="terminal-items"></div><p role="status" class="terminal-feedback"></p>';
  document.body.append(dialog);
  dialog.querySelector('.cargo-patrol').onclick=()=>{dialog.close();nav.openPatrolConsole?.();};
  function render(){
    dialog.querySelector('.terminal-capacity').textContent=`WAREHOUSE ${inventory.mass('station').toFixed(1)} / ${inventory.capacity.station} kg   •   ${nav.shipId.toUpperCase()} ${inventory.mass('ship').toFixed(1)} / ${inventory.capacity.ship} kg`;
    dialog.querySelector('.terminal-items').innerHTML=ITEMS.map(item=>`<article><div><strong>${item.name}</strong><small>${item.mass} kg · ${inventory.count('station',item.id)} in warehouse / ${inventory.count('ship',item.id)} aboard</small></div><button data-item="${item.id}" data-from="station">Load aboard</button><button data-item="${item.id}" data-from="ship">Store ashore</button></article>`).join('');
  }
  dialog.addEventListener('click',event=>{
    const button=event.target.closest('[data-from],[data-bulk]');if(!button)return;
    const from=button.dataset.from||button.dataset.bulk,to=from==='ship'?'station':'ship';
    const result=button.dataset.bulk?inventory.transferAll(from,to):inventory.transfer(button.dataset.item,from,to);
    render();dialog.querySelector('.terminal-feedback').textContent=result.message+(inventory.saved?'':' Browser storage unavailable; this transfer lasts for the session.');
  });
  dialog.querySelector('.station-close').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{nav.keys.clear();nav.enabled=true;nav.canvas.focus();});
  return ()=>{if(!nav.dockedAtStation||nav.mode!=='walk'||document.querySelector('dialog[open]'))return;nav.keys.clear();nav.velocity.set(0,0,0);nav.enabled=false;if(document.pointerLockElement)document.exitPointerLock();render();dialog.querySelector('.terminal-feedback').textContent='Take all moves everything that fits; excess items remain in the source.';dialog.showModal();};
}
