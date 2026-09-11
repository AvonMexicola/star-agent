import * as THREE from 'three';
import { STRATUM_LAYOUT as L } from './stratum-layout.js';
import { createRoverPower } from './rover-power.js';
import { createWeaponTarget } from './effects/weapon-target.js';
import { Plasma } from './effects/energy-effects.js';

// Same accepted per-head cut rate/power cycle as the rover; a separate ship bin.
export const SHIP_MINING_PROFILE = Object.freeze({ range: 40, continuousSeconds: 120,
  rechargeSeconds: 30, cutRatePerBeam: .22, destination: 'stratum-ore' });

const forward = new THREE.Vector3(0, 0, -1);
const finiteVector = v => v?.isVector3 && [v.x, v.y, v.z].every(Number.isFinite);
const finiteQuaternion = q => q?.isQuaternion && [q.x, q.y, q.z, q.w].every(Number.isFinite) && Math.abs(q.lengthSq() - 1) < 1e-4;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

/** Actual rigid ship triangles, including back faces and hidden cockpit meshes.
 * Proxies share geometry only: no material/visibility/pose mutation of the ship.
 * Rays are mapped into its current render frame, so a late floating-origin
 * render update cannot change the physical result from authoritative nav doubles.
 */
function createShipObstruction() {
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const ray = new THREE.Raycaster(); ray.near = .001;
  let cachedShip = null, proxies = [];
  return {
    cast(ship, muzzle, pose, range) {
      if (cachedShip !== ship) {
        cachedShip = ship; proxies = [];
        ship.traverse(node => {
          if (node.isMesh) proxies.push({ source: node, mesh: new THREE.Mesh(node.geometry, material) });
        });
      }
      ship.updateWorldMatrix(true, true);
      const inverse = ship.matrixWorld.clone().invert();
      const renderStart = muzzle.position.clone().applyMatrix4(ship.matrixWorld);
      const renderEnd = muzzle.position.clone().add(muzzle.direction).applyMatrix4(ship.matrixWorld);
      const direction = renderEnd.sub(renderStart), scale = direction.length();
      ray.set(renderStart, direction.normalize()); ray.far = range * scale;
      for (const { source, mesh } of proxies) mesh.matrixWorld.copy(source.matrixWorld);
      const wall = ray.intersectObjects(proxies.map(x => x.mesh), false)[0];
      if (!wall) return null;
      const local = wall.point.clone().applyMatrix4(inverse);
      const normal = wall.face.normal.clone().transformDirection(wall.object.matrixWorld)
        .transformDirection(inverse).applyQuaternion(pose.quaternion).normalize();
      return { kind: 'ship', distance: muzzle.position.distanceTo(local),
        point: local.applyQuaternion(pose.quaternion).add(pose.position), normal };
    },
    dispose() { proxies = []; cachedShip = null; material.dispose(); },
  };
}

/** Twin offline cutters. Call input() once per game frame with the aggregate
 * physical trigger, then update(); do not pass a second polled gamepad. `armed`
 * must be false for suppressed controller samples. A missing sample, context or
 * device change requires a fresh neutral sample before either head can fire.
 * context() supplies {online, blocked, inputContext}; nav owns cockpit/power.
 * This module creates no input listeners, UI, inventory or resource authority.
 */
