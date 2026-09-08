import {expect} from '@playwright/test';

export const state = page => page.evaluate(() => window.starAgent.state);
export const wait = (page, predicate, arg = null, timeout = 15000) => page.waitForFunction(predicate, arg, {timeout, polling: 50});
export const frames = (page, count = 3) => page.evaluate(async count => {
  for (let i = 0; i < count; i++) await new Promise(resolve => requestAnimationFrame(resolve));
}, count);
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const distanceXZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

export function linePath(start, end, spacing = .35) {
  const count = Math.max(1, Math.ceil(distanceXZ(start, end) / spacing));
  return Array.from({length: count + 1}, (_, i) => start.map((v, axis) => v + (end[axis] - v) * i / count));
}

export function turnPath(parkX, mineralLocal = null) {
  // Continue the physical five-metre turn until the observed deposit sits well
  // within the existing ±0.4 rad cutter arc. A half-circle alone left it outside
  // that arc in the first native run; no rover pose or aim limit is changed.
  let end = Math.PI;
  if (mineralLocal) {
    let found = false;
    for (let angle = Math.PI; angle <= Math.PI + .6; angle += .02) {
      const x = parkX - 5 + 5 * Math.cos(angle), z = 26.5 + 5 * Math.sin(angle);
      const dx = mineralLocal[0] - x, dz = mineralLocal[2] - z;
      const fx = -Math.sin(angle), fz = Math.cos(angle);
      const error = Math.abs(Math.atan2(fx * dz - fz * dx, fx * dx + fz * dz));
      if (error <= .16 && Math.hypot(dx, dz) > 4) { end = angle; found = true; break; }
    }
    if (!found) throw Error('Observed deposit needs a different physical approach');
  }
  const steps = Math.ceil(end / .045);
  return Array.from({length: steps + 1}, (_, i) => {
    const angle = end * i / steps;
    return [parkX - 5 + 5 * Math.cos(angle), 0, 26.5 + 5 * Math.sin(angle)];
  });
}

export function pathTarget(local, path, index, lookahead = 1.8) {
  let nearest = index, distance = Infinity;
  for (let j = index; j < Math.min(path.length, index + 24); j++) {
    const d = distanceXZ(local, path[j]);
    if (d < distance) { distance = d; nearest = j; }
  }
  let look = nearest;
  while (look < path.length - 1 && distanceXZ(local, path[look]) < lookahead) look++;
  return {index: nearest, look, remaining: distanceXZ(local, path.at(-1))};
}

/** Real digital inputs track signed speed and right-positive steering. The
 * production wheel angle is negative for right; reverse speed changes yaw in
 * the bicycle model, so the target's local X keeps the same steering sign.
 * No runtime state or speed is assigned by this feedback controller. */
export function drivingControls(control, targetSteer, signedSpeed, steerLimit = .52) {
  const actions = [], sign = Math.sign(signedSpeed), speed = control.speed * sign, target = Math.abs(signedSpeed);
  if (speed < target - .08) actions.push(sign < 0 ? 'reverse' : 'forward');
  else if (speed > target + .3) actions.push('brake');
  const actual = -(control.wheelSteer ?? 0), desired = clamp(targetSteer, -1, 1) * steerLimit;
  if (desired > .025 && actual < desired + .025) actions.push('right');
  if (desired < -.025 && actual > desired - .025) actions.push('left');
  return actions;
}

const keys = {
  walkForward: 'KeyW', walkBackward: 'KeyS', walkLeft: 'KeyA', walkRight: 'KeyD',
  forward: 'KeyW', reverse: 'KeyS', left: 'KeyA', right: 'KeyD', brake: 'KeyX',
  aimLeft: 'ArrowLeft', aimRight: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown', mine: 'KeyT',
  flightForward: 'KeyW', flightBackward: 'KeyS', flightLeft: 'KeyA', flightRight: 'KeyD',
  flightUp: 'Space', flightDown: 'KeyC', flightBrake: 'KeyX',
};
const tapKeys = {seat: 'KeyF', entry: 'KeyF', lift: 'KeyG', cargo: 'KeyI', close: 'KeyI', land: 'KeyB', gear: 'KeyG', camera: 'Digit4'};
const taps = {
  seat: '[data-cabin-interact]', entry: '[data-rover-action="entry"]', lift: '[data-rover-action="lift"]',
  cargo: '[data-rover-action="cargo"]', close: '#cargo-dialog .gameplay-resume',
  land: '[data-cabin-land]', commands: '[data-cabin-menu]', camera: '#camera-button',
};
const touchSelector = action => action.startsWith('walk') || action.startsWith('flight')
  ? `[data-cabin-key="${keys[action]}"]` : `[data-rover-hold="${action}"]`;

