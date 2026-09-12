// Dumps generatePatch() output from the browser generator for the patch
// builder cross-check. Format per patch: a header line
//   # face level ix iy grid parentGrid seed
// followed by one line per buffer: "name v0 v1 v2 ...", numbers in JavaScript
// shortest round-trip form (float32 values print as their exact double).
import { setPlanetSeed } from '../../src/generation.js';
import { generatePatch, cubeDirection, terrainHeight, latLonDirection } from '../../src/world.js';
import { terrainGridForLevel } from '../../src/terrain-resolution.js';

const args = Object.fromEntries(process.argv.slice(2).join(' ').split('--').filter(Boolean).map(s => { const [k, v] = s.trim().split(/\s+/); return [k, v]; }));
const seed = Number(args.seed ?? 7291);
setPlanetSeed(seed);

let state = (0x2545f491 ^ seed) >>> 0 || 1;
function rnd() { state ^= state << 13; state >>>= 0; state ^= state >>> 17; state ^= state << 5; state >>>= 0; return state / 4294967296; }
function sphere() { let u, v, s; do { u = rnd() * 2 - 1; v = rnd() * 2 - 1; s = u * u + v * v; } while (s >= 1 || s === 0); const f = 2 * Math.sqrt(1 - s); return [u * f, v * f, 1 - 2 * s]; }
// Inverse of world.js cubeDirection: which face and (u,v) contain a direction.
function cellFor([x, y, z], level) {
  const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z);
  let face, u, v;
  if (ax >= ay && ax >= az) { if (x > 0) { face = 0; u = -z / ax; v = y / ax; } else { face = 1; u = z / ax; v = y / ax; } }
  else if (ay >= az) { if (y > 0) { face = 2; u = x / ay; v = -z / ay; } else { face = 3; u = x / ay; v = z / ay; } }
  else { if (z > 0) { face = 4; u = x / az; v = y / az; } else { face = 5; u = -x / az; v = y / az; } }
  const n = 2 ** level, clamp = t => Math.max(0, Math.min(n - 1, Math.floor((t + 1) / 2 * n)));
  return { face, level, ix: clamp(u), iy: clamp(v) };
}
const cells = [];
for (let face = 0; face < 6; face++) cells.push({ face, level: 0, ix: 0, iy: 0 });
const targets = [];
while (targets.length < 3) { const d = sphere(); if (terrainHeight(...d) > 0) targets.push(d); }          // land
while (targets.length < 4) { const d = sphere(); if (Math.abs(terrainHeight(...d)) < 60) targets.push(d); } // coast
targets.push([0, 1, 0]);                                     // pole
targets.push(cubeDirection(0, 1, 1));                        // cube corner seam
targets.push(latLonDirection(44, -60));                      // fixed point, mixed
for (const d of targets) for (const level of [1, 2, 3, 4, 5, 7, 9, 11, 13, 14, 16, 17]) cells.push(cellFor(d, level));
const out = [];
for (const c of cells) {
  const grid = terrainGridForLevel(c.level), parentGrid = terrainGridForLevel(Math.max(0, c.level - 1));
  const p = generatePatch({ ...c, grid, parentGrid, surfaceDetail: false });
  out.push(`# ${c.face} ${c.level} ${c.ix} ${c.iy} ${grid} ${parentGrid} ${seed}`);
  out.push('center ' + p.center.map(String).join(' '));
  for (const name of ['positions', 'normals', 'colors', 'directions', 'waterPositions', 'heights', 'rockReliefs', 'parentPositions', 'parentWaterPositions', 'parentNormals', 'parentColors', 'parentHeights', 'indices'])
    out.push(name + ' ' + Array.from(p[name], String).join(' '));
}
process.stdout.write(out.join('\n') + '\n');
process.stderr.write(`seed ${seed}: ${cells.length} patches\n`);
