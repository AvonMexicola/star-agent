import {MAX_PIECES} from './state.js';
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
  const wheels={pieces:undefined,shapes:['foundation-triangle','wall-quarter','window-quarter','foundation-quarter','floor-quarter','floor-triangle','wall','floor'],power:['solar-array','wind-turbine','battery','uranium-generator','helium-generator','ceiling-light','mainframe','terminal'],roofs:['roof-flat','roof-edge','roof-corner','roof-triangle','roof-quarter','ceiling-light','floor','floor-triangle'],facilities:['rack','terminal','hangar-door','foundation-ramp','foundation-pad-small','foundation-pad-medium','foundation-pad-large','mainframe']};
  let radial=null;
  dialog.controllerNavigation=ui=>radial?.navigate(ui);
  dialog.controllerAction=ui=>{const direction=Number(ui.pressed.has(5))-Number(ui.pressed.has(4));if(!direction)return null;const available=[...tabs.children].filter(b=>!b.hidden),i=available.findIndex(b=>b.dataset.controllerKey===`build-tab-${tab}`),target=available[(i+direction+available.length)%available.length];target.click();nav.gamepad.suspend();return target;};
  let tab = 'pieces', batch = 1, claim = null, lastPreview = '', lastMaterials = '';
  let powerPending=false;
  async function powerAction(fn){if(powerPending)return;powerPending=true;try{const result=await fn();claim=build.claims?.find(c=>c.id===claim?.id)?{...claim,...build.claims.find(c=>c.id===claim.id)}:claim;render();report(result);}finally{powerPending=false;nav.gamepad.suspend();}}
  function report(result) { const message = result?.message || result?.reason; if (message) { feedback.dataset.ok=String(result?.ok===true); feedback.textContent = message; onMessage(message); } return result; }
  function suspend() { nav.keys.clear(); nav.toolTrigger = 0; nav.gamepad.suspend(); }
  function cancel() { build.cancel(); suspend(); update(); }
  let placing=false;async function place() {if(placing)return;placing=true;try{report(await build.place());update();}finally{placing=false;}}
  function choose(id) {
    const result = build.active ? build.select(id) : build.begin(id);
    if (result?.ok === false) { report(result); return; }
    dialog.close(); suspend(); update();
  }
  function render() {
    content.replaceChildren(); feedback.textContent = '';radial=null;dialog.classList.toggle('is-radial',Object.hasOwn(wheels,tab));
    for (const el of dialog.querySelector('.build-tabs').children) el.setAttribute('aria-pressed', String(el.dataset.controllerKey === `build-tab-${tab}`));
    if (tab === 'sandbox' && sandbox) {
      description.textContent=`BUILD SANDBOX · Separate saved world. Materials are drawn directly from this bank anywhere you build. Refill whenever you need more; your bases stay saved. ${MAX_PIECES.toLocaleString()} pieces per site.`;
      const totals=document.createElement('dl');totals.className='build-overview';
      for(const [id,quantity]of Object.entries(sandbox.totals())){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=name(id);dd.textContent=`${quantity.toLocaleString()} kg`;totals.append(dt,dd);}
      content.append(totals,button('Refill bank · 4,608 kg','sandbox-refill',()=>{const result=sandbox.refill();render();report(result);}));
    } else if (Object.hasOwn(wheels,tab)) {
      description.textContent = 'LB / RB · Switch tabs   Left stick · Point   A · Choose   B · Close.';
      radial=createBuildRadial({order:wheels[tab],selected:build.pieceId??build.state?.pieceId??'mainframe',onChoose:choose,formatCost:amounts});
      content.append(radial.element);
      if(build.beginRemoval)content.append(button('Remove tool · no material refund','build-remove-tool',()=>{const result=build.beginRemoval();if(!result.ok){report(result);return;}dialog.close();suspend();update();}));
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
      if(claim?.terminal){
        description.textContent='Inventory terminal · Access every storage container on this site while standing at the terminal.';
        for(const container of claim.containers??[])content.append(button(container.name,`terminal-${container.id}`,()=>{dialog.addEventListener('close',()=>onOpenStorage(container.id),{once:true});dialog.close();}));
      }
      if(claim?.pad){
        description.textContent=`Landing pad ${claim.pad.size} · Painted size markings and approach guides. Manual landing; keep the surface clear.`;
        content.append(button(claim.pad.enabled?'Remove landing-pad designation':'Mark as landing pad', 'pad-designate',()=>{const result=build.setLandingPad(claim.id,claim.pad.id,!claim.pad.enabled);if(result.ok)claim={...claim,pad:{...claim.pad,enabled:!claim.pad.enabled}};render();report(result);}));
      }

      if(claim?.bufferId&&build.power){
        const text=document.createElement('p');text.dataset.basePower='';content.append(text);
        description.textContent='Base upkeep draws electricity. Surplus generation charges empty batteries. Without enough power, health decays over 72 real hours; at zero the base and its storage are removed. Repair costs 5 kg metal stock for 25 health.';
        content.append(button('Load uranium · 0.1 kg','power-fuel-uranium',()=>powerAction(()=>build.power.action(claim.id,'fuel','uranium-ore'))),button('Load helium-3 feedstock · 0.1 kg','power-fuel-helium',()=>powerAction(()=>build.power.action(claim.id,'fuel','helium-3-regolith'))),button('Repair base · 5 kg metal stock','power-repair',()=>powerAction(()=>build.power.action(claim.id,'repair'))));
        if(sandbox)content.append(button('Refill sandbox reactor fuel','power-sandbox-fuel',()=>powerAction(()=>build.power.action(claim.id,'sandbox-fuel'))));
        if(!sandbox)content.append(button('Connect / restore server base save','power-cloud',()=>powerAction(()=>build.power.cloud.connect())));
        const rules=document.createElement('p');rules.textContent=sandbox?'Sandbox health decay is paused. Batteries still need generation to charge.':'Put mined fuel in mainframe supplies before loading. Solar needs sunlight and a clear sky; wind needs atmosphere. Server connection requires your signed-in account. Existing server bases are restored on connection; a local backup is retained.';content.append(rules);
      }
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
    if (nav.multiplayer?.connected) { onMessage('Construction and field recipes are available in offline testing.'); return; }
    if (view === 'pieces' && (nav.mode !== 'walk' || nav.insideShip)) { onMessage('Land and leave the ship to build.'); return; }
    tab = view==='pieces'?Object.entries(wheels).find(([key,order])=>build.pieceId!=='mainframe'&&order?.includes(build.pieceId))?.[0]??'pieces':view; suspend(); nav.enabled = false; if (document.pointerLockElement) document.exitPointerLock();
    render(); if (!dialog.open) dialog.showModal(); update();
  }
  const tabs = dialog.querySelector('.build-tabs');
  tabs.title='LB / RB · Switch tabs';
  for (const [id,label] of [['pieces','Blocks'],['shapes','Shapes'],['facilities','Facilities'],['power','Power'],['roofs','Roofs'],['recipes','Resources']]) tabs.append(button(label,`build-tab-${id}`,()=>{tab=id;render();}));
  if(sandbox)tabs.append(button('Sandbox supplies','build-tab-sandbox',()=>{tab='sandbox';render();}));
  const mainframeTab = button('Mainframe','build-tab-mainframe',()=>{tab='mainframe';render();}); mainframeTab.hidden = true; tabs.append(mainframeTab);
  dialog.addEventListener('close', () => { suspend(); nav.enabled = !document.querySelector('dialog[open]'); update(); });
  const touch = hud.querySelector('.build-touch');
  for (const [label,key,action] of [['Place','place',place],['↶','rotate-left',()=>build.rotate(-1)],['↷','rotate-right',()=>build.rotate(1)],['Snap','snap',()=>build.cycleSnap()],['Height +','height-up',()=>build.adjustHeight(.25)],['Height −','height-down',()=>build.adjustHeight(-.25)],['Pieces','pieces',()=>open()],['Exit','exit',cancel]]) touch.append(button(label,`build-hud-${key}`,action));
  touch.querySelector('[data-controller-key="build-hud-rotate-left"]').setAttribute('aria-label','Rotate left');
  touch.querySelector('[data-controller-key="build-hud-rotate-right"]').setAttribute('aria-label','Rotate right');
  function update() {
    document.body.classList.toggle('building',build.active);
    const powerText=content.querySelector('[data-base-power]'),live=build.claims?.find(c=>c.id===claim?.id);
    if(powerText&&!live)powerText.textContent='This base has expired and was removed.';
    if(powerText&&live){const s=build.power.status(live);powerText.textContent=`${s.powered?'POWERED':'UNPOWERED'} · Health ${s.health.toFixed(1)}% · Battery ${s.charge.toFixed(2)} / ${s.capacity} kWh · Renewable ${s.renewable.toFixed(2)} kW · Load ${s.demand.toFixed(2)} kW · Uranium ${(s.fuel['uranium-ore']??0).toFixed(3)} kg · He-3 ${(s.fuel['helium-3-regolith']??0).toFixed(3)} kg · ${build.power.cloud?.status??'Browser save'}`;}

    shortcut.hidden = nav.multiplayer?.connected || nav.openingActive || build.active || nav.mode !== 'walk' || nav.insideShip || !nav.enabled || Boolean(document.querySelector('dialog[open]'));
    hud.hidden = !build.active || dialog.open;
    if(dialog.open)dialog.querySelector('.build-scroll-hint').hidden=content.scrollHeight<=content.clientHeight+2||content.scrollTop+content.clientHeight>=content.scrollHeight-2;
    hud.querySelector('.build-ship-link').textContent = sandbox?'SANDBOX · Supplies / refill in the piece palette':shipCargoLabel(shipCargoAccess(nav));
    const preview = build.preview || {}, piece = PIECES[preview.pieceId || build.pieceId];
    const snapshot = JSON.stringify([build.removing,piece?.id,preview.valid,preview.reason,preview.cost,preview.sources]);
    if (snapshot !== lastPreview) {
      lastPreview = snapshot; hud.querySelector('.build-selected').textContent = build.removing?'REMOVE TOOL':piece?.label || 'Choose a piece';
      hud.querySelector('.build-placement').textContent = preview.reason || (preview.valid ? 'Ready to place' : 'Aim at a valid site');
      hud.dataset.valid = String(Boolean(preview.valid));
      hud.querySelector('.build-cost').textContent = build.removing?'Single piece only · Empty storage and remove supported equipment first':`${amounts(preview.cost || piece?.cost)} · ${sandbox ? 'Sandbox supply bank' : Array.isArray(preview.sources) ? preview.sources.map(id=>store.container(id)?.name ?? id).join(', ') : preview.sources || 'Backpack'}`;
    hud.querySelector('.build-hints').innerHTML=build.removing?'A / Enter · Remove one piece permanently<br>B / P · Build wheel · X / Esc · Exit · RB / Space · Jump':'A / Enter · Place once &nbsp; LT RT / Q E · Rotate<br>LB / T · Next snap '+(PIECES[build.pieceId]?.mount?'':'&nbsp; ↑ ↓ · Height')+'<br>B / P · Build wheel &nbsp; X / Esc · Exit &nbsp; RB / Space · Jump';
    touch.querySelector('[data-controller-key="build-hud-place"]').textContent=build.removing?'Remove':'Place';
    for(const key of ['rotate-left','rotate-right','snap','height-up','height-down'])touch.querySelector(`[data-controller-key="build-hud-${key}"]`).hidden=Boolean(build.removing||key.startsWith('height-')&&PIECES[build.pieceId]?.mount);
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
