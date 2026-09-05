import { Vector3 } from 'three';
import { TRAVEL_TARGETS, TRAVEL, LIGHT_SPEED } from './travel-model.js';
import './system-map.css';

export function formatRange(metres) {
  const km = metres / 1000;
  return km >= 1e6 ? `${(km / 1e6).toFixed(2)} M km` : `${Math.round(km).toLocaleString('en-US')} km`;
}

/** Target selection never moves the ship. Only the explicit drive action begins
 * navigation; the native dialog pauses controls and retains keyboard focus. */
export function createSystemMap(nav, onTarget = () => {}) {
  const dialog = document.createElement('dialog');
  dialog.id = 'system-map';
  dialog.setAttribute('aria-labelledby', 'system-map-title');
  dialog.innerHTML = `
    <div class="system-map-header"><div><span class="map-eyebrow">SA–01 / NAVIGATION</span><h2 id="system-map-title">The Aeon system<span>01</span></h2></div><button id="close-system-map" aria-label="Close system map">✕ <kbd>M</kbd></button></div>
    <div class="system-map-layout">
      <div class="system-chart" aria-label="Schematic system map">
        <div class="map-grid"></div><div class="map-orbit map-orbit-outer"></div><div class="map-orbit map-orbit-inner"></div>
        <div class="map-star"><i></i><span>OUR STAR<small>25 M km from Aeon</small></span></div>
        <div class="map-route-line"></div>
        <button class="map-body map-aeon" data-travel-target="aeon"><i></i><span>AEON<small>TERRESTRIAL PLANET</small></span></button>
        <button class="map-body map-selene" data-travel-target="selene"><i></i><span>SELENE<small>AIRLESS MOON</small></span></button>
        <div class="map-chart-caption"><span>2 WORLDS TO EXPLORE</span><span>SCHEMATIC · NOT TO SCALE</span></div>
      </div>
      <section class="map-destination" aria-label="Selected destination">
        <span class="map-eyebrow">DESTINATION</span><h3 id="map-target-name">Where next?</h3><p id="map-target-description">Select a world on the map to plot an approach.</p>
        <dl><div><dt>DISTANCE</dt><dd id="map-distance">—</dd></div><div><dt>DRIVE LIMIT</dt><dd>0.9<span>c</span></dd></div><div><dt>EST. ARRIVAL</dt><dd id="map-eta">—</dd></div><div><dt>APPROACH ALTITUDE</dt><dd id="map-approach">—</dd></div></dl>
        <p id="map-route-status" role="status">Your course starts here.</p>
        <button id="map-engage" class="primary-button" disabled>ENGAGE DRIVE <span>↗</span></button>
        <p class="map-note">Automatic alignment and arrival braking. Short routes reach a lower peak speed.</p>
      </section>
    </div>
    <footer class="system-map-footer"><span><i></i> FLIGHT PAUSED WHILE MAP IS OPEN</span><span>SELECT A WORLD · <kbd>ESC</kbd> RETURN TO FLIGHT</span></footer>`;
  document.body.append(dialog);
  const button = document.querySelector('#map-button');
  let wasEnabled = true, timer, returnFocus;
  const el = id => dialog.querySelector(`#${id}`);
  function refresh() {
    const target = TRAVEL_TARGETS.find(t => t.id === nav.travelTarget);
    for (const b of dialog.querySelectorAll('[data-travel-target]')) {
      b.setAttribute('aria-pressed', String(b.dataset.travelTarget === target?.id));
      b.disabled = Boolean(nav.travel);
    }
    if (!target) return;
    const route = nav.travel ? { ok: false, reason: 'Drive paused. Close the map to resume; X aborts in flight.' } : nav.travelRoute();
    el('map-target-name').textContent = target.name;
    el('map-target-description').textContent = target.id === 'aeon' ? 'Oceans, forests and an atmosphere. Arrive above the atmosphere, then descend in normal flight.' : 'Cratered terrain and low gravity. Arrive above the moon, then fly down to land and explore.';
    el('map-distance').textContent = formatRange(route.plan?.distance ?? nav.position.distanceTo(new Vector3(...target.center)));
    el('map-eta').textContent = route.ok ? `${route.plan.duration.toFixed(1)} s` : '—';
    el('map-approach').textContent = formatRange(target.arrivalRadius - target.radius);
    el('map-route-status').textContent = route.ok ? `Route clear · peak ${(route.plan.peakSpeed / LIGHT_SPEED).toFixed(2)}c · ${TRAVEL.spoolSeconds}s spool` : route.reason;
    el('map-route-status').classList.toggle('route-blocked', !route.ok);
    el('map-engage').disabled = !route.ok || nav.mode !== 'flight' || nav.autoland || nav.stationLift;
  }
  function close() { if (dialog.open) { nav.enabled = wasEnabled; dialog.close(); } }
  function open() {
    if (dialog.open) return;
    if (document.querySelector('dialog[open]') || !nav.enabled || nav.openingActive) return;
    wasEnabled = nav.enabled; returnFocus = document.activeElement;
    if (document.pointerLockElement) document.exitPointerLock();
    nav.keys.clear(); nav.gamepad?.suspend(); nav.enabled = false;
    dialog.showModal(); refresh(); timer = setInterval(refresh, 250);
  }
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('close', () => {
    clearInterval(timer); nav.keys.clear(); nav.enabled = wasEnabled;
    returnFocus?.focus?.({ preventScroll: true });
  });
  el('close-system-map').addEventListener('click', close);
  for (const body of dialog.querySelectorAll('[data-travel-target]')) body.addEventListener('click', () => {
    if (nav.travel) return;
    nav.travelTarget = body.dataset.travelTarget;
    onTarget(TRAVEL_TARGETS.find(t => t.id === nav.travelTarget)); refresh();
  });
  el('map-engage').addEventListener('click', () => {
    close(); nav.beginTravel();
  });
  button?.addEventListener('click', () => dialog.open ? close() : open());
  document.addEventListener('keydown', event => {
    if (event.code !== 'KeyM' || event.repeat || event.ctrlKey || event.metaKey || event.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName)) return;
    event.preventDefault(); dialog.open ? close() : open();
  });
  return { openMap: open, close, refresh, get open() { return dialog.open; } };
}
