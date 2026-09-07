import {test, expect} from '@playwright/test';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Euler, Matrix4, Quaternion, Vector3} from 'three';
import {STRATUM_LAYOUT as S, stratumRampFloor} from '../src/stratum-layout.js';
import {MiningStore, MINING_KEY} from '../src/mining/store.js';
import {ROCK_ID} from '../src/mining/volume.js';
import {MATERIAL_IDS} from '../src/inventory/containers.js';

const output = process.env.STRATUM_OUTPUT ?? '/home/cees/projects/.medium-ships-qa/stratum-controller';
const sourceRoot = process.env.STRATUM_SOURCE ?? new URL('..', import.meta.url).pathname;
const sourceFiles = ['src/main.js', 'src/navigation.js', 'src/medium-ships.js', 'src/medium-ship-lights.js', 'src/medium-ship-gameplay.js',
  'src/stratum.js', 'src/stratum-systems.js', 'src/stratum-layout.js', 'src/stratum-flight-parts.js',
  'src/ship-mining.js', 'src/ship-mining-input.js', 'src/rover-power.js', 'src/flight-model.js',
  'src/ship-handling.js', 'src/gamepad.js', 'src/controller-ui.js', 'src/ship-inventory-ui.js',
  'src/effects/weapon-target.js', 'src/mining/field.js', 'src/mining/rock.js', 'src/mining/store.js',
  'assets/stratum/layout.json', 'public/models/stratum.glb'];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sourceHashes = async () => Object.fromEntries(await Promise.all(sourceFiles.map(async file => [file, hash(await readFile(sourceRoot + '/' + file))])));
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const vector = v => Array.isArray(v) ? new Vector3(...v) : new Vector3(v.x, v.y, v.z);
const mass = items => MATERIAL_IDS.reduce((n, id) => n + (items[id] ?? 0), 0);

// CPU-only reconstruction of actual GLB node transforms, independent of the
// runtime mining calculation. No geometry, camera, navigation or asset changes.
function muzzleReader(bytes) {
  if (bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(16) !== 0x4e4f534a) throw Error('Expected binary glTF with JSON first');
  const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
  const named = new Map(gltf.nodes.map((n, i) => [n.name, i]));
  for (const boom of S.mining.booms) for (const name of [boom.node, boom.pitchNode, boom.muzzle])
    if (!named.has(name)) throw Error('Actual GLB lacks ' + name);
  return aim => {
    const matrices = new Map();
    function visit(index, parent) {
      const node = gltf.nodes[index], p = new Vector3(...(node.translation ?? [0, 0, 0]));
      const q = new Quaternion(...(node.rotation ?? [0, 0, 0, 1])), scale = new Vector3(...(node.scale ?? [1, 1, 1]));
      if (node.matrix) new Matrix4().fromArray(node.matrix).decompose(p, q, scale);
      for (let i = 0; i < S.mining.booms.length; i++) {
        const boom = S.mining.booms[i];
        if (node.name === boom.node || node.name === boom.pitchNode) {
          const e = new Euler().setFromQuaternion(q);
          if (node.name === boom.node) e.y = aim[i].yaw; else e.x = aim[i].pitch;
          q.setFromEuler(e);
        }
      }
      const world = parent.clone().multiply(new Matrix4().compose(p, q, scale)); matrices.set(index, world);
      for (const child of node.children ?? []) visit(child, world);
    }
    for (const root of gltf.scenes[gltf.scene ?? 0].nodes) visit(root, new Matrix4());
    return S.mining.booms.map(boom => {
      const m = matrices.get(named.get(boom.muzzle));
      return {name: boom.muzzle, position: new Vector3().setFromMatrixPosition(m), direction: new Vector3(0, 0, -1).transformDirection(m)};
    });
  };
}