export function createShipMining({ scene, nav, mining, getShip, context = () => ({}),
  effects = null, targetRay = createWeaponTarget({ nav, mining }),
  profile = SHIP_MINING_PROFILE, makeBeam = () => new Plasma(scene) }) {
  if (![profile.continuousSeconds, profile.rechargeSeconds, profile.cutRatePerBeam, profile.range].every(x => Number.isFinite(x) && x > 0)) {
    throw new Error('Ship mining requires finite positive power, rate and range');
  }
  const range = Math.min(40, profile.range), rate = Math.min(.35, profile.cutRatePerBeam);
  const destination = SHIP_MINING_PROFILE.destination;
  const power = createRoverPower({ mining: profile });
  const beams = [makeBeam(0), makeBeam(1)], obstruction = createShipObstruction();
  const state = { eligible: false, reason: 'release-required', armed: false, active: false,
    charge: 1, depleted: false, cutSeconds: 0, range, destination, aim: [], beams: [], hitIds: [] };
  let sample = null, disposed = false, clock = 0, previousShip = null, previousMode = null;
  let previousSource = null, previousContext = null, touched = new Set();

  function dropBudgets(keep = new Set()) {
    for (const rock of touched) if (!keep.has(rock) && rock.budgetDestination === destination) rock.budget = 0;
    touched = keep; // Never cancel submitted worker jobs or touch another tool's budget.
  }
  function stop() {
    state.active = false; state.beams = []; state.hitIds = [];
    for (const beam of beams) beam.mesh.visible = false;
    dropBudgets();
  }
  function clear(reason = 'release-required') {
    sample = null; state.armed = false; state.reason = reason; stop();
  }
  function eligibility(ship, ctx) {
    if (disposed) return 'disposed';
    if (nav.shipId !== L.id || !['landed', 'flight'].includes(nav.mode) || nav.cabinFlight || nav.roverOccupied || nav.berthRest) return 'cockpit-only';
    if (ctx.online) return 'offline-only';
    if (!nav.powered) return 'power-off';
    if (!nav.enabled || !nav.focused || globalThis.document?.hidden || globalThis.document?.querySelector('dialog[open]') || ctx.blocked) return 'input-blocked';
    if (nav.travel || nav.openingActive || nav.autoland || nav.stationLift) return 'navigation-busy';
    if (nav.doorOpen || nav.doorProgress > .001) return 'ramp-open';
    if (ship?.userData?.assetStatus !== 'ready' || !ship?.muzzle || !ship?.applyPose) return 'asset-not-ready';
    if (ship.snapshot?.().secured === false) return 'ramp-open';
    if (!mining.store || mining.store.blocked || !(mining.store.freeFor(destination) > .001)) return 'ore-bin-unavailable';
    return null;
  }
  function shipPose() {
    const quaternion = nav.shipPosition ? nav.shipOrientation : nav.orientation;
    if (!finiteQuaternion(quaternion) || !finiteVector(nav.position) || !finiteQuaternion(nav.orientation)) return null;
    if (nav.shipPosition) return finiteVector(nav.shipPosition) ? { position: nav.shipPosition.clone(), quaternion: quaternion.clone() } : null;
    const eye = nav.layout?.seatEye;
    if (!Array.isArray(eye) || eye.length !== 3 || !eye.every(Number.isFinite)) return null;
    return { position: nav.position.clone().sub(new THREE.Vector3(...eye).applyQuaternion(quaternion)), quaternion: quaternion.clone() };
  }
  function muzzles(ship) {
    const result = [0, 1].map(i => ship.muzzle(i, { local: true }));
    return result.every((m, i) => m?.name === L.mining.booms[i].muzzle && finiteVector(m.position) && finiteVector(m.direction) && m.direction.lengthSq() > .99 && m.direction.lengthSq() < 1.01) ? result : null;
  }
  function boundedHit(hit, start) {
    return hit && finiteVector(hit.point) && Number.isFinite(hit.distance) && hit.distance >= 0 && hit.distance <= range && hit.point.distanceTo(start) <= range + 1e-5 ? hit : null;
  }

  return {
    state,
    input({ trigger = false, armed = true, source = 'primary' } = {}) {
      if (!disposed) sample = { trigger: Boolean(trigger), armed: Boolean(armed), source };
    },
    clear,
    get available() { return !eligibility(getShip(), context() ?? {}); },
    get audioMining() {
      const beam = state.beams[0];
      return beam ? { active: state.active, start: beam.start, end: beam.end, hit: beam.hit, normal: beam.normal } : null;
    },
    update(dt, origin) {
      if (disposed) return state;
      const input = sample; sample = null;
      const ship = getShip(), ctx = context() ?? {}, pose = shipPose();
      let reason = eligibility(ship, ctx);
      if (!reason && (!pose || !finiteVector(origin) || !Number.isFinite(dt) || dt < 0)) reason = 'invalid-frame';
      const contextChanged = ship !== previousShip || nav.mode !== previousMode || input?.source !== previousSource || ctx.inputContext !== previousContext;
      previousShip = ship; previousMode = nav.mode; previousSource = input?.source; previousContext = ctx.inputContext;
      if (reason || contextChanged || !input?.armed) state.armed = false;
      if (!reason && input?.armed && !input.trigger) state.armed = true;
      state.eligible = !reason;
      const step = Number.isFinite(dt) ? clamp(dt, 0, .1) : 0;
      clock += step;
      if (reason) {
        state.reason = reason; stop();
        power.step(0, { trigger: true, allowed: false });
        return state;
      }
      let tips = muzzles(ship);
      if (!tips) { state.eligible = false; clear('muzzle-unavailable'); return state; }
      const sightDirection = forward.clone().applyQuaternion(nav.orientation).normalize();
      const reachOrigin = tips[0].position.clone().add(tips[1].position).multiplyScalar(.5).applyQuaternion(pose.quaternion).add(pose.position);
      mining.inspectTarget?.(nav.position, sightDirection, range, reachOrigin);
      const sight = boundedHit(targetRay(nav.position, sightDirection, origin, range), nav.position);
      const aimTarget = (sight?.point.clone() ?? nav.position.clone().addScaledVector(sightDirection, range))
        .sub(pose.position).applyQuaternion(pose.quaternion.clone().invert());
      state.aim = L.mining.booms.map(boom => {
        const delta = aimTarget.clone().sub(new THREE.Vector3(...boom.pivot));
        return { yaw: clamp(Math.atan2(-delta.x, -delta.z), -L.mining.yawLimit, L.mining.yawLimit),
          pitch: clamp(Math.atan2(delta.y, Math.hypot(delta.x, delta.z)), L.mining.pitchMin, L.mining.pitchMax) };
      });
      ship.applyPose({ aim: state.aim });
      tips = muzzles(ship); // Never replace a clamped head's actual direction with the sight ray.
      if (!tips) { state.eligible = false; clear('muzzle-unavailable'); return state; }
      const before = power.state.cutSeconds;
      power.step(step, { trigger: input?.trigger ?? true, allowed: state.armed });
      const cutDt = power.state.cutSeconds - before;
      Object.assign(state, { charge: power.state.charge, depleted: power.state.depleted, cutSeconds: power.state.cutSeconds });
      state.reason = !state.armed ? 'release-required' : power.state.depleted && !cutDt ? 'depleted' : cutDt ? 'cutting' : 'ready';
      if (!(cutDt > 0)) { stop(); return state; }
      state.active = true; state.beams = []; state.hitIds = [];
      const current = new Set();
      for (let i = 0; i < 2; i++) {
        const start = tips[i].position.clone().applyQuaternion(pose.quaternion).add(pose.position);
        const direction = tips[i].direction.clone().applyQuaternion(pose.quaternion).normalize();
        let hit = boundedHit(targetRay(start, direction, origin, range), start);
        const wall = obstruction.cast(ship, tips[i], pose, hit?.distance ?? range);
        if (wall && (!hit || wall.distance <= hit.distance + 1e-5)) hit = wall;
        const end = hit?.point.clone() ?? start.clone().addScaledVector(direction, range);
        beams[i].set(start, end, .045, origin, clock, 1);
        state.beams.push({ start, end, direction, hit: Boolean(hit), normal: hit?.normal?.clone(),
          occluded: Boolean(hit && !hit.rock), rockId: hit?.rock?.rockId ?? null });
        if (hit?.rock) {
          current.add(hit.rock); state.hitIds.push(hit.rock.rockId);
          mining.onMine({ point: hit.point.clone(), normal: hit.normal?.clone(), target: hit.rock,
            dt: cutDt, rate, destination, direction: direction.clone() });
          if (effects) effects.spray(hit.point, hit.normal ?? direction.clone().negate(), effects.budget(`ship-mine-${i}`, 35, cutDt), { color: 0xffad62, speed: 1.8, size: .022 });
        }
      }
      dropBudgets(current);
      return state;
    },
    dispose() {
      if (disposed) return;
      clear('disposed'); state.eligible = false; disposed = true;
      obstruction.dispose(); for (const beam of beams) beam.dispose();
    },
  };
}
