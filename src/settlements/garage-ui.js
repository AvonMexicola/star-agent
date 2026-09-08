import './garage.css';
import {garageRetrievalStatus} from './garage-policy.js';

export function createGarageUI(api, nav) {
  const dialog = document.createElement('dialog'); dialog.id = 'garage-dialog'; dialog.setAttribute('aria-labelledby', 'garage-title');
  dialog.innerHTML = `<header><div><p class="garage-label">VEHICLE SERVICES</p><h2 id="garage-title">Compound garage</h2></div><button data-controller-key="garage-close" aria-label="Close garage">✕</button></header><p class="garage-site"></p><article><p class="garage-label">MERIDIAN M-04</p><h3>BURROW</h3><p>Four-wheel mining rover · Twin cutters · 96 kg ore bin</p><dl><div><dt>Ore aboard</dt><dd data-ore>0 kg</dd></div><div><dt>Cutter charge</dt><dd data-charge>100%</dd></div></dl><p class="garage-status" role="status"></p><button class="garage-retrieve" data-controller-key="garage-retrieve" data-controller-focus>Deploy Burrow</button></article><p class="garage-instructions">Board through the port-side door. Use the outer driveway to reach the surface. One vehicle follows you between garages; ore and charge stay aboard.</p><footer>D-pad: choose · A: confirm · B: return</footer>`;
  document.body.append(dialog);
  const $ = selector => dialog.querySelector(selector);
  let site = null, busy = false, message = '', request = 0;
  const suspend = () => {nav.keys.clear(); nav.toolTrigger = 0; nav.gamepad.suspend();};
  function render() {
    const state = api.roverState(), policy = state ? garageRetrievalStatus(state) : {ok: true, message: 'Deploy Burrow in the clear vehicle bay.'};
    $('.garage-site').textContent = site?.name ?? '';
    $('[data-ore]').textContent = `${(state?.mass ?? 0).toFixed(2)} / 96 kg`;
    $('[data-charge]').textContent = `${Math.round((state?.charge ?? 1) * 100)}%`;
    $('.garage-status').textContent = message || policy.message;
    const button = $('.garage-retrieve'); button.textContent = busy ? 'Preparing vehicle…' : state?.spawned ? 'Retrieve Burrow' : 'Deploy Burrow';
    button.disabled = busy || !policy.ok || !api.atTerminal(site);
  }
  $('.garage-retrieve').onclick = async () => {
    if (busy || !site) return;
    const token = ++request; busy = true; message = 'Checking the vehicle bay…'; render();
    try {const result = await api.retrieve(site, () => dialog.open && token === request); if (token === request) message = result.message;}
    catch (error) {if (token === request) message = error.message;}
    finally {busy = false; if (dialog.open) {render(); $('.garage-retrieve:not(:disabled)')?.focus({preventScroll: true});}}
  };
  $('[data-controller-key="garage-close"]').onclick = () => dialog.close();
  dialog.addEventListener('close', () => {request++; suspend(); nav.enabled = !document.querySelector('dialog[open]'); nav.canvas.focus({preventScroll: true});});
  return {dialog,
    open(next) {if (dialog.open || document.querySelector('dialog[open]') || nav.openingActive) return false; site = next; message = ''; suspend(); nav.enabled = false; if (document.pointerLockElement) document.exitPointerLock(); render(); dialog.showModal(); return true;},
    update() {if (dialog.open) render();},
    get site() {return dialog.open ? site?.id : null;},
    dispose() {if (dialog.open) dialog.close(); dialog.remove();},
  };
}
