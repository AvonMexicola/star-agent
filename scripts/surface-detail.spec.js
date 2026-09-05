import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { terrainHeight, findDestinations } from '../src/world.js';

test('water, ground materials and all forest LODs render without shader errors', async ({ page, browser }, testInfo) => {
  await mkdir('/tmp/star-agent-surface', { recursive: true });
  const errors = [], captures = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto('/?seed=7291&debug=1');
  await page.waitForFunction(() => window.starAgent?.state.ready);
  await page.evaluate(() => window.starAgent.setRenderScale(.55));
  await page.keyboard.press('Tab');
  const backend = await page.evaluate(() => {
    const gl = document.querySelector('canvas').getContext('webgl2');
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  });
  const pose = async (direction, altitude, pitch, bearing = 0) => {
    await page.evaluate(({ direction, altitude, pitch, bearing }) => {
      const nav = window.starAgent.navigation;
      nav.transit(direction, altitude); nav.autoland = false; nav.velocity.set(0,0,0);
      const up = nav.position.clone().normalize();
      const east = up.clone().set(0,1,0).cross(up).normalize();
      const north = up.clone().cross(east).normalize();
      const target = nav.position.clone().addScaledVector(north, Math.cos(bearing)*100).addScaledVector(east,Math.sin(bearing)*100).addScaledVector(up, Math.tan(pitch)*100);
      nav.orientToward(target,up);
      window.starAgent.setRenderScale(.55);
    }, { direction, altitude, pitch, bearing });
    // Wait for selection at the NEW position; old diagnostics survive until a frame runs.
    await page.waitForTimeout(1200);
    await page.waitForFunction(() => window.starAgent.state.lod >= 15 && window.starAgent.state.pending < 5, null, { timeout: 60000 });
  };
  const capture = async name => {
    await page.evaluate(async () => { window.starAgent.setRenderScale(1); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); });
    const path = `/tmp/star-agent-surface/${name}.png`;
    await page.screenshot({ path }); await testInfo.attach(name, { path, contentType: 'image/png' });
    const state = await page.evaluate(() => window.starAgent.state);
    expect(state.lod).toBeGreaterThanOrEqual(15);
    captures.push({ name, state }); console.log(name, state);
    expect(errors).toEqual([]);
    await page.evaluate(() => window.starAgent.setRenderScale(.55));
  };
  const forest = findDestinations().forest;
  await pose(forest, 3.5, -.15, 1.5);
  await capture('forest-ground');
  expect(captures.at(-1).state.vegetation.treeLods.every(count => count > 0)).toBe(true);
  expect(captures.at(-1).state.vegetation.treeRange).toBe(1400);
  await pose(forest, 180, -.3, 1.5);
  await capture('forest-distance');
  // Shoreline fixture is a zero crossing of generator v2, seed 7291.
  const shore = [.39930867569257666,.2542796094767946,.8808487167050706];
  expect(Math.abs(terrainHeight(...shore))).toBeLessThan(.001);
  await pose(shore, 8, -.3, 1.9);
  await capture('shoreline');
  await writeFile('/tmp/star-agent-surface/render-environment.json', JSON.stringify({ browser: browser.version(), backend, viewport: {width:1440,height:900}, captures }, null, 2));
  expect(errors).toEqual([]);
});
