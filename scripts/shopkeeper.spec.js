import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const state = page => page.evaluate(() => window.starAgent.state);
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const records = new WeakMap();
const frames = (page, n = 3) => page.evaluate(n => new Promise(resolve => {
  const tick = () => --n <= 0 ? resolve() : requestAnimationFrame(tick);
  requestAnimationFrame(tick);
}), n);
async function pad(page, axes = [0, 0, 0, 0], buttons = {}) {
  // Only the injected input device is mutated. No pose, inventory or runtime setters.
  await page.evaluate(({ axes, buttons }) => {
    window.shopkeeperPad.axes = axes;
    for (const [i, value] of Object.entries(buttons)) window.shopkeeperPad.buttons[i] = { value, pressed: value > .5 };
  }, { axes, buttons });
  await frames(page);
}
async function tap(page, i) { await pad(page, undefined, { [i]: 1 }); await pad(page, undefined, { [i]: 0 }); }
async function neutral(page) {
  await pad(page, undefined, Object.fromEntries(Array.from({ length: 17 }, (_, i) => [i, 0])));
  await page.waitForFunction(() => document.querySelector('dialog[open]')
    ? window.starAgent.navigation.gamepad.uiArmed : window.starAgent.navigation.gamepad.armed);
}
async function note(page, label) {
  const record = records.get(page);
  record.steps.push({ label, at: new Date().toISOString(), state: await state(page) });
}
async function shot(page, label) {
  await frames(page);
  await page.screenshot({ path: `${records.get(page).dir}/${label}.png` });
  await note(page, label);
  const metrics = await page.evaluate(() => {
    const s = window.starAgent.state, canvas = document.querySelector('#viewport');
    return { drawCalls: s.drawCalls, triangles: s.triangles, renderedFrames: s.renderedFrames,
      viewport: [innerWidth, innerHeight], drawingBuffer: canvas && [canvas.width, canvas.height],
      renderScale: s.renderScale, dpr: devicePixelRatio, modalOpen: Boolean(document.querySelector('dialog[open]')) };
  });
  records.get(page).steps.at(-1).sceneMetrics = metrics;
}
async function walk(page, frame, x, z, label) {
  await neutral(page);
  const deadline = Date.now() + 60000;
  let result;
  while (Date.now() < deadline) {
    result = await page.evaluate(({ frame, x, z }) => {
      const n = window.starAgent.navigation;
      const local = frame === 'ship' ? n.toShipLocal() : n.stationLocal;
      if (n.mode !== 'walk' || !local) return { invalid: true };
      const inverse = (frame === 'ship' ? n.shipOrientation : n.station.quaternion).clone().invert();
      const desired = local.clone().set(x - local.x, 0, z - local.z), d = desired.length();
      desired.normalize();
      const forward = local.clone().set(0, 0, -1).applyQuaternion(n.orientation).applyQuaternion(inverse); forward.y = 0; forward.normalize();
      const right = local.clone().set(1, 0, 0).applyQuaternion(n.orientation).applyQuaternion(inverse); right.y = 0; right.normalize();
      const gain = Math.min(.8, .22 + d * .4);
      return { d, local: local.toArray(), axes: [desired.dot(right) * gain, -desired.dot(forward) * gain, 0, 0] };
    }, { frame, x, z });
    if (result.invalid) throw new Error(`Invalid walking state at ${label}`);
    if (result.d < .17) { await pad(page); await tap(page, 6); await note(page, label); return; }
    await pad(page, result.axes);
  }
  await pad(page);
  throw new Error(`Physical route blocked at ${label}: ${JSON.stringify(result)}`);
}
async function aimKeeper(page, shopId) {
  await neutral(page);
  for (let i = 0; i < 180; i++) {
    const error = await page.evaluate(shopId => {
      const n = window.starAgent.navigation, keeper = window.starAgent.state.station.shopkeepers[shopId];
      const local = n.position.clone().fromArray(keeper.position); local.y += 1.45;
      const p = n.station.toWorld(local, n.position.clone()).sub(n.position).applyQuaternion(n.orientation.clone().invert());
      return [Math.atan2(p.x, -p.z), Math.atan2(p.y, Math.hypot(p.x, p.z))];
    }, shopId);
    if (error.every(v => Math.abs(v) < .025)) { await pad(page); return; }
    const axis = v => Math.sign(v) * Math.min(1, .18 + Math.abs(v) * 1.5);
    await pad(page, [0, 0, axis(error[0]), axis(-error[1])]);
  }
  await pad(page); throw new Error('Controller view did not converge on shopkeeper');
}
async function observeKeeper(page, shopId, requiredClips) {
  await page.waitForFunction(id => window.starAgent.state.station.shopkeepers?.[id]?.status === 'ready', shopId);
  expect((await state(page)).station.shopkeepers[shopId].visible).toBe(true);
  await aimKeeper(page, shopId); await shot(page, `${shopId}-idle-desktop`);
  const idle = (await state(page)).station.shopkeepers[shopId];
  const observed = new Set([idle.currentClip]);
  const cycle = [{ ...idle }];
  let current = idle;
  // Natural animation time only: no mixer seek, clock override or debug action.
  // Four transitions ensure the starting clip is revisited after every supplied idle.
  for (let transition = 0; transition < 4; transition++) {
    await page.waitForFunction(({ shopId, t }) => window.starAgent.state.station.shopkeepers[shopId].transitions > t,
      { shopId, t: current.transitions }, { timeout: 60000 });
    // Read each incoming action after the authored .65 s crossfade has finished.
    await page.waitForFunction(id => !window.starAgent.state.station.shopkeepers[id].blending, shopId);
    current = (await state(page)).station.shopkeepers[shopId];
    expect(requiredClips).toContain(current.currentClip);
    expect(current.visible).toBe(true);
    observed.add(current.currentClip); cycle.push({ ...current });
    await shot(page, `${shopId}-cycle-${transition + 1}-${current.currentClip}-desktop`);
  }
  (records.get(page).idleCycles ??= {})[shopId] = cycle;
  expect([...observed].sort()).toEqual([...requiredClips].sort());
  expect(current.transitions - idle.transitions).toBeGreaterThanOrEqual(4);
  expect(current.currentClip).toBe(idle.currentClip);
  await page.setViewportSize({ width: 390, height: 844 }); await shot(page, `${shopId}-mobile`);
  await page.setViewportSize({ width: 1440, height: 900 });
}
async function choose(page, name) {
  await neutral(page);
  const button = page.getByRole('button', { name, exact: true });
  await expect(button).toBeVisible();
  const count = await page.locator('dialog[open] button').count();
  for (let i = 0; i < count + 8; i++) {
    if (await button.evaluate(el => el === document.activeElement)) break;
    await tap(page, 13);
  }
  await expect(button).toBeFocused(); await tap(page, 0);
}
async function travel(page, name, location) {
  await tap(page, 2);
  await expect(page.locator('#station-elevator-dialog')).toBeVisible();
  await choose(page, name);
  await page.waitForFunction(location => window.starAgent.state.station.location === location
    && window.starAgent.navigation.enabled && window.starAgent.state.station.elevator > .99, location);
  await neutral(page);
}

