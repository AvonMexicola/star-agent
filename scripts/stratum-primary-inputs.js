import {expect} from '@playwright/test';

export const state = page => page.evaluate(() => starAgent.state);
export const wait = (page, predicate, arg = null, timeout = 15000) => page.waitForFunction(predicate, arg, {timeout, polling: 50});
export const frames = (page, count = 3) => page.evaluate(async n => {
  for (let i = 0; i < n; i++) await new Promise(resolve => requestAnimationFrame(resolve));
}, count);
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

const keys = {forward: 'KeyW', backward: 'KeyS', left: 'KeyA', right: 'KeyD',
  rise: 'Space', descend: 'KeyC', brake: 'KeyX', aimLeft: 'ArrowLeft', aimRight: 'ArrowRight',
  aimUp: 'ArrowUp', aimDown: 'ArrowDown', mine: 'KeyT'};
const tapKeys = {interact: 'KeyF', land: 'KeyB', gear: 'KeyG', cargo: 'KeyI', close: 'KeyI', camera: 'Digit4'};
const taps = {interact: '[data-cabin-interact]', land: '[data-cabin-land]',
  commands: '[data-cabin-menu]', cargo: '[data-ship-ore]', close: '#cargo-dialog .gameplay-resume'};
const selectorFor = action => action === 'mine' ? '[data-ship-mine]' : `[data-cabin-key="${keys[action]}"]`;

export class KeyboardInput {
  constructor(page) { this.page = page; this.keys = new Set(); this.log = []; }
  async hold(actions) {
    const next = new Set(actions.map(action => { if (!keys[action]) throw Error('Unknown keyboard action ' + action); return keys[action]; }));
    for (const key of this.keys) if (!next.has(key)) await this.page.keyboard.up(key);
    for (const key of next) if (!this.keys.has(key)) await this.page.keyboard.down(key);
    if ([...next].join() !== [...this.keys].join()) this.log.push({time: Date.now(), actions});
    this.keys = next;
  }
  async tap(action) {
    if (!tapKeys[action]) throw Error('Unknown keyboard tap ' + action);
    await this.page.keyboard.press(tapKeys[action], {delay: 70}); this.log.push({time: Date.now(), tap: action});
  }
  async choose(key) {
    const selector = `dialog[open] [data-controller-key=${JSON.stringify(key)}]`;
    await expect(this.page.locator(selector)).toBeVisible(); await expect(this.page.locator(selector)).toBeEnabled();
    for (let i = 0; i < 110; i++) {
      if (await this.page.evaluate(selector => document.activeElement?.matches(selector), selector)) {
        await this.page.keyboard.press('Enter', {delay: 70}); this.log.push({time: Date.now(), choose: key}); await frames(this.page); return;
      }
      await this.page.keyboard.press('Tab');
    }
    throw Error('Native Tab navigation cannot reach ' + key);
  }
  async repeatMine() { await this.page.keyboard.down('KeyT'); }
  async reset() { for (const key of this.keys) await this.page.keyboard.up(key); this.keys.clear(); await frames(this.page); }
}

/** Reuses the validated Gannet/Burrow native CDP released-points semantics.
 * Partial release identifies removed contacts, preserving the mining finger.
 * The fixture never invokes a DOM click or dispatches synthetic pointer events. */
