import {test, expect} from '@playwright/test';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {GANNET_LAYOUT as G} from '../src/gannet-layout.js';
import {ROVER_LAYOUT as R} from '../src/rover-layout.js';

const output = process.env.GANNET_OUTPUT ?? '/home/cees/projects/.medium-ships-qa/gannet-controller';
const sourceRoot = process.env.GANNET_SOURCE ?? new URL('..', import.meta.url).pathname;
const sourceFiles = ['src/main.js', 'src/navigation.js', 'src/medium-ship-gameplay.js', 'src/gannet.js',
  'src/gannet-systems.js', 'src/gannet-layout.js', 'src/mining-rover.js', 'src/rover-carrier.js',
  'src/rover-support.js', 'src/rover-physics.js', 'src/gamepad.js', 'src/controller-ui.js',
  'src/ship-inventory-ui.js', 'src/mining/rock.js', 'src/mining/store.js',
  'assets/gannet/layout.json', 'assets/gannet/collision.json', 'assets/mining-rover/layout.json',
  'public/models/gannet.glb', 'public/models/mining-rover.glb'];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceHashes = async () => Object.fromEntries(await Promise.all(sourceFiles.map(async file => [file, hash(await readFile(sourceRoot + '/' + file))])));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const distanceXZ = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);

