import { shipCargoAccess, shipCargoLabel } from '../inventory/ship-access.js';
import './build.css';
import { createBuildRadial } from './radial.js';
import { PIECES } from './definitions.js';
import { routeBuildInput } from './input.js';
import { RECIPES } from '../crafting/recipes.js';
import { craft, previewCraft } from '../crafting/transactions.js';
import { itemById } from '../inventory/containers.js';

const name = id => itemById(id)?.name ?? id;
const amounts = (items, batch = 1) => Object.entries(items ?? {}).filter(([,q])=>q>0).map(([id, q]) => `${q * batch} ${itemById(id)?.unit === 'kg' ? 'kg' : '×'} ${name(id)}`).join(' · ') || 'None';
const button = (label, key, action) => {
  const el = document.createElement('button'); el.type = 'button'; el.textContent = label;
  el.dataset.controllerKey = key; el.addEventListener('click', action); return el;
};

export function createBuildUI({nav, build, store, sandbox=null, onSandbox=null, onMessage = message => nav.notify(message), onOpenStorage = () => nav.openBackpack?.()}) {
  const dialog = document.createElement('dialog'); dialog.id = 'build-dialog'; dialog.setAttribute('aria-labelledby', 'build-title');
  dialog.innerHTML = '<div class="dialog-top"><span class="build-eyebrow">FIELD CONSTRUCTION</span></div><h2 id="build-title">Build</h2><nav class="build-tabs" aria-label="Construction views"></nav><p class="build-description"></p><div class="build-content" data-controller-scroll></div><p class="build-scroll-hint" hidden>More below · Scroll or use the D-pad to browse</p><p class="build-feedback" role="status" aria-live="polite"></p>';
  const close = button('Close · B / Esc', 'build-close', () => dialog.close()); dialog.querySelector('.dialog-top').append(close);
  const content = dialog.querySelector('.build-content'), description = dialog.querySelector('.build-description'), feedback = dialog.querySelector('.build-feedback');
  const hud = document.createElement('section'); hud.id = 'build-hud'; hud.hidden = true; hud.setAttribute('aria-label', 'Construction placement');
  hud.innerHTML = '<span class="build-eyebrow">CONSTRUCTION MODE</span><strong class="build-selected"></strong><p class="build-placement" role="status"></p><p class="build-cost"></p><p class="build-ship-link"></p><p class="build-hints">A / Enter · Place once &nbsp; LT RT / Q E · Rotate<br>LB / T · Next snap &nbsp; ↑ ↓ · Height<br>B / P · Build wheel &nbsp; X / Esc · Exit &nbsp; RB / Space · Jump</p><div class="build-touch"></div>';
  const shortcut = button(sandbox?'Sandbox · Build / B':'Build · B', 'build-open', () => open()); shortcut.id = 'build-shortcut'; shortcut.hidden = true;
  document.body.append(dialog, hud, shortcut);
  let radial=null;
  dialog.controllerNavigation=ui=>tab==='pieces'?radial?.navigate(ui):null;
  let tab = 'pieces', batch = 1, claim = null, lastPreview = '', lastMaterials = '';
  function report(result) { const message = result?.message || result?.reason; if (message) { feedback.dataset.ok=String(result?.ok===true); feedback.textContent = message; onMessage(message); } return result; }
  function suspend() { nav.keys.clear(); nav.toolTrigger = 0; nav.gamepad.suspend(); }
  function cancel() { build.cancel(); suspend(); update(); }
  function place() { report(build.place()); update(); }
  function choose(id) {
    const result = build.active ? build.select(id) : build.begin(id);
    if (result?.ok === false) { report(result); return; }
    dialog.close(); suspend(); update();
  }
  function render() {
    content.replaceChildren(); feedback.textContent = '';radial=null;dialog.classList.toggle('is-radial',tab==='pieces');
    for (const el of dialog.querySelector('.build-tabs').children) el.setAttribute('aria-pressed', String(el.dataset.controllerKey === `build-tab-${tab}`));
    if (tab === 'sandbox' && sandbox) {
      description.textContent='BUILD SANDBOX · Separate saved world. Materials are drawn directly from this bank anywhere you build. Refill whenever you need more; your bases stay saved. 64 pieces per site.';
      const totals=document.createElement('dl');totals.className='build-overview';
      for(const [id,quantity]of Object.entries(sandbox.totals())){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=name(id);dd.textContent=`${quantity.toLocaleString()} kg`;totals.append(dt,dd);}
      content.append(totals,button('Refill bank · 4,608 kg','sandbox-refill',()=>{const result=sandbox.refill();render();report(result);}));
    } else if (tab === 'pieces') {
      description.textContent = 'Left stick · Point   A · Choose   B · Close. D-pad browses pieces and tabs.';
      radial=createBuildRadial({selected:build.pieceId??build.state?.pieceId??'mainframe',onChoose:choose,formatCost:amounts});
      content.append(radial.element);
      const note=document.createElement('p');note.className='build-wheel-note';note.textContent=sandbox?'Sandbox supply bank · Refill from Sandbox supplies.':'Start with a mainframe. Supplies: backpack, mainframe buffer, or ship within 50 m.';content.append(note);
      if(!sandbox&&onSandbox)content.append(button('Open supplied build sandbox','sandbox-enter',onSandbox));
    } else if (tab === 'recipes') {
      lastMaterials = JSON.stringify(store.container('pack')?.items);
      description.textContent = 'Immediate manual field batches. Ingredients and output: backpack. Each separation consumes its entire input batch. No electricity or imported materials required.';
      const batches = document.createElement('div'); batches.className = 'build-batches';
      for (const quantity of [1, 10, 'max']) { const el = button(quantity === 'max' ? 'Max' : `${quantity} batch${quantity === 1 ? '' : 'es'}`, `recipe-batch-${quantity}`, () => { batch = quantity; render(); }); el.setAttribute('aria-pressed', String(batch === quantity)); batches.append(el); }
      content.append(batches);
      for (const recipe of RECIPES) {
        let quantity = batch;
        if (batch === 'max') {
          const items = store.container('pack')?.items ?? {};
          quantity = Math.min(...Object.entries(recipe.inputs).map(([id, amount]) => Math.floor((items[id] ?? 0) / amount)));
          while (quantity > 0 && !previewCraft(store, recipe.id, {quantity}).ok) quantity--;
          quantity = Math.max(1, quantity);
        }
        const row = document.createElement('article'); row.className = 'build-recipe';
        const title = document.createElement('h3'); title.textContent = recipe.name;
        const input = document.createElement('p'); input.textContent = `Consume: ${amounts(recipe.inputs, quantity)}`;
        const output = document.createElement('p'); output.textContent = `Produce: ${amounts(recipe.outputs, quantity)}`;
        const result = previewCraft(store, recipe.id, {quantity});
        const reason = document.createElement('p'); reason.className = 'build-recipe-reason'; reason.dataset.ready = String(result.ok); reason.textContent = result.ok ? 'Ready · Output fits in backpack' : result.message;
        const action = button(`Process ${quantity} × ${recipe.name}`, `recipe-${recipe.id}`, () => { const result = craft(store, recipe.id, {quantity}); render(); report(result); });
        action.disabled = !result.ok; row.append(title, input, output, reason, action); content.append(row);
      }
    } else {
      description.textContent = 'Local owner access. This mainframe records your claim and construction supplies.';
      const info = document.createElement('dl'); info.className = 'build-overview';
      for (const [label,value] of [['Site',claim?.name || 'Mainframe'],['Body',nav.body?.name || String(claim?.body || nav.body?.id || '').replace(/^./,c=>c.toUpperCase())],['Authority','Local owner · Build and storage access'],['Boundary',`${claim?.radius || 64} m radius`],['Pieces',Array.isArray(claim?.pieces) ? claim.pieces.length : build.state?.pieceCount ?? 0]]) {
        const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = label; dd.textContent = String(value); info.append(dt,dd);
      }
      content.append(info);
      if (claim?.bufferId) {
        const supplies = document.createElement('p'), contents = amounts(store.container(claim.bufferId)?.items); supplies.textContent = `Supply buffer: ${contents === 'None' ? 'Empty' : contents}`; content.append(supplies);
        if (build.setBufferEnabled) content.append(button(claim.useBuffer ? 'Disable construction supply buffer' : 'Enable construction supply buffer', 'build-buffer-toggle', () => {
          const result = build.setBufferEnabled(claim.id, !claim.useBuffer);
          if (result?.ok) claim = {...claim, useBuffer: !claim.useBuffer};
          render(); report(result);
        }));
        content.append(button('Open mainframe supplies', 'build-supplies', () => { const id = claim.bufferId; dialog.addEventListener('close', () => onOpenStorage(id), {once: true}); dialog.close(); }));
      }
    }
  }
  function open(view = 'pieces') {
    if (nav.openingActive) return;
    if (document.querySelector('dialog[open]') && !dialog.open) return;
    if (view === 'pieces' && (nav.mode !== 'walk' || nav.insideShip)) { onMessage('Land and leave the ship to build.'); return; }
    tab = view; suspend(); nav.enabled = false; if (document.pointerLockElement) document.exitPointerLock();
    render(); if (!dialog.open) dialog.showModal(); update();
  }
  const tabs = dialog.querySelector('.build-tabs');
  for (const [id,label] of [['pieces','Pieces'],['recipes','Recipes']]) tabs.append(button(label,`build-tab-${id}`,()=>{tab=id;render();}));
  if(sandbox)tabs.append(button('Sandbox supplies','build-tab-sandbox',()=>{tab='sandbox';render();}));
  const mainframeTab = button('Mainframe','build-tab-mainframe',()=>{tab='mainframe';render();}); mainframeTab.hidden = true; tabs.append(mainframeTab);
  dialog.addEventListener('close', () => { suspend(); nav.enabled = !document.querySelector('dialog[open]'); update(); });
  const touch = hud.querySelector('.build-touch');
  for (const [label,key,action] of [['Place','place',place],['↶','rotate-left',()=>build.rotate(-1)],['↷','rotate-right',()=>build.rotate(1)],['Snap','snap',()=>build.cycleSnap()],['Height +','height-up',()=>build.adjustHeight(.25)],['Height −','height-down',()=>build.adjustHeight(-.25)],['Pieces','pieces',()=>open()],['Exit','exit',cancel]]) touch.append(button(label,`build-hud-${key}`,action));
  touch.querySelector('[data-controller-key="build-hud-rotate-left"]').setAttribute('aria-label','Rotate left');
  touch.querySelector('[data-controller-key="build-hud-rotate-right"]').setAttribute('aria-label','Rotate right');
  function update() {
    document.body.classList.toggle('building',build.active);
    shortcut.hidden = nav.openingActive || build.active || nav.mode !== 'walk' || nav.insideShip || !nav.enabled || Boolean(document.querySelector('dialog[open]'));
    hud.hidden = !build.active || dialog.open;
    if(dialog.open)dialog.querySelector('.build-scroll-hint').hidden=content.scrollHeight<=content.clientHeight+2||content.scrollTop+content.clientHeight>=content.scrollHeight-2;
    hud.querySelector('.build-ship-link').textContent = sandbox?'SANDBOX · Supplies / refill in the piece palette':shipCargoLabel(shipCargoAccess(nav));
    const preview = build.preview || {}, piece = PIECES[preview.pieceId || build.pieceId];
    const snapshot = JSON.stringify([piece?.id,preview.valid,preview.reason,preview.cost,preview.sources]);
    if (snapshot !== lastPreview) {
      lastPreview = snapshot; hud.querySelector('.build-selected').textContent = piece?.label || 'Choose a piece';
      hud.querySelector('.build-placement').textContent = preview.reason || (preview.valid ? 'Ready to place' : 'Aim at a valid site');
      hud.dataset.valid = String(Boolean(preview.valid));
      hud.querySelector('.build-cost').textContent = `${amounts(preview.cost || piece?.cost)} · ${sandbox ? 'Sandbox supply bank' : Array.isArray(preview.sources) ? preview.sources.map(id=>store.container(id)?.name ?? id).join(', ') : preview.sources || 'Backpack'}`;
    }
    const materials = JSON.stringify(store.container('pack')?.items);
    if (dialog.open && tab === 'recipes' && materials !== lastMaterials) { lastMaterials = materials; render(); }
  }
  const keydown = event => {
    if (nav.openingActive || event.repeat || !nav.enabled || !nav.focused || document.querySelector('dialog[open]') || /INPUT|TEXTAREA|SELECT/.test(event.target?.tagName)) return;
    if (!build.active) { if (event.code === 'KeyB') { event.preventDefault(); open(); } return; }
    const action = {Enter:place, KeyQ:()=>build.rotate(-1), KeyE:()=>build.rotate(1), KeyT:()=>build.cycleSnap(), ArrowUp:()=>build.adjustHeight(.25), ArrowDown:()=>build.adjustHeight(-.25), KeyP:()=>open(), Escape:cancel}[event.code];
    if (action) { event.preventDefault(); event.stopImmediatePropagation(); action(); }
  };
  document.addEventListener('keydown', keydown, true);
  return {open,openSandbox:()=>open('sandbox'),openRecipes:()=>open('recipes'),openMainframe(value){claim=value;mainframeTab.hidden=false;open('mainframe');},cancel,update,
    handleController:pad=>routeBuildInput(pad,{cancel,palette:()=>open(),place,rotate:delta=>build.rotate(delta),cycleSnap:()=>build.cycleSnap(),adjustHeight:delta=>build.adjustHeight(delta)}),
    get state(){return {open:dialog.open,tab,batch};},
    dispose(){document.removeEventListener('keydown',keydown,true);document.body.classList.remove('building');dialog.remove();hud.remove();shortcut.remove();}};
}
