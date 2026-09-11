import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

/** A controller-only journey through the new retail promenade: berth, elevator,
 * concourse, the opened aft portal, all four storefronts with a real purchase in
 * each, the sealed Deck 05 door, and the walk back. Nothing here writes a pose,
 * teleports, or sets inventory: every metre is driven through the gamepad. */
const state = page => page.evaluate(() => window.starAgent.state);
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
const records = new WeakMap();
const frames = (page, n = 3) => page.evaluate(n => new Promise(resolve => {
  const tick = () => --n <= 0 ? resolve() : requestAnimationFrame(tick);
  requestAnimationFrame(tick);
}), n);
const SHOPS = [
  { id: 'galley', name: 'LONGREACH GALLEY', at: [-8.6, -25.7], lane: [-3.4, -25.7], buy: 'Buy Brew flask for 12 credits', item: 'brew', price: 12 },
  { id: 'outfitter', name: 'TIDEWELL OUTFITTERS', at: [8.6, -25.7], lane: [3.4, -25.7], buy: 'Buy Work gloves for 60 credits', item: 'gloves', price: 60 },
  { id: 'hydroponics', name: 'GREENSIDE HYDROPONICS', at: [-8.6, -38.9], lane: [-3.4, -38.9], buy: 'Buy Culinary herb pot for 45 credits', item: 'herbs', price: 45 },
  { id: 'souvenir', name: 'WAYPOINT SOUVENIRS', at: [8.6, -38.9], lane: [3.4, -38.9], buy: 'Buy Printed system chart for 25 credits', item: 'chart', price: 25 },
];

