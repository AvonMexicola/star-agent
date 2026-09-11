import './garage.css';
import {garageRetrievalStatus, sentryRetrievalStatus} from './garage-policy.js';

export function createGarageUI(api, nav) {
  const dialog = document.createElement('dialog'); dialog.id = 'garage-dialog'; dialog.setAttribute('aria-labelledby', 'garage-title');
  dialog.innerHTML = `<header><div><p class="garage-label">VEHICLE SERVICES</p><h2 id="garage-title">Compound garage</h2></div><button data-controller-key="garage-close" aria-label="Close garage">✕</button></header><p class="garage-site"></p><div class="garage-choices" role="group" aria-label="Choose vehicle"><button data-vehicle="burrow" data-controller-key="garage-burrow" aria-pressed="true">Burrow · Mining</button><button data-vehicle="sentry" data-controller-key="garage-sentry" aria-pressed="false">Burrow Sentry · Lasers</button></div><article><p class="garage-label" data-model></p><h3 data-name></h3><p data-description></p><dl><div><dt data-condition-label></dt><dd data-condition></dd></div><div><dt data-charge-label></dt><dd data-charge></dd></div></dl><p class="garage-status" role="status"></p><button class="garage-retrieve" data-controller-key="garage-retrieve" data-controller-focus></button></article><p class="garage-instructions">Board the pilot at the port-side door; the Sentry gunner uses the aft ladder. Drive down the outer ramp. Move a parked rover out of the shared bay before deploying the other. Retrieval keeps each vehicle’s cargo and condition.</p><footer>D-pad: choose · A: confirm · B: return</footer>`;
  document.body.append(dialog);
  const $ = selector => dialog.querySelector(selector);
  let site = null, kind = 'burrow', busy = false, message = '', request = 0;
  const suspend = () => {nav.keys.clear(); nav.toolTrigger = 0; nav.gamepad.suspend();};
  function render() {
    const sentry = kind === 'sentry', state = sentry ? api.sentryState() : api.roverState();
    const policy = sentry ? sentryRetrievalStatus(state) : state ? garageRetrievalStatus(state) : {ok: true, message: 'Deploy Burrow in the clear vehicle bay.'};
    $('.garage-site').textContent = site?.name ?? '';
    $('[data-model]').textContent = sentry ? 'MERIDIAN S-04' : 'MERIDIAN M-04';
    $('[data-name]').textContent = sentry ? 'BURROW SENTRY' : 'BURROW';
    $('[data-description]').textContent = sentry ? 'Two crew seats · Twin lasers · Gunner control with pilot fallback' : 'Four-wheel mining rover · Twin cutters · 96 kg ore bin';
    $('[data-condition-label]').textContent = sentry ? 'Hull condition' : 'Ore aboard';
    $('[data-condition]').textContent = sentry ? `${Math.round(state?.health ?? 180)} / 180` : `${(state?.mass ?? 0).toFixed(2)} / 96 kg`;
    $('[data-charge-label]').textContent = sentry ? 'Laser charge' : 'Cutter charge';
    $('[data-charge]').textContent = `${Math.round((state?.charge ?? 1) * 100)}%`;
    $('.garage-status').textContent = message || policy.message;
    const button = $('.garage-retrieve'), spawned = sentry ? Boolean(state) : state?.spawned;
    button.textContent = busy ? 'Preparing vehicle…' : `${spawned ? 'Retrieve' : 'Deploy'} ${sentry ? 'Burrow Sentry' : 'Burrow'}`;
    button.disabled = busy || !policy.ok || !api.atTerminal(site);
    for (const choice of dialog.querySelectorAll('[data-vehicle]')) {choice.setAttribute('aria-pressed', String(choice.dataset.vehicle === kind)); choice.disabled = busy;}
  }
  for (const choice of dialog.querySelectorAll('[data-vehicle]')) choice.onclick = () => {
    if (busy) return; kind = choice.dataset.vehicle; message = ''; suspend(); render();
  };
  $('.garage-retrieve').onclick = async () => {
    if (busy || !site) return;
    const token = ++request; busy = true; message = 'Checking the vehicle bay…'; suspend(); render();
    try {const result = await api.retrieve(site, kind, () => dialog.open && token === request); if (token === request) message = result.message;}
    catch (error) {if (token === request) message = error.message;}
    finally {busy = false; suspend(); if (dialog.open) {render(); $('.garage-retrieve:not(:disabled)')?.focus({preventScroll: true});}}
  };
  $('[data-controller-key="garage-close"]').onclick = () => dialog.close();
  dialog.addEventListener('close', () => {request++; suspend(); nav.enabled = !document.querySelector('dialog[open]'); nav.canvas.focus({preventScroll: true});});
  return {dialog,
    open(next) {if (dialog.open || document.querySelector('dialog[open]') || nav.openingActive) return false; site = next; kind = 'burrow'; message = ''; suspend(); nav.enabled = false; if (document.pointerLockElement) document.exitPointerLock(); render(); dialog.showModal(); return true;},
    update() {if (dialog.open) render();},
    get site() {return dialog.open ? site?.id : null;},
    dispose() {if (dialog.open) dialog.close(); dialog.remove();},
  };
}
