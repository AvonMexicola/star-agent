import {test, expect} from '@playwright/test';
import {mkdir, readFile, writeFile, access} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {STRATUM_LAYOUT as S, stratumRampFloor} from '../src/stratum-layout.js';
import {shipHandling} from '../src/ship-handling.js';
import {MiningStore, MINING_KEY} from '../src/mining/store.js';
import {ROCK_ID} from '../src/mining/volume.js';
import {MATERIAL_IDS} from '../src/inventory/containers.js';
import {analyzeStratumAccess} from './stratum-access-continuity.js';
import {state, wait, frames, clamp, KeyboardInput, TouchInput, installNativeReceipts, nativeFocusNeutral} from './stratum-primary-inputs.js';

const output = process.env.STRATUM_PRIMARY_OUTPUT ?? '/home/cees/projects/.medium-ships-qa/stratum-primary/unconfigured';
const sourceRoot = process.env.STRATUM_SOURCE ?? fileURLToPath(new URL('..', import.meta.url));
const sourceFiles = ['src/main.js', 'src/navigation.js', 'src/medium-ships.js', 'src/medium-ship-lights.js', 'src/medium-ship-gameplay.js',
  'src/stratum.js', 'src/stratum-systems.js', 'src/stratum-layout.js', 'src/stratum-flight-parts.js',
  'src/ship-mining.js', 'src/ship-mining-input.js', 'src/ship-mining.css', 'src/ship-mfd.js',
  'src/nomad-cabin-controls.js', 'src/nomad-cabin-controls.css', 'src/secondary-touch-buttons.js',
  'src/gameplay-menu.js', 'src/controller-ui.js', 'src/ship-inventory-ui.js', 'src/ship-camera.js',
  'src/flight-model.js', 'src/ship-handling.js', 'src/mining/field.js', 'src/mining/rock.js', 'src/mining/store.js', 'src/test-flight.js',
  'assets/stratum/layout.json', 'public/models/stratum.glb', 'src/boarding.js', 'src/celestial.js'];
const fixtureFiles = ['stratum-primary-inputs.spec.js', 'stratum-primary-inputs.config.js', 'stratum-primary-inputs.js', 'stratum-access-continuity.js'];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

// Read the actual adapter bytes. These explicit dev-flight journeys use a fresh
// practice Map; a successful parse certifies serialization, not reload retention.
function readPracticeMiningSave(receipt) {
  expect(receipt, 'The existing debug getter must expose the actual mining save receipt').toBeTruthy();
  expect(receipt.key, 'Receipt key must identify the canonical mining transaction').toBe(MINING_KEY);
  expect(receipt.kind, 'This explicit dev flight must use isolated practice storage').toBe('practice-memory');
  expect(receipt.error, 'Reading the actual selected storage adapter must succeed').toBeUndefined();
  expect(typeof receipt.value, 'Accepted commits must exist as actual serialized bytes').toBe('string');
  const raw = receipt.value;
  expect(raw.length, 'An empty value is not a committed mining save').toBeGreaterThan(0);
  const store = new MiningStore({getItem: key => key === MINING_KEY ? raw : null,
    setItem() { throw Error('Read-only practice serialization probe'); }});
  expect(store.blocked, 'The production parser must accept the actual save bytes').not.toBe(true);
  expect(store.warning).toBe(''); expect(store.persistedRaw).toBe(raw);
  expect(store.container('stratum-ore'), 'The committed dedicated bin must be present').not.toBeNull();
  return {kind: receipt.kind, key: receipt.key, sha256: hash(raw), bytes: Buffer.byteLength(raw), revision: store.state.revision,
    rocks: Object.fromEntries(Object.entries(store.state.rocks).map(([id, rock]) => [id, rock.revision])),
    ore: store.container('stratum-ore'), pack: store.container('pack'), supplies: store.container('ship'),
    oreLimit: store.limits('stratum-ore').resources};
}
const mass = items => MATERIAL_IDS.reduce((sum, id) => sum + (items[id] ?? 0), 0);
const distance = (a, b) => Math.hypot(...a.map((n, i) => n - b[i]));
async function identity() {
  const sources = Object.fromEntries(await Promise.all(sourceFiles.map(async file => [file, hash(await readFile(sourceRoot + '/' + file))])));
  const fixtures = Object.fromEntries(await Promise.all(fixtureFiles.map(async file => [file, hash(await readFile(new URL(file, import.meta.url)))])));
  return {sources, fixtures, commit: execFileSync('git', ['rev-parse', 'HEAD'], {cwd: sourceRoot, encoding: 'utf8'}).trim(),
    dirty: execFileSync('git', ['status', '--short'], {cwd: sourceRoot, encoding: 'utf8'}).trim()};
}

