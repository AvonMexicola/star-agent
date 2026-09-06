import { test, expect } from '@playwright/test';

function watchErrors(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
  });
  return errors;
}

async function moveUntil(page, code, axis, predicate, value, timeout = 90000) {
  await page.keyboard.down(code);
  try {
    await page.waitForFunction(({ axis, predicate, value }) => {
      const coordinate = window.atlasMarkIIStudio?.walker.position[axis];
      return predicate === 'less' ? coordinate < value : coordinate > value;
    }, { axis, predicate, value }, { timeout });
  } catch (error) {
    const diagnostic = await page.evaluate(() => ({
      mode: window.atlasMarkIIStudio?.mode,
      position: window.atlasMarkIIStudio?.walker.position.toArray(),
      heading: window.atlasMarkIIStudio?.heading,
      interaction: window.atlasMarkIIStudio?.interaction,
      systems: window.atlasMarkIIStudio?.systems.snapshot,
    }));
    console.log('MOVE FAILED', JSON.stringify({ code, axis, predicate, value, diagnostic }));
    throw error;
  } finally {
    await page.keyboard.up(code);
  }
}

async function precisionMoveUntil(page, code, axis, predicate, value, timeout = 90000) {
  await page.keyboard.down('ShiftLeft');
  try {
    await moveUntil(page, code, axis, predicate, value, timeout);
  } finally {
    await page.keyboard.up('ShiftLeft');
  }
}

