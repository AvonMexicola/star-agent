import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { findDestinations } from '../src/world.js';
import { MOON_LANDING_DIRECTION, LANDING_FRAME, MOON_RADIUS } from '../src/moon-world.js';
import { Vector3 } from 'three';

const stage = process.env.SURFACE_STAGE || 'after';
const evidence = `/tmp/star-agent-terrain-surfaces/${stage}`;
const lunarOffset = (x, z) => new Vector3(...MOON_LANDING_DIRECTION)
  .addScaledVector(new Vector3(...LANDING_FRAME.east), x / MOON_RADIUS)
  .addScaledVector(new Vector3(...LANDING_FRAME.north), z / MOON_RADIUS).normalize().toArray();

test('planet and moon materials render at walking and flight distances', async ({ page, browser }) => {
  const errors = [], maps = [], captures = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('response', response => { if (/materials\/terrain\/.*png/.test(response.url())) maps.push(response.status()); });
  await page.addInitScript(() => {
    window.surfacePrograms = [];
    const link = WebGL2RenderingContext.prototype.linkProgram;
    WebGL2RenderingContext.prototype.linkProgram = function(program) {
      link.call(this, program);
      const source = this.getAttachedShaders(program).map(s => this.getShaderSource(s)).join('\n');
      if (source.includes('terrainMapsReady')) window.surfacePrograms.push({ gl: this, program });
    };
  });
  await page.goto('/?seed=7291&debug=1');
  await page.waitForFunction(() => window.starAgent?.state.ready);
  await page.keyboard.press('Shift+Tab');
  await mkdir(evidence, { recursive: true });
  const destinations = findDestinations();
  const shots = [
    { name: 'aeon-soil', direction: destinations.forest, altitude: 5, pitch: -.7, bearing: 1.5 },
    { name: 'aeon-cliffs', direction: destinations.mountain, altitude: 160, pitch: -.35, bearing: 1.2 },
    { name: 'aeon-coast', direction: [.39930867569257666,.2542796094767946,.8808487167050706], altitude: 9, pitch: -.4, bearing: 1.9 },
    { name: 'selene-dust', moon: true, direction: MOON_LANDING_DIRECTION, altitude: 5, pitch: -.75, bearing: 1.2 },
    { name: 'selene-crater', moon: true, direction: MOON_LANDING_DIRECTION, altitude: 100, pitch: -.28, bearing: -1.5 },
    { name: 'selene-copper', moon: true, direction: lunarOffset(2600, -3400), altitude: 6, pitch: -.7, bearing: .5 },
  ];
  for (const shot of shots) {
    await page.evaluate(({ moon, direction, altitude, pitch, bearing }) => {
      const nav = window.starAgent.navigation;
      if (moon) nav.transitMoon(altitude, direction); else nav.transit(direction, altitude);
      nav.enabled = false;
      const up = nav.normal.clone();
      const east = up.clone().set(0,1,0).cross(up).normalize(), north = up.clone().cross(east).normalize();
      nav.orientToward(nav.position.clone().addScaledVector(north, Math.cos(bearing)*100)
        .addScaledVector(east, Math.sin(bearing)*100).addScaledVector(up, Math.tan(pitch)*100), up);
      window.starAgent.setRenderScale(.5);
    }, shot);
    await page.waitForTimeout(800);
    await page.waitForFunction(({moon, altitude}) => {
      const s = window.starAgent.state;
      return moon ? s.moon.lod >= (altitude < 20 ? 17 : 14) : s.lod >= 14 && s.pending < 4;
    }, shot, { timeout: 90000 });
    // The lunar cache can rebuild distant patches while the visible surface is
    // already detailed. Check the required LOD, not global cache inactivity.
    await page.evaluate(async () => { for(let i=0;i<12;i++) await new Promise(r => requestAnimationFrame(r)); });
    await page.evaluate(async () => { window.starAgent.setRenderScale(1); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); });
    await page.screenshot({ path: `${evidence}/${shot.name}.png` });
    captures.push({ name: shot.name, state: await page.evaluate(() => window.starAgent.state) });
    console.log(shot.name);
    expect(errors).toEqual([]);
  }
  const graphics = await page.evaluate(() => {
    const gl = document.querySelector('canvas').getContext('webgl2'), extension = gl.getExtension('WEBGL_debug_renderer_info');
    return { backend: extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      programs: window.surfacePrograms.map(({gl, program}) => ({ linked: gl.getProgramParameter(program, gl.LINK_STATUS),
        log: gl.getProgramInfoLog(program), ready: gl.getUniform(program, gl.getUniformLocation(program, 'terrainMapsReady')) })) };
  });
  if (stage !== 'before') {
    expect(maps).toEqual([200, 200]);
    expect(graphics.programs.length).toBeGreaterThanOrEqual(2);
    expect(graphics.programs.every(p => p.linked)).toBe(true);
    expect(graphics.programs.every(p => p.ready === 1)).toBe(true);
  }
  await writeFile(`${evidence}/environment.json`, JSON.stringify({ browser: browser.version(), viewport: [1280,800], scale: 1, ...graphics, maps, errors, captures }, null, 2));
});

test('an unreadable atlas retains playable procedural surfaces', async ({ page }) => {
  test.skip(stage === 'before');
  const errors = [], warnings = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text());
    if (message.type() === 'warning') warnings.push(message.text());
  });
  await page.route('**/materials/terrain/normal-roughness.png', route => route.fulfill({ status: 200, contentType: 'image/png', body: 'invalid atlas' }));
  await page.goto('/?debug=1');
  await page.waitForFunction(() => window.starAgent?.state.ready);
  await page.evaluate(() => {
    const nav = window.starAgent.navigation;
    nav.transitMoon(5); nav.enabled = false;
    nav.orientToward(nav.position.clone().addScaledVector(nav.normal,-30), nav.normal);
    window.starAgent.setRenderScale(.5);
  });
  await page.waitForFunction(() => window.starAgent.state.moon.lod >= 14);
  expect(warnings.some(w => w.includes('Using procedural terrain materials.'))).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({ path: `${evidence}/fallback.png` });
});