async function pad(page, axes = [0, 0, 0, 0], buttons = {}) {
  await page.evaluate(({ axes, buttons }) => {
    window.promenadePad.axes = axes;
    for (const [i, value] of Object.entries(buttons)) window.promenadePad.buttons[i] = { value, pressed: value > .5 };
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
  records.get(page).steps.push({ label, at: new Date().toISOString(), state: await state(page) });
}
async function shot(page, label) {
  await frames(page);
  await page.screenshot({ path: `${records.get(page).dir}/${label}.png` });
  await note(page, label);
  records.get(page).steps.at(-1).sceneMetrics = await page.evaluate(() => {
    const s = window.starAgent.state, canvas = document.querySelector('#viewport');
    return { drawCalls: s.drawCalls, triangles: s.triangles, renderedFrames: s.renderedFrames,
      viewport: [innerWidth, innerHeight], drawingBuffer: canvas && [canvas.width, canvas.height],
      renderScale: s.renderScale, dpr: devicePixelRatio, modalOpen: Boolean(document.querySelector('dialog[open]')) };
  });
}
/** Drive toward a local waypoint with the left stick. A real player pressed
 * against station furniture steps around it, so when progress stalls this holds
 * a perpendicular heading for a moment and resumes. Still only stick input: no
 * pose is written and no collision is bypassed. */
async function walk(page, frame, x, z, label) {
  await neutral(page);
  const deadline = Date.now() + 120000;
  let result, best = Infinity, stalled = 0, slipTicks = 0, slipDir = 1;
  while (Date.now() < deadline) {
    const slip = slipTicks > 0 ? slipDir : 0;
    result = await page.evaluate(({ frame, x, z, slip }) => {
      const n = window.starAgent.navigation;
      const local = frame === 'ship' ? n.toShipLocal() : n.stationLocal;
      if (n.mode !== 'walk' || !local) return { invalid: true };
      const inverse = (frame === 'ship' ? n.shipOrientation : n.station.quaternion).clone().invert();
      const desired = local.clone().set(x - local.x, 0, z - local.z), d = desired.length();
      desired.normalize();
      if (slip) desired.set(-desired.z * Math.sign(slip), 0, desired.x * Math.sign(slip));
      const forward = local.clone().set(0, 0, -1).applyQuaternion(n.orientation).applyQuaternion(inverse); forward.y = 0; forward.normalize();
      const right = local.clone().set(1, 0, 0).applyQuaternion(n.orientation).applyQuaternion(inverse); right.y = 0; right.normalize();
      const gain = Math.min(1, .25 + d * .5);
      return { d, local: local.toArray(), axes: [desired.dot(right) * gain, -desired.dot(forward) * gain, 0, 0] };
    }, { frame, x, z, slip });
    if (result.invalid) throw new Error(`Invalid walking state at ${label}`);
    if (result.d < .2) { await pad(page); await note(page, label); return result; }
    // Sidestep for a bounded burst, then resume the direct heading.
    if (slipTicks > 0) slipTicks--;
    else if (result.d < best - .08) { best = result.d; stalled = 0; }
    else if (++stalled > 12) { stalled = 0; slipDir = -slipDir; slipTicks = 16; best = result.d; }
    await pad(page, result.axes);
  }
  await pad(page);
  throw new Error(`Physical route blocked at ${label}: ${JSON.stringify(result)}`);
}
/** Turn the view toward a hub-local point with the right stick only. */
async function face(page, x, y, z) {
  await neutral(page);
  for (let i = 0; i < 220; i++) {
    const error = await page.evaluate(({ x, y, z }) => {
      const n = window.starAgent.navigation;
      const target = n.position.clone().set(x, y, z);
      const p = n.station.toWorld(target, n.position.clone()).sub(n.position).applyQuaternion(n.orientation.clone().invert());
      return [Math.atan2(p.x, -p.z), Math.atan2(p.y, Math.hypot(p.x, p.z))];
    }, { x, y, z });
    if (error.every(v => Math.abs(v) < .03)) { await pad(page); return; }
    const axis = v => Math.sign(v) * Math.min(1, .18 + Math.abs(v) * 1.5);
    await pad(page, [0, 0, axis(error[0]), axis(-error[1])]);
  }
  await pad(page); throw new Error('Controller view did not converge');
}
/** Alternate the new room on and off at one fixed camera pose and keep both
 * halves of every pair. This is the room's own render cost, measured in the same
 * session against the same scene; RAF cadence is recorded separately from draw
 * and triangle counts and is explicitly not a GPU timer result. */
async function alternate(page, label, samples = 5) {
  const pairs = [];
  for (let i = 0; i < samples; i++) {
    for (const visible of [true, false]) {
      const measured = await page.evaluate(async visible => {
        const promenade = window.starAgent.navigation.station.hub.promenade;
        promenade.group.visible = visible;
        const info = window.starAgent.state;
        const intervals = [];
        await new Promise(resolve => {
          let n = 40, previous = performance.now();
          const tick = now => { intervals.push(now - previous); previous = now; --n <= 0 ? resolve() : requestAnimationFrame(tick); };
          requestAnimationFrame(tick);
        });
        const after = window.starAgent.state;
        promenade.group.visible = true;
        intervals.sort((a, b) => a - b);
        return { visible, drawCalls: after.drawCalls, triangles: after.triangles,
          medianFrameMs: intervals[intervals.length >> 1], p95FrameMs: intervals[Math.floor(intervals.length * .95)],
          startedFrom: info.renderedFrames };
      }, visible);
      pairs.push(measured);
    }
  }
  (records.get(page).alternation ??= {})[label] = pairs;
  const on = pairs.filter(p => p.visible), off = pairs.filter(p => !p.visible);
  const median = values => values.sort((a, b) => a - b)[values.length >> 1];
  return {
    label,
    drawDelta: median(on.map(p => p.drawCalls)) - median(off.map(p => p.drawCalls)),
    triangleDelta: median(on.map(p => p.triangles)) - median(off.map(p => p.triangles)),
    frameMsWith: median(on.map(p => p.medianFrameMs)), frameMsWithout: median(off.map(p => p.medianFrameMs)),
  };
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
  await expect(button).toBeFocused();
  return button;
}

test.beforeEach(async ({ page }, info) => {
  const root = process.env.PROMENADE_QA_OUT || `test-results/promenade-evidence/${Date.now()}`;
  const dir = `${root}/${/keyboard/.test(info.title) ? 'keyboard' : 'controller'}`;
  await mkdir(dir, { recursive: true });
  const record = { dir, errors: [], warnings: [], failedRequests: [], steps: [] }; records.set(page, record);
  page.on('pageerror', error => record.errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') record.errors.push(message.text());
    if (message.type() === 'warning') record.warnings.push(message.text());
  });
  page.on('response', response => { if (response.status() >= 400) record.errors.push(`${response.status()} ${response.url()}`); });
  // Name every failed request, so a console "Failed to load resource" line can
  // be explained rather than waved away.
  page.on('requestfailed', request => record.failedRequests.push(`${request.failure()?.errorText} ${request.url()}`));
  await page.addInitScript(() => {
    window.promenadePad = { id: 'Promenade QA standard gamepad', index: 0, mapping: 'standard', connected: true,
      axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    navigator.getGamepads = () => [window.promenadePad];
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
      renderScale: window.starAgent?.state.renderScale, dpr: devicePixelRatio };
  }).catch(e => ({ error: e.message }));
  await page.screenshot({ path: `${r.dir}/final.png` }).catch(() => {});
  await writeFile(`${r.dir}/report.json`, JSON.stringify(r, null, 2));
  expect(r.errors, 'page, console and HTTP errors').toEqual([]);
});

test('a controller walks the promenade, buys in all four units and is refused at the sealed door', async ({ page }) => {
  await page.route('**/api/auth/session', route => route.request().method() === 'GET'
    ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ account: null }) })
    : route.continue());
  await page.goto('/?dev=1&ship=nomad&start=hangar&intro=0&debug&seed=7291');
  await page.waitForFunction(() => window.starAgent?.state.ready && window.starAgent.state.shipAsset === 'ready'
    && window.starAgent.state.controller.armed);
  await page.waitForFunction(() => window.starAgent.state.station.docked && window.starAgent.state.station.ready);
  await page.waitForFunction(() => window.starAgent.state.station.finish === 'ready', null, { timeout: 90000 });

  // Leave the ship and ride the passenger elevator to the hub, on foot.
  await tap(page, 2); await page.waitForFunction(() => window.starAgent.state.mode === 'walk');
  await walk(page, 'ship', 0, 2.7, 'hatch control');
  await tap(page, 2); await page.waitForFunction(() => window.starAgent.state.doorProgress > .99);
  await walk(page, 'ship', 0, 13, 'outside rear ramp');
  await walk(page, 'station', 0, 20, 'hangar lift call');
  await tap(page, 2); await page.waitForFunction(() => window.starAgent.state.station.elevator > .99);
  await walk(page, 'station', 0, 24, 'inside station lift');
  await tap(page, 2);
  await expect(page.locator('#station-elevator-dialog')).toBeVisible();
  await (await choose(page, 'Central hub · Hands free')).press('Enter');
  await page.waitForFunction(() => window.starAgent.state.station.location === 'hub'
    && window.starAgent.navigation.enabled && window.starAgent.state.station.elevator > .99);
  await neutral(page);

  // The aft wall used to be a flat directory. Look at the hanging gantry from
  // the concourse, then walk under it and through the new portal.
  await walk(page, 'station', 0, 6, 'central concourse');
  await face(page, 0, -3.4, -17);
  await shot(page, 'concourse-gantry-desktop');
  await walk(page, 'station', 0, -12, 'approaching the portal');
  await face(page, 0, -6.3, -34);
  await shot(page, 'portal-approach-desktop');
  await walk(page, 'station', 0, -22, 'inside the promenade');
  await shot(page, 'promenade-entry-desktop');
  const cost = await alternate(page, 'promenade-entry');
  records.get(page).roomCost = [cost];
  expect(cost.triangleDelta).toBeGreaterThan(0);

  const opening = await state(page);
  expect(opening.station.location).toBe('hub');
  let credits = opening.inventory.credits;

  for (const shop of SHOPS) {
    await walk(page, 'station', shop.lane[0], shop.lane[1], `${shop.id} frontage`);
    await face(page, shop.at[0] * 1.35, -6.6, shop.at[1]);
    await shot(page, `${shop.id}-storefront-desktop`);
    await walk(page, 'station', shop.at[0], shop.at[1], `${shop.id} counter`);
    await face(page, shop.at[0] * 1.45, -6.7, shop.at[1] + .6);
    await shot(page, `${shop.id}-counter-desktop`);
    expect((await state(page)).interaction, `${shop.id} prompt`).toContain(shop.name);

    await tap(page, 2);
    await expect(page.locator('#station-shop-dialog')).toBeVisible();
    await expect(page.locator('#station-shop-title')).toHaveText(shop.name);
    await shot(page, `${shop.id}-catalogue-desktop`);
    await page.setViewportSize({ width: 390, height: 844 }); await shot(page, `${shop.id}-catalogue-mobile`);
    await page.setViewportSize({ width: 1440, height: 900 });
    const before = await state(page);
    await choose(page, shop.buy);
    await pad(page, undefined, { 0: 1 }); await frames(page, 60);
    await expect(page.locator('.shop-feedback')).toContainText('Delivered to your station warehouse');
    const bought = await state(page);
    expect(bought.inventory.credits).toBe(before.inventory.credits - shop.price);
    expect(bought.inventory.station[shop.item]).toBe((before.inventory.station[shop.item] || 0) + 1);
    credits = bought.inventory.credits;
    // Close with B; a held stick during the modal must not move the player.
    await pad(page, [0, -1, 0, 0], { 1: 1 });
    await expect(page.locator('#station-shop-dialog')).not.toBeVisible();
    await pad(page, [0, -1, 0, 0], { 1: 0 }); await frames(page, 15);
    expect((await state(page)).controller.armed).toBe(false);
    expect(distance((await state(page)).position, bought.position)).toBeLessThan(.001);
    await neutral(page);
    await walk(page, 'station', shop.lane[0], shop.lane[1], `${shop.id} back to the corridor`);
  }

  // The mid court keeps the station panorama the concourse windows established.
  await walk(page, 'station', 0, -32.3, 'mid court');
  await face(page, -13.3, -6, -32.3);
  await shot(page, 'mid-court-window-desktop');

  // The aft bulkhead is locked and says so instead of silently stopping.
  await walk(page, 'station', 0, -46.2, 'sealed door approach');
  await face(page, 0, -5.4, -49);
  await shot(page, 'sealed-door-desktop');
  const atDoor = await state(page);
  expect(atDoor.interaction, `standing at ${atDoor.station.local}`).toContain('SEALED');
  await tap(page, 2);
  await frames(page, 20);
  const afterPress = await state(page);
  expect(page.locator('dialog[open]')).toHaveCount(0);
  expect(afterPress.station.location).toBe('hub');
  expect(distance(afterPress.position, atDoor.position)).toBeLessThan(.6);
  await expect(page.locator('#toast')).toContainText('SEALED');

  // Walk all the way back: the portal is a two-way route, not a one-way drop.
  await walk(page, 'station', 0, -30, 'leaving the aft hall');
  await walk(page, 'station', 0, -22, 'returning up the corridor');
  await walk(page, 'station', 0, -12, 'back through the portal');
  await walk(page, 'station', 0, 6, 'back in the concourse');
  const returned = await state(page);
  expect(returned.station.location).toBe('hub');
  expect(returned.inventory.credits).toBe(credits);
  await shot(page, 'returned-concourse-desktop');
  records.get(page).roomCost.push(await alternate(page, 'concourse-looking-aft'));
});

