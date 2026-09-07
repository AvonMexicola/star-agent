import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const output = process.env.MULTIPLAYER_EVIDENCE ?? '/tmp/star-agent-hangar-physics-evidence';
const password = 'shared-flight-2026';

async function pulse(page, index) {
  await page.evaluate(i => { window.multiplayerPad.buttons[i] = { pressed: true, value: 1 }; }, index);
  await page.waitForTimeout(90);
  await page.evaluate(i => { window.multiplayerPad.buttons[i] = { pressed: false, value: 0 }; }, index);
  await page.waitForTimeout(130);
}

async function controllerFocus(page, key, limit = 80) {
  const target = page.locator(`[data-controller-key="${key}"]`);
  for (let i = 0; i < limit; i++) {
    if (await target.evaluate(element => element === document.activeElement)) return target;
    await pulse(page, 13);
  }
  await expect(target).toBeFocused(); return target;
}

async function utilityShortcut(page, directionButton) {
  await page.evaluate(() => { for (const i of [4, 5]) window.multiplayerPad.buttons[i] = { pressed: true, value: 1 }; });
  await page.waitForTimeout(120); await pulse(page, directionButton);
  await page.evaluate(() => { for (const i of [4, 5]) window.multiplayerPad.buttons[i] = { pressed: false, value: 0 }; });
  await page.waitForTimeout(180);
}

async function controllerGravityJourney(page) {
  await expect.poll(() => page.evaluate(() => window.starAgent.state.controller.armed)).toBe(true);
  const idle=await page.evaluate(()=>window.starAgent.state.position);
  await pulse(page,9);
  await expect(page.locator('#controller-menu')).toBeVisible();
  await page.evaluate(()=>{window.multiplayerPad.axes[1]=-.8;});
  await pulse(page,1);
  await expect(page.locator('#controller-menu')).not.toBeVisible();
  await page.waitForTimeout(400);
  const displacement=()=>page.evaluate(start=>Math.hypot(...window.starAgent.state.position.map((v,i)=>v-start[i])),idle);
  expect(await displacement()).toBeLessThan(.02);
  await page.evaluate(()=>{window.dispatchEvent(new Event('blur'));window.dispatchEvent(new Event('focus'));});
  await page.waitForTimeout(400);
  expect(await displacement()).toBeLessThan(.02);
  await page.evaluate(()=>{window.multiplayerPad.connected=false;});
  await page.waitForTimeout(250);
  await page.evaluate(()=>{window.multiplayerPad.connected=true;});
  await page.waitForTimeout(400);
  expect(await displacement()).toBeLessThan(.02);
  await page.evaluate(()=>{window.multiplayerPad.axes[1]=0;});
  await expect.poll(()=>page.evaluate(()=>window.starAgent.state.controller.armed)).toBe(true);
  const floor = await page.evaluate(() => window.starAgent.state.station.deckClearance);
  await page.evaluate(() => { window.multiplayerPad.buttons[0] = { pressed: true, value: 1 }; });
  await expect.poll(() => page.evaluate(() => window.starAgent.state.station.deckClearance)).toBeGreaterThan(floor + .25);
  await page.evaluate(() => { window.multiplayerPad.buttons[0] = { pressed: false, value: 0 }; });
  await expect.poll(() => page.evaluate(() => window.starAgent.state.station.deckClearance)).toBeCloseTo(floor, 3);
  await page.screenshot({ path: `${output}/assigned-hangar-deck.png` });

  await page.evaluate(() => { window.multiplayerPad.axes[1] = -1; });
  await expect.poll(() => page.evaluate(() => window.starAgent.state.mode), { timeout: 25000 }).toBe('eva');
  await page.evaluate(() => { window.multiplayerPad.axes[1] = 0; window.multiplayerPad.buttons[6] = { pressed: true, value: 1 }; });
  await expect.poll(() => page.evaluate(() => window.starAgent.state.speed)).toBeLessThan(.1);
  await page.evaluate(() => { window.multiplayerPad.buttons[6] = { pressed: false, value: 0 }; });
  const ownShip = await page.evaluate(() => window.starAgent.state.shipPosition);

  // Debug state is read for steering only. All pose changes come from sticks,
  // including the turn back toward the same open doorway from EVA.
  for (let i = 0; i < 120; i++) {
    const yaw = await page.evaluate(() => {
      const n = window.starAgent.navigation;
      const target = n.station.toLocal(n.position, n.position.clone());
      target.z = n.station.openingZ + 8;
      const direction = n.station.toWorld(target, target).sub(n.position).applyQuaternion(n.orientation.clone().invert());
      return Math.atan2(direction.x, -direction.z);
    });
    if (Math.abs(yaw) < .04) break;
    await page.evaluate(yaw => { window.multiplayerPad.axes[2] = Math.max(-1, Math.min(1, yaw * 2)); }, yaw);
    await page.waitForTimeout(100);
  }
  await page.evaluate(() => { window.multiplayerPad.axes[2] = 0; window.multiplayerPad.axes[1] = -.65; });
  await expect.poll(() => page.evaluate(() => window.starAgent.state.mode), { timeout: 20000 }).toBe('walk');
  await page.waitForTimeout(750);
  await page.evaluate(() => { window.multiplayerPad.axes[1] = 0; });
  await expect.poll(() => page.evaluate(() => window.starAgent.state.station.deckClearance)).toBeCloseTo(floor, 3);
  expect(await page.evaluate(() => window.starAgent.state.shipPosition)).toEqual(ownShip);
  await page.screenshot({ path: `${output}/eva-return-to-gravity.png` });
}