test.beforeEach(async ({ page }, info) => {
  const dir = process.env.SHOPKEEPER_QA_OUT || `test-results/shopkeeper-evidence/${Date.now()}-${info.workerIndex}`;
  await mkdir(dir, { recursive: true });
  const record = { dir, errors: [], warnings: [], steps: [] }; records.set(page, record);
  page.on('pageerror', error => record.errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') record.errors.push(message.text());
    if (message.type() === 'warning') record.warnings.push(message.text());
  });
  page.on('response', response => { if (response.status() >= 400) record.errors.push(`${response.status()} ${response.url()}`); });
  await page.addInitScript(() => {
    window.shopkeeperPad = { id: 'Shopkeeper QA standard gamepad', index: 0, mapping: 'standard', connected: true,
      axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    navigator.getGamepads = () => [window.shopkeeperPad];
  });
});
test.afterEach(async ({ page, browser }, info) => {
  const r = records.get(page); if (!r) return;
  r.status = info.status; r.testErrors = info.errors.map(e => e.message); r.browser = browser.version();
  r.final = await state(page).catch(e => ({ error: e.message }));
  r.environment = await page.evaluate(() => {
    const canvas = document.querySelector('#viewport'), gl = canvas?.getContext('webgl2');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    return { renderer: gl?.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER),
      viewport: [innerWidth, innerHeight], buffer: canvas && [canvas.width, canvas.height],
      renderScale: window.starAgent?.state.renderScale, dpr: devicePixelRatio,
      scripts: [...document.scripts].map(s => s.src).filter(Boolean) };
  }).catch(e => ({ error: e.message }));
  await page.screenshot({ path: `${r.dir}/final.png` }).catch(() => {});
  await writeFile(`${r.dir}/report.json`, JSON.stringify(r, null, 2));
  expect(r.errors, 'page, console and HTTP errors').toEqual([]);
});

