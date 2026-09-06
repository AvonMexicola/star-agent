import { test, expect } from '@playwright/test';

const errorsFor = page => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error' && /THREE|WebGL|shader/i.test(message.text())) errors.push(message.text());
  });
  return errors;
};
async function readyDocked(page) {
  await page.goto('/?intro=0&debug=1&seed=7291');
  await page.waitForFunction(() => window.starAgent?.state.ready && starAgent.state.station.ready);
  await page.evaluate(renderScale => {
    const n = starAgent.navigation, s = n.station; starAgent.setRenderScale(renderScale);
    const p = n.position.clone().set(0, s.interiorBox.min.y + 4, 2);
    n.orbit(); s.toWorld(p, n.position); n.orientation.copy(s.quaternion); n.landOrLaunch();
  }, process.env.STATION_MOTION_RENDER_SCALE === '1' ? 1 : .55);
  await page.waitForFunction(() => starAgent.state.station.docked);
}
async function walkTo(page, x, z) {
  await page.evaluate(({ x, z }) => {
    const n = starAgent.navigation, s = n.station;
    const target = n.position.clone().set(x, s.interiorBox.min.y + n.layout.eyeHeight, z);
    n.orientToward(s.toWorld(target, target), s.up);
    window.shopWalkDiagnostic = { target: [x, z], start: n.stationLocal.toArray(), startSpeed: n.velocity.length(), minDistance: Infinity };
  }, { x, z });
  await page.keyboard.down('KeyW');
  try {
    await page.waitForFunction(({ x, z }) => {
      const p = starAgent.navigation.stationLocal;
      const distance = Math.hypot(p.x - x, p.z - z), diagnostic = window.shopWalkDiagnostic;
      if (distance < diagnostic.minDistance) { diagnostic.minDistance = distance; diagnostic.nearest = p.toArray(); }
      return distance < .35;
    }, { x, z }, { timeout: 45000 });
  } catch (error) {
    console.log('SHOP WALK FAILURE', await page.evaluate(() => ({ ...window.shopWalkDiagnostic,
      local: starAgent.navigation.stationLocal.toArray(), velocity: starAgent.navigation.velocity.toArray(),
      keys: [...starAgent.navigation.keys], enabled: starAgent.navigation.enabled,
      interaction: starAgent.state.interaction })));
    throw error;
  } finally {
    await page.keyboard.up('KeyW');
    const released = await page.evaluate(() => ({ local: starAgent.navigation.stationLocal.toArray(), speed: starAgent.navigation.velocity.length() }));
    // Walking accelerates/decelerates physically. Do not turn the next leg while
    // residual motion from this leg is still carrying the player sideways.
    await page.waitForFunction(() => starAgent.navigation.velocity.lengthSq() < .0001, null, { timeout: 5000 });
    await page.evaluate(released => {
      const n = starAgent.navigation;
      (window.shopWalkHistory ??= []).push({ ...window.shopWalkDiagnostic, released, settled: n.stationLocal.toArray(), settledSpeed: n.velocity.length() });
    }, released);
  }
}
async function hubFixture(page) {
  await readyDocked(page);
  // Controlled UI fixture; the separate test below walks through passenger transit.
  await page.evaluate(() => {
    const n = starAgent.navigation, s = n.station;
    s.location = 'hub'; n.mode = 'walk'; n.insideShip = false; n.velocity.set(0, 0, 0);
    s.toWorld(n.position.clone().set(0, s.interiorBox.min.y + n.layout.eyeHeight, 0), n.position);
    n.orientation.copy(s.quaternion); s.rebase(n.position);
  });
}
async function samplePad(page, index, pressed) {
  await page.evaluate(async ({ index, pressed }) => {
    window.shopPad.buttons[index] = { pressed, value: Number(pressed) };
    // Both Navigation and the dialog poll on RAF. Span actual polls, not a fixed delay.
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  }, { index, pressed });
}