/** Keyboard and phone-viewport coverage of the same room. WASD and the arrow
 * keys are the default desktop controls and F is the interact key the HUD names,
 * so this is the route a player without a controller actually takes. */
async function bearing(page, frame, x, z) {
  return page.evaluate(({ frame, x, z }) => {
    const n = window.starAgent.navigation;
    const local = frame === 'ship' ? n.toShipLocal() : n.stationLocal;
    if (n.mode !== 'walk' || !local) return null;
    const inverse = (frame === 'ship' ? n.shipOrientation : n.station.quaternion).clone().invert();
    const desired = local.clone().set(x - local.x, 0, z - local.z), d = desired.length();
    desired.normalize();
    const forward = local.clone().set(0, 0, -1).applyQuaternion(n.orientation).applyQuaternion(inverse); forward.y = 0; forward.normalize();
    const right = local.clone().set(1, 0, 0).applyQuaternion(n.orientation).applyQuaternion(inverse); right.y = 0; right.normalize();
    return { d, yaw: Math.atan2(desired.dot(right), desired.dot(forward)) };
  }, { frame, x, z });
}
async function focusGame(page) {
  await page.evaluate(() => document.querySelector('#viewport')?.focus());
}
async function keyTurn(page, frame, x, z, limit = 400) {
  for (let i = 0; i < limit; i++) {
    const at = await bearing(page, frame, x, z);
    if (!at) throw new Error('Invalid keyboard walking state');
    if (Math.abs(at.yaw) < .06) return at;
    const key = at.yaw > 0 ? 'ArrowRight' : 'ArrowLeft';
    await page.keyboard.down(key); await frames(page, 2); await page.keyboard.up(key);
  }
  throw new Error('Keyboard view did not converge');
}
async function keyWalk(page, frame, x, z, label) {
  await focusGame(page);
  const deadline = Date.now() + 180000;
  let best = Infinity, stalled = 0, side = 1, at;
  while (Date.now() < deadline) {
    at = await keyTurn(page, frame, x, z);
    if (at.d < .35) { await page.keyboard.up('KeyW'); await note(page, `keyboard ${label}`); return at; }
    if (at.d < best - .1) { best = at.d; stalled = 0; }
    else if (++stalled > 8) {
      // Step around station furniture with the strafe keys, as a player would,
      // alternating sides and backing off a little if one side is also blocked.
      stalled = 0; side = -side;
      const key = side > 0 ? 'KeyD' : 'KeyA';
      await page.keyboard.down('KeyS'); await frames(page, 5); await page.keyboard.up('KeyS');
      await page.keyboard.down(key); await frames(page, 22); await page.keyboard.up(key);
      best = Infinity;
    }
    await page.keyboard.down('KeyW'); await frames(page, 6); await page.keyboard.up('KeyW');
  }
  await page.keyboard.up('KeyW');
  throw new Error(`Keyboard route blocked at ${label}: ${JSON.stringify(at)}`);
}

