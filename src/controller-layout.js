import './controller-layout.css';

// Xbox names identify the standard browser positions; PlayStation equivalents
// are printed alongside them. The diagram uses the same native dialog router.
const shared=[['View / Share','Backpack'],['Menu / Options','Commands · weapons · targeting']];
const movement=[['LS','Move forward / reverse · strafe'],['RS','Aim / steer'],['LB / RB · L1 / R1','Roll left / right']];
const layouts={
  flight:{note:'Hold RT to fire at combat speed. Menu → Ship selects combat/cruise. Allow room to brake. Aim at a nav marker to charge; LB + RB + ↑ engages.',left:[['LT / L2','Brake · disengage drive'],...movement,['L3','Hold to boost'],['D-pad ↑ / ↓','Adjust flight speed'],['D-pad ←','System map']],right:[['RT / R2','Fire ship weapon'],['A / ✕','Rise'],['B / ○','Descend'],['X / □','Interact · enter / leave seat'],['Y / △','Land / dock / launch'],['R3','Fly-by-wire / unlocked'],...shared]},
  walk:{note:'Menu → Trade → Cargo equips the tractor. Hold RT to guide; X secures a grid. D-pad up/down adjusts distance, left aligns, right holsters.',left:[['LT / L2','Stop movement'],['LS','Walk / strafe'],['RS','Look / aim'],['L3','Hold to sprint'],['D-pad ← / →','Cycle equipment / mining tool'],['D-pad ↑ / ↓','Select quick item / use item']],right:[['RT / R2','Fire / mine / tractor'],['A / ✕','Jump'],['X / □','Interact · doors / cargo / seat'],['Y / △','Toggle suit thrusters'],...shared]},
  rover:{note:'Burrow uses the existing RT firing position for its twin mining beams. Park fully inside the Atlas lift before operating it.',left:[['LT / L2','Brake rover'],['LS','Drive forward / reverse · steer'],['RS','Aim the two cutter heads'],['LB + RB + D-pad →','Cockpit / chase camera']],right:[['RT / R2','Hold twin mining beams'],['X / □','Board / leave closed cabin'],['Y / △','Operate Atlas belly lift'],['View / Share','Rover ore bins'],['Menu / Options','Gameplay menu']]},
  eva:{note:'Release thrust to coast. Hold LT to stop drifting before returning to the open ship ramp.',left:[['LT / L2','Brake drift'],...movement,['L3','Hold to boost'],['D-pad ← / →','Cycle equipment / mining tool'],['D-pad ↑ / ↓','Select quick item / use item']],right:[['RT / R2','Fire / mine / tractor'],['A / ✕','Rise'],['B / ○','Descend'],['X / □','Interact / board'],['Y / △','Toggle suit thrusters'],...shared]},
  shortcuts:{note:'Hold both bumpers, then press a direction or Menu. Release both bumpers before rolling again.',left:[['LB + RB · L1 + R1','Hold for shortcuts'],['+ D-pad ↑','Relativistic drive · engage / abort'],['+ D-pad ↓','Landing gear'],['+ D-pad ←','Ship lights / flashlight'],['+ D-pad →','Change camera'],['+ Menu / Options','Graphics settings']],right:[['In any dialog','Release controls to begin'],['D-pad / LS','Move visible selection'],['A / ✕','Confirm'],['B / ○','Close · return to play'],['RS','Scroll'],['Menu / Options','Close dialog']]}
};
const diagram=`<svg viewBox="0 0 400 330" role="img" aria-labelledby="pad-art-title pad-art-desc">
<title id="pad-art-title">Standard controller button positions</title><desc id="pad-art-desc">Left and right triggers above the bumpers. Left stick and directional pad on the left. Y at top, X left, B right, A bottom, and right stick on the right. View and Menu between the sticks.</desc>
<g class="pad-shell"><rect x="71" y="22" width="64" height="46" rx="15"/><rect x="265" y="22" width="64" height="46" rx="15"/>
<path d="M76 69 Q100 53 145 70 L255 70 Q300 53 324 69 L362 229 Q378 310 335 300 L269 248 Q200 230 131 248 L65 300 Q22 310 38 229Z"/>
<path class="pad-inset" d="M72 100 Q104 74 147 94 Q200 115 253 94 Q296 74 328 100 L342 193 Q337 243 287 229 Q200 209 113 229 Q63 243 58 193Z"/>
<rect x="72" y="69" width="70" height="23" rx="9"/><rect x="258" y="69" width="70" height="23" rx="9"/>
<circle cx="104" cy="137" r="31"/><circle class="pad-inset" cx="104" cy="137" r="23"/>
<circle cx="249" cy="209" r="31"/><circle class="pad-inset" cx="249" cy="209" r="23"/>
<path d="M111 184 H131 V203 H150 V223 H131 V242 H111 V223 H92 V203 H111Z"/>
<rect x="164" y="123" width="23" height="19" rx="6"/><rect x="213" y="123" width="23" height="19" rx="6"/>
<circle cx="299" cy="113" r="14"/><circle cx="273" cy="139" r="14"/><circle cx="325" cy="139" r="14"/><circle cx="299" cy="165" r="14"/></g>
<g class="pad-letter"><text x="103" y="50">LT</text><text class="pad-fire" x="297" y="50">RT</text><text x="107" y="85">LB</text><text x="293" y="85">RB</text><text x="104" y="142">LS</text><text x="249" y="214">RS</text><text class="pad-y" x="299" y="118">Y</text><text x="273" y="144">X</text><text class="pad-b" x="325" y="144">B</text><text class="pad-fire" x="299" y="170">A</text><text x="175" y="137">▣</text><text x="225" y="137">≡</text><text x="121" y="218">+</text></g>
<g class="pad-guides"><path d="M71 44H15 M329 44H385 M58 137H15 M342 139H385"/><circle cx="15" cy="44" r="3"/><circle cx="385" cy="44" r="3"/></g>
</svg>`;

