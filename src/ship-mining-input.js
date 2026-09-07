import {MATERIAL_IDS} from './inventory/containers.js';
import {secondaryTouchButtons} from './secondary-touch-buttons.js';
import './ship-mining.css';

const labels = {
  ready:'Aim the ship at a deposit within 40 m.', cutting:'Twin cutters active.',
  'release-required':'Release the trigger to arm the cutters.', depleted:'Cutter charge depleted. Release to recharge.',
  'power-off':'Enable main power to mine.', 'ramp-open':'Close the boarding ramp before mining.',
  'ore-bin-unavailable':'Ore bin full or save unavailable. Unload or restore storage.',
  'navigation-busy':'Finish the current flight maneuver before mining.',
  'offline-only':'Ship mining is available in solo play.', 'asset-not-ready':'Preparing mining heads.',
};

/** Shares the existing controller sample. All firing sources pass the same
 * cockpit, power, focus and fresh-neutral gate in the mining adapter. */
export function createShipMiningInput({nav, canvas, mining, cutter, inventoryUI}) {
  let key = false, pointer = false, touch = false, pad = null;
  const panel = document.createElement('aside'); panel.id = 'ship-mining'; panel.hidden = true;
  panel.innerHTML = '<span>STRATUM / TWIN CUTTERS</span><label>CHARGE <meter min="0" max="1" value="1" aria-label="Ship cutter charge"></meter></label><strong class="ship-ore"></strong><p class="ship-mining-status" role="status"></p><button type="button" data-ship-mine>HOLD TO MINE</button><button type="button" data-ship-ore>Open ore bin</button><small>RT / T · Cutters · Aim with ship flight controls</small>';
  document.body.append(panel);
  const trigger = panel.querySelector('[data-ship-mine]');
  const clear = () => {
    key = pointer = touch = false; pad = null; cutter.clear();
    // Blur can suspend the animation loop. Publish the actual stopped cutter
    // state immediately, preserving the inventory mass in the display snapshot.
    if (nav.shipMiningState) Object.assign(nav.shipMiningState,{...cutter.state,beaming:0,reason:labels['release-required']});
  };
  const canInput = () => cutter.available && !document.querySelector('dialog[open]');
  const keydown = e => {
    if (e.code === 'KeyT' && !e.repeat && !e.target.closest('input,textarea,select,dialog') && canInput()) key = true;
  };
  const keyup = e => { if (e.code === 'KeyT') key = false; };
  const down = e => { if (e.button === 0 && nav.locked && canInput()) pointer = true; };
  const up = () => { pointer = false; };
  document.addEventListener('keydown',keydown); document.addEventListener('keyup',keyup);
  canvas.addEventListener('pointerdown',down); window.addEventListener('pointerup',up);
  window.addEventListener('blur',clear); document.addEventListener('visibilitychange',clear); document.addEventListener('pointerlockchange',clear);
  trigger.addEventListener('pointerdown',e=>{if(!canInput())return;e.preventDefault();trigger.setPointerCapture(e.pointerId);touch=true;});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])trigger.addEventListener(event,()=>{touch=false;});
  trigger.addEventListener('keydown',e=>{if(['Space','Enter'].includes(e.code)){e.preventDefault();e.stopPropagation();if(!e.repeat&&canInput())touch=true;}});
  trigger.addEventListener('keyup',e=>{if(['Space','Enter'].includes(e.code)){e.preventDefault();e.stopPropagation();touch=false;}});
  panel.querySelector('[data-ship-ore]').onclick=()=>{clear();inventoryUI.openStorage('stratum-ore');};
  const secondary = secondaryTouchButtons(panel,'[data-ship-ore]');
  return {
    controller(sample) { pad = {trigger:sample.fire > .1, armed:nav.gamepad.armed && !sample.ui}; },
    clear,
    beforeUpdate() {
      if (!canInput()) { key = pointer = touch = false; }
      const primary = key || pointer || touch, source = primary || !nav.controllerActive ? 'primary' : `controller:${nav.gamepad.id}`;
      cutter.input({trigger:primary || Boolean(pad?.trigger), armed:source === 'primary' || Boolean(pad?.armed), source});
      pad = null;
      nav.shipMiningActive = cutter.available;
    },
    update() {
      const state=cutter.state, mass=MATERIAL_IDS.reduce((n,id)=>n+(mining.store.container('stratum-ore')?.items[id]??0),0);
      const reason=labels[state.reason]??'Cutters unavailable.';
      nav.shipMiningState={...state,mass,beaming:state.active?state.beams.length:0,reason};
      panel.hidden=nav.shipId!=='stratum'||!['landed','flight'].includes(nav.mode)||Boolean(document.querySelector('dialog[open]'))||!document.body.classList.contains('player-active');
      if(panel.hidden)return;
      panel.querySelector('meter').value=state.charge;
      panel.querySelector('.ship-ore').textContent=`${mass.toFixed(2)} / 384 kg ore`;
      panel.querySelector('.ship-mining-status').textContent=reason;
      trigger.disabled=!cutter.available;trigger.textContent=state.active?'CUTTING · RELEASE TO STOP':'HOLD TO MINE';
    },
    dispose() {
      clear();secondary();panel.remove();
      document.removeEventListener('keydown',keydown);document.removeEventListener('keyup',keyup);
      canvas.removeEventListener('pointerdown',down);window.removeEventListener('pointerup',up);
      window.removeEventListener('blur',clear);document.removeEventListener('visibilitychange',clear);document.removeEventListener('pointerlockchange',clear);
    },
  };
}
