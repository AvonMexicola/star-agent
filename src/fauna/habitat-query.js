const unit = a => {
  if (!a || a.length !== 3 || !a.every(Number.isFinite)) return null;
  const n = Math.hypot(...a);
  return n > 0 && Number.isFinite(n) ? a.map(v => v / n) : null;
};
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const distanceSquared = (a, b) => (a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2;
function hash(x, y, z, seed, salt) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1442695041) ^ seed ^ Math.imul(salt, 1013904223);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
/** Shared bounded sampler; adapters supply the canonical terrain and frame. */
export function createHabitatQueries(config, planet) {
  function dry(d, sample) {
    return planet.suitable(d, sample);
  }

  /** Canonical terrain only; null means unsuitable. Eight surrounding samples
   * reject lava/biome boundaries and slopes at the selected footprint radii.
   * Returned positions are Aeon-centred doubles; normals are world unit vectors.
   * This local suitability check is not swept collision or a path planner. */
  function sampleFootprint(bodyDirection, radii) {
    const d = unit(bodyDirection);
    if (!d || !planet.directionSuitable(d)) return null;
    const center = planet.sample(...d);
    if (!dry(d, center)) return null;
    const east = unit(cross(Math.abs(d[1]) < .9 ? [0, 1, 0] : [1, 0, 0], d));
    const north = cross(d, east), gradients = [];
    let slope = 0;
    for (const metres of radii) {
      for (const tangent of [east, north]) {
        const heights = [];
        for (const sign of [-1, 1]) {
          const q = unit(d.map((v, i) => v + sign * tangent[i] * metres / (planet.radius + center.height)));
          const sample = planet.sample(...q);
          if (!dry(q, sample)) return null;
          heights.push(sample.height);
          slope = Math.max(slope, Math.abs(sample.height - center.height) / metres);
        }
        gradients.push((heights[1] - heights[0]) / (2 * metres));
      }
    }
    slope = Math.max(slope, Math.hypot(gradients[0], gradients[1]), Math.hypot(gradients[2], gradients[3]));
    if (slope > config.maxSlope) return null;
    const bodyNormal = unit(d.map((v, i) => v - east[i] * gradients[0] - north[i] * gradients[1]));
    const offset = planet.fromBody(...d.map(v => v * (planet.radius + center.height)));
    return { bodyDirection: d, bodyNormal, normal: planet.fromBody(...bodyNormal),
      position: offset.map((v, i) => v + planet.position[i]), height: center.height,
      slope, region: center.region, activity: center.activity, fresh: center.fresh };
  }
  // Broad spawn clearance is deliberately separate from body-sized locomotion:
  // a distant boulder must not make an otherwise safe next footstep impassable.
  const sampleHabitat = direction => sampleFootprint(direction, config.footprintRadii);
  const sampleFooting = direction => sampleFootprint(direction, config.footingRadii ?? config.footprintRadii);

  /** Deterministic nearby population, with no mutable RNG, cache or traversal state.
   * A Cartesian terrain-frame shell lattice avoids latitude/pole/cube-face seams.
   * Cells whose centres lie within 60m of the reference sphere get one jittered
   * candidate, then project onto the canonical surface. IDs/anchors never follow
   * the player. Call at a streaming cadence, not for every animated joint/frame.
   * Radius is an actual 3D world distance and must be in (0,500]. The nearest six
   * may change at a streaming boundary; callers own persistence/death/animation.
   * Optional diagnostics counts visited cells for profiling/tests, not placement.
   */
  function enumerateSpawns(worldPosition, { seed = config.defaultSeed,
    radius = config.defaultRadius, diagnostics } = {}) {
    if (!Number.isFinite(radius) || radius <= 0 || radius > config.maxRadius) throw new RangeError('Fauna radius must be in (0,500] metres');
    if (!Number.isInteger(seed) || !Number.isSafeInteger(seed)) throw new TypeError('Fauna seed must be a safe integer');
    const p = Array.isArray(worldPosition) ? worldPosition : [worldPosition?.x, worldPosition?.y, worldPosition?.z];
    if (p.length !== 3 || !p.every(Number.isFinite)) throw new TypeError('Fauna position must contain three finite world coordinates');
    if (diagnostics) Object.assign(diagnostics, { visitedCells: 0, terrainCandidates: 0, suitableCandidates: 0 });
    const offset = p.map((v, i) => v - planet.position[i]), length = Math.hypot(...offset);
    // Conservative shell guard includes negative relief and highest peaks;
    // actual surface-distance filtering below excludes high flight and other bodies.
    if (length < planet.radius - 20_000 || length > planet.radius + planet.maxHeight + config.maxRadius) return [];
    const d = unit(planet.toBody(...offset)), q = d.map(v => v * planet.radius);
    const projectedRadius = radius * planet.radius / (planet.radius - 20_000);
    if (!planet.nearHabitat(d, projectedRadius / planet.radius)) return [];
    const cell = config.cellSize, reach = projectedRadius + cell * 2;
    const lo = q.map(v => Math.floor((v - reach) / cell)), hi = q.map(v => Math.floor((v + reach) / cell));
    const result = [], populationSeed = seed >>> 0;
    for (let x = lo[0]; x <= hi[0]; x++) for (let y = lo[1]; y <= hi[1]; y++) for (let z = lo[2]; z <= hi[2]; z++) {
      if (diagnostics) diagnostics.visitedCells++;
      const center = [(x + .5) * cell, (y + .5) * cell, (z + .5) * cell];
      if (Math.abs(Math.hypot(...center) - planet.radius) > cell / 2 || hash(x, y, z, populationSeed, 0) >= config.density) continue;
      const direction = unit(center.map((v, i) => v + (hash(x, y, z, populationSeed, i + 1) - .5) * cell * .7));
      // Safe cheap angular rejection before the relatively costly terrain sampler.
      if (distanceSquared(direction.map(v => v * planet.radius), q) > projectedRadius ** 2) continue;
      if (diagnostics) diagnostics.terrainCandidates++;
      const habitat = sampleHabitat(direction);
      if (!habitat || distanceSquared(habitat.position, p) > radius ** 2) continue;
      if (diagnostics) diagnostics.suitableCandidates++;
      result.push({ id: `${config.id}-v${config.version}:${populationSeed}:${x},${y},${z}`,
        position: habitat.position, normal: habitat.normal, bodyDirection: habitat.bodyDirection,
        heading: hash(x, y, z, populationSeed, 4) * Math.PI * 2,
        phase: hash(x, y, z, populationSeed, 5), seed: Math.floor(hash(x, y, z, populationSeed, 6) * 4294967296) });
    }
    return result.sort((a, b) => distanceSquared(a.position, p) - distanceSquared(b.position, p) || a.id.localeCompare(b.id)).slice(0, config.maxSpawns);
  }

  return { sampleHabitat, sampleFooting, enumerateSpawns };
}
