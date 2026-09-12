// Dumps reference Aeon surface samples from the browser generator so the C++
// port can be checked against it. One line per sample:
//   x y z height rockRelief moisture biomeIndex r g b
// Numbers use JavaScript's shortest round-trip form, which strtod restores exactly.
//
//   node dump-aeon-samples.mjs --seed 7291 --count 20000 > build/aeon-7291.txt
import { setPlanetSeed } from '../../src/generation.js';
import { terrainSample, moisture, biomeAt, surfaceColor, cubeDirection } from '../../src/world.js';

const args = Object.fromEntries(process.argv.slice(2).join(' ').split('--').filter(Boolean).map(s => { const [k, v] = s.trim().split(/\s+/); return [k, v]; }));
const seed = Number(args.seed ?? 7291), count = Number(args.count ?? 20000);
setPlanetSeed(seed);

const BIOMES = ['POLAR ICE', 'OPEN OCEAN', 'COASTLAND', 'ALPINE HIGHLANDS', 'TEMPERATE FOREST', 'GRASSLAND'];
let state = (0x9e3779b9 ^ seed) >>> 0 || 1;
function rnd() { state ^= state << 13; state >>>= 0; state ^= state >>> 17; state ^= state << 5; state >>>= 0; return state / 4294967296; }
function sphere() { // Marsaglia: uniform on the unit sphere
  let u, v, s; do { u = rnd() * 2 - 1; v = rnd() * 2 - 1; s = u * u + v * v; } while (s >= 1 || s === 0);
  const f = 2 * Math.sqrt(1 - s); return [u * f, v * f, 1 - 2 * s];
}
const dirs = [];
// Cube face centres, corners and edge midpoints, and the poles: seams and extremes.
for (let face = 0; face < 6; face++) for (const u of [-1, 0, 1]) for (const v of [-1, 0, 1]) dirs.push(cubeDirection(face, u, v));
dirs.push([0, 1, 0], [0, -1, 0]);
for (let i = 0; i < count; i++) dirs.push(sphere());
// Walking-scale clusters: points a few metres apart exercise the finest octaves.
for (let k = 0; k < 60; k++) {
  const c = sphere();
  for (let i = 0; i < 20; i++) {
    const d = [c[0] + (rnd() - .5) * 8 / 1592750, c[1] + (rnd() - .5) * 8 / 1592750, c[2] + (rnd() - .5) * 8 / 1592750];
    const l = Math.hypot(...d); dirs.push([d[0] / l, d[1] / l, d[2] / l]);
  }
}
const out = [];
for (const [x, y, z] of dirs) {
  const { height, rockRelief } = terrainSample(x, y, z);
  const m = moisture(x, y, z), b = BIOMES.indexOf(biomeAt(x, y, z, height)), [r, g, bl] = surfaceColor(x, y, z, height);
  out.push([x, y, z, height, rockRelief, m, b, r, g, bl].map(String).join(' '));
}
process.stdout.write(out.join('\n') + '\n');
process.stderr.write(`seed ${seed}: ${out.length} samples\n`);
