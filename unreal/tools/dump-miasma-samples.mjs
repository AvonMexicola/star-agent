// Reference Miasma samples from the browser generator for miasma-crosscheck.cpp.
//   S x y z height rockRelief sulphur basin region w0 w1 w2 dominant r g b
//   T i dx dy dz radius depth        site constants
//   M epoch px py pz                 MIASMA_POSITION (constant for any epoch)
import { miasmaSurface, MIASMA_SITES, MIASMA_POSITION, MIASMA_RESOURCE_IDS } from '../../src/miasma-world.js';
import { PYRE_EPOCH } from '../../src/pyre-world.js';
import { cubeDirection } from '../../src/world.js';

const args = Object.fromEntries(process.argv.slice(2).join(' ').split('--').filter(Boolean).map(s => { const [k, v] = s.trim().split(/\s+/); return [k, v]; }));
const count = Number(args.count ?? 20000);
const REGIONS = ['SULPHUR UPLANDS', ...MIASMA_SITES.map(s => s.name)];
let state = 0x4d494153;
function rnd() { state ^= state << 13; state >>>= 0; state ^= state >>> 17; state ^= state << 5; state >>>= 0; return state / 4294967296; }
function sphere() { let u, v, s; do { u = rnd() * 2 - 1; v = rnd() * 2 - 1; s = u * u + v * v; } while (s >= 1 || s === 0); const f = 2 * Math.sqrt(1 - s); return [u * f, v * f, 1 - 2 * s]; }
const unit = d => { const l = Math.hypot(...d); return [d[0] / l, d[1] / l, d[2] / l]; };
const along = (site, frac, axis) => { const t = frac * site.radius, c = Math.cos(t), s = Math.sin(t); return unit([site.direction[0] * c + axis[0] * s, site.direction[1] * c + axis[1] * s, site.direction[2] * c + axis[2] * s]); };
const dirs = [];
for (let face = 0; face < 6; face++) for (const u of [-1, 0, 1]) for (const v of [-1, 0, 1]) dirs.push(cubeDirection(face, u, v));
dirs.push([0, 1, 0], [0, -1, 0]);
for (let i = 0; i < count; i++) dirs.push(sphere());
for (const site of MIASMA_SITES) { const e = unit([site.direction[2], 0, -site.direction[0]]); for (const frac of [0, .5, .9, 1.04, 1.2]) dirs.push(along(site, frac, e)); }
for (let k = 0; k < 60; k++) { const c = sphere(); for (let i = 0; i < 20; i++) dirs.push(unit([c[0] + (rnd() - .5) * 8 / 340000, c[1] + (rnd() - .5) * 8 / 340000, c[2] + (rnd() - .5) * 8 / 340000])); }
const out = [];
for (const [x, y, z] of dirs) {
  const s = miasmaSurface(x, y, z);
  out.push(['S', x, y, z, s.height, s.rockRelief, s.sulphur, s.fresh, REGIONS.indexOf(s.region), ...s.resources.weights, MIASMA_RESOURCE_IDS.indexOf(s.resources.dominant), ...s.color].map(String).join(' '));
}
MIASMA_SITES.forEach((s, i) => out.push(['T', i, ...s.direction, s.radius, s.depth].map(String).join(' ')));
out.push(['M', PYRE_EPOCH, ...MIASMA_POSITION].map(String).join(' '));
process.stdout.write(out.join('\n') + '\n');
process.stderr.write(`miasma: ${dirs.length} surface samples\n`);