test('loads the authored asset and completes the physical aft-ramp-to-upper-deck journey', async ({ page }) => {
  test.setTimeout(480000);
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 480, height: 300 });
  await page.goto('/dev/atlas-mark-ii.html');
  await page.waitForFunction(() => document.body.classList.contains('is-ready'), null, { timeout: 60000 });

  const asset = await page.evaluate(() => ({
    stats: window.atlasMarkIIStudio.stats,
    scale: window.atlasMarkIIStudio.model.scale.toArray(),
    ramps: window.atlasMarkIIStudio.systems.ramps.map(ramp => Boolean(ramp.nodeObject)),
    elevator: Boolean(window.atlasMarkIIStudio.systems.elevator.nodeObject),
    texturedUvMeshes: (() => {
      let count = 0;
      window.atlasMarkIIStudio.model.traverse(object => {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        if (object.isMesh && object.geometry.attributes.uv && materials.some(material => material?.map)) count += 1;
      });
      return count;
    })(),
  }));
  expect(asset.stats.meshes).toBeGreaterThan(0);
  expect(asset.stats.triangles).toBeGreaterThan(0);
  expect(asset.stats.materials).toBeGreaterThan(0);
  expect(asset.stats.textures).toBeGreaterThan(0);
  expect(asset.texturedUvMeshes).toBeGreaterThan(0);
  expect(asset.scale).toEqual([1, 1, 1]);
  expect(asset.ramps).toEqual([true, true]);
  expect(asset.elevator).toBe(true);

  await page.getByRole('button', { name: /physical walkthrough/i }).click();
  await page.waitForFunction(() => window.atlasMarkIIStudio.systems.snapshot.ramps.find(ramp => ramp.id === 'aft').progress > 0.995, null, { timeout: 90000 });
  await moveUntil(page, 'KeyW', 'z', 'less', 20.5);
  await expect.poll(() => page.evaluate(() => window.atlasMarkIIStudio.walker.position.y)).toBeCloseTo(4.35, 1);

  await moveUntil(page, 'KeyW', 'z', 'less', 0);
  await precisionMoveUntil(page, 'KeyW', 'z', 'less', -3.9);
  await moveUntil(page, 'KeyD', 'x', 'greater', 2.8);
  await page.waitForFunction(() => {
    const state = window.atlasMarkIIStudio.systems.snapshot.elevator;
    const gate = state.gates.find(item => Math.abs(item.deck - 2.6) < 0.1);
    return gate && !gate.moving && gate.z > -2.3;
  }, null, { timeout: 90000 });
  await precisionMoveUntil(page, 'KeyD', 'x', 'greater', 5.1);
  await expect.poll(() => page.evaluate(() => window.atlasMarkIIStudio.interaction)).toBe('elevator:crew');
  await page.keyboard.press('KeyF');
  await page.waitForFunction(() => window.atlasMarkIIStudio.walker.position.y > 11.1, null, { timeout: 90000 });
  await page.waitForFunction(() => {
    const state = window.atlasMarkIIStudio.systems.snapshot.elevator;
    const gate = state.gates.find(item => Math.abs(item.deck - 9.5) < 0.1);
    return gate && !gate.moving && gate.z > -2.3;
  }, null, { timeout: 90000 });

  await precisionMoveUntil(page, 'KeyA', 'x', 'less', 3.7);
  await moveUntil(page, 'KeyA', 'x', 'less', 0.2);
  await moveUntil(page, 'KeyW', 'z', 'less', -18);
  await precisionMoveUntil(page, 'KeyW', 'z', 'less', -20.2);
  await precisionMoveUntil(page, 'KeyA', 'x', 'less', -1.9);
  await expect.poll(() => page.evaluate(() => window.atlasMarkIIStudio.interaction)).toBe('seat');
  await page.screenshot({ path: '/tmp/atlas-mark-ii-bridge-walk.png', timeout: 60000 });

  await precisionMoveUntil(page, 'KeyD', 'x', 'greater', -0.2);
  await moveUntil(page, 'KeyS', 'z', 'greater', 2);
  await precisionMoveUntil(page, 'KeyS', 'z', 'greater', 3.2);
  await precisionMoveUntil(page, 'KeyA', 'x', 'less', -3);
  const crewPosition = await page.evaluate(() => window.atlasMarkIIStudio.walker.position.toArray());
  expect(crewPosition[1]).toBeCloseTo(11.25, 1);
  await page.screenshot({ path: '/tmp/atlas-mark-ii-crew-walk.png', timeout: 60000 });

  await precisionMoveUntil(page, 'KeyD', 'x', 'greater', 2.2);
  await moveUntil(page, 'KeyS', 'z', 'greater', 13);
  await precisionMoveUntil(page, 'KeyS', 'z', 'greater', 14);
  const hygienePosition = await page.evaluate(() => window.atlasMarkIIStudio.walker.position.toArray());
  expect(hygienePosition[0]).toBeGreaterThan(1.8);
  expect(hygienePosition[0]).toBeLessThan(3.4);
  expect(hygienePosition[2]).toBeGreaterThan(14);
  await page.screenshot({ path: '/tmp/atlas-mark-ii-galley-walk.png', timeout: 60000 });
  expect(errors).toEqual([]);
});

test('inspection presets and mount overlay remain usable', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/dev/atlas-mark-ii.html');
  await page.waitForFunction(() => document.body.classList.contains('is-ready'), null, { timeout: 60000 });
  const environment = await page.evaluate(() => {
    const canvas = document.querySelector('#viewport');
    const gl = canvas.getContext('webgl2') ?? canvas.getContext('webgl');
    const extension = gl.getExtension('WEBGL_debug_renderer_info');
    return {
      browser: navigator.userAgent,
      renderer: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      viewport: [innerWidth, innerHeight],
      devicePixelRatio,
      stats: window.atlasMarkIIStudio.stats,
    };
  });
  console.log('ATLAS QA ENVIRONMENT', JSON.stringify(environment));
  for (const name of ['EXTERIOR', 'AFT', 'CARGO', 'BRIDGE', 'CREW', 'GALLEY', 'MOUNTS']) {
    await page.locator(`[data-view="${name.toLowerCase()}"]`).click();
    await page.waitForFunction(() => !window.atlasMarkIIStudio.transitioning);
    await expect(page.locator(`[data-view="${name.toLowerCase()}"]`)).toHaveClass(/active/);
    if (['CARGO', 'BRIDGE', 'CREW', 'GALLEY'].includes(name)) {
      await expect(page.locator('#details-toggle')).toHaveAttribute('aria-pressed', 'false');
      await expect(page.locator('#scale-reference')).toHaveCSS('opacity', '0');
    }
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `/tmp/atlas-mark-ii-${name.toLowerCase()}.png`, timeout: 60000 });
  }
  await page.getByRole('button', { name: 'S3 MOUNTS' }).click();
  await expect(page.getByRole('button', { name: 'S3 MOUNTS' })).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: '/tmp/atlas-mark-ii-mount-overlay.png', timeout: 60000 });
  expect(errors).toEqual([]);
});

