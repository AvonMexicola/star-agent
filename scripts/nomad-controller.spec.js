// Retained from the independent Nomad controller review; only path/config
// plumbing is adapted for repository execution. Original runs are documented
// in docs/qa/nomad-02/controller-review.md.
import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = process.env.NOMAD_CONTROLLER_OUT ?? '/tmp/star-agent-nomad-controller';
const context = new WeakMap();
const state = page => page.evaluate(() => window.starAgent.state);
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const files = [
  'public/models/nomad.glb', 'src/main.js', 'src/navigation.js', 'src/boarding.js',
  'src/ship-walkable.js', 'src/gear-flight.js', 'src/landing-gear.js', 'src/nomad-cabin.js', 'src/nomad-cabin-controls.js',
  'src/nomad-cabin-controls.css', 'src/ship-camera.js', 'src/ship-mfd.js',
  'src/gamepad.js', 'src/controller-ui.js', 'src/ship-inventory-ui.js',
  'src/mining/store.js', 'src/mining/tool.js', 'src/effects/flight-effects.js',
];
async function candidate() {
  return {
    head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    status: execFileSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8' }).trim(),
    files: Object.fromEntries(await Promise.all(files.map(async path => [path, digest(await readFile(`${root}/${path}`))]))),
  };
}
async function pad(page, { axes, buttons } = {}) {
  // The only gameplay-input mutation in this harness is the injected device.
  // Navigation, view, ship transforms, inventory and localStorage are never set.
  await page.evaluate(({ axes, buttons }) => {
    if (axes) window.nomadReviewPad.axes = axes;
    for (const [index, value] of Object.entries(buttons ?? {})) {
      window.nomadReviewPad.buttons[Number(index)] = { pressed: value > .5, value };
    }
  }, { axes, buttons });
}
async function pollButton(page, index, down) {
  await page.waitForFunction(({ index, down }) => Boolean(window.starAgent?.navigation.gamepad.previous[index]) === down, { index, down }, { timeout: 10000 });
}
async function tap(page, index) {
  await pad(page, { buttons: { [index]: 1 } });await pollButton(page, index, true);
  await pad(page, { buttons: { [index]: 0 } });await pollButton(page, index, false);
}
async function frames(page, count = 3) {
  // Dialogs intentionally hold the last rendered scene, but controller polling
  // continues each animation tick. Count browser ticks, not new WebGL renders.
  await page.evaluate(count => new Promise(resolve => {
    let remaining = count;
    const tick = () => { if (--remaining <= 0) resolve();else requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }), count);
}
async function neutral(page) {
  await pad(page, { axes: [0, 0, 0, 0], buttons: Object.fromEntries(Array.from({ length: 17 }, (_, i) => [i, 0])) });
  await page.waitForFunction(() => {
    const n = window.starAgent.navigation;
    return document.querySelector('dialog[open]') ? n.gamepad.uiArmed : n.gamepad.armed;
  }, null, { timeout: 15000 });
}
async function focusKey(page, key) {
  const target = page.locator(`dialog[open] [data-controller-key="${key}"]`);
  await expect(target).toBeVisible();await expect(target).toBeEnabled();
  await page.waitForFunction(() => window.starAgent.navigation.gamepad.uiArmed);
  const count = await page.locator('dialog[open] [data-controller-key]').count();
  for (let i = 0; i < count + 8; i++) {
    if (await target.evaluate(el => el === document.activeElement)) break;
    await tap(page, 13);
  }
  await expect(target).toBeFocused();
  await expect(target).toHaveAttribute('data-controller-selected', '');
}
async function activateKey(page, key) { await focusKey(page, key);await tap(page, 0); }
async function command(page, key) {
  await neutral(page);await tap(page, 9);
  await expect(page.locator('#controller-menu')).toBeVisible();
  await neutral(page);await activateKey(page, key);
  await expect(page.locator('#controller-menu')).not.toBeVisible();
}
async function boot(page) {
  await page.addInitScript(() => {
    window.nomadReviewPad = { id: 'Independent Nomad standard Gamepad', index: 0, mapping: 'standard', connected: true,
      axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    navigator.getGamepads = () => [window.nomadReviewPad];
  });
  await page.goto('/?intro=0&seed=7291&debug');
  await page.waitForFunction(() => window.starAgent?.state.ready && window.starAgent.state.shipAsset === 'ready' && window.starAgent.state.controller.armed);
  expect((await state(page)).shipId).toBe('nomad');
}
async function note(page, label, extra = {}) {
  const current = await state(page);
  context.get(page).steps.push({ label, at: new Date().toISOString(), state: current, ...extra });
  return current;
}
async function shot(page, name) {
  await frames(page, 3);
  await page.screenshot({ path: `${context.get(page).dir}/${name}.png` });
  await note(page, name);
}
async function stopWalking(page) {
  await pad(page, { axes: [0, 0, 0, 0] });
  // The real controller brake stops the avatar, never the moving cabin hull.
  await tap(page, 1);await frames(page, 2);
}
async function lookAtLocal(page, point) {
  await neutral(page);
  for (let i = 0; i < 150; i++) {
    const error = await page.evaluate(point => {
      const n = window.starAgent.navigation;
      const target = n.position.clone().fromArray(point).applyQuaternion(n.shipOrientation).add(n.shipPosition);
      const local = target.sub(n.position).applyQuaternion(n.orientation.clone().invert());
      return [Math.atan2(local.x, -local.z), Math.atan2(local.y, Math.hypot(local.x, local.z))];
    }, point);
    if (Math.abs(error[0]) < .025 && Math.abs(error[1]) < .025) { await pad(page, { axes: [0, 0, 0, 0] });return; }
    const axis = v => Math.sign(v) * Math.min(1, .18 + Math.abs(v) * 1.5);
    await pad(page, { axes: [0, 0, axis(error[0]), axis(-error[1])] });await frames(page, 3);
  }
  await pad(page, { axes: [0, 0, 0, 0] });throw new Error('Controller RS did not converge on local view target');
}
async function walkTo(page, x, z, label) {
  await neutral(page);
  const deadline = Date.now() + 45000;
  let last;
  while (Date.now() < deadline) {
    last = await page.evaluate(({ x, z }) => {
      const n = window.starAgent.navigation, local = n.toShipLocal();
      if (n.mode !== 'walk' || n.berthRest || n.berthTransition || !local) return { invalid: window.starAgent.state };
      const desired = local.clone().set(x - local.x, 0, z - local.z), distance = desired.length();
      desired.normalize();
      const inverse = n.shipOrientation.clone().invert();
      const forward = local.clone().set(0, 0, -1).applyQuaternion(n.orientation).applyQuaternion(inverse);forward.y = 0;forward.normalize();
      const right = local.clone().set(1, 0, 0).applyQuaternion(n.orientation).applyQuaternion(inverse);right.y = 0;right.normalize();
      const speed = .16 + .84 * Math.min(.70, Math.max(.16, distance * .65));
      return { distance, local: local.toArray(), axes: [desired.dot(right) * speed, -desired.dot(forward) * speed, 0, 0] };
    }, { x, z });
    if (last.invalid) throw new Error(`Cannot walk to ${label}: ${JSON.stringify(last.invalid)}`);
    if (last.distance < .07) { await stopWalking(page);await note(page, label);return; }
    await pad(page, { axes: last.axes });await frames(page, 3);
  }
  await stopWalking(page);
  throw new Error(`Controller walking did not reach ${label}: target ${x},${z}; ${JSON.stringify(last)}`);
}
async function enterBerth(page) {
  await walkTo(page, 0, .55, 'aisle beside berth');
  await walkTo(page, -.30, .55, 'physical berth access');
  expect((await state(page)).interaction).toContain('REST IN BERTH');
  const approach = (await state(page)).shipLocal;
  await tap(page, 2);
  await page.waitForFunction(() => window.starAgent.state.berthRest && !window.starAgent.state.berthTransition);
  const rest = await state(page);
  expect(distance(rest.shipLocal, [-1.13, 2.02, 1.08])).toBeLessThan(.00001);
  expect(distance(rest.shipLocal, approach)).toBeGreaterThan(.5);
  expect(rest.insideShip).toBe(true);expect(rest.camera.mode).toBe('first-person');
  await note(page, 'rest posture reached');
  await neutral(page);
  return rest;
}
async function leaveBerthWithHeldInput(page) {
  // Keep LS, A and RT physically held through X and the whole stand transition.
  // A fresh X is legitimate; only that interaction may occur before neutral.
  await pad(page, { axes: [0, -1, 0, 0], buttons: { 0: 1, 7: 1, 2: 1 } });
  await pollButton(page, 2, true);
  await page.waitForFunction(() => !window.starAgent.state.berthRest && !window.starAgent.state.berthTransition);
  const stand = await state(page);await frames(page, 15);
  const held = await state(page);
  expect(held.controller.armed).toBe(false);
  expect(distance(held.shipLocal, [-.30, 2.75, .55])).toBeLessThan(.00001);
  expect(distance(held.shipLocal, stand.shipLocal)).toBeLessThan(.00001);
  expect(held.effects.weaponShots).toBe(stand.effects.weaponShots);
  expect(held.mining.tool.beaming).toBe(false);
  await note(page, 'berth exit holds require neutral');await neutral(page);
}
async function modalAndDeviceGuards(page) {
  const before = await state(page);
  await pad(page, { axes: [0, -1, 0, 0], buttons: { 7: 1 } });await frames(page, 6);
  expect(distance((await state(page)).shipLocal, before.shipLocal)).toBeLessThan(.00001);
  // B closes the real modal while movement/fire/confirm remain physically held.
  // A and B arrive together so B's real back action wins; a fresh standalone A
  // on the currently focused Attach button would legitimately attach another box.
  await pad(page, { buttons: { 0: 1, 1: 1 } });await pollButton(page, 1, true);
  await expect(page.locator('#cargo-dialog')).not.toBeVisible();
  await pad(page, { buttons: { 1: 0 } });await frames(page, 15);
  const resumed = await state(page);
  expect(resumed.controller.armed).toBe(false);
  expect(distance(resumed.shipLocal, before.shipLocal)).toBeLessThan(.00001);
  expect(resumed.effects.weaponShots).toBe(before.effects.weaponShots);
  expect(resumed.mining.tool.beaming).toBe(false);
  // Environmental/device fixtures are not navigation writes. Held axes remain
  // down during blur, reconnect, replacement and unsupported mapping recovery.
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));await frames(page, 4);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));await frames(page, 5);
  await page.evaluate(() => window.nomadReviewPad.connected = false);
  await page.waitForFunction(() => !window.starAgent.state.controller.connected);
  await page.evaluate(() => { window.nomadReviewPad.connected = true;window.nomadReviewPad.id = 'Replacement Nomad standard Gamepad'; });await frames(page, 5);
  await page.evaluate(() => window.nomadReviewPad.mapping = '');
  await page.waitForFunction(() => !window.starAgent.state.controller.connected);
  await page.evaluate(() => window.nomadReviewPad.mapping = 'standard');await frames(page, 8);
  const guarded = await state(page);
  expect(guarded.controller.armed).toBe(false);
  expect(distance(guarded.shipLocal, before.shipLocal)).toBeLessThan(.00001);
  expect(guarded.effects.weaponShots).toBe(before.effects.weaponShots);
  await note(page, 'modal and held-device recovery guards');await neutral(page);
}