async function setup(page, errors) {
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  page.on('pageerror', error => errors.push(`page: ${error.message}`));
  page.on('requestfailed', request => errors.push(`request: ${request.url()} ${request.failure()?.errorText}`));
  await page.addInitScript(() => {
    window.multiplayerPad = { id: 'Automated standard Xbox multiplayer', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    Object.defineProperty(navigator, 'getGamepads', { value: () => [window.multiplayerPad] });
  });
  await page.goto('/?debug');
  await expect.poll(async () => {
    if(errors.length)throw new Error(errors.join('\n'));
    return page.evaluate(() => window.starAgent?.state.ready);
  }, { timeout: 90000 }).toBe(true);
  await expect(page.locator('#multiplayer-account-dialog')).toBeVisible();
}

async function register(page, email, callsign, controllerJoin = false) {
  await page.locator('[data-auth-view=register]').click();
  await page.locator('#mp-register-email').fill(email);
  await page.locator('#mp-register-callsign').fill(callsign);
  await page.locator('#mp-register-password').fill(password);
  await page.locator('[data-auth-form=register] button[type=submit]').click();
  await expect(page.locator('[data-account-callsign]')).toHaveText(callsign);
  if (controllerJoin) {
    await controllerFocus(page, 'join-multiplayer'); await pulse(page, 0);
  } else await page.locator('[data-join]').click();
  await expect.poll(() => page.evaluate(() => window.starAgent?.state.multiplayer.connected), { timeout: 30000 }).toBe(true);
  await page.locator('#multiplayer-account-dialog [data-mp-close]').click();
}

test('bare entry shows account access and keeps it reachable through the intro and play', async ({ browser }) => {
  await mkdir(output, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, hasTouch: true });
  const page = await context.newPage(), errors = [];
  try {
    await setup(page, errors);
    await expect(page.locator('[data-auth-form=login]')).toBeVisible();
    await expect(page.locator('[data-auth-view=register]')).toBeVisible();
    await page.screenshot({ path: `${output}/bare-entry-desktop.png` });
    const openingTime = await page.evaluate(() => window.starAgent.state.opening.elapsed);
    await page.keyboard.down('KeyW'); await page.waitForTimeout(250); await page.keyboard.up('KeyW');
    expect(await page.evaluate(() => window.starAgent.state.opening.elapsed)).toBe(openingTime);

    await controllerFocus(page, 'auth-register'); await pulse(page, 0);
    await expect(page.locator('[data-auth-form=register]')).toBeVisible();
    // A held movement stick may navigate the dialog, but must not take control
    // of the cinematic when B closes it. Release and press again to move.
    await page.evaluate(() => { window.multiplayerPad.axes[1] = -1; });
    await pulse(page, 1);
    await expect(page.locator('#multiplayer-account-dialog')).not.toBeVisible();
    await page.waitForTimeout(350);
    expect(await page.evaluate(() => window.starAgent.state.opening.phase)).toBe('cinematic');
    await page.evaluate(() => { window.multiplayerPad.axes[1] = 0; });
    await page.waitForTimeout(250);
    await pulse(page, 9);
    await expect(page.locator('#multiplayer-account-dialog')).toBeVisible();
    await controllerFocus(page, 'account-continue'); await pulse(page, 0);
    await expect(page.locator('#multiplayer-account-dialog')).not.toBeVisible();

    await page.locator('#multiplayer-access').click();
    await page.locator('[data-mp-continue]').click();
    // Pointer close followed immediately by movement must accept the first key.
    await page.keyboard.down('KeyW'); await page.waitForTimeout(150); await page.keyboard.up('KeyW');
    await expect.poll(() => page.evaluate(() => window.starAgent.state.opening.phase)).toBe('playing');
    await expect(page.locator('.topbar')).not.toBeVisible();
    await expect(page.locator('#multiplayer-access')).toBeVisible();
    await page.locator('#multiplayer-access').press('Enter');
    await expect(page.locator('#multiplayer-account-dialog')).toBeVisible();
    await page.locator('[data-mp-continue]').click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#multiplayer-access').tap();
    await expect(page.locator('[data-auth-form=register]')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({ path: `${output}/bare-entry-phone.png` });
    await page.locator('[data-mp-continue]').tap();
    await expect(page.locator('#multiplayer-account-dialog')).not.toBeVisible();
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('two pilots spawn in assigned hangars, transfer cargo and cross the gravity boundary with a controller', async ({ browser }) => {
  await mkdir(output, { recursive: true });
  const errors = [], stamp = `${Date.now()}`.slice(-8);
  const firstContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const secondContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const first = await firstContext.newPage(), second = await secondContext.newPage();
  await setup(first, errors); await setup(second, errors);
  await register(first, `atlas-${stamp}-a@example.test`, `ATLAS_${stamp.slice(-4)}A`, true);
  await register(second, `atlas-${stamp}-b@example.test`, `ATLAS_${stamp.slice(-4)}B`);
  await expect.poll(() => first.evaluate(() => window.starAgent.state.multiplayer.players.length), { timeout: 30000 }).toBe(2);
  const assignments = await Promise.all([first, second].map(page => page.evaluate(() => {
    const s = window.starAgent.state;
    return { id: s.multiplayer.hangar.id, status: s.multiplayer.hangar.status, mode: s.mode, clearance: s.station.deckClearance,
      frame: s.multiplayer.players.find(p => p.id === s.multiplayer.ownId).physicsFrame };
  })));
  expect(assignments[0].id).not.toBe(assignments[1].id);
  for (const assignment of assignments) {
    expect(assignment.status).toBe('occupied'); expect(assignment.mode).toBe('walk');
    expect(assignment.clearance).toBeCloseTo(1.75, 3); expect(assignment.frame).toBe(`hangar:${assignment.id}`);
  }

  await pulse(first, 9);
  await expect(first.locator('#controller-menu')).toBeVisible();
  await controllerFocus(first, 'comms'); await pulse(first, 0);
  await expect(first.locator('#multiplayer-comms-dialog')).toBeVisible();
  await expect(first.locator('[data-comms-players]')).toHaveText('2 / 10');
  await expect(first.locator('[data-request-hangar]')).not.toBeVisible();
  await expect.poll(() => first.evaluate(() => window.starAgent.state.multiplayer.hangar?.id ?? null), { timeout: 30000 }).not.toBeNull();
  await expect.poll(() => first.evaluate(() => window.starAgent.state.station.doorsOpen), { timeout: 15000 }).toBeGreaterThan(0);
  await first.setViewportSize({ width: 1440, height: 900 });
  await first.screenshot({ path: `${output}/desktop-two-pilot-comms.png` });
  await pulse(first, 1); await expect(first.locator('#multiplayer-comms-dialog')).not.toBeVisible();

  await pulse(first, 9); await controllerFocus(first, 'server-inventory'); await pulse(first, 0);
  await expect(first.locator('#multiplayer-inventory-dialog')).toBeVisible();
  const initialRevision = await first.evaluate(() => window.starAgent.state.multiplayer.inventory.revision);
  await controllerFocus(first, 'pack-ship-rifle-laser'); await pulse(first, 0);
  await expect.poll(() => first.evaluate(() => window.starAgent.state.multiplayer.inventory.revision), { timeout: 30000 }).toBeGreaterThan(initialRevision);
  await pulse(first, 1); await expect(first.locator('#multiplayer-inventory-dialog')).not.toBeVisible();

  await pulse(first, 9); await controllerFocus(first, 'server-inventory'); await pulse(first, 0);
  const dockRevision = await first.evaluate(() => window.starAgent.state.multiplayer.inventory.revision);
  await controllerFocus(first, 'ship-station-ration'); await pulse(first, 0);
  await expect.poll(() => first.evaluate(() => window.starAgent.state.multiplayer.inventory.revision), { timeout: 30000 }).toBeGreaterThan(dockRevision);
  await pulse(first, 1);
  await controllerGravityJourney(first);

  await expect.poll(() => second.evaluate(() => window.starAgent.state.ready), { timeout: 90000 }).toBe(true);
  const before = await first.evaluate(s => window.starAgent.state.multiplayer.players.find(p => p.id === s).position, await second.evaluate(() => window.starAgent.state.multiplayer.ownId));
  await second.keyboard.down('KeyW'); await second.waitForTimeout(900); await second.keyboard.up('KeyW');
  await expect.poll(async () => {
    const after = await first.evaluate(s => window.starAgent.state.multiplayer.players.find(p => p.id === s)?.position, await second.evaluate(() => window.starAgent.state.multiplayer.ownId));
    return after ? Math.hypot(after[0]-before[0], after[1]-before[1], after[2]-before[2]) : 0;
  }, { timeout: 30000 }).toBeGreaterThan(.05);

  await pulse(second, 9); await controllerFocus(second, 'account'); await pulse(second, 0);
  await second.setViewportSize({ width: 390, height: 844 });
  await expect(second.locator('#multiplayer-account-dialog')).toBeVisible();
  await second.screenshot({ path: `${output}/phone-account.png` });

  const report = await first.evaluate(() => {
    const gl = document.querySelector('#viewport').getContext('webgl2');
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return { state: window.starAgent.state.multiplayer, renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER), resolution: [innerWidth, innerHeight, devicePixelRatio] };
  });
  await writeFile(`${output}/two-pilot-report.json`, JSON.stringify({ browser: browser.version(), assignments, input: 'Desktop registration; injected W3C standard Gamepad for first-pilot Join, COMMS, server inventory transfers, jump, physical doorway exit to EVA and turn/return to hangar gravity; keyboard W for second-pilot authoritative movement. No physical controller used.', report, errors }, null, 2));
  expect(errors).toEqual([]);
  await firstContext.close(); await secondContext.close();
});