test('phone controls remain usable', async ({ browser }) => {
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const phoneErrors = watchErrors(phone);
  await phone.goto('/dev/atlas-mark-ii.html');
  await phone.waitForFunction(() => document.body.classList.contains('is-ready'), null, { timeout: 60000 });
  await phone.waitForTimeout(700);
  const controlsFit = await phone.locator('.view-dock').evaluate(element => {
    const rect = element.getBoundingClientRect();
    return rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight;
  });
  expect(controlsFit).toBe(true);
  await phone.screenshot({ path: '/tmp/atlas-mark-ii-phone.png', timeout: 60000 });
  expect(phoneErrors).toEqual([]);
  await phone.close();
});

test('controller walk, look, interact, and exit use neutral button edges', async ({ page }) => {
  const errors = watchErrors(page);
  await page.setViewportSize({ width: 720, height: 450 });
  await page.goto('/dev/atlas-mark-ii.html');
  await page.waitForFunction(() => document.body.classList.contains('is-ready'), null, { timeout: 60000 });
  await page.evaluate(() => {
    window.__atlasTestPad = {
      connected: true,
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })),
    };
    Object.defineProperty(navigator, 'getGamepads', {
      configurable: true,
      value: () => [window.__atlasTestPad],
    });
  });

  await page.getByRole('button', { name: /physical walkthrough/i }).click();
  await page.waitForFunction(() => window.atlasMarkIIStudio.systems.snapshot.ramps.find(ramp => ramp.id === 'aft').progress > 0.995, null, { timeout: 90000 });
  const startZ = await page.evaluate(() => window.atlasMarkIIStudio.walker.position.z);
  await page.evaluate(() => { window.__atlasTestPad.axes[1] = -1; });
  await page.waitForFunction(z => window.atlasMarkIIStudio.walker.position.z < z - 0.8, startZ, { timeout: 30000 });
  await page.evaluate(() => { window.__atlasTestPad.axes[1] = 0; });

  const startYaw = await page.evaluate(() => window.atlasMarkIIStudio.heading.yaw);
  await page.evaluate(() => { window.__atlasTestPad.axes[2] = 1; });
  await page.waitForFunction(yaw => window.atlasMarkIIStudio.heading.yaw < yaw - 0.08, startYaw, { timeout: 30000 });
  await page.evaluate(() => { window.__atlasTestPad.axes[2] = 0; });

  await page.evaluate(() => {
    const studio = window.atlasMarkIIStudio;
    const [x, floor, z] = studio.systems.layout.ramps.find(ramp => ramp.id === 'front').control;
    studio.walker.position.set(x + 0.8, floor + studio.systems.eyeHeight, z);
    window.__atlasTestPad.buttons[0].pressed = true;
    window.__atlasTestPad.buttons[0].value = 1;
  });
  await page.waitForFunction(() => {
    const ramp = window.atlasMarkIIStudio.systems.ramps.find(item => item.id === 'front');
    return ramp.moving && ramp.target === ramp.openAngle;
  }, null, { timeout: 30000 });
  await page.evaluate(() => {
    window.__atlasTestPad.buttons[0].pressed = false;
    window.__atlasTestPad.buttons[0].value = 0;
  });

  await page.evaluate(() => {
    window.__atlasTestPad.buttons[1].pressed = true;
    window.__atlasTestPad.buttons[1].value = 1;
  });
  await page.waitForFunction(() => window.atlasMarkIIStudio.mode === 'inspect', null, { timeout: 30000 });
  expect(errors).toEqual([]);
});