export function createControllerLayout({nav}){
  const dialog=document.createElement('dialog');dialog.id='controller-layout';dialog.setAttribute('aria-labelledby','controller-layout-title');
  dialog.innerHTML=`<header><div><h2 id="controller-layout-title">Controller layout</h2><p>Xbox / PlayStation · Standard mapping</p></div><button type="button" data-controller-key="layout-close" aria-label="Close controller layout">×</button></header><nav aria-label="Control context">${Object.entries({flight:'Flight',walk:'On foot',rover:'Burrow',eva:'EVA',shortcuts:'Shortcuts & menus'}).map(([id,label])=>`<button type="button" data-layout="${id}" data-controller-key="layout-${id}">${label}</button>`).join('')}</nav><p class="layout-note"></p><div class="layout-board"><dl class="layout-left"></dl><div class="layout-art">${diagram}<p>Press either stick for L3 / R3</p></div><dl class="layout-right"></dl></div><footer>D-pad / LS selects · A / ✕ confirms · B / ○ returns · RS scrolls</footer>`;
  document.body.append(dialog);
  function select(id){
    const layout=layouts[id];dialog.dataset.context=id;
    for(const button of dialog.querySelectorAll('[data-layout]'))button.setAttribute('aria-pressed',String(button.dataset.layout===id));
    dialog.querySelector('.layout-note').textContent=layout.note;
    for(const side of ['left','right'])dialog.querySelector(`.layout-${side}`).innerHTML=layout[side].map(([key,action])=>`<div><dt>${key}</dt><dd>${action}</dd></div>`).join('');
  }
  dialog.querySelector('[data-controller-key="layout-close"]').onclick=()=>dialog.close();
  for(const button of dialog.querySelectorAll('[data-layout]'))button.onclick=()=>select(button.dataset.layout);
  dialog.addEventListener('close',()=>{nav.keys.clear();nav.gamepad.suspend();nav.enabled=!document.querySelector('dialog[open]');if(nav.enabled)document.getElementById('viewport')?.focus({preventScroll:true});});
  return {open(){
    if(!nav.enabled||document.querySelector('dialog[open]'))return;
    select(nav.roverOccupied?'rover':nav.mode==='eva'?'eva':nav.mode==='walk'?'walk':'flight');
    for(const b of dialog.querySelectorAll('[data-layout]'))b.toggleAttribute('data-controller-focus',b.dataset.layout===dialog.dataset.context);
    nav.keys.clear();nav.toolTrigger=0;nav.gamepad.suspend();nav.enabled=false;
    if(document.pointerLockElement)document.exitPointerLock();
    dialog.showModal();dialog.querySelector('[data-controller-focus]').focus();
  }};
}