test('walk through passenger transit to the armory, buy with a controller, transfer cargo and reload', async ({ page }, testInfo) => {
  const errors = errorsFor(page);
  await page.addInitScript(() => {
    window.shopPad = { id: 'Station shop test controller', index: 0, connected: true, mapping: 'standard',
      axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    Object.defineProperty(navigator, 'getGamepads', { value: () => [window.shopPad] });
  });
  await readyDocked(page);
  const parked = await page.evaluate(() => starAgent.navigation.shipPosition.toArray());
  if (process.env.STATION_MOTION_RENDER_SCALE === '1') {
    const environment = await page.evaluate(() => {
      const gl = document.querySelector('canvas').getContext('webgl2');
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      return { renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : null,
        version: gl.getParameter(gl.VERSION), renderScale: starAgent.state.renderScale,
        viewport: [innerWidth, innerHeight], drawingBuffer: [gl.drawingBufferWidth, gl.drawingBufferHeight],
        timeOrigin: performance.timeOrigin, performanceNow: performance.now(), wallTime: Date.now() };
    });
    await testInfo.attach('motion-environment', { body: JSON.stringify(environment, null, 2), contentType: 'application/json' });
  }
  // Begin in a clear hangar side aisle. Existing boarding tests cover the ship ramp.
  await page.evaluate(() => {
    const n = starAgent.navigation, s = n.station;
    n.mode = 'walk'; n.insideShip = false; n.velocity.set(0, 0, 0);
    s.toWorld(n.position.clone().set(-12, s.interiorBox.min.y + n.layout.eyeHeight, 0), n.position);
  });
  await walkTo(page, -12, 20); await walkTo(page, 0, 20);
  await page.keyboard.press('KeyF');
  await page.waitForFunction(() => starAgent.state.station.elevator > .99);
  await walkTo(page, 0, 24);
  await page.keyboard.press('KeyF');
  await page.getByRole('button', { name: 'Central hub', exact: true }).click();
  await page.waitForFunction(() => starAgent.state.station.location === 'hub' && starAgent.navigation.enabled && starAgent.state.station.elevator > .99);
  await walkTo(page, 0, 0); await walkTo(page, -10.7, 0);
  await expect.poll(() => page.evaluate(() => starAgent.state.interaction)).toContain('WATCHKEEP ARMORY');
  await page.keyboard.press('KeyF');
  const dialog = page.locator('#station-shop-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'WATCHKEEP ARMORY', exact: true })).toBeVisible();
  await expect(dialog).toContainText('Combat and equipping are not implemented');
  const position = await page.evaluate(() => starAgent.state.position);
  await samplePad(page, 13, true); await samplePad(page, 13, false);
  await expect(dialog.getByRole('button', { name: 'Buy Security sidearm for 350 credits', exact: true })).toBeFocused();
  await samplePad(page, 0, true);
  await expect(dialog.locator('.shop-feedback')).toContainText('Delivered to your station warehouse');
  await page.evaluate(async () => {
    window.shopPad.axes[1] = -.9;
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await page.keyboard.press('KeyW');
  expect(await page.evaluate(() => starAgent.state.position)).toEqual(position);
  expect(await page.evaluate(() => starAgent.state.inventory.credits)).toBe(1150);
  expect(await page.evaluate(() => starAgent.state.inventory.station.sidearm)).toBe(1);
  await page.evaluate(() => { window.shopPad.axes[1] = 0; });
  await samplePad(page, 0, false);
  await page.screenshot({ path: testInfo.outputPath('shop-controller-desktop.png') });
  await samplePad(page, 1, true); await expect(dialog).toBeHidden(); await samplePad(page, 1, false);
  await page.waitForFunction(() => starAgent.navigation.enabled && starAgent.navigation.gamepad.armed);
  expect(await page.evaluate(() => starAgent.navigation.shipPosition.toArray())).toEqual(parked);
  await walkTo(page, 0, 0); await walkTo(page, 0, 16);
  await page.keyboard.press('KeyF');
  await page.getByRole('button', { name: 'Berth 01 · Your ship', exact: true }).click();
  await page.waitForFunction(() => starAgent.state.station.location === 'hangar' && starAgent.navigation.enabled);
  await walkTo(page, 0, 20); await walkTo(page, -12, 20.7);
  await page.keyboard.press('KeyF');
  const cargo = page.getByRole('dialog', { name: 'Cargo transfer terminal' });
  await expect(cargo).toBeVisible();
  await cargo.locator('[data-item="sidearm"][data-from="station"]').click();
  expect(await page.evaluate(() => starAgent.state.inventory.ship.sidearm)).toBe(1);
  expect(await page.evaluate(() => starAgent.state.inventory.station.sidearm)).toBe(0);
  await page.keyboard.press('Escape');
  const history = await page.evaluate(() => window.shopWalkHistory);
  await test.info().attach('physical-walk-stop-diagnostics', { body: JSON.stringify(history, null, 2), contentType: 'application/json' });
  console.log('SHOP WALK COAST', history.map(leg => ({ target: leg.target, startSpeed: leg.startSpeed, releasedSpeed: leg.released.speed,
    coastMetres: Math.hypot(...leg.settled.map((value, axis) => value - leg.released.local[axis])), settledSpeed: leg.settledSpeed })));
  const manifest = await page.evaluate(() => starAgent.state.inventory);
  await page.reload(); await page.waitForFunction(() => window.starAgent?.state.ready);
  expect(await page.evaluate(() => starAgent.state.inventory)).toEqual(manifest);
  expect(errors).toEqual([]);
});

test('390×844 touch shop keeps delivery, price and feedback readable in a controlled hub fixture', async ({ browser }, testInfo) => {
  const context = await browser.newContext({ baseURL: test.info().project.use.baseURL, viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await context.newPage(); const errors = errorsFor(page);
  try {
    await hubFixture(page); await walkTo(page, 10.7, 0);
    await expect.poll(() => page.evaluate(() => starAgent.state.interaction)).toContain('KESTREL SHIPWORKS');
    await page.keyboard.press('KeyF');
    const dialog = page.locator('#station-shop-dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'KESTREL SHIPWORKS', exact: true })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('shop-mobile-top.png') });
    await dialog.getByRole('button', { name: 'Buy Replacement components for 220 credits', exact: true }).tap();
    await expect(dialog.locator('.shop-feedback')).toContainText('Balance: 1280 credits');
    expect(await page.evaluate(() => starAgent.state.inventory.station.replacement)).toBe(1);
    const layout = await dialog.evaluate(node => {
      const bounds = node.getBoundingClientRect();
      return { left: bounds.left, right: bounds.right, scrollWidth: node.scrollWidth, clientWidth: node.clientWidth };
    });
    expect(layout.left).toBeGreaterThanOrEqual(0); expect(layout.right).toBeLessThanOrEqual(390);
    expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth);
    await dialog.locator('.shop-feedback').scrollIntoViewIfNeeded();
    await page.screenshot({ path: testInfo.outputPath('shop-mobile.png') });
    const closeBounds = await dialog.getByRole('button', { name: 'Close shop', exact: true }).boundingBox();
    expect(closeBounds.y).toBeGreaterThanOrEqual(0);
    expect(closeBounds.y + closeBounds.height).toBeLessThanOrEqual(844);
    await dialog.getByRole('button', { name: 'Close shop', exact: true }).tap();
    await expect(dialog).toBeHidden();
    await page.waitForFunction(() => starAgent.navigation.enabled);
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});
