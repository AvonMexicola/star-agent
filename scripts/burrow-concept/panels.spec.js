import {test, expect} from '@playwright/test';
import {mkdir, writeFile} from 'node:fs/promises';

const output = process.env.BURROW_OUTPUT ?? '/tmp/burrow-concept-panels';
const state = page => page.evaluate(() => starAgent.state);
const wait = (page, fn, arg = null, timeout = 15000) => page.waitForFunction(fn, arg, {timeout});
const keys = {mine: 'KeyT', forward: 'KeyW', reverse: 'KeyS', right: 'KeyD', brake: 'KeyX'};
const selectors = {entry: '[data-rover-action="entry"]', cargo: '[data-rover-action="cargo"]',
  close: '#cargo-dialog .gameplay-resume', next: '[data-controller-key="page-containers-next"]'};

// Native touch contacts use the Chromium 151 released-points protocol already
// established by mining-rover-inputs.spec.js; no synthetic DOM action dispatch.
async function inputs(page, phone, dir) {
  const session = phone ? await page.context().newCDPSession(page) : null;
  const held = new Map(); let serial = 1;
  async function center(selector) {
    const el = page.locator(selector); await expect(el).toBeVisible(); await expect(el).toBeEnabled();
    // A newly opened cargo dialog animates and lays out its paged containers.
    // Observe a stable, actually hittable centre before sending native contact.
    const b = await el.evaluate(async el => {
      let previous = null, stable = 0;
      const deadline = performance.now() + 5000;
      while (performance.now() < deadline) {
        await new Promise(resolve => requestAnimationFrame(resolve));
        const r = el.getBoundingClientRect(), b = {x: r.x, y: r.y, width: r.width, height: r.height};
        const same = previous && Object.keys(b).every(k => Math.abs(b[k] - previous[k]) < .1);
        const hit = el.contains(document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2));
        stable = same && hit ? stable + 1 : 0; previous = b;
        if (stable >= 3) return b;
      }
      throw Error('Native touch control never settled at a hittable centre: ' + el.outerHTML.slice(0, 180));
    }), viewport = page.viewportSize();
    expect(b.x).toBeGreaterThanOrEqual(0); expect(b.y).toBeGreaterThanOrEqual(0);
    expect(b.x + b.width).toBeLessThanOrEqual(viewport.width + .5);
    expect(b.y + b.height).toBeLessThanOrEqual(viewport.height + .5);
    const p = {x: b.x + b.width / 2, y: b.y + b.height / 2, id: serial++};
    expect(await el.evaluate((el, p) => el.contains(document.elementFromPoint(p.x, p.y)), p)).toBe(true);
    return p;
  }
  async function release(action) {
    if (!held.has(action)) return;
    if (phone) await session.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: held.size > 1 ? [held.get(action)] : []});
    else await page.keyboard.up(keys[action]);
    held.delete(action);
  }
  async function hold(actions) {
    for (const action of [...held.keys()]) if (!actions.includes(action)) await release(action);
    for (const action of actions) if (!held.has(action)) {
      if (phone) {
        const p = await center(`[data-rover-hold="${action}"]`);
        await session.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [p]}); held.set(action, p);
      } else { await page.keyboard.down(keys[action]); held.set(action, true); }
    }
  }
  async function tap(action) {
    if (!phone) return page.keyboard.press({entry: 'KeyF', cargo: 'KeyI', close: 'KeyI'}[action]);
    // Read the presented dialog before locating a second-finger page action.
    // Previous failures hit HEADER even though main-thread elementFromPoint
    // had reported the pager. Retain the actual painted frame for diagnosis.
    if (action === 'next') await page.screenshot({path:dir+'/before-native-pager.png'});
    const p = await center(selectors[action]);
    await session.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [p]});
    if (action === 'next') {
      const landed = await page.evaluate(() => burrowTouches.filter(e => e.type === 'pointerdown').at(-1));
      expect(landed?.target, 'native contact must land on the visually presented pager').toBe('page-containers-next');
    }
    await page.waitForTimeout(70);
    await session.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: held.size ? [p] : []});
  }
  return {hold, tap, async dispose() { await hold([]); await session?.detach(); }};
}

async function atlas(page) {
  return page.evaluate(() => {
    const root = starAgent.navigation.vehicle.object, names = ['RoverDisplay', 'RoverCuttersDisplay', 'RoverOreDisplay', 'RoverDrivePad', 'RoverMiningPad'];
    const faces = names.map(n => root.getObjectByName(n + 'Live'));
    const texture = faces[0].material.map, canvas = texture.image;
    // Read a CPU inspection copy so our repeated pixel probes do not change the
    // production canvas's backing strategy or generate readback warnings.
    const copy = document.createElement('canvas'); copy.width = canvas.width; copy.height = canvas.height;
    const ctx = copy.getContext('2d', {willReadFrequently: true}); ctx.drawImage(canvas, 0, 0);
    return {faces: faces.map(f => ({name: f.name, material: f.material.uuid, texture: f.material.map.uuid, triangles: f.geometry.index.count / 3})),
      size: [canvas.width, canvas.height], version: texture.version,
      forward: [...ctx.getImageData(400, 310, 1, 1).data], mining: [...ctx.getImageData(554, 321, 1, 1).data],
      image: canvas.toDataURL('image/png'), yoke: Boolean(root.getObjectByName('SteeringYoke'))};
  });
}

