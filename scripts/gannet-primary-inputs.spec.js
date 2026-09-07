import {test, expect} from '@playwright/test';
import {mkdir, readFile, writeFile, access as fileAccess} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {GANNET_LAYOUT as G} from '../src/gannet-layout.js';
import {ROVER_LAYOUT as R} from '../src/rover-layout.js';
import {state, wait, frames, distanceXZ, linePath, turnPath, pathTarget, drivingControls,
  KeyboardInput, TouchInput, installNativeReceipts, nativeFocusNeutral} from './gannet-primary-inputs.js';

const output = process.env.GANNET_PRIMARY_OUTPUT ?? '/tmp/star-agent-gannet-primary-results/unconfigured';
const sourceRoot = process.env.GANNET_SOURCE ?? fileURLToPath(new URL('..', import.meta.url));
const sourceFiles = ['src/main.js', 'src/navigation.js', 'src/medium-ship-gameplay.js', 'src/medium-ships.js', 'src/medium-ship-lights.js',
  'src/gannet.js', 'src/gannet-systems.js', 'src/gannet-layout.js', 'src/mining-rover.js', 'src/rover-carrier.js',
  'src/rover-support.js', 'src/rover-physics.js', 'src/nomad-cabin-controls.js', 'src/nomad-cabin-controls.css',
  'src/rover-ui.js', 'src/secondary-touch-buttons.js', 'src/gameplay-menu.js', 'src/controller-ui.js',
  'src/ship-inventory-ui.js', 'src/mining/rock.js', 'src/mining/store.js', 'assets/gannet/layout.json',
  'assets/gannet/collision.json', 'assets/mining-rover/layout.json', 'public/models/gannet.glb', 'public/models/mining-rover.glb'];
const fixtureFiles = ['gannet-primary-inputs.spec.js', 'gannet-primary-inputs.config.js', 'gannet-primary-inputs.js'];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function identity() {
  const sources = Object.fromEntries(await Promise.all(sourceFiles.map(async file => [file, hash(await readFile(sourceRoot + '/' + file))])));
  const fixtures = Object.fromEntries(await Promise.all(fixtureFiles.map(async file => [file, hash(await readFile(new URL(file, import.meta.url)))])));
  let commit = null, dirty = null;
  try {
    commit = execFileSync('git', ['rev-parse', 'HEAD'], {cwd: sourceRoot, encoding: 'utf8'}).trim();
    dirty = execFileSync('git', ['status', '--short', '--', ...sourceFiles], {cwd: sourceRoot, encoding: 'utf8'}).trim();
  } catch { /* Hashes still identify non-git copied builds. */ }
  return {commit, dirty, sources, fixtures};
}