// Derived from the established mining-rover controller journey and its native
// focus diagnostic. Only standard Gamepad input changes gameplay. All navigation,
// physics, ray targets and inventory accesses below are observations/cloned math.
test('controller Gannet → physical Burrow → elevator → real ore → reverse reload → carried flight', async ({page, browser}) => {
  await mkdir(output, {recursive: true});
  const errors = [], warnings = [], requests = [], milestones = [], gates = {}, trajectory = [];
  const beforeHashes = await sourceHashes();
  let phase = 'startup', failed = null, complete = false, recordOutbound = false;
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); if (message.type() === 'warning') warnings.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) requests.push({status: response.status(), url: response.url()}); });
  await page.addInitScript(() => {
    window.gannetPad = {id: 'Gannet standard controller acceptance', index: 0, connected: true,
      mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({length: 17}, () => ({pressed: false, value: 0}))};
    Object.defineProperty(navigator, 'getGamepads', {value: () => [window.gannetPad]});
    window.__gannetReview = {inputs: [], focus: [], access: null};
    const record = event => __gannetReview.focus.push({type: event.type, trusted: event.isTrusted,
      time: performance.now(), focused: document.hasFocus(), visibility: document.visibilityState});
    window.addEventListener('focus', record); window.addEventListener('blur', record);
    document.addEventListener('visibilitychange', record);
  });
  const state = () => page.evaluate(() => window.starAgent.state);
  const wait = (predicate, arg = null, timeout = 15000) => page.waitForFunction(predicate, arg, {timeout, polling: 50});
  const frames = (count = 4) => page.evaluate(async count => { for (let i = 0; i < count; i++) await new Promise(resolve => requestAnimationFrame(resolve)); }, count);
  const axes = values => page.evaluate(values => {
    gannetPad.axes = values; __gannetReview.inputs.push({t: performance.now(), axes: values});
  }, values);
  async function button(index, down) {
    await page.evaluate(({index, down}) => {
      gannetPad.buttons[index] = {pressed: down, value: Number(down)};
      __gannetReview.inputs.push({t: performance.now(), button: index, down});
    }, {index, down});
    await frames();
  }
  const tap = async index => { await button(index, true); await button(index, false); };
  async function neutral() {
    await page.evaluate(() => {
      gannetPad.axes = [0, 0, 0, 0]; gannetPad.buttons = gannetPad.buttons.map(() => ({pressed: false, value: 0}));
      __gannetReview.inputs.push({t: performance.now(), neutral: true});
    });
    await frames();
  }
  async function readyInput() { await neutral(); await wait(() => starAgent.state.controller.armed); }
  async function stop() {
    await axes([0, 0, 0, 0]); await button(6, true);
    await wait(() => Math.abs(starAgent.state.rover.speed) < .025, null, 6000);
    await button(6, false); await frames();
  }
  async function chord(index) {
    await readyInput(); await button(4, true); await button(5, true); await tap(index);
    await button(5, false); await button(4, false); await frames();
  }
  function appendPath(local) {
    if (recordOutbound && (!trajectory.length || distanceXZ(local, trajectory.at(-1)) >= .22)) trajectory.push([...local]);
  }
  async function note(name) {
    const s = await state(); milestones.push({name, phase, time: new Date().toISOString(), pageTime: await page.evaluate(() => performance.now()),
      mode: s.mode, position: s.position, shipLocal: s.shipLocal, shipPosition: s.shipPosition, shipOrientation: s.shipOrientation,
      rover: s.rover, lifts: s.lifts, camera: s.camera, controller: s.controller, containers: s.containers, mining: s.mining});
    console.log('Gannet controller:', name);
  }
  const shot = async name => { await frames(); await page.screenshot({path: output + '/' + name + '.png'}); };
  async function pilotShot(name) {
    if ((await state()).camera.mode !== 'cockpit') await chord(15);
    await wait(() => starAgent.state.camera.mode === 'cockpit');
    await page.waitForTimeout(750); await shot(name);
    const sightline = await page.evaluate(() => ({orientation: starAgent.navigation.orientation.toArray(),
      shipOrientation: starAgent.navigation.shipOrientation.toArray(), camera: starAgent.state.camera, shipLocal: starAgent.state.shipLocal}));
    milestones.push({name: 'Settled actual Gannet pilot view', image: name + '.png', phase,
      pageTime: await page.evaluate(() => performance.now()), sightline,
      visualRequirement: 'Main forward pilot view must have no central strut/mullion; image review required, not an automatic visual pass'});
  }

  async function walk(target) {
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      const c = await page.evaluate(target => {
        const n = starAgent.navigation, d = n.fromShipLocal(n.position.clone().fromArray(target)).sub(n.position).applyQuaternion(n.orientation.clone().invert());
        return {distance: Math.hypot(d.x, d.z), x: d.x, z: d.z, local: n.toShipLocal().toArray()};
      }, target);
      if (c.distance < .16) { await axes([0, 0, 0, 0]); await frames(); return; }
      const speed = clamp(c.distance * 1.2, .25, .72);
      await axes([c.x / c.distance * speed, c.z / c.distance * speed, 0, 0]);
      await page.waitForTimeout(70);
    }
    throw Error('Walking could not reach ' + JSON.stringify(target) + '; actual local=' + JSON.stringify((await state()).shipLocal));
  }

  // Invert the shared radial deadzone and rover's x1.5 steering compensation.
  // This sets raw controller axes; the production physics alone integrates them.
  async function driveInput(steer, signedSpeed) {
    const x = clamp(steer, -1, 1) / 1.5;
    const y = -signedSpeed / (signedSpeed >= 0 ? R.driving.forwardSpeed : R.driving.reverseSpeed);
    const length = Math.hypot(x, y), scale = length ? (.16 + .84 * Math.min(1, length)) / length : 0;
    await axes([x * scale, y * scale, 0, 0]);
  }
  async function followPath(path, {reverse = false, reach = .16, maxSpeed = 1.6, seconds = 65} = {}) {
    let index = 0, blockedSince = null, progressAt = Date.now(), bestRemaining = Infinity;
    const deadline = Date.now() + seconds * 1000;
    while (Date.now() < deadline) {
      const s = await state(), local = s.rover.local; appendPath(local);
      const remaining = distanceXZ(local, path.at(-1));
      if (remaining < reach && index >= path.length - 12) { await stop(); appendPath((await state()).rover.local); return; }
      let nearest = index, nearestDistance = Infinity;
      for (let j = index; j < Math.min(path.length, index + 24); j++) {
        const d = distanceXZ(local, path[j]); if (d < nearestDistance) { nearestDistance = d; nearest = j; }
      }
      if (nearest > index || remaining < bestRemaining - .15) { progressAt = Date.now(); bestRemaining = remaining; }
      index = nearest;
      let look = index;
      while (look < path.length - 1 && distanceXZ(local, path[look]) < 1.8) look++;
      const c = await page.evaluate(target => {
        const n = starAgent.navigation, r = n.vehicle.physics.state;
        const d = n.fromShipLocal(n.position.clone().fromArray(target)).sub(r.position).applyQuaternion(r.quaternion.clone().invert());
        return {x: d.x, z: d.z, distance: Math.hypot(d.x, d.z), speed: r.speed, blocked: r.blocked, reason: r.reason};
      }, path[look]);
      // Steering has the same sign for a target's local X in forward and reverse;
      // the real signed velocity reverses the bicycle model's yaw response.
      const steer = Math.atan(2 * R.wheelbase * c.x / Math.max(1, c.distance * c.distance)) / R.driving.wheelSteerLimit;
      const desiredSpeed = Math.min(maxSpeed, Math.max(.28, remaining * .7));
      await driveInput(steer, (reverse ? -1 : 1) * desiredSpeed);
      blockedSince = c.blocked ? blockedSince ?? Date.now() : null;
      if (blockedSince && Date.now() - blockedSince > 1600) throw Error(`Drive blocked (${reverse ? 'reverse' : 'forward'}): ${JSON.stringify({index, local, target: path[look], ...c})}`);
      if (Date.now() - progressAt > 9000) throw Error('Drive stopped making route progress: ' + JSON.stringify({index, local, remaining, ...c}));
      await page.waitForTimeout(65);
    }
    throw Error('Driving deadline exhausted: ' + JSON.stringify({reverse, index, end: path.at(-1), rover: (await state()).rover}));
  }
  async function lineTo(target) {
    const local = (await state()).rover.local, length = distanceXZ(local, target), n = Math.ceil(length / .35), path = [];
    for (let i = 0; i <= n; i++) path.push([local[0] + (target[0] - local[0]) * i / n, target[1], local[2] + (target[2] - local[2]) * i / n]);
    await followPath(path);
  }
  async function aim(target) {
    for (let i = 0; i < 160; i++) {
      const c = await page.evaluate(target => {
        const n = starAgent.navigation, d = n.position.clone().fromArray(target).sub(n.position).applyQuaternion(n.orientation.clone().invert());
        return {x: Math.atan2(d.x, -d.z), y: Math.atan2(d.y, Math.hypot(d.x, d.z))};
      }, target);
      if (Math.hypot(c.x, c.y) < .022) { await axes([0, 0, 0, 0]); return; }
      const axis = x => Math.sign(x) * Math.min(.72, Math.max(.20, Math.abs(x) * 2));
      await axes([0, 0, Math.abs(c.x) > .013 ? axis(c.x) : 0, Math.abs(c.y) > .013 ? -axis(c.y) : 0]);
      await page.waitForTimeout(60);
    }
    throw Error('Actual outcrop is outside the reached cutter aim arc; target=' + JSON.stringify(target) + '; rover=' + JSON.stringify((await state()).rover));
  }
  async function choose(key) {
    for (let i = 0; i < 90; i++) {
      const focused = await page.evaluate(key => document.activeElement?.dataset.controllerKey === key, key);
      if (focused) { await tap(0); return; }
      await tap(13);
    }
    const visible = await page.locator('dialog[open] [data-controller-key]').evaluateAll(nodes => nodes.filter(n => n.getClientRects().length && !n.disabled).map(n => ({key: n.dataset.controllerKey, label: n.textContent})));
    throw Error('Controller cannot focus ' + key + '; visible=' + JSON.stringify(visible));
  }
  async function access(inward) {
    await page.evaluate(() => {
      __gannetReview.access = {active: true, points: []};
      function record(t) {
        const a = __gannetReview.access; if (!a.active) return;
        const s = starAgent.state; a.points.push({t, position: s.position, phase: s.rover.phase, door: s.rover.door}); requestAnimationFrame(record);
      }
      requestAnimationFrame(record);
    });
    await readyInput(); await tap(2);
    await wait(inward => starAgent.state.rover.occupied === inward && !starAgent.state.rover.busy, inward, 30000);
    const points = await page.evaluate(() => { __gannetReview.access.active = false; return __gannetReview.access.points; });
    const maxStep = Math.max(0, ...points.slice(1).map((point, i) => Math.hypot(...point.position.map((n, j) => n - points[i].position[j]))));
    expect(points.some(p => p.phase !== 'idle'), 'Actual pressure-door/step access must run').toBe(true);
    expect(points.some(p => p.door > .99), 'Visible door must fully open during physical access').toBe(true);
    expect(maxStep, 'Physical boarding must not jump between endpoints').toBeLessThan(.30);
    expect((await state()).rover.door).toBe(0);
    await writeFile(output + `/access-${inward ? 'in' : 'out'}.json`, JSON.stringify({maxStep, points}, null, 2));
  }

  async function nativeFocusGate() {
    const report = gates.focus = {}, blank = await page.context().newPage();
    const gameSession = await page.context().newCDPSession(page), blankSession = await page.context().newCDPSession(blank);
    const snapshot = () => page.evaluate(() => ({focused: document.hasFocus(), navFocused: starAgent.navigation.focused,
      active: starAgent.navigation.vehicle.power.state.active, events: [...__gannetReview.focus], trigger: gannetPad.buttons[7].value}));
    try {
      await blank.goto('about:blank');
      await gameSession.send('Emulation.setFocusEmulationEnabled', {enabled: false});
      await blankSession.send('Emulation.setFocusEmulationEnabled', {enabled: false});
      await page.bringToFront(); await wait(() => document.hasFocus() && starAgent.navigation.focused, null, 6000);
      await readyInput(); await button(7, true); await wait(() => starAgent.state.rover.beaming === 2);
      report.before = await snapshot(); await blank.bringToFront();
      await wait(() => !document.hasFocus() && !starAgent.navigation.focused && !starAgent.navigation.vehicle.power.state.active, null, 6000);
      report.background = await snapshot();
      expect(report.background.events.slice(report.before.events.length).some(e => e.type === 'blur' && e.trusted)).toBe(true);
      await page.bringToFront(); await wait(() => document.hasFocus() && starAgent.navigation.focused, null, 6000);
      report.returned = await snapshot();
      expect(report.returned.events.slice(report.background.events.length).some(e => e.type === 'focus' && e.trusted)).toBe(true);
      expect(report.returned.trigger).toBe(1); await page.waitForTimeout(350); expect((await state()).rover.beaming).toBe(0);
      await button(7, false); await wait(() => starAgent.state.controller.armed);
      await button(7, true); await wait(() => starAgent.state.rover.beaming === 2); await button(7, false);
      report.result = 'PASS';
    } catch (error) { report.result = 'FAIL'; report.error = error.message; throw error; }
    finally {
      report.last = await snapshot().catch(() => null);
      await gameSession.send('Emulation.setFocusEmulationEnabled', {enabled: true}).catch(() => {});
      await blankSession.send('Emulation.setFocusEmulationEnabled', {enabled: true}).catch(() => {});
      await page.bringToFront().catch(() => {}); await blank.close().catch(() => {});
      await gameSession.detach().catch(() => {}); await blankSession.detach().catch(() => {});
    }
  }

  try {
    await page.goto('/?dev=1&intro=0&ship=gannet&start=moon&debug=1&seed=7291');
    await wait(() => window.starAgent?.state.ready && starAgent.state.rover?.spawned && !starAgent.state.transiting, null, 90000);
    await readyInput(); let s = await state();
    expect(s.dev, 'The preview requires VITE_DEV_TOOLS=1').not.toBeNull(); expect(s.shipId).toBe('gannet'); expect(s.mode).toBe('landed');
    expect(s.shipAsset).toBe('ready'); expect(s.rover.error).toBeNull(); expect(s.rover.fitsLift).toBe(true); expect(s.lifts.id).toBe('gannet'); expect(s.lifts.secured).toBe(true);
    for (const file of ['public/models/gannet.glb', 'public/models/mining-rover.glb']) {
      const response = await page.request.get('/' + file.slice('public/'.length)); expect(response.ok()).toBe(true);
      expect(hash(await response.body()), 'Served geometry must match the recorded source: ' + file).toBe(beforeHashes[file]);
    }
    expect(s.mining.activePosition, 'The real mining field must expose its existing outcrop').toHaveLength(3);
    const mineral = [...s.mining.activePosition];
    await note('Powered Gannet starts on Selene with Burrow secured');
    await pilotShot('00-settled-gannet-forward-cockpit');
    phase = 'pilot-to-rover-door'; await tap(2); await wait(() => starAgent.state.mode === 'walk');
    for (const point of G.rover.approach) await walk(point);
    expect((await state()).rover.near).toBe(true); await shot('01-physical-port-door');
    phase = 'physical-rover-boarding'; await access(true); await readyInput(); await note('Actual pressure door and steps boarded'); await shot('02-enclosed-cockpit');
    phase = 'elevator-lower'; await tap(3);
    await wait(() => starAgent.state.lifts.lift.y < .001 && starAgent.state.lifts.hatch.progress > .999 && !starAgent.state.lifts.queued, null, 16000);
    s = await state(); expect(s.rover.local[1]).toBeCloseTo(G.lift.low, 3); expect(s.rover.wheels.every(w => w.source === 'gannet-lift:vehicle')).toBe(true);
    await readyInput(); recordOutbound = true; appendPath(s.rover.local);
    phase = 'all-wheels-to-terrain'; await lineTo([G.rover.park[0], G.lift.low, 16]);
    s = await state(); expect(s.rover.aboard).toBe(false); expect(s.rover.wheels).toHaveLength(4); expect(s.rover.wheels.every(w => w.source === 'terrain')).toBe(true);
    await chord(15); await wait(() => starAgent.state.camera.mode === 'third-person'); await note('All four wheels on canonical terrain'); await shot('03-unloaded-external');
    phase = 'physical-turn-to-outcrop'; await lineTo([G.rover.park[0], 0, 26.5]);
    const arc = Array.from({length: 65}, (_, i) => { const angle = Math.PI * i / 64; return [G.rover.park[0] - 5 + 5 * Math.cos(angle), 0, 26.5 + 5 * Math.sin(angle)]; });
    await followPath(arc, {maxSpeed: 1.4}); appendPath((await state()).rover.local); recordOutbound = false;
    await aim(mineral); await note('Existing Crescent outcrop reached through controller steering');
    phase = 'real-twin-mining'; const before = await state(); await button(7, true);
    await wait(mass => starAgent.state.rover.beaming === 2 && starAgent.state.rover.mass > mass + .02, before.rover.mass, 25000);
    await shot('04-real-twin-mining'); await page.waitForTimeout(3500); await button(7, false);
    s = await state(); expect(s.rover.mass).toBeGreaterThan(before.rover.mass + .02); expect(s.rover.beamPoses).toHaveLength(2); expect(s.rover.charge).toBeGreaterThan(.7);
    expect(s.containers.saved).toBe(true); expect(s.containers.containers.find(c => c.id === 'pack').items).toEqual(before.containers.containers.find(c => c.id === 'pack').items);
    await note('Real ore committed into Burrow bin, backpack unchanged');

    phase = 'shared-ore-dialog'; await button(7, true); await wait(() => starAgent.state.rover.beaming === 2); await tap(8);
    await expect(page.locator('#cargo-dialog')).toBeVisible(); await expect(page.locator('#cargo-dialog')).toContainText('Rover mineral bin');
    await expect(page.getByRole('button', {name: 'Gannet cargo', exact: true})).toBeVisible();
    await wait(() => starAgent.state.rover.beaming === 0); await neutral();
    await wait(() => starAgent.navigation.gamepad.uiArmed);
    // The shared inventory pages, not hidden DOM slots, own controller focus.
    let slot = page.locator(`[data-from="${R.cargo.id}"][data-item]:visible`).first();
    for (let i = 0; i < 6 && !await slot.count(); i++) { await choose('page-containers-next'); await frames(); }
    await expect(slot).toBeVisible(); const oreKey = await slot.getAttribute('data-controller-key');
    const packBefore = (await state()).mining.pack.reduce((a, b) => a + b, 0);
    await choose(oreKey); await choose('transfer-one');
    expect((await state()).mining.pack.reduce((a, b) => a + b, 0)).toBeGreaterThan(packBefore);
    await shot('05-controller-ore-transfer');
    // Menu has already received neutral. Keep a new RT hold through B closure.
    await button(7, true); await tap(1); await expect(page.locator('#cargo-dialog')).not.toBeVisible();
    await page.waitForTimeout(350); expect((await state()).rover.beaming).toBe(0); gates.dialog = {result: 'PASS', triggerHeldAcrossClose: true};
    await readyInput();
    phase = 'native-focus-neutral'; await nativeFocusGate();
    phase = 'controller-device-neutral';
    for (const kind of ['disconnect', 'replacement', 'unsupported']) {
      await readyInput(); await button(7, true); await wait(() => starAgent.state.rover.beaming === 2);
      await page.evaluate(kind => {
        if (kind === 'disconnect') gannetPad.connected = false;
        if (kind === 'replacement') gannetPad.id += ' replacement';
        if (kind === 'unsupported') gannetPad.mapping = '';
        __gannetReview.inputs.push({t: performance.now(), device: kind});
      }, kind);
      await wait(() => starAgent.state.rover.beaming === 0); const suppressed = (await state()).controller;
      await page.evaluate(() => { gannetPad.connected = true; gannetPad.mapping = 'standard'; });
      await frames(); expect((await state()).rover.beaming).toBe(0);
      await button(7, false); await wait(() => starAgent.state.controller.armed);
      await button(7, true); await wait(() => starAgent.state.rover.beaming === 2); await button(7, false);
      gates[kind] = {result: 'PASS', suppressed};
    }
    await note('Native focus, dialog and controller changes require release');

    phase = 'reverse-actual-outbound-path'; await stop();
    const actualEnd = (await state()).rover.local;
    if (distanceXZ(actualEnd, trajectory.at(-1)) > .02) trajectory.push([...actualEnd]);
    expect(trajectory.length).toBeGreaterThan(30);
    await followPath([...trajectory].reverse(), {reverse: true, maxSpeed: 1.05, reach: .13, seconds: 95});
    s = await state(); expect(s.rover.fitsLift).toBe(true); expect(s.rover.aboard).toBe(true);
    expect(s.rover.wheels.every(w => w.source === 'gannet-lift:vehicle')).toBe(true);
    expect(distanceXZ(s.rover.local, G.rover.park)).toBeLessThan(.3); await shot('06-reverse-loaded-same-bay');
    phase = 'raise-and-secure'; await readyInput(); await tap(3);
    await wait(() => starAgent.state.lifts.secured && !starAgent.state.lifts.queued, null, 16000);
    s = await state(); expect(s.rover.local[1]).toBeCloseTo(G.lift.high, 3); expect(s.rover.fitsLift).toBe(true);
    await note('Original rover returned, elevator raised and hatch secured');
    phase = 'physical-rover-exit'; await access(false); await readyInput();
    phase = 'return-to-gannet-chair';
    for (const point of [...G.rover.approach].reverse().slice(1)) await walk(point);
    await walk(G.stand); await tap(2); await wait(() => starAgent.state.mode === 'landed');
    expect((await state()).rover.occupied).toBe(false); await pilotShot('07-settled-gannet-pilot-return');
    phase = 'launch-carry'; await readyInput(); s = await state(); const parked = [...s.rover.local];
    await tap(3); await wait(() => starAgent.state.mode === 'flight');
    const ascentStart = (await state()).position;
    await button(0, true); await page.waitForTimeout(1600); await button(0, false);
    s = await state(); expect(Math.hypot(...s.position.map((n, i) => n - ascentStart[i]))).toBeGreaterThan(1);
    await button(6, true); await wait(() => starAgent.state.speed < .5, null, 12000); await button(6, false);
    s = await state(); expect(s.mode).toBe('flight'); expect(s.rover.aboard).toBe(true);
    expect(Math.hypot(...s.rover.local.map((n, i) => n - parked[i]))).toBeLessThan(.035); expect(s.lifts.secured).toBe(true);
    if (s.camera.mode !== 'external') await chord(15);
    await note('Controller launch carries the same loaded rover'); await shot('08-carried-in-flight');
    expect(errors).toEqual([]); expect(warnings).toEqual([]); expect(requests).toEqual([]); complete = true;
  } catch (error) {
    failed = {phase, message: error.message};
    await shot('failure-' + phase).catch(() => {}); throw error;
  } finally {
    await neutral().catch(() => {}); await shot('last-frame').catch(() => {});
    const final = await state().catch(() => null), afterHashes = await sourceHashes();
    const sourcesStable = JSON.stringify(beforeHashes) === JSON.stringify(afterHashes);
    if (!sourcesStable) { complete = false; failed ??= {phase: 'source-identity', message: 'Source/asset files changed during the browser run'}; }
    const diagnostics = await page.evaluate(() => ({input: window.__gannetReview,
      visibleDialog: [...document.querySelectorAll('dialog[open]')].map(d => ({id: d.id, text: d.innerText})),
      focusedControl: document.activeElement?.dataset?.controllerKey ?? null,
      gpu: (() => { const g = document.querySelector('#viewport')?.getContext('webgl2'), e = g?.getExtension('WEBGL_debug_renderer_info');
        return g ? {renderer: g.getParameter(e ? e.UNMASKED_RENDERER_WEBGL : g.RENDERER), buffer: [g.drawingBufferWidth, g.drawingBufferHeight]} : null; })(),
    })).catch(() => null);
    await writeFile(output + '/journey.json', JSON.stringify({result: complete ? 'PASS' : 'FAIL', phase, failed,
      input: 'Injected W3C standard Gamepad only; real native focus interruption; no physical controller claim',
      browser: browser.version(), viewport: page.viewportSize(), beforeHashes, afterHashes,
      sourcesStable, errors, warnings, requests,
      milestones, gates, trajectory, final, diagnostics, performanceClaim: false}, null, 2));
    expect(afterHashes, 'Source/asset identity must stay frozen during gameplay acceptance').toEqual(beforeHashes);
  }
});
