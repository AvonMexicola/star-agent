import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const output = '/tmp/star-agent-multiplayer-evidence';
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

async function controllerApproach(page) {
  let last;
  await page.evaluate(() => { window.multiplayerPad.axes[1] = -.72; });
  for (let i = 0; i < 400; i++) {
    last = await page.evaluate(() => {
      const state = window.starAgent.state, pad = state.multiplayer.hangar?.pad, position = state.position;
      return { canDock: state.station.canDock, local: state.station.local, speed: state.speed, doors: state.station.doorsOpen,
        position, pad, distance: pad ? Math.hypot(position[0]-pad[0], position[1]-pad[1], position[2]-pad[2]) : Infinity };
    });
    if (last.canDock) { await page.evaluate(() => { window.multiplayerPad.axes[1] = 0; }); return last; }
    await page.waitForTimeout(100);
  }
  await page.evaluate(() => { window.multiplayerPad.axes[1] = 0; });
  throw new Error(`Controller approach did not reach the pad: ${JSON.stringify(last)}`);
}

async function setup(page, errors) {
  page.on('console', message => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
  page.on('pageerror', error => errors.push(`page: ${error.message}`));
  await page.addInitScript(() => {
    window.multiplayerPad = { id: 'Automated standard Xbox multiplayer', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    Object.defineProperty(navigator, 'getGamepads', { value: () => [window.multiplayerPad] });
  });
  await page.goto('/?intro=0');
  await expect(page.locator('.mp-top-button', { hasText: 'ACCOUNT' })).toBeVisible({ timeout: 30000 });
  await expect.poll(() => page.evaluate(() => window.starAgent?.state.ready), { timeout: 90000 }).toBe(true);
}

async function register(page, email, callsign, controllerJoin = false) {
  await page.locator('.mp-top-button', { hasText: 'ACCOUNT' }).click();
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

test('two pilots join, request and dock at a hangar, transfer cargo and exchange movement', async ({ browser }) => {
  await mkdir(output, { recursive: true });
  const errors = [], stamp = `${Date.now()}`.slice(-8);
  const firstContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const secondContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const first = await firstContext.newPage(), second = await secondContext.newPage();
  await Promise.all([setup(first, errors), setup(second, errors)]);
  await register(first, `atlas-${stamp}-a@example.test`, `ATLAS_${stamp.slice(-4)}A`, true);
  await register(second, `atlas-${stamp}-b@example.test`, `ATLAS_${stamp.slice(-4)}B`);
  await expect.poll(() => first.evaluate(() => window.starAgent.state.multiplayer.players.length), { timeout: 30000 }).toBe(2);

  await pulse(first, 9);
  await expect(first.locator('#controller-menu')).toBeVisible();
  await controllerFocus(first, 'comms'); await pulse(first, 0);
  await expect(first.locator('#multiplayer-comms-dialog')).toBeVisible();
  await expect(first.locator('[data-comms-players]')).toHaveText('2 / 10');
  await controllerFocus(first, 'request-hangar'); await pulse(first, 0);
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

  await pulse(first, 14);
  await expect(first.locator('#system-map')).toBeVisible();
  await first.locator('[data-travel-target=pyre]').click();
  await expect(first.locator('#map-engage')).toBeDisabled();
  await pulse(first, 1);
  await expect.poll(() => first.evaluate(() => window.starAgent.state.travelTarget), { timeout: 10000 }).toBe('pyre');

  await controllerApproach(first);
  await pulse(first, 3);
  await expect.poll(() => first.evaluate(() => window.starAgent.state.station.docked), { timeout: 30000 }).toBe(true);

  await pulse(first, 9); await controllerFocus(first, 'server-inventory'); await pulse(first, 0);
  const dockRevision = await first.evaluate(() => window.starAgent.state.multiplayer.inventory.revision);
  await controllerFocus(first, 'ship-station-ration'); await pulse(first, 0);
  await expect.poll(() => first.evaluate(() => window.starAgent.state.multiplayer.inventory.revision), { timeout: 30000 }).toBeGreaterThan(dockRevision);
  await pulse(first, 1);

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
  await writeFile(`${output}/two-pilot-report.json`, JSON.stringify({ browser: browser.version(), input: 'Desktop registration; injected W3C standard Gamepad for first-pilot Join, COMMS, hangar request, server inventory transfers, guarded map selection, physical approach and docking; keyboard W for second-pilot authoritative movement.', report, errors }, null, 2));
  expect(errors).toEqual([]);
  await firstContext.close(); await secondContext.close();
});
