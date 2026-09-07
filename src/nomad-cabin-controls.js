import {SHIPS} from './fleet.js';
import {secondaryTouchButtons} from './secondary-touch-buttons.js';
import './nomad-cabin-controls.css';

/** Touch access to the same physical cabin actions as F / controller X. */
export function createNomadCabinControls(nav) {
  const root = document.createElement('aside');root.id = 'nomad-cabin-controls';root.hidden = true;
  root.setAttribute('aria-label', 'Nomad cabin controls');
  root.innerHTML = '<div class="nomad-walk-pad"><button type="button" data-cabin-key="KeyW" aria-label="Walk forward">↑</button><button type="button" data-cabin-key="KeyA" aria-label="Walk left">←</button><button type="button" data-cabin-key="KeyS" aria-label="Walk backward">↓</button><button type="button" data-cabin-key="KeyD" aria-label="Walk right">→</button></div><div class="medium-flight-pad" hidden><button type="button" data-cabin-key="Space" aria-label="Ascend">UP</button><button type="button" data-cabin-key="KeyX" aria-label="Brake">BRAKE</button><button type="button" data-cabin-key="KeyC" aria-label="Descend">DOWN</button></div><button type="button" data-cabin-land hidden>Launch</button><button type="button" data-cabin-interact>Leave seat</button><button type="button" data-cabin-menu>Commands</button><small>Drag the view to look</small>';
  document.body.append(root);
  const action = root.querySelector('[data-cabin-interact]'), pad = root.querySelector('.nomad-walk-pad');
  const held = new Map();let context = '';
  const release = id => { const key = held.get(id);if (key) nav.keys.delete(key);held.delete(id); };
  const cancel = () => { for (const id of held.keys()) release(id); };
  const medium = () => ['stratum','gannet'].includes(nav.shipId);
  const available = () => nav.enabled && nav.focused && !document.hidden && !document.querySelector('dialog[open]') && !nav.openingActive && !nav.travel;
  for (const button of root.querySelectorAll('[data-cabin-key]')) {
    button.addEventListener('pointerdown', event => {
      if (!available() || !(nav.mode === 'walk' || medium() && nav.mode === 'flight' && nav.powered) || nav.berthRest || nav.berthTransition) return;
      event.preventDefault();button.setPointerCapture(event.pointerId);
      nav.onTakeControl?.();nav.controllerActive = false;held.set(event.pointerId, button.dataset.cabinKey);nav.keys.add(button.dataset.cabinKey);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(type, event => release(event.pointerId));
  }
  action.addEventListener('click', () => { if (available()) { cancel();nav.onTakeControl?.();nav.controllerActive = false;nav.embark(); } });
  root.querySelector('[data-cabin-land]').addEventListener('click', () => { if (available() && medium()) { cancel();nav.onTakeControl?.();nav.controllerActive = false;nav.landOrLaunch(); } });
  root.querySelector('[data-cabin-menu]').addEventListener('click', () => { if (available()) { cancel();nav.openCommands?.(); } });
  secondaryTouchButtons(root,'[data-cabin-interact],[data-cabin-menu],[data-cabin-land]');
  window.addEventListener('blur', cancel);
  document.addEventListener('visibilitychange', cancel);
  function update() {
    const usable = (Boolean(nav.layout.berth)||Boolean(nav.freighter)) && !nav.roverOccupied && ['flight', 'landed', 'walk'].includes(nav.mode) && available();
    const next = `${nav.shipId}:${nav.mode}:${nav.powered}:${nav.berthRest}:${Boolean(nav.berthTransition)}:${usable}`;
    if (next !== context) { cancel();context = next; }
    root.hidden = !usable;root.setAttribute('aria-label',`${SHIPS[nav.shipId]?.name??'Ship'} cabin controls`);
    const walking = nav.mode === 'walk', flying = medium() && nav.mode === 'flight';
    pad.hidden = !(walking || flying) || nav.berthRest || Boolean(nav.berthTransition);
    root.querySelector('.medium-flight-pad').hidden = !flying;
    const landing = root.querySelector('[data-cabin-land]');landing.hidden = !medium() || walking;landing.disabled = !nav.powered;
    landing.textContent = nav.mode === 'landed' ? 'Launch' : nav.autoland ? 'Cancel landing' : 'Land';
    for (const [key,label] of [['KeyW','forward'],['KeyS','backward'],['KeyA','left'],['KeyD','right']])
      pad.querySelector(`[data-cabin-key="${key}"]`).setAttribute('aria-label',`${walking?'Walk':'Thrust'} ${label}`);
    const hit = walking && nav.vehicle?.interaction?'rover':walking && nav.shipPosition ? nav.shipInteraction(nav.toShipLocal()) : null;
    const secured = hit === 'door' && nav.cabinFlight && !nav.spaceParked;
    action.disabled = Boolean(nav.berthTransition) || secured || (walking && !nav.berthRest && !hit);
    action.textContent = nav.berthTransition ? (nav.berthRest ? 'Settling into berth' : 'Standing up')
      : nav.berthRest ? 'Leave berth' : !walking ? 'Leave pilot seat' : hit === 'berth' ? 'Rest in berth'
        : hit === 'rover' ? 'Board Burrow' : hit?.startsWith('lift:') ? 'Use cargo lift' : hit?.startsWith('elevator:') ? 'Operate elevator' : hit?.startsWith('ramp:') ? 'Operate ramp' : hit?.startsWith('storage:') ? 'Open ore bin' : hit === 'storage' ? 'Open cargo' : secured ? 'Hatch secured in flight' : hit === 'door' ? (nav.doorOpen ? 'Close hatch' : 'Open hatch')
          : hit === 'seat' ? 'Sit at controls' : 'Approach a control';
  }
  return { update };
}