// Extends the established mining-rover/Gannet controller and genuine native-focus
// helpers. Only navigator.getGamepads input drives the game; debug reads supply
// steering feedback and evidence. This is injected input, not hardware testing.
test('controller Stratum: actual landing/ramp → flight approach → twin persisted ore → inventory → neutral return', async ({page, browser}) => {
  await mkdir(output, {recursive: true});
  const errors = [], warnings = [], requests = [], milestones = [], gates = {}, flightPath = [], accessPaths = {};
  const beforeHashes = await sourceHashes(), glb = await readFile(sourceRoot + '/public/models/stratum.glb');
  const actualMuzzles = muzzleReader(glb);
  let phase = 'startup', failed = null, complete = false, persistence = null, beamReceipt = null;
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); if (m.type() === 'warning') warnings.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) requests.push({status: r.status(), url: r.url()}); });
  await page.addInitScript(() => {
    window.stratumPad = {id: 'Stratum standard controller acceptance', index: 0, connected: true,
      mapping: 'standard', axes: [0, 0, 0, 0], buttons: Array.from({length: 17}, () => ({pressed: false, value: 0}))};
    Object.defineProperty(navigator, 'getGamepads', {value: () => [window.stratumPad]});
    window.__stratumReview = {inputs: [], focus: [], access: null};
    const record = event => __stratumReview.focus.push({type: event.type, trusted: event.isTrusted,
      t: performance.now(), focused: document.hasFocus(), visibility: document.visibilityState});
    window.addEventListener('focus', record); window.addEventListener('blur', record);
    document.addEventListener('visibilitychange', record);
  });
  const state = () => page.evaluate(() => starAgent.state);
  const wait = (predicate, arg = null, timeout = 15000) => page.waitForFunction(predicate, arg, {timeout, polling: 50});
  const frames = (count = 4) => page.evaluate(async n => { for (let i = 0; i < n; i++) await new Promise(resolve => requestAnimationFrame(resolve)); }, count);
  const axes = values => page.evaluate(values => { stratumPad.axes = values; __stratumReview.inputs.push({t: performance.now(), axes: values}); }, values);
  async function button(index, down) {
    await page.evaluate(({index, down}) => { stratumPad.buttons[index] = {pressed: down, value: Number(down)};
      __stratumReview.inputs.push({t: performance.now(), button: index, down}); }, {index, down});
    await frames();
  }
  const tap = async index => { await button(index, true); await button(index, false); };
  async function neutral() {
    await page.evaluate(() => { stratumPad.axes = [0, 0, 0, 0]; stratumPad.buttons = stratumPad.buttons.map(() => ({pressed: false, value: 0}));
      __stratumReview.inputs.push({t: performance.now(), neutral: true}); }); await frames();
  }
  async function readyInput() { await neutral(); await wait(() => starAgent.state.controller.armed); }
  async function chord(index) {
    await readyInput();
    // Both shoulders enter together, so the fixture does not add an accidental roll.
    await page.evaluate(() => { for (const i of [4, 5]) stratumPad.buttons[i] = {pressed: true, value: 1};
      __stratumReview.inputs.push({t: performance.now(), shoulders: true}); });
    await frames(); await tap(index); await neutral();
  }
  async function brake() {
    await axes([0, 0, 0, 0]); await button(6, true);
    await wait(() => starAgent.state.mode === 'flight' && starAgent.state.speed < .045, null, 12000);
    await button(6, false); await frames();
  }
  const shot = async name => { await frames(); await page.screenshot({path: output + '/' + name + '.png'}); };
  async function note(name) {
    const s = await state(); milestones.push({name, phase, time: new Date().toISOString(), pageTime: await page.evaluate(() => performance.now()),
      mode: s.mode, position: s.position, shipLocal: s.shipLocal, shipPosition: s.shipPosition, shipOrientation: s.shipOrientation,
      lifts: s.lifts, gear: s.landingGear, camera: s.camera, controller: s.controller, containers: s.containers, mining: s.mining, mfds: s.mfds});
    console.log('Stratum controller:', name);
  }
  async function pilotShot(name) {
    if ((await state()).camera.mode !== 'cockpit') await chord(15);
    await wait(() => starAgent.state.camera.mode === 'cockpit'); await page.waitForTimeout(750); await shot(name);
    milestones.push({name: 'Settled actual Stratum pilot view', image: name + '.png', phase,
      pageTime: await page.evaluate(() => performance.now()),
      sightline: await page.evaluate(() => ({orientation: starAgent.navigation.orientation.toArray(), camera: starAgent.state.camera, local: starAgent.state.shipLocal})),
      visualRequirement: 'No central strut/mullion across the main forward pilot view or usable displays; image inspection required'});
  }
  async function walk(target) {
    const deadline = Date.now() + 28000; let best = Infinity, progressAt = Date.now();
    while (Date.now() < deadline) {
      const c = await page.evaluate(target => {
        const n = starAgent.navigation, d = n.fromShipLocal(n.position.clone().fromArray(target)).sub(n.position).applyQuaternion(n.orientation.clone().invert());
        return {distance: Math.hypot(d.x, d.z), x: d.x, z: d.z, local: n.toShipLocal().toArray(), mode: n.mode};
      }, target);
      if (c.mode !== 'walk') throw Error('Ramp/aisle walking left the walking mode: ' + JSON.stringify(c));
      if (c.distance < .14) { await axes([0, 0, 0, 0]); await frames(); return; }
      if (c.distance < best - .08) { best = c.distance; progressAt = Date.now(); }
      if (Date.now() - progressAt > 4500) throw Error('Walking blocked toward ' + JSON.stringify({target, ...c}));
      const speed = clamp(c.distance * 1.1, .25, .62);
      await axes([c.x / c.distance * speed, c.z / c.distance * speed, 0, 0]); await page.waitForTimeout(65);
    }
    throw Error('Walking deadline at ' + JSON.stringify({target, actual: (await state()).shipLocal}));
  }
  async function accessRecord(start, id) {
    if (start) {
      await page.evaluate(() => {
        __stratumReview.access = {active: true, points: []};
        function record(t) {
          const a = __stratumReview.access; if (!a.active) return;
          const n = starAgent.navigation, p = n.toShipLocal(), surface = n.freighter.surfaceAt(p);
          a.points.push({t, world: n.position.toArray(), local: p.toArray(), source: surface?.source ?? 'terrain', floor: surface?.y ?? null,
            inside: n.insideShip, mode: n.mode, ramp: n.freighter.snapshot.ramp}); requestAnimationFrame(record);
        }
        requestAnimationFrame(record);
      }); return;
    }
    const points = await page.evaluate(() => { __stratumReview.access.active = false; return __stratumReview.access.points; });
    const maxStep = Math.max(0, ...points.slice(1).map((p, i) => Math.hypot(...p.world.map((v, j) => v - points[i].world[j]))));
    accessPaths[id] = {points, maxStep};
    expect(points.filter(p => p.source === 'stratum-ramp:aft').length).toBeGreaterThan(10);
    expect(maxStep, 'Per-frame actual ramp travel must not jump between endpoints').toBeLessThan(.75);
    expect(points.every(p => p.mode === 'walk')).toBe(true);
    await writeFile(output + '/access-' + id + '.json', JSON.stringify(accessPaths[id], null, 2));
  }
  async function flightFeedback(target) {
    return page.evaluate(target => {
      const n = starAgent.navigation, d = n.position.clone().fromArray(target).sub(n.position).applyQuaternion(n.orientation.clone().invert());
      return {yaw: Math.atan2(d.x, -d.z), pitch: Math.atan2(d.y, Math.hypot(d.x, d.z)), distance: d.length(),
        speed: n.speed, limit: Math.min(n.speedProfile.speed, n.debrisSpeedLimit), mode: n.mode, altitude: n.altitude,
        position: n.position.toArray(), orientation: n.orientation.toArray(), t: performance.now()};
    }, target);
  }
  const lookAxis = angle => Math.abs(angle) <= .009 ? 0 : Math.sign(angle) * Math.min(.70, .18 + Math.abs(angle) * 1.45);
  async function aim(target, mode = 'flight') {
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      const c = await flightFeedback(target); flightPath.push({...c, operation: mode === 'flight' ? 'aim' : 'walk-look'});
      if (c.mode !== mode) throw Error('Right-stick aim interrupted: ' + JSON.stringify(c));
      if (Math.hypot(c.yaw, c.pitch) < .017) {
        await axes([0, 0, 0, 0]); await page.waitForTimeout(240);
        const settled = await flightFeedback(target);
        if (Math.hypot(settled.yaw, settled.pitch) < .024) return;
      } else await axes([0, 0, lookAxis(c.yaw), -lookAxis(c.pitch)]);
      await page.waitForTimeout(65);
    }
    throw Error('Right-stick aim could not settle on observed target: ' + JSON.stringify(await flightFeedback(target)));
  }
  async function lookAtLocal(point) {
    const target = await page.evaluate(point => {
      const n = starAgent.navigation; return n.fromShipLocal(n.position.clone().fromArray(point)).toArray();
    }, point);
    await aim(target, 'walk');
  }
  async function approach(target, standOff = 26) {
    const start = await flightFeedback(target), deadline = Date.now() + 35000;
    expect(start.distance, 'Launch must leave a real, short forward approach').toBeGreaterThan(standOff + .5);
    while (Date.now() < deadline) {
      const c = await flightFeedback(target); flightPath.push({...c, operation: 'approach'});
      if (c.mode !== 'flight' || c.altitude < 7 || c.distance < 22) throw Error('Approach safety envelope reached: ' + JSON.stringify(c));
      if (c.distance <= standOff + .35) {
        await brake(); await aim(target);
        const end = await flightFeedback(target);
        expect(end.distance).toBeGreaterThan(23); expect(end.distance).toBeLessThan(29);
        expect(vector(end.position).distanceTo(vector(start.position))).toBeGreaterThan(.5); return;
      }
      const aligned = Math.hypot(c.yaw, c.pitch) < .07;
      const desiredSpeed = aligned ? Math.min(1.7, Math.max(.30, (c.distance - standOff) * .75)) : 0;
      // Invert the shared deadzone; actual flight physics owns acceleration/braking.
      const input = desiredSpeed ? .16 + .84 * clamp(desiredSpeed / c.limit, 0, 1) : 0;
      await axes([0, -input, lookAxis(c.yaw), -lookAxis(c.pitch)]); await page.waitForTimeout(65);
    }
    throw Error('Controller approach deadline: ' + JSON.stringify(await flightFeedback(target)));
  }
  async function choose(key) {
    for (let i = 0; i < 90; i++) {
      if (await page.evaluate(key => document.activeElement?.dataset.controllerKey === key, key)) { await tap(0); return; }
      await tap(13);
    }
    const visible = await page.locator('dialog[open] [data-controller-key]').evaluateAll(nodes => nodes.filter(n => n.getClientRects().length && !n.disabled).map(n => ({key: n.dataset.controllerKey, label: n.textContent})));
    throw Error('Controller cannot focus ' + key + '; visible=' + JSON.stringify(visible));
  }
  async function saveReceipt() {
    const raw = await page.evaluate(key => localStorage.getItem(key), MINING_KEY);
    expect(raw, 'Committed cuts and bins must exist in actual browser storage').not.toBeNull();
    // A separate reader verifies the persisted bytes; its storage adapter cannot write.
    const readOnly = new MiningStore({getItem: key => key === MINING_KEY ? raw : null, setItem() { throw Error('Read-only persistence probe'); }});
    expect(readOnly.blocked).not.toBe(true); expect(readOnly.warning).toBe('');
    const parsed = JSON.parse(raw);
    return {sha256: hash(raw), bytes: Buffer.byteLength(raw), revision: parsed.revision,
      rocks: Object.fromEntries(Object.entries(parsed.rocks ?? {}).map(([id, rock]) => [id, rock.revision])),
      ore: readOnly.container('stratum-ore'), pack: readOnly.container('pack'), supplies: readOnly.container('ship'),
      oreLimit: readOnly.limits('stratum-ore').resources};
  }
  async function muzzleReceipt() {
    const live = await page.evaluate(() => ({position: starAgent.navigation.position.toArray(), orientation: starAgent.navigation.orientation.toArray(),
      shipPosition: starAgent.navigation.shipPosition?.toArray() ?? null, shipOrientation: starAgent.navigation.shipOrientation.toArray(),
      mining: starAgent.state.mining.ship, pose: starAgent.state.kestrel, t: performance.now()}));
    const q = new Quaternion(...(live.shipPosition ? live.shipOrientation : live.orientation));
    const shipOrigin = live.shipPosition ? vector(live.shipPosition) : vector(live.position).sub(new Vector3(...S.interior.pilotEye).applyQuaternion(q));
    const tips = actualMuzzles(live.mining.aim);
    expect(live.mining.beaming).toBe(2); expect(live.mining.beams).toHaveLength(2);
    const comparisons = tips.map((tip, i) => {
      const beam = live.mining.beams[i], expected = tip.position.clone().applyQuaternion(q).add(shipOrigin);
      const direction = tip.direction.clone().applyQuaternion(q), start = vector(beam.start), end = vector(beam.end);
      const result = {name: tip.name, expected: expected.toArray(), actual: start.toArray(), startError: expected.distanceTo(start),
        directionError: direction.distanceTo(vector(beam.direction)), range: start.distanceTo(end), hit: beam.hit, occluded: beam.occluded, rockId: beam.rockId};
      expect(result.startError, 'Visible cutter begins at actual articulated GLB tip ' + tip.name).toBeLessThan(.002);
      expect(result.directionError).toBeLessThan(.0001); expect(result.range).toBeLessThanOrEqual(40.0001);
      expect(start.distanceTo(vector(live.position)), 'A ship cutter must originate away from the camera').toBeGreaterThan(3);
      expect(result.hit).toBe(true); expect(result.occluded).toBe(false); expect(result.rockId).toBeTruthy(); return result;
    });
    expect(new Set(comparisons.map(x => x.rockId)).size, 'Both real barrels must reach the same existing outcrop').toBe(1);
    return {live, comparisons};
  }
  async function nativeFocusGate() {
    const report = gates.focus = {}, blank = await page.context().newPage();
    const gameSession = await page.context().newCDPSession(page), blankSession = await page.context().newCDPSession(blank);
    const snapshot = () => page.evaluate(() => ({focused: document.hasFocus(), navFocused: starAgent.navigation.focused,
      active: starAgent.state.mining.ship.active, beams: starAgent.state.mining.ship.beaming,
      events: [...__stratumReview.focus], trigger: stratumPad.buttons[7].value}));
    try {
      await blank.goto('about:blank');
      await gameSession.send('Emulation.setFocusEmulationEnabled', {enabled: false});
      await blankSession.send('Emulation.setFocusEmulationEnabled', {enabled: false});
      await page.bringToFront(); await wait(() => document.hasFocus() && starAgent.navigation.focused, null, 6000);
      await readyInput(); await button(7, true); await wait(() => starAgent.state.mining.ship.beaming === 2);
      report.before = await snapshot(); await blank.bringToFront();
      await wait(() => !document.hasFocus() && !starAgent.navigation.focused && !starAgent.state.mining.ship.active, null, 6000);
      report.background = await snapshot();
      expect(report.background.events.slice(report.before.events.length).some(e => e.type === 'blur' && e.trusted)).toBe(true);
      await page.bringToFront(); await wait(() => document.hasFocus() && starAgent.navigation.focused, null, 6000);
      report.returned = await snapshot();
      expect(report.returned.events.slice(report.background.events.length).some(e => e.type === 'focus' && e.trusted)).toBe(true);
      expect(report.returned.trigger).toBe(1); await page.waitForTimeout(350); expect((await state()).mining.ship.beaming).toBe(0);
      await button(7, false); await wait(() => starAgent.state.controller.armed);
      await button(7, true); await wait(() => starAgent.state.mining.ship.beaming === 2); await button(7, false);
      report.result = 'PASS';
    } catch (e) { report.result = 'FAIL'; report.error = e.message; throw e; }
    finally {
      report.last = await snapshot().catch(() => null);
      await gameSession.send('Emulation.setFocusEmulationEnabled', {enabled: true}).catch(() => {});
      await blankSession.send('Emulation.setFocusEmulationEnabled', {enabled: true}).catch(() => {});
      await page.bringToFront().catch(() => {}); await blank.close().catch(() => {});
      await gameSession.detach().catch(() => {}); await blankSession.detach().catch(() => {});
    }
  }

  try {
    await page.goto('/?dev=1&intro=0&ship=stratum&start=moon&debug=1&seed=7291');
    await wait(() => window.starAgent?.state.ready && starAgent.state.shipAsset === 'ready' && !starAgent.state.transiting, null, 90000);
    await readyInput(); let s = await state();
    expect(s.dev, 'Preview needs VITE_DEV_TOOLS=1').not.toBeNull(); expect(s.shipId).toBe('stratum');
    expect(s.mode, 'Explicit Stratum start is an approach, not a pre-landed shortcut').toBe('flight');
    expect(s.altitude).toBeGreaterThan(160); expect(s.altitude).toBeLessThan(200); expect(s.powered).toBe(true);
    expect(s.flightAssist).toBe(true); expect(s.multiplayer.connected).not.toBe(true); expect(s.lifts.secured).toBe(true);
    const response = await page.request.get('/models/stratum.glb'); expect(response.ok()).toBe(true);
    expect(hash(await response.body()), 'Served model must match the exact frozen source').toBe(beforeHashes['public/models/stratum.glb']);
    await note('Explicit 180 m Selene approach, actual loaded Stratum');
    phase = 'controller-landing'; await tap(3);
    await wait(() => starAgent.state.autoland || starAgent.state.mode === 'landed');
    await wait(() => starAgent.state.mode === 'landed' && starAgent.state.landingGear.progress === 1, null, 55000);
    s = await state(); expect(s.lifts.secured).toBe(true); expect(vector(s.shipLocal).distanceTo(new Vector3(...S.interior.pilotEye))).toBeLessThan(.00001);
    expect(s.mining.activePosition).toHaveLength(3); const target = [...s.mining.activePosition];
    const initialTarget = {id: s.mining.activeRock, position: target, revision: s.mining.activeRevision};
    await pilotShot('00-settled-stratum-landed-pilot'); await note('Actual Y landing and gear-down contact');

    phase = 'physical-aisle-to-ramp'; await tap(2); await wait(() => starAgent.state.mode === 'walk');
    await walk(S.interior.standingEye); await walk([0, S.interior.standingEye[1], 5.75]);
    expect((await state()).interaction).toContain('RAMP'); await tap(2);
    await wait(() => starAgent.state.lifts.ramp === 1 && starAgent.state.kestrel.rampReady, null, 10000);
    await lookAtLocal([0, 2.0, 12.2]); await shot('01-fully-deployed-aft-ramp');
    const rampPath = [6.35, 7.1, 8.1, 9.2, 10.3, 11.3, 12.1, 13.2].map(z => [0, (z < S.ramp.hinge[2] ? S.interior.floorY : stratumRampFloor(z) ?? 0) + 1.75, z]);
    phase = 'actual-ramp-egress'; await accessRecord(true, 'out');
    for (const point of rampPath) await walk(point); await accessRecord(false, 'out');
    s = await state(); expect(s.insideShip).toBe(false); expect(s.shipLocal[2]).toBeGreaterThan(12.8);
    expect(s.shipLocal[1]).toBeGreaterThan(1.60); expect(s.shipLocal[1]).toBeLessThan(1.90);
    await lookAtLocal([0, S.interior.standingEye[1], 5.75]);
    await shot('02-physical-ramp-on-terrain'); await note('Continuous ramp egress reaches canonical terrain');
    phase = 'actual-ramp-return'; await accessRecord(true, 'in');
    for (const point of [...rampPath].reverse().slice(1)) await walk(point);
    await walk([0, S.interior.standingEye[1], 5.75]); await accessRecord(false, 'in');
    await tap(2); await wait(() => starAgent.state.lifts.secured && starAgent.state.kestrel.secured, null, 10000);
    await walk(S.interior.standingEye); await tap(2); await wait(() => starAgent.state.mode === 'landed');
    await pilotShot('03-settled-stratum-pilot-return'); await note('Physical ramp return and secure pilot chair');

    phase = 'real-launch-and-gear'; await readyInput(); await tap(3); await wait(() => starAgent.state.mode === 'flight');
    await brake(); await chord(13); await wait(() => starAgent.state.landingGear.progress === 0, null, 6000);
    s = await state(); expect(s.landingGear.target).toBe(false); expect(s.landingGear.visual).toBe(0); expect(s.lifts.secured).toBe(true);
    phase = 'nose-turn-to-existing-outcrop'; await aim(target);
    phase = 'controlled-short-flight'; await approach(target); await readyInput();
    await note('Real stick turn and controlled 26 m approach to existing outcrop');
    phase = 'real-twin-cutter-payout'; const before = await state(); persistence = {before: await saveReceipt(), initialTarget};
    await button(7, true);
    await wait(previous => starAgent.state.mining.ship.beaming === 2 && starAgent.state.mining.ship.mass > previous + .02, before.mining.ship.mass, 25000);
    beamReceipt = await muzzleReceipt(); await shot('04-real-twin-mining-cockpit'); await page.waitForTimeout(1500); await button(7, false);
    await wait(() => !starAgent.state.mining.pending); s = await state();
    expect(s.mining.ship.mass).toBeGreaterThan(before.mining.ship.mass + .02);
    expect(s.containers.saved).toBe(true); expect(s.containers.warning).toBe(''); expect(s.mining.ship.charge).toBeGreaterThan(.7);
    expect(s.containers.containers.find(c => c.id === 'pack').items).toEqual(before.containers.containers.find(c => c.id === 'pack').items);
    expect(s.containers.containers.find(c => c.id === 'ship').items).toEqual(before.containers.containers.find(c => c.id === 'ship').items);
    persistence.mined = await saveReceipt(); expect(persistence.mined.oreLimit).toBe(384);
    expect(mass(persistence.mined.ore.items)).toBeGreaterThan(mass(persistence.before.ore.items) + .02);
    expect(persistence.mined.sha256).not.toBe(persistence.before.sha256);
    const hit = beamReceipt.comparisons[0].rockId;
    expect(hit === ROCK_ID ? persistence.mined.revision > persistence.before.revision
      : (persistence.mined.rocks[hit] ?? 0) > (persistence.before.rocks[hit] ?? 0),
    'Persisted voxel revision must advance alongside real ore').toBe(true);
    await note('Accepted voxel cuts persisted into Stratum ore; backpack and supplies unchanged');
    // External view uses the real gameplay camera and retains the target/ship pose.
    await chord(15); await wait(() => starAgent.state.camera.mode === 'external');
    await readyInput(); await button(7, true); await wait(() => starAgent.state.mining.ship.beaming === 2); await shot('05-real-external-twin-cutters'); await button(7, false);
    await pilotShot('06-cockpit-cutter-status');

    phase = 'shared-stratum-ore-dialog'; await readyInput(); await button(7, true); await wait(() => starAgent.state.mining.ship.beaming === 2); await tap(8);
    await expect(page.locator('#cargo-dialog')).toBeVisible(); await wait(() => starAgent.state.mining.ship.beaming === 0);
    await neutral(); await wait(() => starAgent.navigation.gamepad.uiArmed); await choose('location-stratum-ore');
    await expect(page.getByRole('button', {name: 'Stratum cargo', exact: true})).toBeVisible();
    await expect(page.locator('#cargo-dialog')).toContainText('Stratum dedicated ore bin');
    let slot = page.locator('[data-from="stratum-ore"][data-item]:visible').first();
    for (let i = 0; i < 6 && !await slot.count(); i++) { await choose('page-containers-next'); await frames(); }
    await expect(slot).toBeVisible(); await wait(() => !starAgent.state.mining.pending);
    const item = await slot.getAttribute('data-item'), key = await slot.getAttribute('data-controller-key');
    const transferBefore = await saveReceipt(); await choose(key); await choose('transfer-one');
    const transferAfter = await saveReceipt(), added = (transferAfter.pack.items[item] ?? 0) - (transferBefore.pack.items[item] ?? 0);
    expect(added).toBeGreaterThan(0); expect(added).toBeLessThanOrEqual(1.000001);
    expect(transferBefore.ore.items[item] - transferAfter.ore.items[item]).toBeCloseTo(added, 6);
    expect(transferAfter.supplies.items).toEqual(transferBefore.supplies.items);
    persistence.transfer = {item, added, before: transferBefore, after: transferAfter}; await shot('07-visible-controller-ore-transfer');
    await button(7, true); await tap(1); await expect(page.locator('#cargo-dialog')).not.toBeVisible();
    await page.waitForTimeout(350); expect((await state()).mining.ship.beaming).toBe(0);
    gates.dialog = {result: 'PASS', triggerHeldAcrossOpenAndClose: true}; await readyInput();
    phase = 'native-focus-neutral'; await nativeFocusGate();
    phase = 'controller-device-neutral';
    for (const kind of ['disconnect', 'replacement', 'unsupported']) {
      await readyInput(); await button(7, true); await wait(() => starAgent.state.mining.ship.beaming === 2);
      await page.evaluate(kind => {
        if (kind === 'disconnect') stratumPad.connected = false;
        if (kind === 'replacement') stratumPad.id += ' replacement';
        if (kind === 'unsupported') stratumPad.mapping = '';
        __stratumReview.inputs.push({t: performance.now(), device: kind});
      }, kind);
      await wait(() => starAgent.state.mining.ship.beaming === 0); const suppressed = (await state()).controller;
      await page.evaluate(() => { stratumPad.connected = true; stratumPad.mapping = 'standard'; });
      await frames(); expect((await state()).mining.ship.beaming).toBe(0);
      await button(7, false); await wait(() => starAgent.state.controller.armed);
      await button(7, true); await wait(() => starAgent.state.mining.ship.beaming === 2); await button(7, false);
      gates[kind] = {result: 'PASS', suppressed};
    }
    phase = 'return-to-pilot-control'; await readyInput(); await brake();
    await wait(() => !starAgent.state.mining.pending); persistence.final = await saveReceipt();
    s = await state(); expect(s.mode).toBe('flight'); expect(s.powered).toBe(true); expect(s.enabled).toBe(true);
    expect(s.controller.armed).toBe(true); expect(s.mining.ship.beaming).toBe(0); expect(s.lifts.secured).toBe(true);
    await pilotShot('08-final-powered-pilot-ore-mfd'); await note('Dialog, native focus and device gates closed; actual pilot control restored');
    expect(errors).toEqual([]); expect(warnings).toEqual([]); expect(requests).toEqual([]); complete = true;
  } catch (e) {
    failed = {phase, message: e.message}; await shot('failure-' + phase).catch(() => {}); throw e;
  } finally {
    await neutral().catch(() => {}); await shot('last-frame').catch(() => {});
    const final = await state().catch(() => null), afterHashes = await sourceHashes();
    const sourcesStable = JSON.stringify(beforeHashes) === JSON.stringify(afterHashes);
    if (!sourcesStable) { complete = false; failed ??= {phase: 'source-identity', message: 'Source/asset changed during acceptance'}; }
    const diagnostics = await page.evaluate(() => ({input: window.__stratumReview,
      visibleDialog: [...document.querySelectorAll('dialog[open]')].map(d => ({id: d.id, text: d.innerText})),
      focusedControl: document.activeElement?.dataset.controllerKey ?? null,
      gpu: (() => { const g = document.querySelector('#viewport')?.getContext('webgl2'), e = g?.getExtension('WEBGL_debug_renderer_info');
        return g ? {renderer: g.getParameter(e ? e.UNMASKED_RENDERER_WEBGL : g.RENDERER), buffer: [g.drawingBufferWidth, g.drawingBufferHeight]} : null; })(),
    })).catch(() => null);
    await writeFile(output + '/journey.json', JSON.stringify({result: complete ? 'PASS' : 'FAIL', phase, failed,
      input: 'Injected W3C standard Gamepad only; genuine native focus interruption; no physical controller claim',
      browser: browser.version(), viewport: page.viewportSize(), beforeHashes, afterHashes, sourcesStable,
      errors, warnings, requests, milestones, gates, flightPath, accessPaths, beamReceipt, persistence, final, diagnostics,
      limits: ['Actual screenshots/video require visual review; no automatic cockpit/art acceptance', 'No keyboard, touch, online authority or FPS claim',
        'Persistence is re-read from real saved bytes without mutating or reloading the game; ramp walk occurs at the first real landing'], performanceClaim: false}, null, 2));
    expect(afterHashes, 'Freeze source/asset throughout the complete journey').toEqual(beforeHashes);
  }
});
