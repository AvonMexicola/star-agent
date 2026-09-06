import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const evidenceDir = '/tmp/star-agent-power-browser';

function captureErrors(page) {
  const errors = [];
  const warnings = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
    if (message.type() === 'warning') warnings.push(message.text());
  });
  return { errors, warnings };
}

async function boot(page) {
  await page.goto('/?intro=0&seed=7291&debug');
  await page.waitForFunction(() => window.starAgent?.state.ready && typeof window.starAgent.state.powered === 'boolean');
  await page.evaluate(() => window.starAgent.setRenderScale(.55));
}

async function walk(page, key, predicate) {
  await page.keyboard.down(key);
  try {
    await page.waitForFunction(predicate, null, { timeout: 20_000 });
  } finally {
    await page.keyboard.up(key);
  }
  await page.keyboard.press('KeyX');
}

async function nativeShot(page, path) {
  await page.evaluate(() => window.starAgent.setRenderScale(1));
  await page.waitForFunction(() => window.starAgent.state.renderScale === 1 && document.getElementById('viewport').width >= innerWidth);
  await page.waitForTimeout(300);
  await page.screenshot({ path });
  await page.evaluate(() => window.starAgent.setRenderScale(.55));
}

const vectorDistance = (a, b) => Math.hypot(...a.map((value, axis) => value - b[axis]));

async function setPadButton(page, index, pressed) {
  await page.evaluate(({ index, pressed }) => {
    window.powerPad.buttons[index] = { pressed, value: Number(pressed) };
  }, { index, pressed });
  await page.waitForFunction(({ index, pressed }) => {
    const nav = window.starAgent.navigation;
    return nav.gamepad.previous[index] === pressed || nav.menuButtons?.[index] === pressed;
  }, { index, pressed });
}

test.beforeAll(async () => {
  await mkdir(evidenceDir, { recursive: true });
});

test('keyboard power and seat controls preserve a moving Nomad while its powered-off MFDs render', async ({ page, browser }) => {
  const { errors, warnings } = captureErrors(page);
  await boot(page);
  await page.keyboard.down('KeyW');
  await page.waitForFunction(() => window.starAgent.state.shipSpeed > 20);
  await page.keyboard.press('KeyF');
  await page.keyboard.up('KeyW');
  await page.waitForFunction(() => window.starAgent.state.cabinFlight && window.starAgent.state.mode === 'walk');
  const assistedCabin = await page.evaluate(() => window.starAgent.state);
  expect(assistedCabin.flightAssist).toBe(true);
  expect(assistedCabin.shipId).toBe('nomad');
  expect(assistedCabin.shipLocal[2]).toBeCloseTo(-1.2, 4);
  await page.waitForFunction(start => Math.hypot(
    ...window.starAgent.state.shipPosition.map((value, axis) => value - start[axis]),
  ) > 1, assistedCabin.shipPosition);
  const heldCourse = await page.evaluate(() => window.starAgent.state);
  expect(heldCourse.shipPosition).not.toEqual(assistedCabin.shipPosition);
  expect(Math.abs(heldCourse.shipSpeed - assistedCabin.shipSpeed)).toBeLessThan(.2);
  expect(heldCourse.shipOrientation).toEqual(assistedCabin.shipOrientation);
  await page.evaluate(() => window.starAgent.navigation.look(Math.PI, 0));
  await page.waitForFunction(() => window.starAgent.state.mfds[0].values.some(value => value.includes('CABIN / ASSIST')));
  await nativeShot(page, `${evidenceDir}/nomad-power-on-mfd.png`);
  await walk(page, 'KeyW', () => window.starAgent.state.shipLocal[2] < -1.4);
  await page.keyboard.press('KeyF');
  await page.waitForFunction(() => !window.starAgent.state.cabinFlight && window.starAgent.state.mode === 'flight');

  await page.keyboard.press('KeyP');
  await expect.poll(() => page.evaluate(() => window.starAgent.state.powered)).toBe(false);
  const velocityBefore = await page.evaluate(() => window.starAgent.state.velocity);
  await page.keyboard.press('KeyX');
  const velocityAfter = await page.evaluate(() => window.starAgent.state.velocity);
  expect(Math.hypot(...velocityAfter)).toBeGreaterThan(10);
  expect(velocityAfter).not.toEqual([0, 0, 0]);
  expect(velocityBefore).not.toEqual([0, 0, 0]);

  await page.keyboard.press('KeyF');
  await page.waitForFunction(() => window.starAgent.state.cabinFlight && window.starAgent.state.mode === 'walk');
  const cabinStart = await page.evaluate(() => window.starAgent.state);
  expect(cabinStart.shipLocal[2]).toBeCloseTo(-1.2, 4);
  expect(cabinStart.shipPosition).not.toBeNull();
  await expect(page.locator('#ship-power-button')).toBeDisabled();

  await walk(page, 'KeyW', () => window.starAgent.state.shipLocal[2] > -.5);
  const moving = await page.evaluate(() => window.starAgent.state);
  expect(moving.shipPosition).not.toEqual(cabinStart.shipPosition);
  expect(moving.shipSpeed).toBeGreaterThan(10);
  await walk(page, 'KeyS', () => window.starAgent.state.shipLocal[2] < -1.25);
  await page.evaluate(() => window.starAgent.navigation.look(Math.PI, 0));
  await page.waitForFunction(() => window.starAgent.state.mfds.every(screen => screen.values.includes('MAIN POWER: OFF')));
  await nativeShot(page, `${evidenceDir}/nomad-power-off-mfd.png`);

  const beforeSeat = await page.evaluate(() => window.starAgent.state);
  await page.keyboard.press('KeyF');
  await page.waitForFunction(() => !window.starAgent.state.cabinFlight && window.starAgent.state.mode === 'flight');
  const reseated = await page.evaluate(() => window.starAgent.state);
  expect(reseated.shipSpeed).toBeGreaterThan(10);
  expect(vectorDistance(reseated.velocity, beforeSeat.shipVelocity)).toBeLessThan(2);
  await page.keyboard.press('KeyP');
  await expect.poll(() => page.evaluate(() => window.starAgent.state.powered)).toBe(true);

  const gl = await page.evaluate(() => {
    const context = document.querySelector('canvas').getContext('webgl2');
    const extension = context.getExtension('WEBGL_debug_renderer_info');
    return {
      renderer: extension ? context.getParameter(extension.UNMASKED_RENDERER_WEBGL) : context.getParameter(context.RENDERER),
      viewport: [innerWidth, innerHeight],
      finalState: {
        powered: window.starAgent.state.powered,
        cabinFlight: window.starAgent.state.cabinFlight,
        shipSpeed: window.starAgent.state.shipSpeed,
      },
    };
  });
  await writeFile(`${evidenceDir}/environment.json`, JSON.stringify({ browser: browser.version(), ...gl, errors, warnings }, null, 2));
  expect(errors).toEqual([]);
  expect(warnings).toEqual([]);
});

