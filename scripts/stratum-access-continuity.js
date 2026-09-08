import {Quaternion, Vector3} from 'three';
import {SHIP_LAYOUT} from '../src/boarding.js';
import {bodyAt, bodyAltitude, bodyOffset, bodySurfacePoint} from '../src/celestial.js';
import {STRATUM_LAYOUT as S, stratumRampFloor} from '../src/stratum-layout.js';

// These fixtures walk, without boost/jump, beside a stationary landed Stratum.
// main.frame caps one RAF update at .2 s and subdivides it at <= .025 s.
// Navigation lerps velocity toward 4.5 m/s outside and 2.3 inside. Cabin entry
// retains some ramp velocity, so 2.3 is not an instantaneous speed ceiling.
// RAF timestamps are the same clock main.frame uses: no extra timing allowance.
// 10 micrometres covers double-precision round trips at Selene's 24 Mm origin;
// it is not an allowance for a visible contact gap or a render-frame teleport.
export const STRATUM_ACCESS_LIMITS = Object.freeze({
  maxWalkSpeed: 4.5, cabinTargetSpeed: 2.3, frameDtCap: .2, maxSubstep: .025,
  numericTolerance: 1e-5, eyeHeight: SHIP_LAYOUT.eyeHeight,
  rampRise: S.interior.floorY, rampRun: S.ramp.run,
  rampSlope: S.interior.floorY / S.ramp.run,
});

const vector = (a, length = 3) => Array.isArray(a) && a.length === length && a.every(Number.isFinite);
const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));

