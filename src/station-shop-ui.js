import { ITEMS } from './ship-inventory.js';
import { STATION_SHOPS, STARTER_CREDITS, purchaseStationItem } from './station-shop.js';
import './station-shop.css';

export function createStationShopUI(nav, inventory) {
  const dialog = document.createElement('dialog');
  dialog.id = 'station-shop-dialog';
  dialog.setAttribute('aria-labelledby', 'station-shop-title');
  dialog.innerHTML = `<div class="dialog-top"><span class="eyebrow">AEON ORBITAL / CONCOURSE</span><button type="button" aria-label="Close shop">✕</button></div>
    <h2 id="station-shop-title"></h2><p class="shop-description"></p>
    <div class="shop-account"><div><span>AVAILABLE CREDIT</span><strong class="shop-balance"></strong></div><div><span>DELIVERY / STATION WAREHOUSE</span><strong class="shop-capacity"></strong></div></div>
    <p class="shop-delivery">Purchases go to your station warehouse. Use the cargo transfer terminal in your ship’s berth to load them aboard.</p>
    <div class="shop-items"></div><p class="shop-feedback" role="status" aria-live="polite"></p>
    <p class="manual-note shop-policy"></p><p class="shop-controls">Controller: D-pad or left stick to choose · A to confirm · B / Menu to close</p>`;
  document.body.append(dialog);
  let activeShop = null;
  const number = value => value.toLocaleString('en-US', { maximumFractionDigits: 1 });
  function render() {
    const shop = STATION_SHOPS[activeShop];
    dialog.dataset.shop = activeShop;
    dialog.querySelector('.dialog-top .eyebrow').textContent = shop.category;
    dialog.querySelector('#station-shop-title').textContent = shop.name;
    dialog.querySelector('.shop-description').textContent = shop.detail;
    dialog.querySelector('.shop-balance').textContent = `${number(inventory.credits)} CR`;
    dialog.querySelector('.shop-capacity').textContent = `${number(inventory.mass('station'))} / ${number(inventory.capacity.station)} kg`;
    const focusedItem = document.activeElement?.dataset?.purchase;
    const rows = dialog.querySelector('.shop-items'); rows.replaceChildren();
    for (const offer of shop.offers) {
      const item = ITEMS.find(item => item.id === offer.itemId);
      const check = inventory.purchaseStatus(activeShop, item.id);
      const owned = ['station', 'ship', 'pack'].reduce((sum, container) => sum + inventory.count(container, item.id), 0);
      const row = document.createElement('article'); row.className = 'shop-item';
      const info = document.createElement('div');
      const title = document.createElement('h3'); title.textContent = item.name; info.append(title);
      const detail = document.createElement('p'); detail.textContent = `${item.detail} · ${number(item.mass)} kg`; info.append(detail);
      const quantity = document.createElement('p'); quantity.className = 'shop-quantity';
      quantity.textContent = `${inventory.shopStock[activeShop][item.id]} in shop · ${owned} owned (${inventory.count('station', item.id)} in warehouse)`;
      info.append(quantity);
      const buy = document.createElement('button'); buy.type = 'button'; buy.dataset.purchase = item.id;buy.dataset.controllerKey=`purchase-${item.id}`;
      buy.textContent = `Buy 1 · ${number(offer.price)} CR`;
      buy.setAttribute('aria-label', `Buy ${item.name} for ${offer.price} credits`);
      // Keep unavailable offers keyboard reachable so their explanation can be read.
      buy.setAttribute('aria-disabled', String(!check.ok));
      if (!check.ok) { const reason = document.createElement('p'); reason.className = 'shop-unavailable'; reason.textContent = check.message; info.append(reason); }
      row.append(info, buy); rows.append(row);
    }
    if (focusedItem) rows.querySelector(`[data-purchase="${focusedItem}"]`)?.focus();
    dialog.querySelector('.shop-policy').textContent = inventory.loadError ||
      `One-time ${number(STARTER_CREDITS)} CR expedition allowance. Stock is finite; no resale or recurring income. ${inventory.saved ? 'Manifest saved on this browser.' : 'A purchase requires a successful browser save.'}`;
  }
  dialog.addEventListener('click', event => {
    const button = event.target.closest('[data-purchase]');
    if (!button || !activeShop) return;
    const result = purchaseStationItem(inventory, activeShop, button.dataset.purchase);
    render(); dialog.querySelector('.shop-feedback').textContent = result.message;
  });
  dialog.querySelector('.dialog-top button').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    nav.gamepad.suspend();
    nav.keys.clear(); nav.velocity.set(0, 0, 0);
    nav.enabled = !document.querySelector('dialog[open]');
    if (nav.enabled) nav.canvas.focus({ preventScroll: true });
  });
  return {
    dialog,
    open(shopId) {
      if (!Object.hasOwn(STATION_SHOPS, shopId) || document.querySelector('dialog[open]') || !nav.enabled
        || nav.mode !== 'walk' || !nav.dockedAtStation || nav.insideShip || nav.station?.location !== 'hub') return false;
      activeShop = shopId;
      nav.keys.clear(); nav.velocity.set(0, 0, 0); nav.enabled = false;
      if (document.pointerLockElement) document.exitPointerLock();
      render(); dialog.querySelector('.shop-feedback').textContent = '';
      dialog.showModal();
      // The shared dialog router owns controller focus and activation.
      nav.gamepad.suspend();
      return true;
    },
  };
}