test('Atlas permits interior cabin movement and cargo lifts while the unattended hull flies and rotates', async ({ page }) => {
  const { errors, warnings } = captureErrors(page);
  await page.addInitScript(() => localStorage.setItem('star-agent.fleet.v1', JSON.stringify({
    version: 1, surfaceVisited: true, unlocked: true, active: 'atlas',
  })));
  await boot(page);
  await page.waitForFunction(() => window.starAgent.state.shipId === 'atlas' && window.starAgent.state.shipAsset === 'ready');
  await page.keyboard.press('KeyV');
  await page.keyboard.down('KeyW');
  await page.waitForFunction(() => window.starAgent.state.shipSpeed > 20);
  await page.keyboard.up('KeyW');
  await page.keyboard.down('KeyQ');
  await page.waitForFunction(() => Math.abs(window.starAgent.state.angularVelocity[2]) > .05);
  await page.keyboard.up('KeyQ');
  await page.keyboard.press('KeyF');
  await page.waitForFunction(() => window.starAgent.state.cabinFlight);
  const start = await page.evaluate(() => window.starAgent.state);
  expect(start.shipLocal[1]).toBeCloseTo(5.75, 3);
  expect(start.shipLocal[2]).toBeCloseTo(-8.8, 3);

  await walk(page, 'KeyW', () => window.starAgent.state.shipLocal[2] > -3.9);
  await walk(page, 'KeyD', () => window.starAgent.state.shipLocal[0] < -4.7);
  await expect.poll(() => page.evaluate(() => window.starAgent.state.interaction)).toContain('PORT CARGO');
  await page.keyboard.press('KeyF');
  await page.waitForFunction(() => window.starAgent.state.lifts[1].y === 7);
  expect(await page.evaluate(() => window.starAgent.state.shipLocal[1])).toBeCloseTo(8.75, 3);
  const lifted = await page.evaluate(() => window.starAgent.state);
  expect(lifted.shipPosition).not.toEqual(start.shipPosition);
  expect(lifted.shipOrientation).not.toEqual(start.shipOrientation);
  await nativeShot(page, `${evidenceDir}/atlas-moving-cabin.png`);

  await page.keyboard.press('KeyF');
  await page.waitForFunction(() => window.starAgent.state.lifts[1].y === 4);
  await walk(page, 'KeyA', () => window.starAgent.state.shipLocal[0] > -.2);
  await walk(page, 'KeyS', () => window.starAgent.state.shipLocal[2] < -9.1);
  const beforeSeat = await page.evaluate(() => window.starAgent.state);
  await page.keyboard.press('KeyF');
  await page.waitForFunction(() => window.starAgent.state.mode === 'flight' && !window.starAgent.state.cabinFlight);
  expect(vectorDistance(await page.evaluate(() => window.starAgent.state.velocity), beforeSeat.shipVelocity)).toBeLessThan(2);

  await page.keyboard.press('KeyP');
  await page.keyboard.press('KeyF');
  await page.waitForFunction(() => window.starAgent.state.cabinFlight && !window.starAgent.state.powered);
  await page.evaluate(() => window.starAgent.navigation.look(Math.PI, 0));
  await page.waitForFunction(() => window.starAgent.state.mfds.every(screen => screen.values.includes('MAIN POWER: OFF')));
  await nativeShot(page, `${evidenceDir}/atlas-power-off-mfd.png`);
  expect(errors).toEqual([]);
  expect(warnings).toEqual([]);
});

