import './controller-ui.css';

const selector = 'summary, button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex="0"]';
const visible = el => !el.closest('[hidden], [inert]') && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
const controls = dialog => [...dialog.querySelectorAll(selector)].filter(visible);

/** Every native dialog gets the same controller focus/activate/back behavior.
 * Features keep their real click handlers; this never synthesizes keyboard mining.
 */
export function createControllerUI({ nav, destinations = [], actions = [], openBackpack = () => nav.openBackpack?.(), toggleTool = () => {}, openEquipment = null, cycleEquipment = () => {}, cycleQuick = () => {}, useQuick = () => {}, openBuild = null, openRecipes = null, buildActive = () => false, handleBuild = () => {} }) {
  const menu = document.createElement('dialog');
  menu.id = 'controller-menu'; menu.setAttribute('aria-labelledby', 'controller-menu-title');
  menu.innerHTML = '<div class="controller-menu-top"><h2 id="controller-menu-title">Command menu</h2><button type="button" data-controller-close aria-label="Close command menu">×</button></div><p>D-pad / left stick · Select &nbsp; A · Confirm &nbsp; B · Back</p><div class="controller-command-list"></div>';
  document.body.append(menu);
  const list = menu.querySelector('.controller-command-list');
  let restoreOnClose = true;
  const add = (label, callback, key) => {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.dataset.controllerKey = key;
    b.addEventListener('click', () => { restoreOnClose = false; nav.enabled = true; menu.close(); callback(); }); list.append(b); return b;
  };
  add('Resume exploration', () => {}, 'resume').setAttribute('data-controller-focus', '');
  add('Backpack', openBackpack, 'backpack');
  if(openEquipment)add('Equipment',openEquipment,'equipment');
  if(openBuild)add('Build',openBuild,'build')._controllerEnabled=()=>nav.mode==='walk'&&!nav.insideShip;
  if(openRecipes)add('Field recipes',openRecipes,'recipes');
  add('Equip / holster mining laser', toggleTool, 'tool');
  for (const d of destinations) {
    const b = add(`Quick transit · ${d.label}`, d.activate, `destination-${d.id}`);
    if (d.enabled) b._controllerEnabled = d.enabled;
  }
  for(const action of actions){const button=add(action.label,action.activate,action.id);button._controllerEnabled=action.enabled;}
  add('Controls and help', () => document.getElementById('help-button')?.click(), 'help');
  menu.querySelector('[data-controller-close]').addEventListener('click', () => menu.close());
  menu.addEventListener('close', () => { nav.keys.clear(); if (restoreOnClose) nav.enabled = true; nav.gamepad.suspend(); });
  let activeDialog = null, direction = 0, repeat = 0, focusKey = null, focusIndex = 0;
  const clearFocus = () => document.querySelectorAll('[data-controller-selected]').forEach(el => el.removeAttribute('data-controller-selected'));
  function focus(el, items) {
    if (!el) return;
    clearFocus(); el.dataset.controllerSelected = ''; el.focus({ preventScroll: true }); el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    focusKey = el.dataset.controllerKey || el.id || null; focusIndex = items.indexOf(el);
  }
  function open() {
    if (!nav.enabled || document.querySelector('dialog[open]')) return;
    restoreOnClose = true; nav.keys.clear(); nav.toolTrigger = 0; nav.enabled = false;
    if (document.pointerLockElement) document.exitPointerLock();
    for (const b of list.children) if (b._controllerEnabled) b.disabled = !b._controllerEnabled();
    menu.showModal();
  }
  function update(pad, dt) {
    const dialog = [...document.querySelectorAll('dialog[open]')].at(-1);
    if (!dialog) {
      if (activeDialog) { clearFocus(); activeDialog = null; }
      if (!nav.enabled) return;
      if (pad.pressed.has(9)) open();
      else if (pad.pressed.has(8)) openBackpack();
      else if (buildActive()) handleBuild(pad);
      else if (nav.mode === 'walk' || nav.mode === 'eva') {
        if(pad.pressed.has(15))toggleTool();
        else if(pad.pressed.has(14))cycleEquipment();
        else if(pad.pressed.has(12))cycleQuick();
        else if(pad.pressed.has(13))useQuick();
      }
      return;
    }
    const items = controls(dialog);
    if (activeDialog !== dialog) {
      activeDialog = dialog; direction = 0; repeat = 0; focusKey = null;
      focus(items.find(el => el.hasAttribute('data-controller-focus')) || items[0], items);
    }
    // Inventory renders may replace nodes; keep the logical slot/action selected.
    if (!items.includes(document.activeElement)) focus(items.find(el => focusKey && (el.dataset.controllerKey || el.id) === focusKey) || items[Math.min(focusIndex, items.length - 1)], items);
    if (!pad.ui) return;
    if (pad.ui.pressed.has(1) || pad.ui.pressed.has(9)) { dialog.close(); nav.gamepad.suspend(); return; }
    const next = Math.abs(pad.ui.y) > .5 ? Math.sign(pad.ui.y) : Math.abs(pad.ui.x) > .5 ? Math.sign(pad.ui.x) : 0;
    repeat -= dt;
    if (next && (next !== direction || repeat <= 0)) {
      const index = Math.max(0, items.indexOf(document.activeElement));
      focus(items[(index + next + items.length) % items.length], items);
      repeat = next !== direction ? .36 : .13;
    }
    direction = next;
    if (pad.ui.scroll) {
      const scrollTarget=dialog.querySelector('[data-controller-scroll]')??dialog;
      scrollTarget.scrollTop += pad.ui.scroll * dt * 480;
    }
    if (pad.ui.pressed.has(0)) {
      const target = document.activeElement;
      if (items.includes(target) && target.getAttribute('aria-disabled') !== 'true') target.click();
    }
  }
  // Keyboard/mouse can resume normal native focus without a stale controller halo.
  const pointer = () => clearFocus();
  document.addEventListener('pointerdown', pointer);
  return { update, open, get openDialog() { return activeDialog?.id ?? null; }, dispose() { clearFocus(); document.removeEventListener('pointerdown', pointer); menu.remove(); } };
}