export class KeyboardInput {
  constructor(page) { this.page = page; this.keys = new Set(); this.log = []; }
  async hold(actions) {
    const next = new Set(actions.map(action => { if (!keys[action]) throw Error('Unknown key action: ' + action); return keys[action]; }));
    for (const key of this.keys) if (!next.has(key)) await this.page.keyboard.up(key);
    for (const key of next) if (!this.keys.has(key)) await this.page.keyboard.down(key);
    if ([...next].join() !== [...this.keys].join()) this.log.push({time: Date.now(), actions: [...actions]});
    this.keys = next;
  }
  async tap(action) {
    if (!tapKeys[action]) throw Error('Unknown keyboard tap: ' + action);
    await this.page.keyboard.press(tapKeys[action], {delay: 70});
    this.log.push({time: Date.now(), tap: action});
  }
  async choose(key) {
    const selector = `dialog[open] [data-controller-key=${JSON.stringify(key)}]`;
    await expect(this.page.locator(selector)).toBeVisible();
    await expect(this.page.locator(selector)).toBeEnabled();
    for (let i = 0; i < 110; i++) {
      if (await this.page.evaluate(selector => document.activeElement?.matches(selector), selector)) {
        await this.page.keyboard.press('Enter', {delay: 70});
        this.log.push({time: Date.now(), choose: key}); await frames(this.page); return;
      }
      await this.page.keyboard.press('Tab');
    }
    throw Error('Native Tab navigation could not reach ' + key);
  }
  async repeatMine() { await this.page.keyboard.down('KeyT'); }
  async reset() { for (const key of this.keys) await this.page.keyboard.up(key); this.keys.clear(); await frames(this.page); }
}

/** Native CDP contacts; this is the Chromium 151 released-points backend proven
 * by mining-rover-inputs and its plain-DOM diagnostics. A partial release sends
 * the removed IDs, preserving the same held mining finger through UI actions. */