export class TouchInput {
  constructor(page, session) { this.page = page; this.session = session; this.contacts = new Map(); this.centers = new Map(); this.serial = 1; this.log = []; }
  async center(selector, cache = false) {
    let point = cache ? this.centers.get(selector) : null;
    if (!point) {
      const element = this.page.locator(selector); await expect(element).toBeVisible(); await expect(element).toBeEnabled();
      const b = await element.boundingBox(), v = this.page.viewportSize(); expect(b, selector).not.toBeNull();
      expect(b.x).toBeGreaterThanOrEqual(0); expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(v.width + .5); expect(b.y + b.height).toBeLessThanOrEqual(v.height + .5);
      point = {x: b.x + b.width / 2, y: b.y + b.height / 2};
      expect(await element.evaluate((el, p) => el.contains(document.elementFromPoint(p.x, p.y)), point), selector + ' actual touch hit target').toBe(true);
      if (cache) this.centers.set(selector, point);
    }
    return {...point, id: this.serial++};
  }
  async warm(actions) { this.centers.clear(); for (const action of actions) await this.center(selectorFor(action), true); }
  async event(type, points) { await this.session.send('Input.dispatchTouchEvent', {type, touchPoints: points}); }
  async update(next) {
    const removed = [...this.contacts].filter(([key]) => !next.has(key)), added = [...next].filter(([key]) => !this.contacts.has(key));
    if (!removed.length && !added.length) return;
    if (removed.length) {
      await this.event('touchEnd', this.contacts.size > removed.length ? removed.map(([, p]) => p) : []);
      for (const [key] of removed) this.contacts.delete(key);
    }
    if (added.length) {
      await this.event('touchStart', added.map(([, p]) => p)); for (const [key, p] of added) this.contacts.set(key, p);
    }
    this.log.push({time: Date.now(), contacts: [...this.contacts].map(([key, p]) => ({key, ...p}))});
  }
  async hold(actions) {
    const next = new Map();
    for (const action of new Set(actions)) next.set(action, this.contacts.get(action) ?? await this.center(selectorFor(action), true));
    await this.update(next);
  }
  async tapSelector(selector) {
    expect(this.contacts.has('tap')).toBe(false); const tap = await this.center(selector);
    await this.update(new Map([...this.contacts, ['tap', tap]])); await this.page.waitForTimeout(70);
    const next = new Map(this.contacts); next.delete('tap'); await this.update(next); this.centers.clear(); await frames(this.page);
  }
  async tap(action) { if (!taps[action]) throw Error('Unknown touch tap ' + action); await this.tapSelector(taps[action]); }
  async choose(key) { await this.tapSelector(`dialog[open] [data-controller-key=${JSON.stringify(key)}]`); }
  async repeatMine() { /* Intentionally keep the original physical contact held. */ }
  async reset() {
    if (this.contacts.size) { await this.event('touchCancel', []); this.contacts.clear(); }
    this.centers.clear(); await frames(this.page);
  }
  async mineReceipt() {
    const contact = this.contacts.get('mine'); expect(contact).toBeDefined();
    const native = await this.page.evaluate(() => ({pointers: [...__stratumPrimary.pointers].map(([pointer, key]) => ({pointer, key,
      captured: document.querySelector('[data-ship-mine]')?.hasPointerCapture(pointer) ?? false})), events: __stratumPrimary.events}));
    const physical = native.pointers.filter(p => p.key === 'mine'); expect(physical).toHaveLength(1);
    const pointer = physical[0].pointer, events = native.events.filter(e => e.pointer === pointer);
    expect(events.every(e => e.trusted)).toBe(true); expect(events.filter(e => e.type === 'pointerdown')).toHaveLength(1);
    expect(events.filter(e => ['pointerup', 'pointercancel'].includes(e.type))).toHaveLength(0);
    return {backend: 'released-points', cdpId: contact.id, pointer, captured: physical[0].captured, events};
  }
  async dragView(dx, dy) {
    expect(this.contacts.size, 'Release propulsion before a fresh native look drag').toBe(0);
    const lock = () => this.page.evaluate(() => ({navigation: starAgent.navigation.locked, element: document.pointerLockElement?.id ?? null}));
    expect(await lock(), 'Touch look must not enter mouse pointer lock').toEqual({navigation: false, element: null});
    const point = await this.page.evaluate(({dx, dy}) => {
      const canvas = document.querySelector('#viewport');
      for (const y of [innerHeight * .32, innerHeight * .4, innerHeight * .22]) for (const x of [innerWidth * .4, innerWidth * .6, innerWidth * .25]) {
        const end = {x: x + dx, y: y + dy};
        if (end.x < 8 || end.y < 8 || end.x > innerWidth - 8 || end.y > innerHeight - 8) continue;
        if (Array.from({length: 7}, (_, i) => document.elementFromPoint(x + dx * i / 6, y + dy * i / 6) === canvas).every(Boolean)) return {x, y};
      }
      return null;
    }, {dx, dy});
    expect(point, 'A real unobstructed canvas drag lane is required').not.toBeNull();
    const contact = {...point, id: this.serial++}; await this.event('touchStart', [contact]);
    try {
      for (let i = 1; i <= 6; i++) {
        await this.event('touchMove', [{...contact, x: point.x + dx * i / 6, y: point.y + dy * i / 6}]); await this.page.waitForTimeout(16);
      }
    } finally { await this.event('touchEnd', []); }
    await frames(this.page);
    const after = await lock();
    this.log.push({time: Date.now(), canvasDrag: {start: point, dx, dy}, lock: after});
    expect(after, 'A compatibility click after a touch drag must leave touch look available').toEqual({navigation: false, element: null});
  }
}

