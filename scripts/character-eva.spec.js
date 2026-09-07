import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

test('controller physically exits to EVA, aims in both views, coasts, brakes and returns to the chair', async ({ page, browser }) => {
  const out = join(process.env.CHARACTER_EVIDENCE || '/tmp', 'eva'); await mkdir(out, { recursive: true });
  page.setDefaultTimeout(45000);
  const errors = [], warnings = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); if (m.type() === 'warning') warnings.push(m.text()); });
  await page.addInitScript(() => {
    window.suitPad = { id: 'Character EVA standard controller', index: 0, mapping: 'standard', connected: true,
      axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })) };
    Object.defineProperty(navigator, 'getGamepads', { value: () => [window.suitPad] });
  });
  const frames = () => page.evaluate(async () => { for (let i = 0; i < 3; i++) await new Promise(r => requestAnimationFrame(r)); });
  const button = async (index, down) => { await page.evaluate(({ index, down }) => {
    window.suitPad.buttons[index] = { pressed: down, value: Number(down) };
  }, { index, down }); await frames(); };
  const tap = async index => { await button(index, true); await button(index, false); };
  const axes = values => page.evaluate(values => { window.suitPad.axes = values; }, values);
  const camera = async () => {
    await page.waitForFunction(() => window.starAgent.state.controller.armed);
    await button(4, true); await button(5, true); await tap(15); await button(4, false); await button(5, false);
  };
  try {
    await page.goto('/?intro=0&seed=7291&debug');
    await page.waitForFunction(() => window.starAgent?.state.ready && window.starAgent.state.controller.armed);
    await tap(1); await tap(2);
    await page.waitForFunction(() => window.starAgent.navigation.spaceParked && window.starAgent.state.mode === 'walk');
    await axes([0, -1, 0, 0]); await page.waitForFunction(() => window.starAgent.state.shipLocal[2] > 2.3);
    await axes([0, 0, 0, 0]); await tap(2); await page.waitForFunction(() => window.starAgent.state.doorProgress === 1);
    await axes([0, -1, 0, 0]); await page.waitForFunction(() => window.starAgent.state.mode === 'eva'); await axes([0, 0, 0, 0]);
    // The chase boom correctly retracts beside the ramp. Thrust into clear space
    // before requiring the full external view; navigation owns this movement.
    await axes([0, -1, 0, 0]); await page.waitForFunction(() => window.starAgent.state.shipLocal[2] > 18); await axes([0, 0, 0, 0]);
    await button(6, true); await page.waitForFunction(() => window.starAgent.state.speed < .01); await button(6, false);
    console.log('EVA clear of ramp', await page.evaluate(() => ({local:window.starAgent.state.shipLocal,camera:window.starAgent.state.camera})));
    await tap(14); await page.waitForFunction(() => window.starAgent.state.mining.tool.item === 'rifle-laser');
    await camera(); await page.waitForFunction(() => window.starAgent.state.mining.tool.attachment === 'character-hand' && window.starAgent.state.character.visible);
    console.log('EVA third-person ready');
    const ammo = await page.evaluate(() => window.starAgent.state.mining.tool.ammo);
    await page.waitForFunction(() => window.starAgent.state.controller.armed);
    await button(7, true); await page.waitForFunction(ammo => window.starAgent.state.mining.tool.ammo < ammo, ammo); await button(7, false);
    await page.screenshot({ path: join(out, 'third-person-rifle.png') });
    const remaining = await page.evaluate(() => window.starAgent.state.mining.tool.ammo);
    await camera(); await page.waitForFunction(() => window.starAgent.state.mining.tool.attachment === 'first-person' && !window.starAgent.state.character.visible);
    console.log('EVA returned to first person');
    expect(await page.evaluate(() => window.starAgent.state.mining.tool.ammo)).toBe(remaining);
    await page.screenshot({ path: join(out, 'first-person-rifle.png') });
    const outside = await page.evaluate(() => window.starAgent.state.position);
    await axes([0, -1, 0, 0]); await page.waitForTimeout(400); await axes([0, 0, 0, 0]); await page.waitForTimeout(1000);
    expect(await page.evaluate(() => window.starAgent.state.speed)).toBeGreaterThan(.5);
    expect(await page.evaluate(() => window.starAgent.state.position)).not.toEqual(outside);
    await button(6, true); await page.waitForFunction(() => window.starAgent.state.speed < .01); await button(6, false);
    await axes([0, 1, 0, 0]); await page.waitForTimeout(350); await axes([0, 0, 0, 0]);
    await page.waitForFunction(() => window.starAgent.state.mode === 'walk', null, { timeout: 30000 });
    await axes([0, 1, 0, 0]); await page.waitForFunction(() => window.starAgent.state.shipLocal[2] < -1.4); await axes([0, 0, 0, 0]);
    await tap(1); await tap(2); await page.waitForFunction(() => window.starAgent.state.mode === 'flight');
    expect(await page.evaluate(() => window.starAgent.navigation.spaceParked)).toBe(false);
    await page.screenshot({ path: join(out, 'returned-to-chair.png') });
    expect(errors).toEqual([]); expect(warnings).toEqual([]);
  } finally {
    await writeFile(join(out, 'evidence.json'), JSON.stringify({ browser: browser.version(), input: 'Injected W3C standard Gamepad; no keyboard, pointer, teleport or gameplay state mutation. Physical hardware not tested.',
      viewport: page.viewportSize(), final: await page.evaluate(() => window.starAgent?.state).catch(error => ({unavailable:error.message})), errors, warnings }, null, 2));
  }
});