test('touch and controller menu controls toggle main power from the real help menu', async ({ page }) => {
  const { errors, warnings } = captureErrors(page);
  await page.addInitScript(() => {
    window.powerPad = {
      id: 'Power menu test pad', index: 0, connected: true, mapping: 'standard', axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
    };
    Object.defineProperty(navigator, 'getGamepads', { value: () => [window.powerPad] });
  });
  await boot(page);
  await page.waitForFunction(() => window.starAgent.navigation.gamepad.armed);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.keyboard.press('KeyH');
  const powerButton = page.locator('#ship-power-button');
  await expect(powerButton).toBeVisible();
  await powerButton.tap();
  await expect.poll(() => page.evaluate(() => window.starAgent.state.powered)).toBe(false);
  await expect(powerButton).toContainText('MAIN POWER OFF');
  await nativeShot(page, `${evidenceDir}/touch-power-menu-390x844.png`);
  await powerButton.tap();
  await expect.poll(() => page.evaluate(() => window.starAgent.state.powered)).toBe(true);
  await page.keyboard.press('KeyH');
  await expect(page.locator('#help-dialog')).toBeHidden();

  await setPadButton(page, 9, true);
  await expect(page.locator('#controller-menu')).toBeVisible();
  await setPadButton(page, 9, false);
  for(let i=0;i<40;i++){
    if(await page.locator('[data-controller-key=help]').evaluate(el=>el===document.activeElement))break;
    await setPadButton(page,13,true);await setPadButton(page,13,false);
  }
  await expect(page.locator('[data-controller-key=help]')).toBeFocused();
  await setPadButton(page,0,true);await setPadButton(page,0,false);
  await expect(page.locator('#help-dialog')).toBeVisible();
  for(let i=0;i<12;i++){
    if(await powerButton.evaluate(el=>el===document.activeElement))break;
    await setPadButton(page,13,true);await setPadButton(page,13,false);
  }
  await expect(powerButton).toBeFocused();
  await setPadButton(page, 0, true);
  await expect.poll(() => page.evaluate(() => window.starAgent.state.powered)).toBe(false);
  await setPadButton(page, 0, false);
  await expect(powerButton).toContainText('MAIN POWER OFF');
  await nativeShot(page, `${evidenceDir}/controller-power-menu-390x844.png`);

  await page.evaluate(() => {
    window.powerPad.axes[1] = -1;
    window.powerPad.buttons[0] = { pressed: true, value: 1 };
    window.powerPad.buttons[1] = { pressed: true, value: 1 };
  });
  await expect(page.locator('#help-dialog')).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.starAgent.navigation.gamepad.armed)).toBe(false);
  expect(await page.evaluate(() => window.starAgent.state.powered)).toBe(false);
  await page.evaluate(() => {
    window.powerPad.axes[1] = 0;
    window.powerPad.buttons[0] = { pressed: false, value: 0 };
    window.powerPad.buttons[1] = { pressed: false, value: 0 };
  });
  await page.waitForFunction(() => window.starAgent.navigation.gamepad.armed);
  expect(await page.evaluate(() => window.starAgent.state.powered)).toBe(false);
  expect(errors).toEqual([]);
  expect(warnings).toEqual([]);
});
