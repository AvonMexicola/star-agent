import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

// Actual seeded outcrops from the rock-material tour, held fixed for comparison.
const cases = [
  { body: 'miasma', eye: [.601408218876073,.6688545268590339,-.43696885034117394], target: [18213160633.084404,7556096441.146508,11679940949.953436] },
  { body: 'selene', eye: [.44821909134965116,.21892217076478226,.8667022148912098], target: [-2193643.3292671675,94934.20470339815,-23504785.46823977] },
  { body: 'pyre', eye: [-.5743643494654797,-.0996909204278106,-.8125068088621487], target: [18210716684.008247,7553155130.145759,11673473079.118124] },
  { body: 'aeon', eye: [.838970418588386,.37450291018062376,.39481160950492866], target: [1336632.038912082,596618.8215010805,629081.84415094] },
];

test('ground wisps and particles render on all four worlds, then clear in orbit', async ({ page, browser }) => {
  const dir = '/tmp/star-agent-weather', errors = [], states = [];
  await mkdir(dir, { recursive: true });
  page.on('pageerror', e => { errors.push(e.message); console.log(e.message); });
  page.on('console', m => { if (m.type() === 'error') { errors.push(m.text()); console.log(m.text()); } });
  await page.goto('/?intro=0&debug&seed=7291');
  await page.waitForFunction(() => window.starAgent?.state.ready);
  expect(errors).toEqual([]);
  await page.keyboard.press('Shift+Tab');
  for (const c of cases) {
    await page.evaluate(c => {
      const s = window.starAgent, n = s.navigation;
      if (c.body === 'miasma') n.transitMiasma(4, c.eye);
      else if (c.body === 'selene') n.transitMoon(4, c.eye);
      else if (c.body === 'pyre') n.transitPyre(4, c.eye);
      else n.transit(c.eye, 4);
      n.enabled = false; s.setRenderScale(.4);
      n.orientToward(n.position.clone().set(...c.target), n.normal);
    }, c);
    await page.waitForFunction(body => {
      const s = window.starAgent.state;
      const level = body === 'aeon' ? s.lod : body === 'selene' ? s.moon.lod : s[body].lod;
      return s.body === body && level >= 16 && s.surfaceWeather.ready && s.surfaceWeather.strength > .95;
    }, c.body, { timeout: 300000 });
    if (c.body === 'selene') await page.evaluate(async () => { for (let i=0;i<90;i++) await new Promise(r => requestAnimationFrame(r)); });
    for (const enabled of [false, true]) {
      await page.evaluate(async enabled => {
        const s = window.starAgent; s.surfaceWeather.enabled = enabled; s.setRenderScale(.4);
        for (let i=0;i<24;i++) await new Promise(r => requestAnimationFrame(r));
        s.setRenderScale(1);
        for (let i=0;i<3;i++) await new Promise(r => requestAnimationFrame(r));
      }, enabled);
      const name = `${c.body}-${enabled ? 'after' : 'before'}`;
      await page.screenshot({ path: `${dir}/${name}.png` });
      const state = await page.evaluate(() => window.starAgent.state);
      states.push({ name, state }); console.log(`Captured ${name}`, state.surfaceWeather);
      expect(state.surfaceWeather.strength)[enabled ? 'toBeGreaterThan' : 'toBe'](enabled ? .8 : 0);
      expect(errors).toEqual([]);
    }
  }
  await page.evaluate(() => { const s = window.starAgent; s.setRenderScale(.4); s.navigation.transit(s.navigation.normal, 250000); s.navigation.enabled = false; });
  await page.waitForFunction(() => window.starAgent.state.surfaceWeather.strength === 0);
  expect(await page.evaluate(() => window.starAgent.state.surfaceWeather.particles)).toBe(0);
  await page.screenshot({ path: `${dir}/orbit-clear.png` });
  const backend = await page.evaluate(() => { const gl = document.querySelector('canvas').getContext('webgl2'), e = gl.getExtension('WEBGL_debug_renderer_info'); return gl.getParameter(e.UNMASKED_RENDERER_WEBGL); });
  await writeFile(`${dir}/environment.json`, JSON.stringify({ browser: browser.version(), backend, viewport: [1280,800], errors, states }, null, 2));
  expect(errors).toEqual([]);
});