export async function installNativeReceipts(page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'getGamepads', {value: () => []});
    const a = window.__stratumPrimary = {pointers: new Map(), events: [], clicks: [], locks: [], focus: [], keys: [], access: null};
    function keyOf(target) {
      const el = target.closest?.('[data-ship-mine],[data-ship-ore],[data-cabin-key],[data-cabin-interact],[data-cabin-land],[data-cabin-menu],[data-controller-key],#viewport');
      if (!el) return null;
      if (el.hasAttribute('data-ship-mine')) return 'mine';
      return el.dataset.cabinKey ?? (el.dataset.controllerKey ? 'ui:' + el.dataset.controllerKey : el.id || 'native-action');
    }
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'gotpointercapture', 'lostpointercapture']) window.addEventListener(type, e => {
      const key = a.pointers.get(e.pointerId) ?? keyOf(e.target); if (e.pointerType !== 'touch' || !key) return;
      if (type === 'pointerdown') a.pointers.set(e.pointerId, key);
      a.events.push({type, key, pointer: e.pointerId, trusted: e.isTrusted, primary: e.isPrimary, x: e.clientX, y: e.clientY, time: performance.now()});
      if (['pointerup', 'pointercancel'].includes(type)) a.pointers.delete(e.pointerId);
    }, true);
    document.addEventListener('click', e => a.clicks.push({trusted: e.isTrusted, target: e.target.id,
      pointerType: e.pointerType ?? null, firesTouchEvents: e.sourceCapabilities?.firesTouchEvents ?? null, time: performance.now()}), true);
    document.addEventListener('pointerlockchange', () => a.locks.push({element: document.pointerLockElement?.id ?? null, time: performance.now()}));
    for (const type of ['keydown', 'keyup']) window.addEventListener(type, e => a.keys.push({type, code: e.code, repeat: e.repeat, trusted: e.isTrusted, time: performance.now()}), true);
    const record = e => a.focus.push({type: e.type, trusted: e.isTrusted, time: performance.now(), focused: document.hasFocus(), visibility: document.visibilityState});
    window.addEventListener('blur', record); window.addEventListener('focus', record); document.addEventListener('visibilitychange', record);
  });
}

export async function nativeFocusNeutral(page, input, report) {
  const blank = await page.context().newPage(), game = await page.context().newCDPSession(page), other = await page.context().newCDPSession(blank);
  const snapshot = () => page.evaluate(() => ({focused: document.hasFocus(), navFocused: starAgent.navigation.focused,
    active: starAgent.state.mining.ship.active, events: [...__stratumPrimary.focus]}));
  try {
    await blank.goto('about:blank'); await game.send('Emulation.setFocusEmulationEnabled', {enabled: false}); await other.send('Emulation.setFocusEmulationEnabled', {enabled: false});
    await page.bringToFront(); await wait(page, () => document.hasFocus() && starAgent.navigation.focused, null, 6000);
    await input.reset(); await input.hold(['mine']); await wait(page, () => starAgent.state.mining.ship.beaming === 2);
    report.before = await snapshot(); if (input.mineReceipt) report.mineBefore = await input.mineReceipt();
    await blank.bringToFront(); await wait(page, () => !document.hasFocus() && !starAgent.navigation.focused && !starAgent.state.mining.ship.active, null, 6000);
    report.background = await snapshot(); expect(report.background.events.slice(report.before.events.length).some(e => e.type === 'blur' && e.trusted)).toBe(true);
    await page.bringToFront(); await wait(page, () => document.hasFocus() && starAgent.navigation.focused, null, 6000);
    report.returned = await snapshot(); expect(report.returned.events.slice(report.background.events.length).some(e => e.type === 'focus' && e.trusted)).toBe(true);
    await input.repeatMine(); await page.waitForTimeout(400); expect((await state(page)).mining.ship.beaming).toBe(0);
    if (input.mineReceipt) {
      report.mineReturned = await input.mineReceipt(); expect(report.mineReturned.pointer).toBe(report.mineBefore.pointer); expect(report.mineReturned.cdpId).toBe(report.mineBefore.cdpId);
    }
    await input.reset(); await input.hold(['mine']); await wait(page, () => starAgent.state.mining.ship.beaming === 2);
    await input.hold([]); await wait(page, () => starAgent.state.mining.ship.beaming === 0); report.result = 'PASS';
  } catch (e) { report.result = 'FAIL'; report.error = e.message; throw e; }
  finally {
    report.last = await snapshot().catch(() => null); await game.send('Emulation.setFocusEmulationEnabled', {enabled: true}).catch(() => {});
    await other.send('Emulation.setFocusEmulationEnabled', {enabled: true}).catch(() => {}); await page.bringToFront().catch(() => {});
    await blank.close().catch(() => {}); await game.detach().catch(() => {}); await other.detach().catch(() => {});
  }
}
