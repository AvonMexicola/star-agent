import { ITEMS } from './ship-inventory.js';
import './ship-inventory.css';

export function createInventoryUI(nav, ship, inventory) {
  const dialog = document.createElement('dialog');
  dialog.id = 'cargo-dialog';
  dialog.setAttribute('aria-labelledby', 'cargo-title');
  dialog.innerHTML = `<div class="dialog-top"><span class="eyebrow">NOMAD / CARGO 01</span><button type="button" aria-label="Close ship inventory">✕</button></div>
    <h2 id="cargo-title">Ship inventory</h2><p>Expedition supplies, right where you left them. Transfer individual items or everything that fits between the ship and your backpack.</p>
    <div class="cargo-bulk"><button data-bulk="ship">Take all</button><button data-bulk="pack">Stow all</button></div><div class="cargo-capacities"></div><div class="cargo-items"></div>
    <p class="cargo-feedback" role="status" aria-live="polite"></p><p class="cargo-save manual-note"></p>`;
  document.body.append(dialog);
  const mass = value => `${value.toLocaleString('en-US', { maximumFractionDigits: 1 })} kg`;
  function render() {
    dialog.querySelector('.eyebrow').textContent=`${(nav.shipId||'nomad').toUpperCase()} / CARGO 01`;
    dialog.querySelector('.cargo-capacities').innerHTML = ['ship', 'pack'].map(container =>
      `<div><span>${container === 'ship' ? 'SHIP STORAGE' : 'BACKPACK'}</span><strong>${mass(inventory.mass(container))} <small>/ ${inventory.capacity[container]} kg</small></strong><meter aria-label="${container === 'ship' ? 'Ship storage mass' : 'Backpack mass'}" value="${inventory.mass(container)}" max="${inventory.capacity[container]}"></meter></div>`).join('');
    // Preserve the focused transfer button across updates, including empty rows.
    const active = document.activeElement?.dataset;
    const focus = active?.item ? [active.item, active.from] : null;
    dialog.querySelector('.cargo-items').innerHTML = ITEMS.map(item => `<article class="cargo-item"><div><strong>${item.name}</strong><small>${item.detail} · ${mass(item.mass)} each</small></div><div class="cargo-transfer"><span>${inventory.count('ship', item.id)} aboard / ${inventory.count('pack', item.id)} carried</span><button data-item="${item.id}" data-from="ship" aria-label="Take ${item.name}" aria-disabled="${inventory.count('ship', item.id) === 0 || inventory.mass('pack') + item.mass > inventory.capacity.pack}">Take →</button><button data-item="${item.id}" data-from="pack" aria-label="Stow ${item.name}" aria-disabled="${inventory.count('pack', item.id) === 0 || inventory.mass('ship') + item.mass > inventory.capacity.ship}">← Stow</button></div></article>`).join('');
    if (focus) dialog.querySelector(`[data-item="${focus[0]}"][data-from="${focus[1]}"]`)?.focus();
    dialog.querySelector('.cargo-save').textContent = inventory.saved ? 'Manifest saved on this browser. Supplies can be carried and stowed; item use is not available yet.' : 'Browser storage unavailable. Transfers work for this session, but may not survive a reload.';
  }
  dialog.addEventListener('click', event => {
    const bulk=event.target.closest('[data-bulk]');
    if(bulk){const result=inventory.transferAll(bulk.dataset.bulk);render();dialog.querySelector('.cargo-feedback').textContent=result.message;return;}
    const button = event.target.closest('button[data-item]');
    if (!button) return;
    const result = inventory.transfer(button.dataset.item, button.dataset.from);
    render();
    dialog.querySelector('.cargo-feedback').textContent = result.message;
  });
  dialog.querySelector('.dialog-top button').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    (typeof ship === 'function' ? ship() : ship).setStorage(false);nav.keys.clear();nav.enabled = true;
    nav.canvas.focus();
  });
  nav.openInventory = () => {
    if (dialog.open) return;
    nav.enabled = false;nav.keys.clear();
    if (document.pointerLockElement) document.exitPointerLock();
    (typeof ship === 'function' ? ship() : ship).setStorage(true);render();dialog.querySelector('.cargo-feedback').textContent = '';
    dialog.showModal();
  };
  return { get open() { return dialog.open; } };
}
