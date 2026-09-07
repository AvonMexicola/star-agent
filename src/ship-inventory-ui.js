import { MiningStore } from './mining/store.js';
import { CATALOG, RESOURCE_IDS, SLOTS_PER_BOX, stacksFor, itemById, itemMass, quantityLabel } from './inventory/containers.js';
import './inventory/inventory.css';
import { itemIcon } from './inventory/item-icons.js';
import { loadoutHTML } from './inventory/loadout-ui.js';

const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const icon = itemIcon;

/** Shared native-dialog renderer for a backpack and any available box container. */
export function createInventoryUI(nav, ship, inventory, mining = null, {loadout=null} = {}) {
  const store = mining ?? new MiningStore(inventory.storage);
  store.bindManifest(inventory);
  const availability = new Map();
  let view='cargo',selectedSlot='tool';
  let targetId = null, selection = null, lastState = null, savedEnabled = true, lastPaint = 0;
  const launcher = document.createElement('button');
  launcher.id = 'backpack-button'; launcher.type = 'button'; launcher.className = 'inventory-launcher';
  launcher.innerHTML = '<span class="inventory-bag-icon" aria-hidden="true">▣</span><span>Backpack<small class="backpack-count">0.00 kg minerals</small></span><kbd>I</kbd>';
  launcher.setAttribute('aria-label', 'Open backpack');
  const dialog = document.createElement('dialog');
  dialog.id = 'cargo-dialog'; dialog.setAttribute('aria-labelledby', 'cargo-title');
  dialog.innerHTML = `<header class="inventory-header"><div><span class="eyebrow">PERSONAL LOGISTICS</span><h2 id="cargo-title">Backpack & storage</h2></div><button class="inventory-close" type="button" data-controller-focus data-controller-key="inventory-close" aria-label="Close inventory">Close <kbd>Esc / B</kbd></button></header>
    <nav class="inventory-view-tabs" aria-label="Inventory views"><button data-inventory-view="cargo" data-controller-key="view-cargo">Storage</button><button data-inventory-view="equipment" data-controller-key="view-equipment">Equipment</button></nav>
    <div class="inventory-toolbar"><p>One stack per slot. More boxes give you room for more items.</p><nav class="inventory-locations" aria-label="Nearby storage"></nav></div>
    <div class="inventory-columns"></div><div class="inventory-equipment" hidden></div>
    <section class="inventory-detail" aria-label="Selected item"></section>
    <footer class="inventory-footer"><p class="cargo-feedback" role="status" aria-live="polite">Select a stack to inspect or transfer it.</p><p class="cargo-save"></p><div class="mining-cargo"><button type="button" data-action="stow" data-controller-key="stow-minerals">Stow all minerals</button></div></footer>`;
  (document.querySelector('.top-actions') || document.body).append(launcher);
  document.body.append(dialog);

  function accessible(id) {
    if (id === 'pack') return true;
    if (id === 'ship') return nav.shipId !== 'kestrel' && (nav.insideShip || nav.mode === 'landed' || nav.mode === 'flight');
    if (id === 'station') return Boolean(nav.dockedAtStation);
    return Boolean(availability.get(id)?.());
  }
  function availableIds() { return ['ship', 'station', ...availability.keys()].filter(id => accessible(id) && store.container(id)); }
  function containerHTML(id) {
    const c = store.container(id), stacks = stacksFor(c.items), limits = store.limits(id), mineralMass = RESOURCE_IDS.reduce((n, key) => n + c.items[key], 0);
    const max = id === 'pack' ? 2 : 8;
    return `<section class="inventory-container" data-container="${escape(id)}" aria-label="${escape(c.name)}"><header><div><span class="eyebrow">${escape(c.kind)}</span><h3>${escape(c.name)}</h3></div><span class="container-mass">${itemMass(c.items).toFixed(1)} <small>kg total</small></span></header><div class="container-stat"><span>${stacks.length} / ${c.boxes * SLOTS_PER_BOX} slots</span><span>${mineralMass.toFixed(2)} / ${limits.resources} kg minerals</span></div><div class="inventory-boxes">${Array.from({ length: c.boxes }, (_, box) => `<section class="inventory-box"><h4>BOX ${String(box + 1).padStart(2, '0')} <span>8 STACK SLOTS</span></h4><div class="inventory-slots">${Array.from({ length: SLOTS_PER_BOX }, (_, slot) => {
      const index = box * SLOTS_PER_BOX + slot, stack = stacks[index], item = stack && itemById(stack.item);
      return stack ? `<button type="button" class="inventory-slot${selection?.from === id && selection?.index === index ? ' selected' : ''}" data-item="${item.id}" data-from="${escape(id)}" data-slot="${index}" data-quantity="${stack.quantity}" data-controller-key="${escape(id)}-${index}" aria-label="${escape(item.name)}, ${quantityLabel(item, stack.quantity)}, ${escape(c.name)}"><span class="slot-art">${icon(item)}</span><span class="slot-name">${escape(item.name)}</span><strong>${quantityLabel(item, stack.quantity)}</strong></button>` : '<span class="inventory-slot empty" aria-label="Empty stack slot"><span>+</span></span>';
    }).join('')}</div></section>`).join('')}</div><button class="inventory-add-box" type="button" data-add-box="${escape(id)}" data-controller-key="add-box-${escape(id)}" ${c.boxes >= max || store.blocked ? 'disabled' : ''}>+ Attach empty box <small>${c.boxes} / ${max} mounts</small></button></section>`;
  }
  function renderDetail() {
    const detail = dialog.querySelector('.inventory-detail');
    if (!selection) { detail.innerHTML = '<span class="detail-placeholder">Select a stack to see what you collected.</span><span class="detail-controls">D-pad / stick · select &nbsp; A · confirm &nbsp; B · close</span>'; return; }
    const c = store.container(selection.from), item = itemById(selection.item), amount = c?.items[item.id] ?? 0;
    const to = selection.from === 'pack' ? targetId : 'pack';
    const valid = amount > 1e-7 && to && accessible(to) && accessible(selection.from);
    const stack = Math.min(item.stack, amount);
    detail.innerHTML = `<div class="detail-item">${icon(item)}<div><h3>${escape(item.name)}</h3><p>${escape(item.detail)} · ${quantityLabel(item, amount)} in ${escape(c.name)}</p></div></div><div class="detail-actions">${valid ? `<span>To ${escape(store.container(to).name)}</span><button type="button" data-transfer="one" data-controller-key="transfer-one">Transfer ${item.unit === 'kg' ? `${Math.min(1, amount).toFixed(2)} kg` : '1'}</button><button type="button" data-transfer="stack" data-controller-key="transfer-stack">Transfer stack <small>${quantityLabel(item, stack)}</small></button>` : `<span>${amount > 0 ? 'Open nearby storage to transfer this stack.' : 'This stack has been transferred.'}</span>`}</div>`;
  }
  function render() {
    if (targetId && !accessible(targetId)) { targetId = null; selection = null; }
    const activeKey = document.activeElement?.dataset.controllerKey;
    dialog.querySelector('.inventory-locations').innerHTML = `<button type="button" data-location="" data-controller-key="location-pack" aria-pressed="${!targetId}">Backpack</button>${availableIds().map(id => `<button type="button" data-location="${escape(id)}" data-controller-key="location-${escape(id)}" aria-pressed="${targetId === id}">${escape(store.container(id).name)}</button>`).join('')}`;
    dialog.querySelector('.inventory-columns').innerHTML = containerHTML('pack') + (targetId ? containerHTML(targetId) : `<section class="inventory-empty-context"><span class="eyebrow">YOUR FIELD INVENTORY</span><h3>Everything you carry.</h3><p>Mined basalt, copper and ice appear here as you collect them. Each stack occupies a box slot.</p><p>${availableIds().length ? 'Choose a nearby storage container above to move supplies and minerals.' : 'Return aboard the Nomad or dock at Aeon orbital to access storage.'}</p><div class="inventory-rules"><span>MINERALS<strong>4 kg / stack</strong></span><span>BOX CAPACITY<strong>8 stack slots</strong></span><span>BACKPACK<strong>2 box mounts</strong></span></div><p class="prototype-box-note">Empty boxes are freely attachable in this prototype. Crafting and box purchase are not implemented.</p></section>`);
    dialog.querySelector('.inventory-view-tabs').hidden=!loadout;
    for(const b of dialog.querySelectorAll('[data-inventory-view]'))b.setAttribute('aria-pressed',String(b.dataset.inventoryView===view));
    const gear=view==='equipment'&&loadout;
    dialog.classList.toggle('equipment-view',Boolean(gear));
    dialog.querySelector('#cargo-title').textContent=gear?'Equipment & loadout':'Backpack & storage';
    dialog.querySelector('.inventory-toolbar>p').textContent=gear?'Select a slot to draw, stow or assign available gear.':'One stack per slot. More boxes give you room for more items.';
    dialog.querySelector('.inventory-columns').hidden=Boolean(gear);
    dialog.querySelector('.inventory-detail').hidden=Boolean(gear);
    dialog.querySelector('.inventory-equipment').hidden=!gear;
    if(gear)dialog.querySelector('.inventory-equipment').innerHTML=loadoutHTML(loadout,selectedSlot,['pack',...availableIds()].map(id=>store.container(id)));
    renderDetail();
    dialog.querySelector('.cargo-save').textContent = store.blocked ? store.warning : store.saved ? 'Saved on this browser · cuts and cargo share one transaction' : 'Changes require browser storage.';
    const stow = dialog.querySelector('[data-action="stow"]'); stow.hidden = view==='equipment' || targetId !== 'ship'; stow.disabled = store.mass <= 1e-7 || store.blocked;
    if (activeKey) [...dialog.querySelectorAll('[data-controller-key]')].find(el => el.dataset.controllerKey === activeKey)?.focus({ preventScroll: true });
    lastState = store.state;
  }
  function feedback(result) { render(); dialog.querySelector('.cargo-feedback').textContent = result.message; }
  function openContainer(id = null) {
    if (!dialog.open && !nav.enabled) return false;
    if (id && !accessible(id)) { nav.notify?.('Approach that storage container first.'); return false; }
    if (!dialog.open && document.querySelector('dialog[open]')) return false;
    targetId = id; selection = null;
    if (!dialog.open) {
      savedEnabled = nav.enabled; nav.enabled = false; nav.keys.clear();
      if (document.pointerLockElement) document.exitPointerLock();
      render(); dialog.showModal(); dialog.querySelector('.inventory-close').focus();
    } else render();
    (typeof ship === 'function' ? ship() : ship).setStorage(targetId === 'ship');
    return true;
  }
  function openPack() { view='cargo';return openContainer(null); }
  function openEquipment(){view='equipment';return openContainer(null);}
  launcher.addEventListener('click', openPack);
  const keyHandler = event => {
    if (event.code !== 'KeyI' || event.repeat || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName)) return;
    event.preventDefault(); dialog.open ? dialog.close() : openPack();
  };
  document.addEventListener('keydown', keyHandler);
  dialog.querySelector('.inventory-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { (typeof ship === 'function' ? ship() : ship).setStorage(false); nav.keys.clear(); nav.enabled = savedEnabled; nav.gamepad.suspend(); nav.canvas.focus(); });
  dialog.addEventListener('click', event => {
    const button = event.target.closest('button'); if (!button) return;
    if(button.dataset.inventoryView){view=button.dataset.inventoryView;render();}
    else if(button.dataset.equipmentSlot){selectedSlot=button.dataset.equipmentSlot;render();}
    else if(button.dataset.loadoutAssign){const from=button.dataset.loadoutFrom;if(accessible(from))feedback(loadout.assign(selectedSlot,button.dataset.loadoutAssign,from));}
    else if(button.dataset.loadoutStow){const to=button.dataset.loadoutStow;if(accessible(to))feedback(loadout.stow(selectedSlot,to));}
    else if(button.dataset.loadoutAction==='select')feedback(loadout.select(loadout.active===selectedSlot?null:selectedSlot));
    else if(button.dataset.loadoutAction==='use')feedback(loadout.useQuick(Number(selectedSlot.slice(5))-1));
    else if (button.dataset.location !== undefined) { targetId = button.dataset.location || null; selection = null; render(); (typeof ship === 'function' ? ship() : ship).setStorage(targetId === 'ship'); }
    else if (button.dataset.item) { selection = { item: button.dataset.item, from: button.dataset.from, index: Number(button.dataset.slot) }; render(); }
    else if (button.dataset.transfer && selection) {
      const source = store.container(selection.from), item = itemById(selection.item), amount = source.items[item.id];
      const to = selection.from === 'pack' ? targetId : 'pack';
      if (!to || !accessible(to) || !accessible(selection.from)) { feedback({ message: 'This storage container is out of reach.' }); return; }
      feedback(store.transfer(item.id, selection.from, to, Math.min(amount, button.dataset.transfer === 'one' ? 1 : item.stack)));
    } else if (button.dataset.addBox) feedback(store.addBox(button.dataset.addBox));
    else if (button.dataset.action === 'stow' && accessible('ship')) feedback({ message: store.stow() ? 'Survey samples stowed aboard.' : store.warning });
  });
  nav.openInventory = () => {view='cargo';return openContainer('ship');}; nav.openBackpack = openPack;
  function update() {
    const now = performance.now(); if (now - lastPaint < 200) return; lastPaint = now;
    launcher.querySelector('.backpack-count').textContent = `${store.mass.toFixed(2)} kg minerals`;
    launcher.title = `Backpack · ${store.mass.toFixed(2)} kg collected · I / controller View`;
    launcher.hidden = document.body.classList.contains('photo-mode');
    if (dialog.open && (lastState !== store.state || targetId && !accessible(targetId))) render();
  }
  const ticker = setInterval(update, 250); update();
  return {
    get open() { return dialog.open; }, openPack, openEquipment, openContainer, update,
    get state() { return { open: dialog.open, view, target: targetId, containers: ['pack', 'ship', ...Object.keys(store.state.remote)].map(id => store.container(id)), saved: store.saved, warning: store.warning }; },
    registerContainer(definition) { const { available, ...def } = definition; if (!store.registerContainer(def)) return false; availability.set(def.id, typeof available === 'function' ? available : () => false); return true; },
    dispose() { clearInterval(ticker); document.removeEventListener('keydown', keyHandler); dialog.remove(); launcher.remove(); },
  };
}