test('Burrow panels follow actual mining and driving through physical cabin access', async ({page, browser}, info) => {
  const phone = info.project.name === 'touch', dir = output + '/' + info.project.name;
  await mkdir(dir, {recursive: true});
  const errors = [], warnings = [], requests = [], milestones = [], access = [];
  let complete = false, failed = null;
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); if (m.type() === 'warning') warnings.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) requests.push({status: r.status(), url: r.url()}); });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'getGamepads', {value: () => []});
    window.burrowTouches = [];
    for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'gotpointercapture', 'lostpointercapture', 'click']) window.addEventListener(type, e => {
      if (e.pointerType === 'touch' || type === 'click') {
        const b = e.target.closest?.('button');
        burrowTouches.push({type, trusted: e.isTrusted, pointer: e.pointerId, primary: e.isPrimary,
          time: performance.now(), x: e.clientX, y: e.clientY, target: b?.dataset.controllerKey ?? b?.dataset.roverHold ?? b?.dataset.roverAction ?? e.target.tagName});
      }
    }, true);
  });
  const input = await inputs(page, phone, dir);
  const shot = name => page.screenshot({path: dir + '/' + name + '.png'});
  async function note(name) {
    const display = await atlas(page);
    await writeFile(dir + '/' + name + '-atlas.png', Buffer.from(display.image.split(',')[1], 'base64'));
    delete display.image;
    milestones.push({name, time: new Date().toISOString(), state: await state(page), display});
    console.log(info.project.name + ': ' + name); return display;
  }
  async function board(inward) {
    await page.evaluate(() => {
      window.burrowAccess = {active: true, points: []};
      function frame() { if (!burrowAccess.active) return; const s = starAgent.state;
        burrowAccess.points.push({p: s.position, phase: s.rover.phase, door: s.rover.door}); requestAnimationFrame(frame); }
      requestAnimationFrame(frame);
    });
    await input.tap('entry');
    await wait(page, inward => starAgent.state.rover.occupied === inward && !starAgent.state.rover.busy, inward, 25000);
    const points = await page.evaluate(() => { burrowAccess.active = false; return burrowAccess.points; });
    const maxStep = Math.max(0, ...points.slice(1).map((s, i) => Math.hypot(...s.p.map((v, j) => v - points[i].p[j]))));
    expect(points.some(p => p.door > .99)).toBe(true); expect(maxStep).toBeLessThan(.3);
    expect((await state(page)).rover.door).toBe(0); access.push({inward, maxStep, points});
  }
  async function stop() {
    await input.hold(['brake']); await wait(page, () => Math.abs(starAgent.state.rover.speed) < .025);
    await input.hold([]); await page.waitForTimeout(180);
  }
  try {
    // Explicit developer ground start is disclosed; everything after it uses
    // actual keyboard/native touchscreen input, including both boarding routes.
    await page.goto('/?dev=1&intro=0&start=rover-surface&debug=1&seed=7291');
    await wait(page, () => window.starAgent?.state.ready && starAgent.state.rover?.occupied && !starAgent.state.transiting, null, 90000);
    expect((await state(page)).rover.error).toBeNull();
    await board(false); await shot('01-physical-door'); await board(true);
    const idle = await note('02-enclosed-cockpit'); await shot('02-enclosed-cockpit');
    expect(idle.faces).toHaveLength(5); expect(new Set(idle.faces.map(f => f.material)).size).toBe(1);
    expect(new Set(idle.faces.map(f => f.texture)).size).toBe(1); expect(idle.size).toEqual([1024, 512]);
    expect(idle.yoke).toBe(false); expect(idle.faces.reduce((n, f) => n + f.triangles, 0)).toBe(10);
    const mass = (await state(page)).rover.mass;
    await input.hold(['mine']);
    await wait(page, mass => starAgent.state.rover.beaming === 2 && starAgent.state.rover.mass > mass + .02, mass, 25000);
    await page.waitForTimeout(1100); const cutting = await note('03-twin-mining'); await shot('03-twin-mining');
    expect(cutting.version).toBeGreaterThan(idle.version); expect(cutting.mining).toEqual([233, 178, 116, 255]);
    await input.tap('cargo'); await expect(page.locator('#cargo-dialog')).toBeVisible();
    await wait(page, () => starAgent.state.rover.beaming === 0);
    expect((await state(page)).containers.target).toBe('meridian-rover-bin');
    // The final cut may still publish after input stops. Inspect the settled
    // inventory; a replaced pager cannot retain native pointer capture.
    await wait(page, () => !starAgent.state.mining.pending);
    if (phone) await input.tap('next');
    await expect(page.locator('[data-from="meridian-rover-bin"][data-item]').first()).toBeVisible();
    await shot('04-real-ore-inventory');
    await input.tap('close'); await expect(page.locator('#cargo-dialog')).not.toBeVisible();
    if (!phone) await page.keyboard.down('KeyT');
    await page.waitForTimeout(350); expect((await state(page)).rover.beaming).toBe(0);
    await input.hold([]); await input.hold(['mine']); await wait(page, () => starAgent.state.rover.beaming === 2);
    await input.hold([]); await wait(page, () => starAgent.state.rover.beaming === 0);
    await input.hold(['forward', 'right']); await wait(page, () => starAgent.state.rover.speed > .6);
    await page.waitForTimeout(180); const driving = await note('05-drive-panels'); await shot('05-drive-panels');
    expect(driving.forward).toEqual([233, 178, 116, 255]); expect((await state(page)).rover.controls.steer).toBe(1);
    // Hold reverse directly from forward motion, without inserting a brake or
    // neutral frame: it must decelerate through zero and keep driving backward.
    await input.hold(['reverse']); await wait(page, () => starAgent.state.rover.speed < -.4);
    const reversing = (await state(page)).rover;
    expect(reversing.controls.throttle).toBe(-1); expect(reversing.controls.brake).toBe(0);
    await page.waitForTimeout(700);
    const reversed = (await state(page)).rover;
    expect(reversed.speed).toBeLessThan(-.4);
    expect(Math.hypot(...reversed.position.map((n, i) => n - reversing.position[i]))).toBeGreaterThan(.3);
    await note('06-reverse'); await shot('06-reverse'); await stop();
    const resumed = await note('07-resumed-play'); expect(resumed.forward).toEqual([81, 120, 128, 255]);
    expect((await state(page)).enabled).toBe(true); await shot('07-resumed-play');
    if (!phone) { await page.keyboard.press('Digit4'); await shot('08-surface-exterior'); }
    await input.hold(['forward']);
    const contactHandle = await wait(page, () => { const s=starAgent.state; return s.rover.blocked ? s : null; }, null, 18000);
    const contactState = await contactHandle.jsonValue(); await contactHandle.dispose();
    const contact = contactState.rover;
    // Retain the exact blocked frame: the next frame may already be separating
    // from a glancing contact while the held forward input remains active.
    milestones.push({name:'09-observed-contact-stop',time:new Date().toISOString(),state:contactState,display:null});
    await note('09-contact-stop'); await shot('09-contact-stop');
    expect(contact.controls.brake).toBe(0);
    await input.hold(['reverse']); await wait(page, () => starAgent.state.rover.speed < -.4);
    await page.waitForTimeout(700);
    const escaped = (await state(page)).rover;
    expect(escaped.blocked).toBe(false);
    expect(Math.hypot(...escaped.position.map((n, i) => n - contact.position[i]))).toBeGreaterThan(.3);
    await note('10-reverse-from-contact'); await shot('10-reverse-from-contact'); await stop();
    expect(errors).toEqual([]); expect(requests).toEqual([]);
    if (phone) {
      const touches = await page.evaluate(() => burrowTouches);
      const native = touches.filter(e => e.type !== 'click');
      // SecondaryTouchButtons deliberately invokes existing click handlers for
      // a second finger; its semantic click is synthetic, its contacts are native.
      expect(native.length).toBeGreaterThan(12); expect(native.every(e => e.trusted)).toBe(true);
    }
    complete = true;
  } catch (error) { failed = error.message; throw error; }
  finally {
    await input.dispose().catch(() => {}); await shot('last-frame').catch(() => {});
    const gpu = await page.evaluate(() => {
      const g = document.querySelector('#viewport')?.getContext('webgl2'), e = g?.getExtension('WEBGL_debug_renderer_info');
      return g ? {renderer: g.getParameter(e ? e.UNMASKED_RENDERER_WEBGL : g.RENDERER), buffer: [g.drawingBufferWidth, g.drawingBufferHeight]} : null;
    }).catch(() => null);
    await writeFile(dir + '/journey.json', JSON.stringify({complete, failed, browser: browser.version(), viewport: page.viewportSize(), gpu,
      nativeTouches: await page.evaluate(() => burrowTouches).catch(() => []),
      scope: 'Explicit developer surface start, followed by real keyboard or injected native touch. Controller carrier journey recorded separately; no hardware/FPS claim.',
      errors, warnings, requests, milestones, access, final: await state(page).catch(() => null)}, null, 2));
  }
});