test('controller physically visits both merchants, observes all idles, purchases and returns', async ({ page }) => {
  // Optional offline authentication only; economy/navigation remain real.
  await page.route('**/api/auth/session', route => route.request().method() === 'GET'
    ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ account: null }) })
    : route.continue());
  await page.goto('/?dev=1&ship=nomad&start=hangar&intro=0&debug&seed=7291');
  await page.waitForFunction(() => window.starAgent?.state.ready && window.starAgent.state.shipAsset === 'ready'
    && window.starAgent.state.controller.armed);
  expect((await state(page)).shipId).toBe('nomad');
  expect((await state(page)).dev, 'preview must enable VITE_DEV_TOOLS=1 for supported hangar entry').not.toBeNull();
  await page.waitForFunction(() => window.starAgent.state.station.docked && window.starAgent.state.station.ready);
  const initial = await state(page); await shot(page, 'hangar-start');
  await tap(page, 2); await page.waitForFunction(() => window.starAgent.state.mode === 'walk');
  await walk(page, 'ship', 0, 2.7, 'hatch control');
  await tap(page, 2); await page.waitForFunction(() => window.starAgent.state.doorProgress > .99);
  await walk(page, 'ship', 0, 13, 'outside rear ramp');
  expect((await state(page)).insideShip).toBe(false);
  const local = await page.evaluate(() => window.starAgent.navigation.stationLocal.toArray());
  await walk(page, 'station', -12, local[2], 'clear ship side aisle');
  await walk(page, 'station', -12, 20, 'hangar lift aisle');
  await walk(page, 'station', 0, 20, 'hangar lift call');
  await tap(page, 2); await page.waitForFunction(() => window.starAgent.state.station.elevator > .99);
  await walk(page, 'station', 0, 24, 'inside station lift');
  await travel(page, 'Central hub', 'hub');
  await walk(page, 'station', 0, 0, 'central concourse');
  await walk(page, 'station', -10.7, 0, 'armory customer position');
  await observeKeeper(page, 'weapons', ['idle-04', 'idle-06', 'idle-07', 'idle-15']);
  expect((await state(page)).interaction).toContain('WATCHKEEP ARMORY');
  await tap(page, 2); await expect(page.locator('#station-shop-dialog')).toBeVisible();
  await neutral(page);
  const buy = page.getByRole('button', { name: 'Buy Security sidearm for 350 credits', exact: true });
  for (let i = 0; i < 20 && !(await buy.evaluate(el => el === document.activeElement)); i++) await tap(page, 13);
  await expect(buy).toBeFocused();
  const before = await state(page), keeperPaused = before.station.shopkeeper.time;
  await pad(page, undefined, { 0: 1 }); await frames(page, 60);
  await expect(page.locator('.shop-feedback')).toContainText('Delivered to your station warehouse');
  const purchased = await state(page);
  expect(purchased.inventory.credits).toBe(before.inventory.credits - 350);
  expect(purchased.inventory.station.sidearm).toBe((before.inventory.station.sidearm || 0) + 1);
  expect(purchased.station.shopkeeper.time).toBe(keeperPaused);
  await shot(page, 'purchase-desktop');
  await page.setViewportSize({ width: 390, height: 844 }); await shot(page, 'purchase-mobile');
  await page.setViewportSize({ width: 1440, height: 900 });
  await pad(page, [0, -1, 0, 0], { 7: 1 }); await frames(page, 15);
  expect(distance((await state(page)).position, before.position)).toBeLessThan(.001);
  await pad(page, [0, -1, 0, 0], { 1: 1 }); await expect(page.locator('#station-shop-dialog')).not.toBeVisible();
  await pad(page, [0, -1, 0, 0], { 1: 0 }); await frames(page, 15);
  expect((await state(page)).controller.armed).toBe(false);
  expect(distance((await state(page)).position, before.position)).toBeLessThan(.001);
  // Focus loss/recovery uses actual tab focus; no synthetic navigation or pose writes.
  const other = await page.context().newPage(); await other.goto('about:blank'); await other.bringToFront();
  await page.bringToFront(); await other.close(); await frames(page, 10);
  expect((await state(page)).controller.armed).toBe(false);
  expect((await state(page)).inventory.credits).toBe(purchased.inventory.credits);
  // The device disconnects while LS/RT/A are still held after modal close.
  // Reconnecting the same held device must never arm gameplay or repeat a purchase.
  const disconnectBefore = await state(page);
  await page.evaluate(() => { window.shopkeeperPad.connected = false; });
  await page.waitForFunction(() => !window.starAgent.state.controller.connected);
  await frames(page, 10);
  const disconnected = await state(page);
  expect(disconnected.controller.armed).toBe(false);
  expect(distance(disconnected.position, disconnectBefore.position)).toBeLessThan(.001);
  expect(disconnected.inventory.credits).toBe(disconnectBefore.inventory.credits);
  await page.evaluate(() => { window.shopkeeperPad.connected = true; });
  await page.waitForFunction(() => window.starAgent.state.controller.connected);
  await frames(page, 15);
  const reconnected = await state(page);
  expect(reconnected.controller.armed).toBe(false);
  expect(distance(reconnected.position, disconnectBefore.position)).toBeLessThan(.001);
  expect(reconnected.inventory.credits).toBe(disconnectBefore.inventory.credits);
  expect(reconnected.inventory.station.sidearm).toBe(disconnectBefore.inventory.station.sidearm);
  expect(reconnected.effects.weaponShots).toBe(disconnectBefore.effects.weaponShots);
  expect(reconnected.mining.tool.beaming).toBe(false);
  await note(page, 'held-input disconnect and reconnect remain unarmed');
  await neutral(page);
  expect((await state(page)).controller.armed).toBe(true);
  await tap(page, 9); await expect(page.locator('dialog[open].gameplay-screen')).toBeVisible();
  await neutral(page); await tap(page, 1); await expect(page.locator('dialog[open].gameplay-screen')).toHaveCount(0);
  await neutral(page); await note(page, 'held purchase, close, focus and menu guards');
  await walk(page, 'station', 0, 0, 'cross central aisle');
  await walk(page, 'station', 10.7, 0, 'Kestrel customer position');
  await observeKeeper(page, 'equipment', ['idle-02', 'idle-03', 'idle-11', 'idle-12']);
  expect((await state(page)).interaction).toContain('KESTREL SHIPWORKS');
  await tap(page, 2); await expect(page.locator('#station-shop-dialog')).toBeVisible();
  await neutral(page);
  const equipmentBefore = await state(page);
  // Select the real offer through D-pad focus, then hold A to test single activation.
  const repair = page.locator('#station-shop-dialog [data-purchase="repair"]');
  for (let i = 0; i < 20 && !(await repair.evaluate(el => el === document.activeElement)); i++) await tap(page, 13);
  await expect(repair).toBeFocused();
  await pad(page, undefined, { 0: 1 }); await frames(page, 60);
  await expect(page.locator('.shop-feedback')).toContainText('Delivered to your station warehouse');
  const equipmentAfter = await state(page);
  expect(equipmentAfter.inventory.credits).toBe(equipmentBefore.inventory.credits - 120);
  expect(equipmentAfter.inventory.station.repair).toBe((equipmentBefore.inventory.station.repair || 0) + 1);
  expect(equipmentAfter.inventory.station.sidearm).toBe(purchased.inventory.station.sidearm);
  for (const id of ['weapons', 'equipment']) {
    expect(equipmentAfter.station.shopkeepers[id].time).toBe(equipmentBefore.station.shopkeepers[id].time);
  }
  await shot(page, 'equipment-purchase-desktop');
  await page.setViewportSize({ width: 390, height: 844 }); await shot(page, 'equipment-purchase-mobile');
  await page.setViewportSize({ width: 1440, height: 900 });
  await neutral(page); await tap(page, 1); await neutral(page);
  await walk(page, 'station', 0, 0, 'return central aisle');
  await walk(page, 'station', 0, 16, 'hub elevator return');
  await travel(page, `Berth ${String(initial.station.parkedPod).padStart(2, '0')} · Your ship`, 'hangar');
  await walk(page, 'station', 0, 20, 'exit hangar lift');
  await walk(page, 'station', -12, 20, 'return toward parked ship');
  expect(distance((await state(page)).shipPosition, initial.shipPosition)).toBeLessThan(.001);
  for (const id of ['weapons', 'equipment']) expect((await state(page)).station.shopkeepers[id].visible).toBe(false);
  await shot(page, 'returned-hangar');
});