// The developer URL selects one real 180 m approach. Everything after that is
// native keyboard or native touch input, including every movement and menu action.
test('Stratum: real landing and ramp → short flight → twin practice-store commits → native inventory and return', async ({page, browser}, testInfo) => {
  const phone = testInfo.project.name === 'touch', dir = output + '/' + testInfo.project.name;
  if (await access(dir + '/journey.json').then(() => true, () => false)) throw Error('Preserve the prior result: choose a fresh STRATUM_PRIMARY_OUTPUT directory.');
  await mkdir(dir, {recursive: true});
  const errors = [], warnings = [], requests = [], milestones = [], flight = [], accessPaths = {}, gates = {}, sightlines = [], serialization = {};
  const beforeIdentity = await identity(); let phase = 'startup', failed = null, complete = false;
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); if (m.type() === 'warning') warnings.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) requests.push({status: r.status(), url: r.url()}); });
  await installNativeReceipts(page);
  const input = phone ? new TouchInput(page, await page.context().newCDPSession(page)) : new KeyboardInput(page);
  async function shot(name) { await frames(page); await page.screenshot({path: dir + '/' + name + '.png'}); }
  async function note(name) {
    const s = await state(page); milestones.push({name, phase, pageTime: await page.evaluate(() => performance.now()), time: new Date().toISOString(),
      mode: s.mode, position: s.position, shipLocal: s.shipLocal, shipPosition: s.shipPosition, shipOrientation: s.shipOrientation,
      gear: s.landingGear, camera: s.camera, lifts: s.lifts, mining: s.mining, containers: s.containers, mfds: s.mfds});
    console.log(`Stratum ${testInfo.project.name}: ${name}`);
  }
  async function choosePaged(key, nextKey) {
    const locator = page.locator(`dialog[open] [data-controller-key=${JSON.stringify(key)}]`);
    for (let i = 0; i < 8; i++) {
      if (await locator.isVisible()) { await input.choose(key); return; }
      await input.choose(nextKey); await frames(page);
    }
    throw Error('Visible pagination cannot reach ' + key);
  }
  async function shipCommand(key) {
    await input.reset(); await input.tap('commands'); await expect(page.locator('dialog[open]')).toHaveCount(1);
    await input.choose('tab-ship'); await expect(page.locator('#controller-menu')).toBeVisible();
    await choosePaged(key, 'page-ship systems-next'); await expect(page.locator('dialog[open]')).toHaveCount(0);
    await wait(page, () => starAgent.state.enabled); await input.reset();
  }
  async function cockpit() {
    if ((await state(page)).camera.mode !== 'cockpit') {
      if (phone) await shipCommand('camera-view'); else await input.tap('camera');
    }
    await wait(page, () => starAgent.state.camera.mode === 'cockpit');
  }
  async function sightline(name) {
    const record = await page.evaluate(displays => {
      const n = starAgent.navigation, s = starAgent.state, q = n.shipPosition ? n.shipOrientation : n.orientation;
      const base = n.shipPosition?.clone() ?? n.position.clone().sub(n.position.clone().fromArray(n.layout.seatEye).applyQuaternion(q));
      const camera = n.position.clone().fromArray(s.camera.position), inverse = n.orientation.clone().fromArray(s.camera.orientation).invert();
      const aspect = innerWidth / innerHeight, tan = Math.tan(s.camera.fov * Math.PI / 360);
      return {eye: n.position.toArray(), camera: s.camera, orientation: n.orientation.toArray(), shipOrientation: q.toArray(), mfds: s.mfds,
        nominalLayoutCenters: displays.map(d => {
          const p = n.position.clone().fromArray(d.position).applyQuaternion(q).add(base).sub(camera).applyQuaternion(inverse);
          const x = p.x / (-p.z * tan * aspect), y = p.y / (-p.z * tan);
          return {name: d.node, page: d.page, ndc: [x, y], pixel: [(x + 1) * innerWidth / 2, (1 - y) * innerHeight / 2],
            centerInFrame: p.z < 0 && Math.abs(x) <= 1 && Math.abs(y) <= 1};
        }), projectionLimit: 'Canonical display centers projected with actual FOV/origin and rendered camera quaternion; this is not a triangle/occlusion or readability certificate'};
    }, S.displays);
    expect(record.mfds).toHaveLength(4);
    sightlines.push({name, image: name + '.png', phase, pageTime: await page.evaluate(() => performance.now()), ...record,
      visualRequirement: 'Clear actual forward view and unobstructed readable MFD faces. Portrait may use native look; no camera offset/FOV/DOM hiding by fixture.'});
  }
  async function pilotShot(name) { await cockpit(); await input.reset(); await page.waitForTimeout(750); await shot(name); await sightline(name); }
  async function feedback(target) {
    return page.evaluate(target => {
      const n = starAgent.navigation, inverse = n.orientation.clone().invert(), d = n.position.clone().fromArray(target).sub(n.position).applyQuaternion(inverse);
      return {yaw: Math.atan2(d.x, -d.z), pitch: Math.atan2(d.y, Math.hypot(d.x, d.z)), distance: d.length(), mode: n.mode,
        position: n.position.toArray(), orientation: n.orientation.toArray(), turn: n.assistedTurn.toArray(),
        speed: n.speed, forwardSpeed: -n.velocity.clone().applyQuaternion(inverse).z, altitude: n.altitude, t: performance.now()};
    }, target);
  }
  async function aim(target, mode = 'flight') {
    await input.hold([]); const deadline = Date.now() + (phone ? 65000 : 35000);
    while (Date.now() < deadline) {
      const c = await feedback(target); flight.push({...c, phase, action: 'native-look'});
      if (c.mode !== mode) throw Error('Native aim left expected mode: ' + JSON.stringify(c));
      if (Math.hypot(c.yaw, c.pitch) < .022) {
        await input.hold([]); await page.waitForTimeout(240); const settled = await feedback(target);
        if (Math.hypot(settled.yaw, settled.pitch) < .032) return;
      } else if (phone) {
        const sensitivity = .002 * (mode === 'flight' ? shipHandling('stratum').turn : 1);
        await input.dragView(clamp(c.yaw / sensitivity * .78, -90, 90), clamp(-c.pitch / sensitivity * .78, -70, 70));
      } else {
        // Account for the current physical steering run-down before releasing
        // digital arrows. Near-zero inputs are never written into navigation.
        const lag = mode === 'flight' ? shipHandling('stratum').steeringLag : 0;
        const x = c.yaw + c.turn[1] * lag, y = c.pitch - c.turn[0] * lag;
        await input.hold([...(Math.abs(x) > .011 ? [x > 0 ? 'aimRight' : 'aimLeft'] : []), ...(Math.abs(y) > .011 ? [y > 0 ? 'aimUp' : 'aimDown'] : [])]);
        await page.waitForTimeout(35);
      }
    }
    throw Error('Native view input failed to reach target: ' + JSON.stringify(await feedback(target)));
  }
  async function lookLocal(point, mode = 'walk') {
    const world = await page.evaluate(point => { const n = starAgent.navigation; return n.fromShipLocal(n.position.clone().fromArray(point)).toArray(); }, point);
    await aim(world, mode);
  }
  async function phoneDisplays() {
    if (!phone) return;
    const eye = (await state(page)).position;
    for (const display of S.displays) {
      await lookLocal(display.position, 'landed'); await pilotShot('00-phone-' + display.node.toLowerCase());
      expect(distance((await state(page)).position, eye), 'Looking at a real display cannot move the pilot eye').toBeLessThan(.00001);
    }
    await lookLocal([S.interior.pilotEye[0], S.interior.pilotEye[1], S.interior.pilotEye[2] - 100], 'landed');
    await pilotShot('00-phone-forward-restored');
  }
  async function walk(target) {
    await input.hold([]); if (phone) await input.warm(['forward', 'backward', 'left', 'right']);
    const deadline = Date.now() + 30000; let best = Infinity, progressAt = Date.now();
    while (Date.now() < deadline) {
      const c = await page.evaluate(target => {
        const n = starAgent.navigation, d = n.fromShipLocal(n.position.clone().fromArray(target)).sub(n.position).applyQuaternion(n.orientation.clone().invert());
        return {distance: Math.hypot(d.x, d.z), x: d.x, z: d.z, local: n.toShipLocal().toArray(), mode: n.mode};
      }, target);
      if (c.mode !== 'walk') throw Error('Physical aisle/ramp left walking mode: ' + JSON.stringify(c));
      if (c.distance < .18) { await input.hold([]); await frames(page); return; }
      if (c.distance < best - .08) { best = c.distance; progressAt = Date.now(); }
      if (Date.now() - progressAt > 4500) throw Error('Walking blocked: ' + JSON.stringify({target, ...c}));
      await input.hold(Math.abs(c.x) > Math.abs(c.z) ? [c.x > 0 ? 'right' : 'left'] : [c.z > 0 ? 'backward' : 'forward']);
      await page.waitForTimeout(45);
    }
    throw Error('Physical walking deadline: ' + JSON.stringify({target, actual: (await state(page)).shipLocal}));
  }
  async function recordAccess(start, id) {
    if (start) {
      await page.evaluate(() => {
        const n = starAgent.navigation;
        const a = __stratumPrimary.access = {active: true, points: [],
          shipFrame: {position: n.shipPosition.toArray(), orientation: n.shipOrientation.toArray()}};
        function record(t) {
          if (!a.active) return;
          const n = starAgent.navigation, p = n.toShipLocal(), surface = n.freighter.surfaceAt(p);
          a.points.push({t, world: n.position.toArray(), local: p.toArray(), source: surface?.source ?? 'terrain',
            floor: surface?.y ?? null, inside: n.insideShip, ramp: n.freighter.snapshot.ramp, mode: n.mode,
            boost: n.boost, jumpHeight: n.jumpHeight, velocity: n.velocity.toArray()});
          requestAnimationFrame(record);
        }
        requestAnimationFrame(record);
      }); return;
    }
    const {points, shipFrame} = await page.evaluate(() => {
      const a = __stratumPrimary.access; a.active = false; return {points: a.points, shipFrame: a.shipFrame};
    });
    const continuity = analyzeStratumAccess(points, shipFrame);
    accessPaths[id] = {points, maxStep: continuity.maxStep, shipFrame, continuity};
    await writeFile(dir + '/access-' + id + '.json', JSON.stringify(accessPaths[id], null, 2));
    expect(points.filter(p => p.source === 'stratum-ramp:aft').length).toBeGreaterThan(10);
    expect(points.every(p => p.mode === 'walk')).toBe(true);
    expect(continuity.offenders, 'Actual ramp travel must obey elapsed-time speed and canonical support').toEqual([]);
  }
  async function brake() {
    await input.hold([]); if (phone) await input.warm(['brake']); await input.hold(['brake']);
    await wait(page, () => starAgent.state.mode === 'flight' && starAgent.state.speed < .045, null, 12000);
    await input.hold([]); await frames(page);
  }
  async function approach(target) {
    const start = await feedback(target); expect(start.distance).toBeGreaterThan(28);
    if (phone) await input.warm(['forward', 'brake']);
    const deadline = Date.now() + 40000;
    while (Date.now() < deadline) {
      const c = await feedback(target); flight.push({...c, phase, action: 'digital-propulsion'});
      if (c.mode !== 'flight' || c.altitude < 7 || c.distance < 22) throw Error('Digital approach envelope reached: ' + JSON.stringify(c));
      if (c.distance < 27.0) {
        await brake(); await aim(target); const end = await feedback(target);
        expect(end.distance).toBeGreaterThan(23); expect(end.distance).toBeLessThan(29);
        expect(distance(start.position, end.position)).toBeGreaterThan(.5); return;
      }
      if (Math.hypot(c.yaw, c.pitch) > .07) {
        await brake(); await aim(target); if (phone) await input.warm(['forward', 'brake']); continue;
      }
      const targetSpeed = Math.min(1.3, Math.max(.35, (c.distance - 26) * .55));
      await input.hold(c.forwardSpeed < targetSpeed - .08 ? ['forward'] : c.speed > targetSpeed + .4 ? ['brake'] : []);
      await page.waitForTimeout(55);
    }
    throw Error('Digital approach deadline: ' + JSON.stringify(await feedback(target)));
  }
  async function saved() {
    const receipt = await page.evaluate(() => starAgent.miningSave);
    return readPracticeMiningSave(receipt);
  }
  async function cargoGate() {
    const report = gates.dialog = {};
    await input.reset(); await input.hold(['mine']); await wait(page, () => starAgent.state.mining.ship.beaming === 2);
    if (phone) report.before = await input.mineReceipt();
    await input.tap('cargo'); await expect(page.locator('#cargo-dialog')).toBeVisible();
    await wait(page, () => starAgent.state.mining.ship.beaming === 0 && !starAgent.state.mining.pending);
    if (!phone) await input.choose('location-stratum-ore');
    expect((await state(page)).containers.target).toBe('stratum-ore');
    await expect(page.locator('#cargo-dialog')).toContainText('Stratum dedicated ore bin');
    await expect(page.getByRole('button', {name: 'Stratum cargo', exact: true})).toBeVisible();
    const realOre = (await state(page)).containers.containers.find(c => c.id === 'stratum-ore').items;
    const largest = Object.entries(realOre).filter(([, quantity]) => quantity > 0).sort((a, b) => b[1] - a[1])[0]?.[0];
    expect(largest).toBeTruthy();
    const slot = page.locator(`[data-from="stratum-ore"][data-item="${largest}"]:visible`);
    for (let i = 0; i < 6 && !await slot.count(); i++) { await input.choose('page-containers-next'); await frames(page); }
    await expect(slot).toBeVisible(); const item = await slot.getAttribute('data-item'), key = await slot.getAttribute('data-controller-key');
    const before = await saved(); await input.choose(key); await input.choose('transfer-one'); const after = await saved();
    const amount = after.pack.items[item] - before.pack.items[item]; expect(amount).toBeGreaterThan(0); expect(amount).toBeLessThanOrEqual(1.000001);
    expect(before.ore.items[item] - after.ore.items[item]).toBeCloseTo(amount, 6); expect(after.supplies.items).toEqual(before.supplies.items);
    report.transfer = {item, amount, before, after}; await shot('06-native-ore-transfer');
    if (phone) { report.opened = await input.mineReceipt(); expect(report.opened.pointer).toBe(report.before.pointer); expect(report.opened.cdpId).toBe(report.before.cdpId); }
    await input.tap('close'); await expect(page.locator('dialog[open]')).toHaveCount(0); await wait(page, () => starAgent.state.enabled);
    await input.repeatMine(); await page.waitForTimeout(400); expect((await state(page)).mining.ship.beaming).toBe(0);
    if (phone) { report.closed = await input.mineReceipt(); expect(report.closed.pointer).toBe(report.before.pointer); expect(report.closed.cdpId).toBe(report.before.cdpId); }
    await input.reset(); await input.hold(['mine']); await wait(page, () => starAgent.state.mining.ship.beaming === 2); await input.hold([]);
    report.result = 'PASS'; report.heldThroughTransferAndClose = true;
  }

  try {
    await page.goto('/?dev=1&intro=0&ship=stratum&start=moon&debug=1&seed=7291');
    await wait(page, () => window.starAgent?.state.ready && starAgent.state.shipAsset === 'ready' && !starAgent.state.transiting, null, 90000);
    let s = await state(page); expect(s.dev).not.toBeNull(); expect(s.shipId).toBe('stratum'); expect(s.mode).toBe('flight');
    expect(s.altitude).toBeGreaterThan(160); expect(s.altitude).toBeLessThan(200); expect(s.powered).toBe(true); expect(s.flightAssist).toBe(true);
    expect(s.multiplayer.connected).not.toBe(true); expect(s.controller.connected).toBe(false);
    const asset = await page.request.get('/models/stratum.glb'); expect(asset.ok()).toBe(true);
    expect(hash(await asset.body())).toBe(beforeIdentity.sources['public/models/stratum.glb']);
    phase = 'native-landing'; await input.tap('land'); await wait(page, () => starAgent.state.autoland || starAgent.state.mode === 'landed');
    await wait(page, () => starAgent.state.mode === 'landed' && starAgent.state.landingGear.progress === 1, null, 55000);
    s = await state(page); expect(distance(s.shipLocal, S.interior.pilotEye)).toBeLessThan(.00001);
    expect(s.lifts.secured).toBe(true); expect(s.mining.activePosition).toHaveLength(3); const target = [...s.mining.activePosition];
    serialization.target = {id: s.mining.activeRock, position: target, revision: s.mining.activeRevision};
    await pilotShot('00-settled-forward-pilot'); await phoneDisplays(); await note('Native landing reaches real gear contact and seated view');
    phase = 'physical-aisle-to-ramp'; await input.tap('interact'); await wait(page, () => starAgent.state.mode === 'walk');
    await walk(S.interior.standingEye); await walk([0, S.interior.standingEye[1], 5.75]); await input.tap('interact');
    await wait(page, () => starAgent.state.lifts.ramp === 1 && starAgent.state.kestrel.rampReady, null, 10000);
    await lookLocal([0, 2.0, 12.2]); await shot('01-deployed-physical-ramp');
    const ramp = [6.35, 7.1, 8.1, 9.2, 10.3, 11.3, 12.1, 13.2].map(z => [0, (z < 7 ? S.interior.floorY : stratumRampFloor(z) ?? 0) + 1.75, z]);
    phase = 'native-ramp-to-terrain'; await recordAccess(true, 'out'); for (const point of ramp) await walk(point); await recordAccess(false, 'out');
    s = await state(page); expect(s.insideShip).toBe(false); expect(s.shipLocal[2]).toBeGreaterThan(12.8); expect(s.shipLocal[1]).toBeGreaterThan(1.60); expect(s.shipLocal[1]).toBeLessThan(1.90);
    await lookLocal([0, S.interior.standingEye[1], 5.75]); await shot('02-actual-terrain-ramp-view'); await note('Continuous physical ramp egress onto canonical terrain');
    phase = 'native-ramp-return'; await recordAccess(true, 'in'); for (const point of [...ramp].reverse().slice(1)) await walk(point);
    await walk([0, S.interior.standingEye[1], 5.75]); await recordAccess(false, 'in'); await input.tap('interact');
    await wait(page, () => starAgent.state.lifts.secured && starAgent.state.kestrel.secured, null, 10000);
    await walk(S.interior.standingEye); await input.tap('interact'); await wait(page, () => starAgent.state.mode === 'landed');
    await pilotShot('03-settled-pilot-return'); await note('Ramp stowed after real return to pilot chair');
    phase = 'launch-and-real-gear'; await input.tap('land'); await wait(page, () => starAgent.state.mode === 'flight'); await brake();
    if (phone) await shipCommand('gear'); else await input.tap('gear');
    await wait(page, () => starAgent.state.landingGear.progress === 0 && starAgent.state.landingGear.visual === 0, null, 6000);
    phase = 'native-flight-aim'; await aim(target); phase = 'digital-short-approach'; await approach(target);
    await note('Native look and small digital thrust pulses reach the existing outcrop');
    phase = 'native-twin-mining'; const before = await state(page); serialization.before = await saved();
    await input.hold(['mine']); await wait(page, mass => starAgent.state.mining.ship.beaming === 2 && starAgent.state.mining.ship.mass > mass + .02, before.mining.ship.mass, 25000);
    const live = await state(page); expect(live.mining.ship.beams).toHaveLength(2); expect(live.mining.ship.hitIds).toHaveLength(2);
    for (const beam of live.mining.ship.beams) {
      expect(beam.hit).toBe(true); expect(beam.occluded).toBe(false); expect(beam.rockId).toBeTruthy();
      const a = [beam.start.x, beam.start.y, beam.start.z], b = [beam.end.x, beam.end.y, beam.end.z];
      expect(distance(a, b)).toBeLessThanOrEqual(40.0001); expect(distance(a, live.position)).toBeGreaterThan(3);
    }
    serialization.beams = live.mining.ship.beams; await shot('04-native-twin-cutters'); await page.waitForTimeout(1500); await input.hold([]);
    await wait(page, () => starAgent.state.mining.ship.beaming === 0 && !starAgent.state.mining.pending); serialization.mined = await saved();
    expect(serialization.mined.oreLimit).toBe(384); expect(mass(serialization.mined.ore.items)).toBeGreaterThan(mass(serialization.before.ore.items) + .02);
    expect(serialization.mined.pack.items).toEqual(serialization.before.pack.items); expect(serialization.mined.supplies.items).toEqual(serialization.before.supplies.items);
    const hit = live.mining.ship.hitIds[0]; expect(hit === ROCK_ID ? serialization.mined.revision > serialization.before.revision : (serialization.mined.rocks[hit] ?? 0) > (serialization.before.rocks[hit] ?? 0)).toBe(true);
    if (!phone) {
      await input.tap('camera'); await wait(page, () => starAgent.state.camera.mode === 'external');
      await input.hold(['mine']); await wait(page, () => starAgent.state.mining.ship.beaming === 2); await shot('05-native-external-cutters'); await input.hold([]); await cockpit();
    }
    await note('Twin real hits commit voxel cuts and Stratum ore to practice-memory serialized bytes');
    phase = 'native-ore-dialog-and-neutral'; await cargoGate(); await note('Visible ore transfer conserves the containers in actual practice-memory save bytes');
    phase = 'native-tab-focus-neutral'; await nativeFocusNeutral(page, input, gates.focus = {});
    phase = 'actual-pilot-control-return'; await input.reset(); await brake(); await wait(page, () => !starAgent.state.mining.pending); serialization.final = await saved();
    s = await state(page); expect(s.mode).toBe('flight'); expect(s.powered).toBe(true); expect(s.enabled).toBe(true); expect(s.lifts.secured).toBe(true); expect(s.mining.ship.beaming).toBe(0);
    await pilotShot('07-final-pilot-ore-status'); await note('Actual input returns to powered flight after native focus and inventory');
    const native = await page.evaluate(() => ({keys: __stratumPrimary.keys, events: __stratumPrimary.events}));
    if (phone) { expect(native.keys).toHaveLength(0); expect(native.events.some(e => e.key === 'viewport' && e.type === 'pointerdown')).toBe(true); }
    else { expect(native.events).toHaveLength(0); expect(native.keys.some(e => e.code === 'KeyW')).toBe(true); expect(native.keys.every(e => e.trusted)).toBe(true); }
    expect(native.events.every(e => e.trusted)).toBe(true); expect(errors).toEqual([]); expect(warnings).toEqual([]); expect(requests).toEqual([]); complete = true;
  } catch (e) {
    failed = {phase, message: e.message}; await shot('failure-' + phase).catch(() => {}); throw e;
  } finally {
    await input.reset().catch(() => {}); await shot('last-frame').catch(() => {});
    const afterIdentity = await identity(), stable = JSON.stringify(beforeIdentity.sources) === JSON.stringify(afterIdentity.sources)
      && JSON.stringify(beforeIdentity.fixtures) === JSON.stringify(afterIdentity.fixtures);
    if (!stable) { complete = false; failed ??= {phase: 'identity', message: 'Source/asset/fixture changed during gameplay'}; }
    const diagnostics = await page.evaluate(() => ({native: {...__stratumPrimary, pointers: [...__stratumPrimary.pointers]},
      dialogs: [...document.querySelectorAll('dialog[open]')].map(d => ({id: d.id, text: d.innerText})),
      gpu: (() => { const g = document.querySelector('#viewport')?.getContext('webgl2'), e = g?.getExtension('WEBGL_debug_renderer_info');
        return g ? {renderer: g.getParameter(e ? e.UNMASKED_RENDERER_WEBGL : g.RENDERER), buffer: [g.drawingBufferWidth, g.drawingBufferHeight]} : null; })(),
    })).catch(() => null);
    await writeFile(dir + '/journey.json', JSON.stringify({result: complete ? 'PASS' : 'FAIL', phase, failed, mode: testInfo.project.name,
      input: phone ? 'Native CDP released-points touch, no keyboard/mouse/gamepad input' : 'Native keyboard controls and Tab/Enter inventory, no pointer/gamepad input',
      browser: browser.version(), viewport: page.viewportSize(), beforeIdentity, afterIdentity, stable, errors, warnings, requests,
      milestones, accessPaths, flight, gates, serialization, sightlines, inputLog: input.log, diagnostics, final: await state(page).catch(() => null),
      limits: ['No physical keyboard/controller/touchscreen hardware claim', 'Actual practice-memory bytes are re-read and parsed without mutation; no browser-localStorage or dev-flight reload persistence claim',
        'Actual screenshots/video and MFD readability require visual review; no automatic art score', 'No multiplayer or FPS claim'], performanceClaim: false}, null, 2));
    if (input.session) await input.session.detach().catch(() => {});
    expect(stable, 'Keep production source, model and fixture frozen for the actual journey').toBe(true);
  }
});