// The dev URL selects the real Gannet/moon start once. Every subsequent move,
// look, door/lift action, extraction and transfer uses native input. Debug state
// is read for assertions, cloned coordinate math and feedback steering only.
test('Gannet chair → physical Burrow → real ore → reverse reload → carried flight → loaded landing', async ({page, browser}, testInfo) => {
  const phone = testInfo.project.name === 'touch', dir = output + '/' + testInfo.project.name;
  if (await fileAccess(dir + '/journey.json').then(() => true, () => false)) throw Error('Preserve the previous result: choose a fresh GANNET_PRIMARY_OUTPUT directory.');
  await mkdir(dir, {recursive: true});
  const errors = [], warnings = [], requests = [], milestones = [], trajectory = [], gates = {}, controls = {timings: []};
  const beforeIdentity = await identity();
  let phase = 'startup', failed = null, complete = false, recordOutbound = false;
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); if (message.type() === 'warning') warnings.push(message.text()); });
  page.on('response', response => { if (response.status() >= 400) requests.push({status: response.status(), url: response.url()}); });
  await installNativeReceipts(page);
  const input = phone ? new TouchInput(page, await page.context().newCDPSession(page)) : new KeyboardInput(page);
  function appendPath(local) {
    if (recordOutbound && (!trajectory.length || distanceXZ(local, trajectory.at(-1)) >= .22)) trajectory.push([...local]);
  }
  async function note(name) {
    const s = await state(page);
    milestones.push({name, phase, time: new Date().toISOString(), pageTime: await page.evaluate(() => performance.now()),
      mode: s.mode, position: s.position, shipLocal: s.shipLocal, shipPosition: s.shipPosition, shipOrientation: s.shipOrientation,
      rover: s.rover, lifts: s.lifts, camera: s.camera, containers: s.containers, mining: s.mining});
    console.log(`Gannet ${testInfo.project.name}: ${name}`);
  }
  async function shot(name) { await frames(page); await page.screenshot({path: dir + '/' + name + '.png'}); }
  async function pilotShot(name) {
    if ((await state(page)).camera.mode !== 'cockpit') await input.tap('camera');
    await wait(page, () => starAgent.state.camera.mode === 'cockpit');
    await page.waitForTimeout(750); await shot(name);
    milestones.push({name: 'Settled actual Gannet pilot view', phase, image: name + '.png',
      sightline: await page.evaluate(() => ({orientation: starAgent.navigation.orientation.toArray(), shipOrientation: starAgent.state.shipOrientation, camera: starAgent.state.camera})),
      visualRequirement: 'Unobstructed main forward sightline needs image inspection; this assertion does not award an art score.'});
  }
  async function stop() {
    await input.hold(['brake']); await wait(page, () => Math.abs(starAgent.state.rover.speed) < .025, null, 6000);
    await input.hold([]); await frames(page);
  }
  async function walk(target) {
    if (phone) await input.warm(['walkForward', 'walkBackward', 'walkLeft', 'walkRight']);
    const deadline = Date.now() + 35000;
    while (Date.now() < deadline) {
      const c = await page.evaluate(target => {
        const n = starAgent.navigation, d = n.fromShipLocal(n.position.clone().fromArray(target)).sub(n.position).applyQuaternion(n.orientation.clone().invert());
        return {distance: Math.hypot(d.x, d.z), x: d.x, z: d.z};
      }, target);
      if (c.distance < .18) { await input.hold([]); await frames(page); return; }
      await input.hold(Math.abs(c.x) > Math.abs(c.z) ? [c.x > 0 ? 'walkRight' : 'walkLeft'] : [c.z > 0 ? 'walkBackward' : 'walkForward']);
      await page.waitForTimeout(50);
    }
    throw Error('Physical walking failed to reach ' + JSON.stringify(target) + '; actual=' + JSON.stringify((await state(page)).shipLocal));
  }
  async function access(inward) {
    await page.evaluate(() => {
      const a = __gannetNativeInput.access = {active: true, points: []};
      function record(t) {
        if (!a.active) return;
        const s = starAgent.state; a.points.push({t, position: s.position, phase: s.rover.phase, door: s.rover.door}); requestAnimationFrame(record);
      }
      requestAnimationFrame(record);
    });
    await input.reset(); await input.tap('entry');
    await wait(page, inward => starAgent.state.rover.occupied === inward && !starAgent.state.rover.busy, inward, 30000);
    const points = await page.evaluate(() => { __gannetNativeInput.access.active = false; return __gannetNativeInput.access.points; });
    const maxStep = Math.max(0, ...points.slice(1).map((point, i) => Math.hypot(...point.position.map((n, j) => n - points[i].position[j]))));
    expect(points.some(p => p.phase !== 'idle'), 'Actual pressure-door/step traversal runs').toBe(true);
    expect(points.some(p => p.door > .99), 'Actual door fully opens during access').toBe(true);
    expect(maxStep, 'Physical access cannot jump between endpoints').toBeLessThan(.30);
    expect((await state(page)).rover.door).toBe(0);
    await writeFile(dir + `/access-${inward ? 'in' : 'out'}.json`, JSON.stringify({maxStep, points}, null, 2));
  }
  async function followPath(path, {reverse = false, reach = .16, maxSpeed = 1.45, seconds = 85} = {}) {
    let index = 0, blockedSince = null, progressAt = Date.now(), bestRemaining = Infinity;
    const deadline = Date.now() + seconds * 1000;
    if (phone) await input.warm(['forward', 'reverse', 'left', 'right', 'brake']);
    while (Date.now() < deadline) {
      const tick = Date.now(), s = await state(page), local = s.rover.local; appendPath(local);
      const target = pathTarget(local, path, index);
      if (target.remaining < reach && target.index >= path.length - 12) { await stop(); appendPath((await state(page)).rover.local); return; }
      if (target.index > index || target.remaining < bestRemaining - .15) { progressAt = Date.now(); bestRemaining = target.remaining; }
      index = target.index;
      const c = await page.evaluate(target => {
        const n = starAgent.navigation, r = n.vehicle.physics.state;
        const d = n.fromShipLocal(n.position.clone().fromArray(target)).sub(r.position).applyQuaternion(r.quaternion.clone().invert());
        return {x: d.x, z: d.z, distance: Math.hypot(d.x, d.z), speed: r.speed, wheelSteer: r.wheels[0].steer, blocked: r.blocked, reason: r.reason};
      }, path[target.look]);
      const steer = Math.atan(2 * R.wheelbase * c.x / Math.max(1, c.distance * c.distance)) / R.driving.wheelSteerLimit;
      const speed = Math.min(maxSpeed, Math.max(.28, target.remaining * .7));
      await input.hold(drivingControls(c, steer, (reverse ? -1 : 1) * speed, R.driving.wheelSteerLimit));
      blockedSince = c.blocked ? blockedSince ?? Date.now() : null;
      if (blockedSince && Date.now() - blockedSince > 1600) throw Error('Drive blocked: ' + JSON.stringify({reverse, index, local, target: path[target.look], ...c}));
      if (Date.now() - progressAt > 10000) throw Error('Drive stopped making progress: ' + JSON.stringify({reverse, index, local, remaining: target.remaining, ...c}));
      await page.waitForTimeout(50);
      controls.timings.push({phase, ms: Date.now() - tick, index, local, speed: c.speed, steer});
    }
    throw Error('Driving deadline exhausted: ' + JSON.stringify({reverse, index, end: path.at(-1), rover: (await state(page)).rover}));
  }
  async function lineTo(target) { await followPath(linePath((await state(page)).rover.local, target)); }
  async function aim(target) {
    if (phone) await input.warm(['aimLeft', 'aimRight', 'up', 'down']);
    const deadline = Date.now() + 14000;
    while (Date.now() < deadline) {
      const c = await page.evaluate(target => {
        const n = starAgent.navigation, d = n.position.clone().fromArray(target).sub(n.position).applyQuaternion(n.orientation.clone().invert());
        return {x: Math.atan2(d.x, -d.z), y: Math.atan2(d.y, Math.hypot(d.x, d.z))};
      }, target);
      if (Math.hypot(c.x, c.y) < .026) { await input.hold([]); await frames(page); return; }
      await input.hold([...(Math.abs(c.x) > .015 ? [c.x > 0 ? 'aimRight' : 'aimLeft'] : []), ...(Math.abs(c.y) > .015 ? [c.y > 0 ? 'up' : 'down'] : [])]);
      await page.waitForTimeout(35);
    }
    throw Error('Existing mineral remains outside the reached cutter arc: ' + JSON.stringify({target, rover: (await state(page)).rover}));
  }
  async function choosePaged(key, nextKey) {
    const locator = page.locator(`dialog[open] [data-controller-key=${JSON.stringify(key)}]`);
    for (let i = 0; i < 8; i++) {
      if (await locator.isVisible()) { await input.choose(key); return; }
      await input.choose(nextKey); await frames(page);
    }
    throw Error('Native UI pagination cannot reach ' + key);
  }
  async function cargoGate() {
    const report = gates.dialog = {};
    await input.hold(['mine']); await wait(page, () => starAgent.state.rover.beaming === 2);
    if (phone) report.before = await input.mineReceipt();
    await input.tap('cargo'); await expect(page.locator('#cargo-dialog')).toBeVisible();
    await expect(page.locator('#cargo-dialog')).toContainText('Rover mineral bin');
    await expect(page.getByRole('button', {name: 'Gannet cargo', exact: true})).toBeVisible();
    expect((await state(page)).containers.target).toBe(R.cargo.id);
    await wait(page, () => starAgent.state.rover.beaming === 0 && !starAgent.state.mining.pending);
    const slot = page.locator(`[data-from="${R.cargo.id}"][data-item]:visible`).first();
    for (let i = 0; i < 6 && !await slot.count(); i++) { await input.choose('page-containers-next'); await frames(page); }
    await expect(slot).toBeVisible();
    const oreKey = await slot.getAttribute('data-controller-key'), item = await slot.getAttribute('data-item');
    await input.choose(oreKey);
    const before = await state(page), source = before.containers.containers.find(c => c.id === R.cargo.id), pack = before.containers.containers.find(c => c.id === 'pack');
    const amount = Math.min(1, source.items[item]); expect(amount).toBeGreaterThan(0);
    await input.choose('transfer-one');
    await wait(page, ({item, quantity}) => starAgent.state.containers.containers.find(c => c.id === 'pack').items[item] >= quantity - 1e-7,
      {item, quantity: pack.items[item] + amount});
    const after = await state(page);
    expect(after.containers.containers.find(c => c.id === R.cargo.id).items[item]).toBeCloseTo(source.items[item] - amount, 6);
    expect(after.containers.containers.find(c => c.id === 'pack').items[item]).toBeCloseTo(pack.items[item] + amount, 6);
    expect(after.containers.saved).toBe(true);
    report.transfer = {item, amount, before: {pack: pack.items[item], bin: source.items[item]}, after: {pack: pack.items[item] + amount, bin: source.items[item] - amount}};
    await shot('05-native-ore-transfer');
    if (phone) {
      report.opened = await input.mineReceipt();
      expect(report.opened.pointer).toBe(report.before.pointer); expect(report.opened.cdpId).toBe(report.before.cdpId);
    }
    await input.tap('close'); await expect(page.locator('dialog[open]')).toHaveCount(0);
    await wait(page, () => starAgent.state.enabled); await input.repeatMine(); await page.waitForTimeout(400);
    expect((await state(page)).rover.beaming).toBe(0);
    if (phone) {
      report.closed = await input.mineReceipt();
      expect(report.closed.pointer).toBe(report.before.pointer); expect(report.closed.cdpId).toBe(report.before.cdpId);
    }
    await input.reset(); await input.hold(['mine']); await wait(page, () => starAgent.state.rover.beaming === 2);
    await input.hold([]); await wait(page, () => starAgent.state.rover.beaming === 0);
    report.result = 'PASS'; report.heldAcrossTransferAndClose = true;
  }

  try {
    await page.goto('/?dev=1&intro=0&ship=gannet&start=moon&debug=1&seed=7291');
    await wait(page, () => window.starAgent?.state.ready && starAgent.state.rover?.spawned && !starAgent.state.transiting, null, 90000);
    let s = await state(page); expect(s.dev, 'Build requires VITE_DEV_TOOLS=1').not.toBeNull();
    expect(s.shipId).toBe('gannet'); expect(s.mode).toBe('landed'); expect(s.shipAsset).toBe('ready');
    expect(s.rover.error).toBeNull(); expect(s.rover.fitsLift).toBe(true); expect(s.lifts.id).toBe('gannet'); expect(s.lifts.secured).toBe(true);
    for (const file of ['public/models/gannet.glb', 'public/models/mining-rover.glb']) {
      const response = await page.request.get('/' + file.slice('public/'.length)); expect(response.ok()).toBe(true);
      expect(hash(await response.body()), 'Served asset matches source: ' + file).toBe(beforeIdentity.sources[file]);
    }
    expect(s.mining.activePosition, 'Existing field must expose its actual outcrop').toHaveLength(3);
    const mineral = [...s.mining.activePosition];
    await note('Powered Gannet on Selene with Burrow secured'); await pilotShot('00-settled-gannet-forward-cockpit');
    phase = 'pilot-to-rover-door'; await input.tap('seat'); await wait(page, () => starAgent.state.mode === 'walk');
    if (phone) {
      const before = await page.evaluate(() => starAgent.navigation.orientation.toArray());
      await input.dragView(40, 0);
      const rotated = await page.evaluate(() => starAgent.navigation.orientation.toArray());
      expect(Math.hypot(...before.map((n, i) => n - rotated[i])), 'Native canvas drag changes the actual walking view').toBeGreaterThan(.02);
      await input.dragView(-40, 0); gates.view = {result: 'PASS', before, rotated};
    }
    for (const point of G.rover.approach) await walk(point);
    expect((await state(page)).rover.near).toBe(true); await shot('01-physical-port-door');
    phase = 'physical-rover-boarding'; await access(true); await note('Physical pressure door and steps boarded'); await shot('02-enclosed-cockpit');
    phase = 'elevator-lower'; await input.tap('lift');
    await wait(page, () => starAgent.state.lifts.lift.y < .001 && starAgent.state.lifts.hatch.progress > .999 && !starAgent.state.lifts.queued, null, 16000);
    s = await state(page); expect(s.rover.local[1]).toBeCloseTo(G.lift.low, 3); expect(s.rover.wheels.every(w => w.source === 'gannet-lift:vehicle')).toBe(true);
    recordOutbound = true; appendPath(s.rover.local);
    phase = 'all-wheels-to-terrain'; await lineTo([G.rover.park[0], G.lift.low, 16]);
    s = await state(page); expect(s.rover.aboard).toBe(false); expect(s.rover.wheels).toHaveLength(4); expect(s.rover.wheels.every(w => w.source === 'terrain')).toBe(true);
    if (!phone) { await input.tap('camera'); await wait(page, () => starAgent.state.camera.mode === 'third-person'); }
    await note('All four wheels on canonical terrain'); await shot('03-unloaded');
    phase = 'physical-turn-to-outcrop'; await lineTo([G.rover.park[0], 0, 26.5]);
    const mineralLocal = await page.evaluate(p => starAgent.navigation.toShipLocal(starAgent.navigation.position.clone().fromArray(p)).toArray(), mineral);
    await followPath(turnPath(G.rover.park[0], mineralLocal), {maxSpeed: 1.3}); appendPath((await state(page)).rover.local); recordOutbound = false;
    await aim(mineral); await note('Existing outcrop reached through digital steering');
    phase = 'real-twin-mining'; const before = await state(page); await input.hold(['mine']);
    await wait(page, mass => starAgent.state.rover.beaming === 2 && starAgent.state.rover.mass > mass + .02, before.rover.mass, 25000);
    await shot('04-real-twin-mining'); await page.waitForTimeout(3500); await input.hold([]);
    await wait(page, () => starAgent.state.rover.beaming === 0 && !starAgent.state.mining.pending);
    s = await state(page); expect(s.rover.mass).toBeGreaterThan(before.rover.mass + .02); expect(s.rover.beamPoses).toHaveLength(2); expect(s.rover.charge).toBeGreaterThan(.7);
    expect(s.containers.saved).toBe(true); expect(s.containers.containers.find(c => c.id === 'pack').items).toEqual(before.containers.containers.find(c => c.id === 'pack').items);
    await note('Real ore saved into Burrow bins, backpack unchanged');
    phase = 'native-ore-transfer-and-neutral'; await cargoGate(); await note('Native ore transfer and held-input closure passed');
    phase = 'native-tab-focus-neutral'; await nativeFocusNeutral(page, input, gates.focus = {}); await note('Trusted tab blur/focus requires fresh mining input');
    phase = 'reverse-actual-outbound-path'; await stop();
    const actualEnd = (await state(page)).rover.local;
    if (distanceXZ(actualEnd, trajectory.at(-1)) > .02) trajectory.push([...actualEnd]);
    expect(trajectory.length).toBeGreaterThan(30);
    await followPath([...trajectory].reverse(), {reverse: true, maxSpeed: .95, reach: .13, seconds: 125});
    s = await state(page); expect(s.rover.fitsLift).toBe(true); expect(s.rover.aboard).toBe(true);
    expect(s.rover.wheels.every(w => w.source === 'gannet-lift:vehicle')).toBe(true); expect(distanceXZ(s.rover.local, G.rover.park)).toBeLessThan(.3);
    await shot('06-reverse-loaded-same-bay');
    phase = 'raise-and-secure'; await input.reset(); await input.tap('lift');
    await wait(page, () => starAgent.state.lifts.secured && !starAgent.state.lifts.queued, null, 16000);
    s = await state(page); expect(s.rover.local[1]).toBeCloseTo(G.lift.high, 3); expect(s.rover.fitsLift).toBe(true);
    await note('Original loaded rover returned, elevator raised and hatch secured');
    phase = 'physical-rover-exit'; await access(false);
    phase = 'return-to-gannet-chair';
    for (const point of [...G.rover.approach].reverse().slice(1)) await walk(point);
    await walk(G.stand); await input.tap('seat'); await wait(page, () => starAgent.state.mode === 'landed');
    expect((await state(page)).rover.occupied).toBe(false); await pilotShot('07-settled-gannet-pilot-return');
    phase = 'launch-carry'; await input.reset(); s = await state(page); const parked = [...s.rover.local], carriedOre = s.rover.mass;
    await input.tap('land'); await wait(page, () => starAgent.state.mode === 'flight');
    const ascentStart = (await state(page)).position;
    await input.hold(['flightUp']); await page.waitForTimeout(1600); await input.hold([]);
    s = await state(page); expect(Math.hypot(...s.position.map((n, i) => n - ascentStart[i]))).toBeGreaterThan(1);
    await input.hold(['flightBrake']); await wait(page, () => starAgent.state.speed < .5, null, 12000); await input.hold([]);
    s = await state(page); expect(s.mode).toBe('flight'); expect(s.rover.aboard).toBe(true); expect(s.lifts.secured).toBe(true);
    expect(Math.hypot(...s.rover.local.map((n, i) => n - parked[i]))).toBeLessThan(.035); expect(s.rover.mass).toBeCloseTo(carriedOre, 6);
    if (!phone && s.camera.mode !== 'external') await input.tap('camera');
    await note('Native launch carries the same loaded rover'); await shot('08-carried-in-flight');
    phase = 'loaded-gear-and-landing';
    if (phone) {
      await input.tap('commands'); await expect(page.locator('dialog[open]')).toHaveCount(1);
      await input.choose('tab-ship'); await expect(page.locator('#controller-menu')).toBeVisible();
      await choosePaged('gear', 'page-ship systems-next'); await expect(page.locator('dialog[open]')).toHaveCount(0);
      await wait(page, () => starAgent.state.enabled);
    } else await input.tap('gear');
    await wait(page, () => starAgent.state.landingGear.progress === 0);
    await input.reset(); await input.tap('land');
    await wait(page, () => starAgent.state.mode === 'landed' && !starAgent.state.autoland, null, 45000);
    s = await state(page); expect(s.landingGear.progress).toBe(1); expect(s.rover.aboard).toBe(true);
    expect(Math.hypot(...s.rover.local.map((n, i) => n - parked[i]))).toBeLessThan(.035); expect(s.rover.mass).toBeCloseTo(carriedOre, 6);
    expect(s.lifts.secured).toBe(true); expect(s.enabled).toBe(true); expect(s.containers.saved).toBe(true);
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await note('Loaded transport deploys its real gear and lands with the same rover'); await shot('09-loaded-touchdown');
    expect(errors).toEqual([]); expect(warnings).toEqual([]); expect(requests).toEqual([]); complete = true;
  } catch (error) {
    failed = {phase, message: error.message}; await shot('failure-' + phase).catch(() => {}); throw error;
  } finally {
    controls.helperContactsBeforeCleanup = phone ? [...input.contacts].map(([key, p]) => ({key, id: p.id})) : [...input.keys];
    await input.reset().catch(() => {}); await shot('last-frame').catch(() => {});
    const final = await state(page).catch(() => null), afterIdentity = await identity();
    const sourcesStable = JSON.stringify(beforeIdentity) === JSON.stringify(afterIdentity);
    if (!sourcesStable) { complete = false; failed ??= {phase: 'source-identity', message: 'Source or asset files changed during the browser run.'}; }
    const diagnostics = await page.evaluate(() => ({native: (() => {
      const a = window.__gannetNativeInput; return a ? {...a, pointers: [...a.pointers].map(([pointer, key]) => ({pointer, key}))} : null;
    })(), dialogs: [...document.querySelectorAll('dialog[open]')].map(d => ({id: d.id, text: d.innerText})),
    focusedControl: document.activeElement?.dataset?.controllerKey ?? null,
    gpu: (() => { const gl = document.querySelector('#viewport')?.getContext('webgl2'), ext = gl?.getExtension('WEBGL_debug_renderer_info');
      return gl ? {renderer: gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER), dpr: devicePixelRatio, buffer: [gl.drawingBufferWidth, gl.drawingBufferHeight]} : null; })(),
    })).catch(() => null);
    await writeFile(dir + '/input.json', JSON.stringify({backend: phone ? input.backend : 'Playwright native keyboard', log: input.log, controls, gates, native: diagnostics?.native}, null, 2));
    await writeFile(dir + '/journey.json', JSON.stringify({result: complete ? 'PASS' : 'FAIL', complete, phase, failed,
      input: phone ? 'Injected native Chromium touch contacts on actual controls, real canvas drag; no physical phone claim'
        : 'Native Playwright keyboard including Tab/Enter inventory; no debug movement or action skips',
      browser: browser.version(), viewport: page.viewportSize(), beforeIdentity, afterIdentity, sourcesStable,
      errors, warnings, requests, milestones, gates, trajectory, final, diagnostics,
      requiredReturnAndLoadedLanding: true, performanceClaim: false}, null, 2));
    expect(afterIdentity, 'Source/asset/fixture identity remains frozen').toEqual(beforeIdentity);
  }
});