test.beforeEach(async ({ page }, info) => {
  const dir = `${out}/${info.project.name}-${info.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
  await mkdir(dir, { recursive: true });
  const record = { dir, candidateStart: await candidate(), errors: [], warnings: [], failedRequests: [], steps: [] };
  context.set(page, record);
  page.on('pageerror', error => record.errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') record.errors.push(message.text());if (message.type() === 'warning') record.warnings.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) record.errors.push(`${response.status()} ${response.url()}`); });
  page.on('requestfailed', request => record.failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
});
test.afterEach(async ({ page, browser }, info) => {
  const record = context.get(page);if (!record) return;
  record.candidateEnd = await candidate();
  record.candidateFrozen = JSON.stringify(record.candidateStart.files) === JSON.stringify(record.candidateEnd.files);
  record.browser = browser.version();record.status = info.status;record.testErrors = info.errors.map(e => e.message);
  record.input = 'Injected W3C standard Gamepad through shared router; no keyboard, mouse, navigation setters, debug actions, inventory writes or localStorage writes. No physical device tested.';
  record.environment = await page.evaluate(() => {
    const canvas = document.getElementById('viewport'), gl = canvas?.getContext('webgl2'), ext = gl?.getExtension('WEBGL_debug_renderer_info');
    return { renderer: gl?.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER), viewport: [innerWidth, innerHeight], dpr: devicePixelRatio,
      renderScale: window.starAgent?.state.renderScale, canvas: canvas ? [canvas.width, canvas.height] : null };
  }).catch(error => ({ failed: error.message }));
  record.final = await state(page).catch(error => ({ failed: error.message }));
  await page.screenshot({ path: `${record.dir}/final.png` }).catch(() => {});
  await writeFile(`${record.dir}/report.json`, JSON.stringify(record, null, 2));
  expect(record.candidateFrozen, 'review candidate changed during browser journey').toBe(true);
  expect(record.errors, 'browser page/console/HTTP errors').toEqual([]);
  expect(record.warnings, 'browser warnings require explicit review').toEqual([]);
});

test('parked controller journey rests, transfers cargo, exits and boards physically, then launches', async ({ page }) => {
  await boot(page);await command(page, 'destination-moon');
  await page.waitForFunction(() => window.starAgent.state.body === 'selene' && !window.starAgent.state.transiting && window.starAgent.state.controller.armed);
  await tap(page, 3);await page.waitForFunction(() => window.starAgent.state.mode === 'landed', null, { timeout: 90000 });
  const landed = await state(page);expect(landed.landingGear.progress).toBe(1);
  expect(landed.landingGear.visual).toBe(1);await shot(page, 'landed-cockpit');
  await tap(page, 2);await page.waitForFunction(() => window.starAgent.state.mode === 'walk');
  const rest = await enterBerth(page);
  await pad(page, { axes: [0, -1, 0, 0], buttons: { 0: 1, 7: 1 } });await frames(page, 20);
  const heldRest = await state(page);
  expect(distance(heldRest.shipLocal, rest.shipLocal)).toBeLessThan(.00001);
  expect(heldRest.effects.weaponShots).toBe(rest.effects.weaponShots);
  expect(heldRest.mining.tool.beaming).toBe(false);await neutral(page);
  await shot(page, 'parked-berth');await leaveBerthWithHeldInput(page);
  await walkTo(page, 0, .55, 'clear berth');await walkTo(page, 0, 2.7, 'aft aisle');
  await walkTo(page, -.30, 2.7, 'cargo rack access');
  expect((await state(page)).interaction).toContain('OPEN CARGO STORAGE');
  const beforeCargo = await state(page);
  const shipBefore = beforeCargo.containers.containers.find(c => c.id === 'ship');
  const packBefore = beforeCargo.containers.containers.find(c => c.id === 'pack');
  await tap(page, 2);await expect(page.locator('#cargo-dialog')).toBeVisible();await neutral(page);
  const repairKey = await page.locator('#cargo-dialog [data-from="ship"][data-item="repair"]').first().getAttribute('data-controller-key');
  await activateKey(page, repairKey);await activateKey(page, 'transfer-one');
  await expect(page.locator('[data-controller-key="transfer-one"]')).toBeFocused();
  await activateKey(page, 'add-box-ship');
  await page.waitForFunction(boxes => window.starAgent.state.nomadCargo.boxes === boxes, shipBefore.boxes + 1);
  const afterCargo = await state(page);
  const shipAfter = afterCargo.containers.containers.find(c => c.id === 'ship');
  const packAfter = afterCargo.containers.containers.find(c => c.id === 'pack');
  expect(shipAfter.items.repair).toBe(shipBefore.items.repair - 1);
  expect(packAfter.items.repair).toBe(packBefore.items.repair + 1);
  expect(afterCargo.nomadCargo).toMatchObject({ boxes: 5, slots: 40, supplies: 29, supplyLimit: 120, mineralLimit: 60 });
  expect(afterCargo.containers.saved).toBe(true);await shot(page, 'controller-cargo-result');
  await modalAndDeviceGuards(page);
  await walkTo(page, 1.05, 2.70, 'opposite aisle rack inspection');
  await lookAtLocal(page, [-1.10, 2.25, 2.84]);await shot(page, 'live-fifth-cargo-box');
  if (page.viewportSize().width < 500) {
    await lookAtLocal(page, [-1.10, 2.30, 2.20]);await shot(page, 'fifth-cargo-box-phone-detail');
  }
  await lookAtLocal(page, [-.879, 2.91, 2.83]);await shot(page, 'physical-cargo-readout');
  await walkTo(page, 0, 2.7, 'hatch control');await tap(page, 2);
  await page.waitForFunction(() => window.starAgent.state.doorProgress === 1);
  await walkTo(page, 0, 4.6, 'physical ramp upper section');
  const ramp = await state(page);expect(ramp.shipLocal[1]).toBeLessThan(2.75);
  expect(ramp.shipLocal[1]).toBeGreaterThan(1.75);await shot(page, 'walking-down-ramp');
  await walkTo(page, 0, 8.6, 'terrain beyond ramp');
  const outside = await state(page);expect(outside.insideShip).toBe(false);
  await tap(page, 2);await frames(page, 3);
  expect(distance((await state(page)).position, outside.position)).toBeLessThan(.001);
  expect((await state(page)).mode).toBe('walk');await shot(page, 'outside-no-distance-boarding');
  await walkTo(page, 0, 4.6, 'return up physical ramp');
  await walkTo(page, 0, 2.7, 'back inside hatch');expect((await state(page)).insideShip).toBe(true);
  await tap(page, 2);await page.waitForFunction(() => window.starAgent.state.doorProgress === 0);
  await walkTo(page, 0, -1.45, 'pilot chair access');
  expect((await state(page)).interaction).toContain('SIT IN PILOT CHAIR');
  await tap(page, 2);expect((await state(page)).mode).toBe('landed');
  await tap(page, 3);
  await page.waitForFunction(() => window.starAgent.state.mode === 'flight');
  expect((await state(page)).landingGear.target).toBe(true);
  await command(page, 'gear');await neutral(page);
  await pad(page, { buttons: { 7: 1 } });
  await page.waitForFunction(() => window.starAgent.state.mode === 'flight' && window.starAgent.state.landingGear.progress === 0);
  const launched = await state(page);expect(launched.doorProgress).toBe(0);expect(launched.insideShip).toBe(false);
  expect(launched.landingGear.visual).toBe(0);await neutral(page);
  await page.waitForFunction(() => window.starAgent.state.mfds.some(display => display.title === 'SYSTEMS' && display.values.includes('LANDING GEAR: STOWED')));
  await shot(page, 'launch-and-stowed-gear');
  await page.reload();await page.waitForFunction(() => window.starAgent?.state.ready && window.starAgent.state.shipAsset === 'ready');
  const restored = await state(page);
  expect(restored.containers.containers.find(c => c.id === 'ship')).toEqual(shipAfter);
  expect(restored.containers.containers.find(c => c.id === 'pack')).toEqual(packAfter);
  // The idle title view deliberately hides the ship and does not update its
  // display cache. Re-enter through real controller X before inspecting it.
  await neutral(page);await tap(page, 2);
  await page.waitForFunction(() => window.starAgent.state.mode === 'walk' && window.starAgent.state.insideShip);
  await expect.poll(async () => (await state(page)).nomadCargo).toMatchObject({ boxes: 5, slots: 40, supplies: 29, mineralLimit: 60 });
  await note(page, 'cargo persisted across normal reload');
});

for (const inertial of [false, true]) test(`${inertial ? 'rotating inertial' : 'assisted moving'} controller berth retains hull motion and returns to the chair`, async ({ page }) => {
  await boot(page);
  if (inertial) { await tap(page, 11);expect((await state(page)).flightAssist).toBe(false); }
  await pad(page, { axes: [0, -1, 0, 0] });
  await page.waitForFunction(() => window.starAgent.state.shipSpeed > 35);
  if (inertial) {
    await pad(page, { buttons: { 5: 1 } });
    await page.waitForFunction(() => Math.hypot(...window.starAgent.state.angularVelocity) > .12);
  }
  await tap(page, 2);await neutral(page);
  let cabin = await state(page);expect(cabin.mode).toBe('walk');expect(cabin.cabinFlight).toBe(true);expect(cabin.shipSpeed).toBeGreaterThan(25);
  await walkTo(page, 0, 2.7, 'moving hatch safety check');await tap(page, 2);
  expect((await state(page)).doorOpen).toBe(false);expect((await state(page)).doorProgress).toBe(0);
  const rest = await enterBerth(page);
  await note(page, 'moving hold start');
  await frames(page, 75);const carried = await note(page, 'moving hold end');
  expect(distance(carried.shipLocal, rest.shipLocal)).toBeLessThan(.00001);
  expect(distance(carried.shipPosition, rest.shipPosition)).toBeGreaterThan(15);
  expect(carried.shipSpeed).toBeGreaterThan(25);expect(carried.cabinFlight).toBe(true);
  expect(carried.camera.mode).toBe('first-person');
  if (inertial) {
    const dot = Math.min(1, Math.abs(carried.shipOrientation.reduce((sum, value, i) => sum + value * rest.shipOrientation[i], 0)));
    expect(2 * Math.acos(dot)).toBeGreaterThan(.02);
  } else expect(Math.abs(carried.shipSpeed - rest.shipSpeed)).toBeLessThan(2);
  await shot(page, 'moving-berth');await leaveBerthWithHeldInput(page);
  await walkTo(page, 0, .55, 'clear berth in moving hull');await walkTo(page, 0, -1.45, 'moving pilot chair access');
  cabin = await state(page);await tap(page, 2);const seated = await state(page);
  await note(page, 'moving chair reentry', { velocityBefore: cabin.shipVelocity, speedBefore: cabin.shipSpeed,
    velocityAfter: seated.velocity, speedAfter: seated.shipSpeed });
  expect(seated.mode).toBe('flight');expect(seated.cabinFlight).toBe(false);expect(seated.berthRest).toBe(false);
  expect(seated.shipSpeed).toBeGreaterThan(15);
  if (inertial) expect(distance(seated.velocity, cabin.shipVelocity)).toBeLessThan(5);
  else {
    // The first seated update already applies normal assist braking with LS
    // released. Verify retained course and substantial velocity, not zero decay.
    const dot = seated.velocity.reduce((sum, value, i) => sum + value * cabin.shipVelocity[i], 0);
    expect(dot / (seated.shipSpeed * cabin.shipSpeed)).toBeGreaterThan(.999);
    expect(seated.shipSpeed / cabin.shipSpeed).toBeGreaterThan(.5);
    expect(seated.shipSpeed / cabin.shipSpeed).toBeLessThanOrEqual(1.01);
  }
  await shot(page, 'returned-to-moving-pilot');
});