test('keyboard and a phone viewport reach the same storefronts and the sealed door', async ({ page }) => {
  await page.route('**/api/auth/session', route => route.request().method() === 'GET'
    ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ account: null }) })
    : route.continue());
  await page.addInitScript(() => { navigator.getGamepads = () => []; });
  await page.goto('/?dev=1&ship=nomad&start=hangar&intro=0&debug&seed=7291');
  await page.waitForFunction(() => window.starAgent?.state.ready && window.starAgent.state.shipAsset === 'ready');
  await page.waitForFunction(() => window.starAgent.state.station.docked && window.starAgent.state.station.ready);
  await page.waitForFunction(() => window.starAgent.state.station.finish === 'ready', null, { timeout: 90000 });
  await focusGame(page);

  await page.keyboard.press('KeyF');
  await page.waitForFunction(() => window.starAgent.state.mode === 'walk');
  await keyWalk(page, 'ship', 0, 2.7, 'hatch control');
  await page.keyboard.press('KeyF');
  await page.waitForFunction(() => window.starAgent.state.doorProgress > .99);
  await keyWalk(page, 'ship', 0, 13, 'outside rear ramp');
  await keyWalk(page, 'station', 0, 20, 'hangar lift call');
  await page.keyboard.press('KeyF');
  await page.waitForFunction(() => window.starAgent.state.station.elevator > .99);
  await keyWalk(page, 'station', 0, 24, 'inside station lift');
  await page.keyboard.press('KeyF');
  await expect(page.locator('#station-elevator-dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Central hub · Hands free' }).click();
  await page.waitForFunction(() => window.starAgent.state.station.location === 'hub'
    && window.starAgent.navigation.enabled && window.starAgent.state.station.elevator > .99);

  await keyWalk(page, 'station', 0, -22, 'inside the promenade');
  await keyTurn(page, 'station', 0, -48);
  await shot(page, 'keyboard-promenade-desktop');
  await page.setViewportSize({ width: 390, height: 844 }); await frames(page, 10);
  await shot(page, 'keyboard-promenade-phone');
  await page.setViewportSize({ width: 1440, height: 900 }); await frames(page, 10);

  await keyWalk(page, 'station', -3.4, -26.4, 'galley frontage');
  await keyWalk(page, 'station', -6.8, -26.6, 'galley aisle');
  await keyWalk(page, 'station', -8.6, -25.7, 'galley counter');
  expect((await state(page)).interaction).toContain('LONGREACH GALLEY');
  await page.keyboard.press('KeyF');
  await expect(page.locator('#station-shop-dialog')).toBeVisible();
  const before = await state(page);
  await page.getByRole('button', { name: 'Buy Hot meal tray for 18 credits', exact: true }).click();
  await expect(page.locator('.shop-feedback')).toContainText('Delivered to your station warehouse');
  expect((await state(page)).inventory.credits).toBe(before.inventory.credits - 18);
  await page.setViewportSize({ width: 390, height: 844 }); await frames(page, 5);
  await shot(page, 'keyboard-catalogue-phone');
  await page.setViewportSize({ width: 1440, height: 900 }); await frames(page, 5);
  await page.keyboard.press('Escape');
  await expect(page.locator('#station-shop-dialog')).not.toBeVisible();

  await keyWalk(page, 'station', 0, -30, 'back to the corridor');
  await keyWalk(page, 'station', 0, -46.2, 'sealed door');
  const atDoor = await state(page);
  expect(atDoor.interaction, `standing at ${atDoor.station.local}`).toContain('SEALED');
  await page.keyboard.press('KeyF');
  await frames(page, 20);
  await expect(page.locator('#toast')).toContainText('SEALED');
  await shot(page, 'keyboard-sealed-door-desktop');
});