export class TouchInput {
  constructor(page, session) {
    this.page = page; this.session = session; this.contacts = new Map(); this.centers = new Map(); this.serial = 1; this.log = [];
    this.backend = 'released-points';
  }
  async center(selector, cache = false) {
    let point = cache ? this.centers.get(selector) : null;
    if (!point) {
      const element = this.page.locator(selector);
      await expect(element).toBeVisible(); await expect(element).toBeEnabled();
      const box = await element.boundingBox(), view = this.page.viewportSize();
      expect(box, selector).not.toBeNull();
      expect(box.x, selector + ' left').toBeGreaterThanOrEqual(0);
      expect(box.y, selector + ' top').toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, selector + ' right').toBeLessThanOrEqual(view.width + .5);
      expect(box.y + box.height, selector + ' bottom').toBeLessThanOrEqual(view.height + .5);
      point = {x: box.x + box.width / 2, y: box.y + box.height / 2};
      expect(await element.evaluate((el, point) => el.contains(document.elementFromPoint(point.x, point.y)), point), selector + ' native hit target').toBe(true);
      if (cache) this.centers.set(selector, point);
    }
    return {...point, id: this.serial++};
  }
  async warm(actions) { this.centers.clear(); for (const action of actions) await this.center(touchSelector(action), true); }
  async event(type, points) { await this.session.send('Input.dispatchTouchEvent', {type, touchPoints: points}); }
  async update(next) {
    const removed = [...this.contacts].filter(([key]) => !next.has(key)), added = [...next].filter(([key]) => !this.contacts.has(key));
    if (!removed.length && !added.length) return;
    if (removed.length) {
      await this.event('touchEnd', this.contacts.size > removed.length ? removed.map(([, point]) => point) : []);
      for (const [key] of removed) this.contacts.delete(key);
    }
    if (added.length) {
      await this.event('touchStart', added.map(([, point]) => point));
      for (const [key, point] of added) this.contacts.set(key, point);
    }
    this.log.push({time: Date.now(), contacts: [...this.contacts].map(([key, p]) => ({key, id: p.id, x: p.x, y: p.y}))});
  }
  async hold(actions) {
    const next = new Map();
    for (const action of new Set(actions)) next.set(action, this.contacts.get(action) ?? await this.center(touchSelector(action), true));
    await this.update(next);
  }
  async tapSelector(selector) {
    expect(this.contacts.has('tap')).toBe(false);
    const tap = await this.center(selector);
    await this.update(new Map([...this.contacts, ['tap', tap]])); await this.page.waitForTimeout(70);
    const next = new Map(this.contacts); next.delete('tap'); await this.update(next);
    this.centers.clear(); await frames(this.page);
  }
  async tap(action) { if (!taps[action]) throw Error('Unknown touch tap: ' + action); await this.tapSelector(taps[action]); }
  async choose(key) { await this.tapSelector(`dialog[open] [data-controller-key=${JSON.stringify(key)}]`); }
  async repeatMine() { /* A held physical contact is deliberately not released/repressed. */ }
  async reset() {
    if (this.contacts.size) { await this.event('touchCancel', []); this.contacts.clear(); }
    this.centers.clear(); await frames(this.page);
  }
  async mineReceipt() {
    const contact = this.contacts.get('mine'); expect(contact, 'Mining finger remains in the helper').toBeDefined();
    const native = await this.page.evaluate(() => {
      const a = window.__gannetNativeInput, button = document.querySelector('[data-rover-hold="mine"]');
      return {pointers: [...a.pointers].map(([pointer, key]) => ({pointer, key, captured: button?.hasPointerCapture(pointer) ?? false})), events: a.events};
    });
    const physical = native.pointers.filter(p => p.key === 'mine'); expect(physical).toHaveLength(1);
    const pointer = physical[0].pointer, events = native.events.filter(e => e.pointer === pointer);
    expect(events.every(e => e.trusted), 'Pointer events must be native/trusted').toBe(true);
    expect(events.filter(e => e.type === 'pointerdown')).toHaveLength(1);
    expect(events.filter(e => e.type === 'pointerup' || e.type === 'pointercancel')).toHaveLength(0);
    return {backend: this.backend, cdpId: contact.id, pointer, captured: physical[0].captured, events};
  }
  async dragView(dx, dy) {
    expect(this.contacts.size, 'View drag requires released controls').toBe(0);
    const point = await this.page.evaluate(({dx, dy}) => {
      const canvas = document.querySelector('#viewport');
      for (const y of [innerHeight * .32, innerHeight * .4, innerHeight * .22]) {
        for (const x of [innerWidth * .4, innerWidth * .6, innerWidth * .25]) {
          const end = {x: x + dx, y: y + dy};
          if (end.x < 8 || end.y < 8 || end.x > innerWidth - 8 || end.y > innerHeight - 8) continue;
          if (Array.from({length: 7}, (_, i) => document.elementFromPoint(x + dx * i / 6, y + dy * i / 6) === canvas).every(Boolean)) return {x, y};
        }
      }
      return null;
    }, {dx, dy});
    expect(point, 'A visible unoccluded canvas drag lane is required').not.toBeNull();
    const contact = {...point, id: this.serial++};
    await this.event('touchStart', [contact]);
    try {
      for (let i = 1; i <= 6; i++) {
        await this.event('touchMove', [{...contact, x: point.x + dx * i / 6, y: point.y + dy * i / 6}]);
        await this.page.waitForTimeout(16);
      }
    } finally { await this.event('touchEnd', []); }
    this.log.push({time: Date.now(), canvasDrag: {start: point, dx, dy}}); await frames(this.page);
  }
}

