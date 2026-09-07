import { test, expect } from '@playwright/test';

const frames = page => page.evaluate(() => new Promise(resolve => {
  let remaining = 5;
  const next = () => --remaining === 0 ? resolve() : requestAnimationFrame(next);
  requestAnimationFrame(next);
}));

test('production renders, controller menu suppresses held input, and all map targets select', async ({ page, browser }, info) => {
  const errors = [], warnings = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
    if (message.type() === 'warning') warnings.push(message.text());
  });
  // Only the input device is simulated. The game boots normally and receives
  // semantic keyboard/Gamepad input; no navigation state or scene is replaced.
  await page.addInitScript(() => {
    // Real persisted user setting: a functional smoke profile for a CPU renderer.
    // Native-resolution visual/performance acceptance runs separately on hardware.
    localStorage.setItem('star-agent.graphics.v1', JSON.stringify({ resolution: 0.6 }));
    window.smokePad = { id: 'CI standard Gamepad', index: 0, connected: true,
      mapping: 'standard', axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    Object.defineProperty(navigator, 'getGamepads', { value: () => [window.smokePad] });
  });
  const press = async index => {
    await page.evaluate(index => { window.smokePad.buttons[index] = { pressed: true, value: 1 }; }, index);
    await frames(page);
    await page.evaluate(index => { window.smokePad.buttons[index] = { pressed: false, value: 0 }; }, index);
    await frames(page);
  };
  try {
    await page.goto('/?intro=0&seed=7291');
    await page.waitForFunction(() => window.starAgent?.state.ready && window.starAgent.state.renderedFrames > 5,
      null, { timeout: 180_000 });
    await expect(page.locator('#loading')).toHaveCSS('opacity', '0');
    await expect(page.locator('#viewport')).toBeVisible();
    const initial = await page.evaluate(() => window.starAgent.state);
    expect(initial.seed).toBe(7291);
    expect(initial.triangles).toBeGreaterThan(0);
    expect(initial.drawCalls).toBeGreaterThan(0);
    expect(initial.graphics.resolution).toBe(0.6);
    await page.waitForFunction(() => window.starAgent.state.controller.armed);
    await press(9);
    await expect(page.locator('#controller-menu')).toBeVisible();
    await expect(page.locator('#controller-menu [data-controller-key="resume"]')).toBeFocused();
    const before = await page.evaluate(() => window.starAgent.state.position);
    await page.evaluate(() => { window.smokePad.axes[1] = -1; });
    await press(1);
    await expect(page.locator('#controller-menu')).not.toBeVisible();
    expect(await page.evaluate(() => window.starAgent.state.controller.armed)).toBe(false);
    expect(await page.evaluate(() => window.starAgent.state.position)).toEqual(before);
    await page.evaluate(() => { window.smokePad.axes[1] = 0; });
    await page.waitForFunction(() => window.starAgent.state.controller.armed);

    await page.keyboard.press('M');
    await expect(page.locator('#system-map')).toHaveCSS('opacity', '1');
    for (const [id, name] of [['aeon', 'Aeon'], ['selene', 'Selene'], ['pyre', 'Pyre'], ['star', 'Our star'], ['miasma', 'Miasma']]) {
      await page.locator(`[data-travel-target="${id}"]`).click();
      await expect(page.locator('#map-target-name')).toContainText(name);
    }
    await info.attach('system-map', { body: await page.screenshot(), contentType: 'image/png' });
    await page.keyboard.press('M');
    await page.waitForFunction(() => !window.starAgent.state.mapOpen && window.starAgent.state.enabled);
    await frames(page);
    await info.attach('rendered-scene', { body: await page.screenshot(), contentType: 'image/png' });
    expect(errors).toEqual([]);
  } finally {
    if (!page.isClosed()) {
      const renderer = await page.evaluate(() => {
        const gl = document.querySelector('#viewport')?.getContext('webgl2');
        const debug = gl?.getExtension('WEBGL_debug_renderer_info');
        const state = window.starAgent?.state;
        return { backend: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : 'unavailable',
          viewport: [innerWidth, innerHeight], deviceScale: devicePixelRatio,
          seed: state?.seed, renderedFrames: state?.renderedFrames, triangles: state?.triangles,
          drawCalls: state?.drawCalls, resolution: state?.renderResolution, preload: state?.preload };
      }).catch(() => ({ pageUnavailable: true }));
      await info.attach('diagnostics', { body: Buffer.from(JSON.stringify({ browser: browser.version(),
        ...renderer, errors, warnings, performanceClaim: false, input: 'injected standard Gamepad + keyboard/mouse' }, null, 2)),
        contentType: 'application/json' });
    }
  }
});