/** Read-only analysis of recorded native actions; never repairs or resamples a path. */
export function analyzeStratumAccess(points, shipFrame) {
  const L = STRATUM_ACCESS_LIMITS, tolerance = L.numericTolerance;
  const result = {ok: false, limits: L, sampleCount: points?.length ?? 0, sourceCounts: {},
    maxStep: 0, maxHorizontalStep: 0, maxHorizontalSpeed: 0, maxWallClockSpeed: 0,
    maxVerticalStep: 0, maxSupportError: 0, maxWorldLocalError: 0, minDt: null, maxDt: 0,
    elapsedSeconds: 0, simulatedSeconds: 0, cappedFrames: 0, samples: [], pairs: [], offenders: []};
  const issue = (kind, details) => result.offenders.push({kind, ...details});
  if (!Array.isArray(points) || points.length < 2) {
    issue('insufficient-samples', {count: points?.length ?? 0}); return result;
  }
  if (!vector(shipFrame?.position) || !vector(shipFrame?.orientation, 4)
      || Math.abs(Math.hypot(...shipFrame.orientation) - 1) > 1e-10) {
    issue('invalid-fixed-ship-frame', {shipFrame}); return result;
  }
  const origin = new Vector3(...shipFrame.position), rotation = new Quaternion(...shipFrame.orientation), inverse = rotation.clone().invert();
  const localToWorld = local => new Vector3(...local).applyQuaternion(rotation).add(origin);
  const worldToLocal = world => world.clone().sub(origin).applyQuaternion(inverse);
  const groundEye = world => {
    const body = bodyAt(world), direction = bodyOffset(world, body).normalize();
    return worldToLocal(bodySurfacePoint(direction, body, L.eyeHeight)).y;
  };

  for (const [index, p] of points.entries()) {
    if (!Number.isFinite(p?.t) || !vector(p?.world) || !vector(p?.local)) {
      issue('invalid-sample', {index, t: p?.t}); result.samples.push(null); continue;
    }
    result.sourceCounts[p.source] = (result.sourceCounts[p.source] ?? 0) + 1;
    const world = new Vector3(...p.world), [x, y, z] = p.local;
    const frameError = world.distanceTo(localToWorld(p.local));
    result.maxWorldLocalError = Math.max(result.maxWorldLocalError, frameError);
    if (frameError > tolerance) issue('world-local-disagreement', {index, t: p.t, error: frameError, limit: tolerance});
    if (p.mode !== 'walk') issue('non-walking-mode', {index, t: p.t, mode: p.mode});
    if (p.boost === true || p.jumpHeight > tolerance) issue('non-walking-input', {index, t: p.t, boost: p.boost, jumpHeight: p.jumpHeight});
    // Select the access surface from horizontal geometry, never from the
    // sample's advertised source or its height. A valid terrain point below
    // the middle of a ramp is not a valid step along this no-jump access route.
    // Do not enlarge these footprints: terrain immediately beyond the exact
    // tip remains terrain, however small the crossing step.
    const b = S.interior, rampFloor = stratumRampFloor(z);
    const onDeck = x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ;
    const onRamp = Math.abs(x) <= S.ramp.halfWidth && rampFloor !== null;
    const canonicalSource = onDeck ? 'stratum-deck' : onRamp ? 'stratum-ramp:aft' : 'terrain';
    if (p.source !== canonicalSource) issue('noncanonical-support-source', {index, t: p.t, source: p.source, expected: canonicalSource, local: p.local});
    const groundEyeY = groundEye(world);
    let expectedEyeY = null, floor = null, error = null;
    if (canonicalSource === 'stratum-deck') {
      floor = b.floorY; expectedEyeY = floor + L.eyeHeight; error = Math.abs(y - expectedEyeY);
    } else if (canonicalSource === 'stratum-ramp:aft') {
      floor = rampFloor;
      if (p.ramp !== 1)
        issue('unavailable-ramp-support', {index, t: p.t, local: p.local, ramp: p.ramp});
      expectedEyeY = floor + L.eyeHeight; error = Math.abs(y - expectedEyeY);
    } else {
      // Reuse the authoritative body sampler; never assume the tangent pad is a
      // second flat floor. This also checks the original traces without floor metadata.
      expectedEyeY = groundEyeY;
      error = Math.abs(bodyAltitude(world) - L.eyeHeight);
    }
    if (error !== null) {
      result.maxSupportError = Math.max(result.maxSupportError, error);
      if (error > tolerance) issue('off-support', {index, t: p.t, source: p.source, eyeY: y, expectedEyeY, error, limit: tolerance});
    }
    if (floor !== null && p.floor !== undefined && (p.floor === null || !Number.isFinite(p.floor) || Math.abs(p.floor - floor) > tolerance))
      issue('reported-floor-disagreement', {index, t: p.t, reported: p.floor, expected: floor});
    result.samples.push({index, t: p.t, source: p.source, canonicalSource, expectedEyeY, groundEyeY, supportError: error, worldLocalError: frameError});
  }

  for (let index = 1; index < points.length; index++) {
    if (!result.samples[index - 1] || !result.samples[index]) continue;
    const a = points[index - 1], b = points[index], dt = (b.t - a.t) / 1000;
    if (!(dt > 0)) { issue('non-increasing-timestamp', {from: index - 1, to: index, t0: a.t, t1: b.t}); continue; }
    const simulatedDt = Math.min(dt, L.frameDtCap), horizontal = Math.hypot(b.local[0] - a.local[0], b.local[2] - a.local[2]);
    const worldStep = distance(a.world, b.world), vertical = b.local[1] - a.local[1];
    const horizontalLimit = L.maxWalkSpeed * simulatedDt + tolerance;
    const expectedA = result.samples[index - 1].expectedEyeY, expectedB = result.samples[index].expectedEyeY;
    const expectedRise = expectedA === null || expectedB === null ? null : expectedB - expectedA;
    const verticalError = expectedRise === null ? null : Math.abs(vertical - expectedRise);
    const canonicalSources = [result.samples[index - 1].canonicalSource, result.samples[index].canonicalSource];
    let transition = null, tipGap = 0;
    if (canonicalSources[0] !== canonicalSources[1]) {
      const has = source => canonicalSources.includes(source);
      const boundaryZ = has('stratum-deck') && has('stratum-ramp:aft') ? S.ramp.hinge[2]
        : has('stratum-ramp:aft') && has('terrain') ? S.ramp.endZ : null;
      const dz = b.local[2] - a.local[2], u = boundaryZ === null || dz === 0 ? null : (boundaryZ - a.local[2]) / dz;
      const crossingX = u === null ? null : a.local[0] + (b.local[0] - a.local[0]) * u;
      const allowed = u !== null && u >= 0 && u <= 1 && Math.abs(crossingX) <= S.ramp.halfWidth;
      transition = {boundaryZ, crossingX, fraction: u, allowed};
      if (!allowed) issue('invalid-access-transition', {from: index - 1, to: index, t0: a.t, t1: b.t, canonicalSources, transition});
      if (allowed && boundaryZ === S.ramp.endZ) {
        // Measure the real tangent-pad/radial-ground join, not a generic step
        // allowance. This sub-mm gap can matter even on a micrometre tip crossing.
        tipGap = Math.abs(L.eyeHeight - groundEye(localToWorld([crossingX, L.eyeHeight, boundaryZ])));
      }
    }
    // Independent of advertised supports and expectedRise: ramp grade times
    // actual horizontal travel, canonical ground variation, and only the
    // measured tip join. A ground/ramp source swap cannot license a vertical hop.
    const groundRise = Math.abs(result.samples[index].groundEyeY - result.samples[index - 1].groundEyeY);
    const verticalLimit = L.rampSlope * horizontal + groundRise + tipGap + 2 * tolerance;
    const pair = {from: index - 1, to: index, t0: a.t, t1: b.t, dt, simulatedDt,
      substeps: Math.ceil(simulatedDt / L.maxSubstep), sources: [a.source, b.source],
      horizontal, horizontalLimit, horizontalSpeed: horizontal / simulatedDt, wallClockSpeed: horizontal / dt,
      worldStep, vertical, verticalLimit, groundRise, tipGap, transition, canonicalSources,
      expectedRise, verticalError, verticalTolerance: 2 * tolerance};
    result.pairs.push(pair);
    result.minDt = result.minDt === null ? dt : Math.min(result.minDt, dt); result.maxDt = Math.max(result.maxDt, dt);
    result.elapsedSeconds += dt; result.simulatedSeconds += simulatedDt; if (dt > L.frameDtCap) result.cappedFrames++;
    result.maxStep = Math.max(result.maxStep, worldStep); result.maxHorizontalStep = Math.max(result.maxHorizontalStep, horizontal);
    result.maxHorizontalSpeed = Math.max(result.maxHorizontalSpeed, pair.horizontalSpeed);
    result.maxWallClockSpeed = Math.max(result.maxWallClockSpeed, pair.wallClockSpeed);
    result.maxVerticalStep = Math.max(result.maxVerticalStep, Math.abs(vertical));
    if (horizontal > horizontalLimit) issue('excess-horizontal-travel', pair);
    if (Math.abs(vertical) > verticalLimit) issue('excess-vertical-travel', pair);
    if (verticalError !== null && verticalError > pair.verticalTolerance) issue('noncanonical-support-rise', pair);
  }
  result.ok = result.offenders.length === 0;
  return result;
}
