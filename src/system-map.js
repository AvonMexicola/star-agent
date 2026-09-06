import { Vector3 } from 'three';
import { TRAVEL_TARGETS, TRAVEL, LIGHT_SPEED } from './travel-model.js';
import { SUN_DIRECTION, SUN_DISTANCE } from './world.js';
import { createMapProjection } from './map-projection.js';
import './system-map.css';

export function formatRange(metres) {
  const km = metres / 1000;
  return km >= 1e6 ? `${(km / 1e6).toFixed(2)} M km` : `${Math.round(km).toLocaleString('en-US')} km`;
}
export const travelPhaseLabel = phase => ({ spooling: 'ALIGNING / SPOOLING', accelerating: 'ACCELERATING', cruising: 'CRUISING', decelerating: 'ARRIVAL BRAKING', cooldown: 'DRIVE COOLDOWN', done: 'ARRIVED' })[phase] ?? 'STANDBY';

/** Selection only plots a course. Flight and rendering are held by the modal. */
export function createSystemMap(nav, onTarget = () => {}) {
  const dialog = document.createElement('dialog');
  dialog.id = 'system-map';
  dialog.setAttribute('aria-labelledby', 'system-map-title');
  dialog.innerHTML = `
    <div class="dialog-top system-map-header"><div><span class="eyebrow">NAVIGATION / LOCAL SYSTEM</span><h2 id="system-map-title">Aeon <span>/ Selene / Pyre</span></h2></div><button id="close-system-map" aria-label="Close system map">✕ <kbd>M</kbd></button></div>
    <div class="system-map-layout">
      <section class="map-chart-panel" aria-label="Aeon, Selene and Pyre navigation chart">
        <div class="map-chart-top"><span class="eyebrow">LOCAL WORLDS</span><span id="map-star-distance"></span></div>
        <div class="system-chart">
          <svg id="map-chart" role="img" aria-label="Projected body positions, ship and plotted route"><defs id="map-defs"></defs><g id="map-zones"></g><g id="map-marker-leaders"></g><path id="map-full-route"/><path id="map-route"/><path id="map-arrival-leader"/><path id="map-arrival" d="M-3,-4 L3,0 L-3,4 Z"/><g id="map-ship"><path d="M0,-8 L6,6 L0,3 L-6,6 Z"/><path class="map-crosshair" d="M-14,0 H-9 M9,0 H14 M0,-16 V-11 M0,10 V15"/></g></svg>
          ${TRAVEL_TARGETS.map(t => `<button class="map-body" data-travel-target="${t.id}" aria-label="Select ${t.name}"><i></i><span>${t.name.toUpperCase()}<small>${t.airless ? 'MOON' : 'PLANET'}</small></span></button>`).join('')}
          <span id="map-ship-label">YOU <small>SHIP POSITION</small></span>
          <span id="map-arrival-label">APPROACH</span>
        </div>
        <div class="map-chart-tools"><div id="map-scale"><i></i><span></span></div><div class="map-zoom" aria-label="Chart zoom"><button id="map-zoom-out" aria-label="Zoom out">−</button><button id="map-fit">FIT</button><button id="map-zoom-in" aria-label="Zoom in on selected world">+</button></div></div>
        <div class="map-legend"><span><i class="legend-ship">△</i> Ship</span><span><i class="legend-route"></i> Course</span><span><i class="legend-zone"></i> Drive exclusion</span></div>
        <p class="map-projection-note">Aeon–Selene plane · true positions and scale · small body markers enlarged and separated for selection; leader lines show their true positions. Exclusion: ${TRAVEL_TARGETS.map(t => `${t.name} ${formatRange(t.exclusionRadius - t.radius)}`).join(' / ')} above the surface. <span id="map-depth"></span></p>
      </section>
      <section class="map-destination" aria-label="Selected destination">
        <span class="eyebrow">PLOTTED DESTINATION</span><h3 id="map-target-name">Where next?</h3><p id="map-target-description">Select a world on the map to plot an approach.</p>
        <dl><div class="map-range"><dt id="map-distance-label">TO APPROACH</dt><dd id="map-distance">—</dd></div><div><dt id="map-eta-label">EST. DURATION</dt><dd id="map-eta">—</dd></div><div><dt>APPROACH ALTITUDE</dt><dd id="map-approach">—</dd></div><div><dt>DRIVE LIMIT</dt><dd>0.9 c</dd></div></dl>
        <div id="map-drive" class="inactive" aria-hidden="true"><div><span id="map-phase"></span><span id="map-percent"></span></div><progress id="map-progress" max="1" value="0" aria-label="Travel distance completed"></progress></div>
        <p id="map-route-status" role="status">Your course starts here.</p>
        <button id="map-engage" class="primary-button" disabled>ENGAGE DRIVE <span>↗</span></button>
        <p class="map-note">Automatic alignment and arrival braking. Short routes reach a lower peak speed.</p>
      </section>
    </div>
    <footer class="system-map-footer"><button id="map-return"><span id="map-hold-status">FLIGHT HELD</span><span>RETURN ↗</span></button><span><kbd>M / ESC</kbd> CLOSE · D-PAD / STICK SELECT · A CONFIRM · B CLOSE</span></footer>`;
  document.body.append(dialog);
  let wasEnabled = true, timer, returnFocus, zoom = 1, targetZoom = 1, zoomFrame, animatedFocus = null, chartCenter, fitCenter, stickDirection = 0;
  const el = id => dialog.querySelector(`#${id}`);
  const buttons = [...dialog.querySelectorAll('[data-travel-target]')];
  const sun = new Vector3(...SUN_DIRECTION).multiplyScalar(SUN_DISTANCE);
  const point = p => `${p.x},${p.y}`;
  function drawChart(target, plan, endpoint, settled = false) {
    const chart = dialog.querySelector('.system-chart');
    const width = chart.clientWidth, height = chart.clientHeight;
    if (!width || !height) return;
    const options = { targets: TRAVEL_TARGETS, positions: [nav.position, ...(plan ? [plan.start, plan.end] : [])], width, height, padding: Math.min(80, width * .2) };
    const fit = createMapProjection(options);
    fitCenter = fit.center;
    const projection = createMapProjection({ ...options, focus: animatedFocus ?? (zoom > 1 && target ? target.center : null), zoom });
    chartCenter = projection.center;
    const { project, metersPerPixel } = projection;
    const ship = project(nav.position), arrival = endpoint && project(endpoint);
    el('map-chart').setAttribute('viewBox', `0 0 ${width} ${height}`);
    el('map-defs').innerHTML = TRAVEL_TARGETS.map(t => {
      const p = project(t.center), light = project(sun), dx = light.x - p.x, dy = light.y - p.y, length = Math.hypot(dx, dy) || 1;
      return `<radialGradient id="map-light-${t.id}" cx="${50 + dx / length * 32}%" cy="${50 + dy / length * 32}%" r="75%"><stop class="map-lit" offset="0"/><stop class="map-mid" offset=".5"/><stop class="map-dark" offset="1"/></radialGradient>`;
    }).join('');
    chart.style.backgroundSize = `${fit.scaleBar.metres / metersPerPixel}px ${fit.scaleBar.metres / metersPerPixel}px`;
    const gridOrigin = project(TRAVEL_TARGETS[0].center);
    chart.style.backgroundPosition = `${gridOrigin.x}px ${gridOrigin.y}px`;
    el('map-zones').innerHTML = TRAVEL_TARGETS.map(t => {
      const p = project(t.center);
      return `<circle class="map-exclusion" cx="${p.x}" cy="${p.y}" r="${t.exclusionRadius / metersPerPixel}"/><circle class="map-surface ${t.id === target?.id ? 'selected' : ''}" fill="url(#map-light-${t.id})" cx="${p.x}" cy="${p.y}" r="${t.radius / metersPerPixel}"/>`;
    }).join('');
    const placed=[],leaders=[];
    buttons.forEach((button, i) => {
      const t = TRAVEL_TARGETS[i], p = project(t.center);
      button.hidden = p.x < -22 || p.x > width + 22 || p.y < -22 || p.y > height + 22;
      let x=p.x,y=p.y;
      // A system-wide fit compresses Aeon and Selene below touch-target size.
      // Move only their selection markers; real body circles and routes stay put.
      for(const q of placed)if(Math.abs(x-q.x)<64&&Math.abs(y-q.y)<52){
        const right=q.x+76,left=q.x-76;
        if(right<width-26)x=right;else if(left>26)x=left;else y=Math.min(height-65,q.y+76);
      }
      if(!button.hidden)placed.push({x,y});
      if(Math.hypot(x-p.x,y-p.y)>1)leaders.push(`<path d="M${point(p)} L${x},${y}"/>`);
      button.style.left = `${x}px`; button.style.top = `${y}px`;
      button.classList.toggle('marker-enlarged', t.radius * 2 / metersPerPixel < 8);
      button.style.setProperty('--label-offset', `${Math.max(36, t.radius / metersPerPixel + 12)}px`);
    });
    el('map-marker-leaders').innerHTML=leaders.join('');
    const heading = nav.travel?.plan.direction ?? new Vector3(0, 0, -1).applyQuaternion(nav.orientation);
    const ahead = project(nav.position.clone().addScaledVector(heading, 100000));
    const headingAngle = Math.atan2(ahead.y - ship.y, ahead.x - ship.x) * 180 / Math.PI + 90;
    el('map-ship').setAttribute('transform', `translate(${point(ship)}) rotate(${headingAngle})`);
    el('map-ship-label').style.left = `${Math.max(8, Math.min(width - 112, ship.x + 17))}px`;
    el('map-ship-label').style.top = `${Math.max(6, Math.min(height - 36, ship.y - 36))}px`;
    el('map-ship-label').hidden = ship.x < 0 || ship.x > width || ship.y < 0 || ship.y > height;
    el('map-route').setAttribute('d', arrival ? `M${point(ship)} L${point(arrival)}` : '');
    el('map-route').classList.toggle('unavailable', !plan);
    el('map-full-route').setAttribute('d', plan ? `M${point(project(plan.start))} L${point(project(plan.end))}` : '');
    el('map-arrival').style.display = arrival ? '' : 'none';
    el('map-arrival-leader').style.display = arrival ? '' : 'none';
    el('map-arrival-label').hidden = !arrival || arrival.x < 0 || arrival.x > width || arrival.y < 0 || arrival.y > height;
    if (arrival) {
      const angle = Math.atan2(arrival.y - ship.y, arrival.x - ship.x) * 180 / Math.PI;
      el('map-arrival').setAttribute('transform', `translate(${point(arrival)}) rotate(${angle})`);
      el('map-arrival-label').style.left = `${Math.max(8, Math.min(width - 82, arrival.x - 38))}px`;
      const labelY = Math.max(8, arrival.y - 54), labelX = Math.max(8, Math.min(width - 82, arrival.x - 38));
      el('map-arrival-label').style.top = `${labelY}px`;
      el('map-arrival-leader').setAttribute('d', `M${arrival.x},${arrival.y - 7} L${labelX + 38},${labelY + 20}`);
    }
    el('map-scale').querySelector('i').style.width = `${projection.scaleBar.pixels}px`;
    el('map-scale').querySelector('span').textContent = formatRange(projection.scaleBar.metres);
    el('map-depth').textContent = `Ship offset from plane: ${formatRange(Math.abs(ship.depth))}. Grid: ${formatRange(fit.scaleBar.metres)}.`;
    el('map-zoom-out').disabled = zoom <= .5; el('map-zoom-in').disabled = zoom >= 32;
    // The scale/depth caption can wrap; settle its layout before presenting positions.
    if (!settled && chart.clientHeight !== height) drawChart(target, plan, endpoint, true);
  }
  function refresh() {
    const target = TRAVEL_TARGETS.find(t => t.id === (nav.travel?.targetId ?? nav.travelTarget));
    const state = nav.travelState;
    el('map-arrival-label').textContent = state?.aborting ? 'BRAKING STOP' : 'APPROACH';
    for (const b of buttons) {
      b.setAttribute('aria-pressed', String(b.dataset.travelTarget === target?.id));
      b.disabled = Boolean(nav.travel);
    }
    const route = nav.travel ? { ok: false, plan: nav.travel.plan } : nav.travelRoute();
    let endpoint = route.plan?.end;
    if (!endpoint && target) {
      const centre = new Vector3(...target.center), direction = nav.position.clone().sub(centre);
      if (!direction.lengthSq()) direction.set(1, 0, 0);
      endpoint = direction.normalize().multiplyScalar(target.arrivalRadius).add(centre);
    }
    el('map-star-distance').textContent = `STAR / ${formatRange(nav.position.distanceTo(sun))} · OUTSIDE VIEW`;
    el('map-hold-status').textContent = state ? 'DRIVE HELD · CLOSE TO RESUME' : 'FLIGHT HELD · CLOSE TO RESUME';
    if (!target) { drawChart(target, route.plan, endpoint); return; }
    el('map-target-name').textContent = target.name;
    el('map-target-description').textContent = target.id === 'aeon' ? 'Oceans, forests and an atmosphere. Arrive above the atmosphere, then descend in normal flight.' : target.id === 'pyre' ? 'Tidally locked and 400 °C on the day side; lava fields glow through cracked basalt on the night side. Thin CO₂ air. Arrive above the atmosphere and descend toward the terminator.' : 'Cratered terrain and low gravity. Arrive above the moon, then fly down to land and explore.';
    el('map-distance-label').textContent = state?.aborting ? 'TO BRAKING STOP' : state ? 'REMAINING TO APPROACH' : 'TO APPROACH';
    el('map-distance').textContent = formatRange(state?.remaining ?? route.plan?.distance ?? nav.position.distanceTo(endpoint));
    el('map-eta-label').textContent = state ? 'TIME REMAINING' : 'EST. DURATION';
    el('map-eta').textContent = state || route.ok ? `${(state?.eta ?? route.plan.duration).toFixed(1)} s` : '—';
    el('map-approach').textContent = formatRange(target.arrivalRadius - target.radius);
    let reason = route.reason;
    const exclusion = TRAVEL_TARGETS.find(t => nav.position.distanceTo(new Vector3(...t.center)) < t.exclusionRadius);
    if (!route.ok && !state && exclusion && nav.mode === 'flight' && !nav.autoland && !nav.stationLift) reason = `Inside ${exclusion.name}'s exclusion zone. Climb above ${formatRange(exclusion.exclusionRadius - exclusion.radius)} altitude to engage.`;
    el('map-route-status').textContent = state ? `${state.aborting ? 'Abort braking' : travelPhaseLabel(state.phase)} held. Close to resume; X / B brakes in flight.` : route.ok ? `Route clear · peak ${(route.plan.peakSpeed / LIGHT_SPEED).toFixed(2)}c · ${TRAVEL.spoolSeconds}s spool` : reason;
    el('map-route-status').classList.toggle('route-blocked', !route.ok && !state);
    el('map-engage').disabled = !route.ok || nav.mode !== 'flight' || nav.autoland || nav.stationLift;
    el('map-drive').classList.toggle('inactive', !state);
    el('map-drive').setAttribute('aria-hidden', String(!state));
    if (state) {
      el('map-phase').textContent = state.aborting ? 'ABORT BRAKING' : travelPhaseLabel(state.phase);
      el('map-percent').textContent = `${Math.round(state.progress * 100)}%`;
      el('map-progress').value = state.progress;
    }
    drawChart(target, route.plan, endpoint);
  }
  function close() { if (dialog.open) { nav.enabled = wasEnabled; dialog.close(); } }
  function open() {
    if (dialog.open || document.querySelector('dialog[open]') || !nav.enabled || nav.openingActive) return;
    wasEnabled = nav.enabled; returnFocus = document.activeElement; stickDirection = 0;
    if (document.pointerLockElement) document.exitPointerLock();
    nav.keys.clear(); nav.gamepad?.suspend(); nav.enabled = false;
    dialog.showModal(); refresh(); timer = setInterval(refresh, 250);
  }
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  dialog.addEventListener('close', () => {
    clearInterval(timer); cancelAnimationFrame(zoomFrame); zoom = targetZoom; animatedFocus = null; nav.keys.clear(); nav.gamepad?.suspend(); nav.enabled = wasEnabled;
    returnFocus?.focus?.({ preventScroll: true });
  });
  // Only dismiss an actual backdrop press, not a drag that started in the chart.
  let backdropDown = false;
  const outside = event => { const r = dialog.getBoundingClientRect(); return event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom; };
  dialog.addEventListener('pointerdown', e => { backdropDown = e.target === dialog && outside(e); });
  dialog.addEventListener('click', e => { if (backdropDown && e.target === dialog && outside(e)) close(); backdropDown = false; });
  el('close-system-map').addEventListener('click', close);
  el('map-return').addEventListener('click', close);
  buttons.forEach(body => body.addEventListener('click', () => {
    if (nav.travel) return;
    nav.travelTarget = body.dataset.travelTarget;
    onTarget(TRAVEL_TARGETS.find(t => t.id === nav.travelTarget)); if (zoom > 1) zoomTo(targetZoom); else refresh();
  }));
  el('map-engage').addEventListener('click', () => { close(); nav.beginTravel(); });
  function zoomTo(value) {
    cancelAnimationFrame(zoomFrame);
    targetZoom = value;
    const target = TRAVEL_TARGETS.find(t => t.id === nav.travelTarget);
    const fromFocus = new Vector3(...chartCenter), toFocus = new Vector3(...(value > 1 && target ? target.center : fitCenter));
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { zoom = value; animatedFocus = null; refresh(); return; }
    const from = zoom, started = performance.now();
    const animate = now => {
      const t = Math.min(1, (now - started) / 180);
      const eased = 1 - (1 - t) ** 3;
      zoom = from + (value - from) * eased;
      animatedFocus = fromFocus.clone().lerp(toFocus, eased);
      if (t === 1) animatedFocus = null;
      refresh();
      if (t < 1 && dialog.open) zoomFrame = requestAnimationFrame(animate);
    };
    zoomFrame = requestAnimationFrame(animate);
  }
  el('map-zoom-in').addEventListener('click', () => zoomTo(Math.min(32, targetZoom * 2)));
  el('map-zoom-out').addEventListener('click', () => zoomTo(Math.max(.5, targetZoom / 2)));
  el('map-fit').addEventListener('click', () => zoomTo(1));
  document.addEventListener('keydown', event => {
    if (event.code !== 'KeyM' || event.repeat || event.ctrlKey || event.metaKey || event.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName)) return;
    event.preventDefault(); dialog.open ? close() : open();
  });
  function controllerInput(input) {
    if (!dialog.open || !input) return;
    if (input.pressed.has(1) || input.pressed.has(9)) { close(); return; }
    const direction = Math.abs(input.y) > .5 ? Math.sign(input.y) : Math.abs(input.x) > .5 ? Math.sign(input.x) : 0;
    const step = input.pressed.has(12) || input.pressed.has(14) ? -1 : input.pressed.has(13) || input.pressed.has(15) ? 1 : direction && direction !== stickDirection ? direction : 0;
    stickDirection = direction;
    if (step) {
      const focusable = [el('close-system-map'), ...buttons, el('map-zoom-out'), el('map-fit'), el('map-zoom-in'), el('map-engage')].filter(b => !b.disabled && !b.hidden);
      const index = focusable.indexOf(document.activeElement);
      const next = focusable[(Math.max(0, index) + step + focusable.length) % focusable.length];
      next.focus({ preventScroll: true }); next.scrollIntoView({ block: 'nearest' });
    }
    if (input.pressed.has(0)) document.activeElement?.closest('#system-map button')?.click();
  }
  return { openMap: open, close, refresh, controllerInput, get open() { return dialog.open; } };
}