export async function installNativeReceipts(page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'getGamepads', {value: () => []});
    const a = window.__gannetNativeInput = {pointers: new Map(), events: [], focus: [], keys: [], access: null};
    const keyOf = target => {
      const el = target.closest?.('[data-rover-hold],[data-cabin-key],[data-rover-action],[data-cabin-interact],[data-cabin-land],[data-cabin-menu],[data-controller-key],#viewport,#camera-button');
      if (!el) return null;
      return el.dataset.roverHold ?? el.dataset.cabinKey ?? (el.dataset.roverAction ? 'tap:' + el.dataset.roverAction
        : el.dataset.controllerKey ? 'ui:' + el.dataset.controllerKey : el.id || 'cabin-action');
    };
    for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'gotpointercapture', 'lostpointercapture']) window.addEventListener(type, e => {
      const key = a.pointers.get(e.pointerId) ?? keyOf(e.target); if (e.pointerType !== 'touch' || !key) return;
      if (type === 'pointerdown') a.pointers.set(e.pointerId, key);
      a.events.push({type, key, pointer: e.pointerId, trusted: e.isTrusted, primary: e.isPrimary, time: performance.now()});
      if (type === 'pointerup' || type === 'pointercancel') a.pointers.delete(e.pointerId);
    }, true);
    for (const type of ['keydown', 'keyup']) window.addEventListener(type, e => a.keys.push({type, code: e.code, repeat: e.repeat, trusted: e.isTrusted, time: performance.now()}), true);
    const record = e => a.focus.push({type: e.type, trusted: e.isTrusted, time: performance.now(), focused: document.hasFocus(), visibility: document.visibilityState});
    window.addEventListener('blur', record); window.addEventListener('focus', record); document.addEventListener('visibilitychange', record);
  });
}

/** Same proven native tab transition as mining-rover-inputs; no synthetic DOM
 * events or nav flags. The live power gate is used while rendering is paused. */
export async function nativeFocusNeutral(page, input, report) {
  const blank = await page.context().newPage(), gameSession = await page.context().newCDPSession(page), blankSession = await page.context().newCDPSession(blank);
  const snapshot = () => page.evaluate(() => ({focused: document.hasFocus(), navigationFocused: starAgent.navigation.focused,
    powerActive: starAgent.navigation.vehicle.power.state.active, events: [...__gannetNativeInput.focus]}));
  try {
    await blank.goto('about:blank');
    await gameSession.send('Emulation.setFocusEmulationEnabled', {enabled: false});
    await blankSession.send('Emulation.setFocusEmulationEnabled', {enabled: false});
    await page.bringToFront(); await wait(page, () => document.hasFocus() && starAgent.navigation.focused, null, 6000);
    await input.reset(); await input.hold(['mine']); await wait(page, () => starAgent.state.rover.beaming === 2);
    report.before = await snapshot(); if (input.mineReceipt) report.mineBefore = await input.mineReceipt();
    await blank.bringToFront(); await wait(page, () => !document.hasFocus() && !starAgent.navigation.focused && !starAgent.navigation.vehicle.power.state.active, null, 6000);
    report.background = await snapshot();
    expect(report.background.events.slice(report.before.events.length).some(e => e.type === 'blur' && e.trusted), 'A new trusted blur must suppress cutters').toBe(true);
    await page.bringToFront(); await wait(page, () => document.hasFocus() && starAgent.navigation.focused, null, 6000);
    report.returned = await snapshot();
    expect(report.returned.events.slice(report.background.events.length).some(e => e.type === 'focus' && e.trusted), 'A new trusted focus must return to play').toBe(true);
    await input.repeatMine(); await page.waitForTimeout(400); expect((await state(page)).rover.beaming).toBe(0);
    if (input.mineReceipt) {
      report.mineReturned = await input.mineReceipt();
      expect(report.mineReturned.pointer).toBe(report.mineBefore.pointer); expect(report.mineReturned.cdpId).toBe(report.mineBefore.cdpId);
    }
    await input.reset(); await input.hold(['mine']); await wait(page, () => starAgent.state.rover.beaming === 2);
    await input.hold([]); await wait(page, () => starAgent.state.rover.beaming === 0); report.result = 'PASS';
  } catch (error) { report.result = 'FAIL'; report.error = error.message; throw error; }
  finally {
    report.last = await snapshot().catch(() => null);
    await gameSession.send('Emulation.setFocusEmulationEnabled', {enabled: true}).catch(() => {});
    await blankSession.send('Emulation.setFocusEmulationEnabled', {enabled: true}).catch(() => {});
    await page.bringToFront().catch(() => {}); await blank.close().catch(() => {});
    await gameSession.detach().catch(() => {}); await blankSession.detach().catch(() => {});
  }
}
