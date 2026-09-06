import { ITEMS, CAPACITY } from './ship-inventory.js';
import './ship-inventory.css';

export function createInventoryUI(nav, ship, inventory, mining=null) {
  const dialog = document.createElement('dialog');
  dialog.id = 'cargo-dialog';
  dialog.setAttribute('aria-labelledby', 'cargo-title');
  dialog.innerHTML = `<div class="dialog-top"><span class="eyebrow">NOMAD / CARGO 01</span><button type="button" aria-label="Close ship inventory">✕</button></div>
    <h2 id="cargo-title">Ship inventory</h2><p>Expedition supplies, right where you left them. Transfer one item at a time between the ship and your backpack.</p>
    <div class="cargo-capacities"></div><div class="cargo-items"></div>
    <p class="cargo-feedback" role="status" aria-live="polite"></p><p class="cargo-save manual-note"></p>`;
  document.body.append(dialog);
  const mass = value => `${value.toLocaleString('en-US', { maximumFractionDigits: 1 })} kg`;
  function render() {
    dialog.querySelector('.cargo-capacities').innerHTML = ['ship', 'pack'].map(container =>
      `<div><span>${container === 'ship' ? 'SHIP STORAGE' : 'BACKPACK'}</span><strong>${mass(inventory.mass(container))} <small>/ ${CAPACITY[container]} kg</small></strong><meter aria-label="${container === 'ship' ? 'Ship storage mass' : 'Backpack mass'}" value="${inventory.mass(container)}" max="${CAPACITY[container]}"></meter></div>`).join('');
    if(mining){const box=dialog.querySelector('.mining-cargo');box.querySelector('p').textContent=`Pouch ${mining.mass.toFixed(2)} / 12 kg · Locker ${mining.state.ship.reduce((a,b)=>a+b,0).toFixed(2)} / 48 kg. `+['Basalt','Copper ore','Ice'].map((n,i)=>`${n}: ${mining.state.pack[i].toFixed(2)} carried / ${mining.state.ship[i].toFixed(2)} kg aboard`).join(' · ');box.querySelector('button').disabled=mining.mass===0;}
    // Preserve the focused transfer button across updates, including empty rows.
    const active = document.activeElement?.dataset;
    const focus = active?.item ? [active.item, active.from] : null;
    dialog.querySelector('.cargo-items').innerHTML = ITEMS.map(item => `<article class="cargo-item"><div><strong>${item.name}</strong><small>${item.detail} · ${mass(item.mass)} each</small></div><div class="cargo-transfer"><span>${inventory.count('ship', item.id)} aboard / ${inventory.count('pack', item.id)} carried</span><button data-item="${item.id}" data-from="ship" aria-label="Take ${item.name}" aria-disabled="${inventory.count('ship', item.id) === 0 || inventory.mass('pack') + item.mass > CAPACITY.pack}">Take →</button><button data-item="${item.id}" data-from="pack" aria-label="Stow ${item.name}" aria-disabled="${inventory.count('pack', item.id) === 0 || inventory.mass('ship') + item.mass > CAPACITY.ship}">← Stow</button></div></article>`).join('');
    if (focus) dialog.querySelector(`[data-item="${focus[0]}"][data-from="${focus[1]}"]`)?.focus();
    dialog.querySelector('.cargo-save').textContent = inventory.saved ? 'Manifest saved on this browser. Supplies can be carried and stowed; item use is not available yet.' : 'Browser storage unavailable. Transfers work for this session, but may not survive a reload.';
  }
  if(mining){
    const samples=document.createElement('section');samples.className='mining-cargo';
    samples.innerHTML='<h3>Survey samples</h3><p></p><button type="button">Stow survey pouch</button>';
    dialog.querySelector('.cargo-items').after(samples);
    samples.querySelector('button').addEventListener('click',()=>{const ok=mining.stow();render();dialog.querySelector('.cargo-feedback').textContent=ok?'Survey samples stowed aboard.':mining.warning||'Sample locker is full.';});
  }
  dialog.addEventListener('click', event => {
    const button = event.target.closest('button[data-item]');
    if (!button) return;
    const result = inventory.transfer(button.dataset.item, button.dataset.from);
    render();
    dialog.querySelector('.cargo-feedback').textContent = result.message;
  });
  dialog.querySelector('.dialog-top button').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    ship.setStorage(false);nav.keys.clear();nav.enabled = true;
    nav.canvas.focus();
  });
  nav.openInventory = () => {
    if (dialog.open) return;
    nav.enabled = false;nav.keys.clear();
    if (document.pointerLockElement) document.exitPointerLock();
    ship.setStorage(true);render();dialog.querySelector('.cargo-feedback').textContent = '';
    dialog.showModal();
  };
  return { get open() { return dialog.open; } };
}
