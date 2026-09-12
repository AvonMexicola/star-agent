// Reference Pyre samples from the browser generator for pyre-crosscheck.cpp.
// Tagged lines (numbers in JavaScript's shortest round-trip form):
//   S x y z height rockRelief activity fresh sulphur oxide region w0 w1 w2 dominant r g b   (body frame)
//   V|F i dx dy dz ex ey ez nx ny nz radius      volcano / lava field constants
//   C i dx dy dz radius depth                    crater constants
//   O ms epoch px py pz x0 x1 x2 y0 y1 y2 z0 z1 z2   pyreFrameAt(ms) after setPyreEpoch(epoch)
//   P period   L lx ly lz
import { pyreSurfaceBody, VOLCANOES, LAVA_FIELDS, CRATERS, pyreFrameAt, setPyreEpoch, PYRE_PERIOD_SECONDS, PYRE_LANDING_BODY_DIRECTION, PYRE_RESOURCE_IDS } from '../../src/pyre-world.js';
import { cubeDirection } from '../../src/world.js';

const args = Object.fromEntries(process.argv.slice(2).join(' ').split('--').filter(Boolean).map(s => { const [k, v] = s.trim().split(/\s+/); return [k, v]; }));
const count = Number(args.count ?? 20000);
const REGIONS = ['BASALT PLAINS', 'CALDERA', ...VOLCANOES.map(v => v.name), ...LAVA_FIELDS.map(f => f.name), 'BASALT HIGHLANDS', 'OXIDISED PLAINS'];
let state = 0x50595245;
function rnd() { state ^= state << 13; state >>>= 0; state ^= state >>> 17; state ^= state << 5; state >>>= 0; return state / 4294967296; }
function sphere() { let u, v, s; do { u = rnd() * 2 - 1; v = rnd() * 2 - 1; s = u * u + v * v; } while (s >= 1 || s === 0); const f = 2 * Math.sqrt(1 - s); return [u * f, v * f, 1 - 2 * s]; }
const unit = d => { const l = Math.hypot(...d); return [d[0] / l, d[1] / l, d[2] / l]; };
const along = (f, frac, axis) => { const t = frac * f.radius, c = Math.cos(t), s = Math.sin(t); return unit([f.direction[0] * c + axis[0] * s, f.direction[1] * c + axis[1] * s, f.direction[2] * c + axis[2] * s]); };
const dirs = [];
for (let face = 0; face < 6; face++) for (const u of [-1, 0, 1]) for (const v of [-1, 0, 1]) dirs.push(cubeDirection(face, u, v));
dirs.push([0, 1, 0], [0, -1, 0]);
for (let i = 0; i < count; i++) dirs.push(sphere());
for (const f of [...VOLCANOES, ...LAVA_FIELDS]) for (const frac of [0, .05, .075, .3, .5, .9, 1, 1.1, 1.3]) { dirs.push(along(f, frac, f.east), along(f, frac, f.north), along(f, frac, f.east.map(v => -v))); }
for (const c of CRATERS.slice(0, 12)) { const e = unit([c.direction[2], 0, -c.direction[0]]); for (const frac of [0, .5, .98, 1.2]) dirs.push(along({ direction: c.direction, radius: c.radius }, frac, e)); }
for (let k = 0; k < 60; k++) { const c = k < 20 ? along(LAVA_FIELDS[k % 6], .3, LAVA_FIELDS[k % 6].north) : sphere(); for (let i = 0; i < 20; i++) dirs.push(unit([c[0] + (rnd() - .5) * 8 / 1200000, c[1] + (rnd() - .5) * 8 / 1200000, c[2] + (rnd() - .5) * 8 / 1200000])); }
const out = [];
for (const [x, y, z] of dirs) {
  const s = pyreSurfaceBody(x, y, z);
  out.push(['S', x, y, z, s.height, s.rockRelief, s.activity, s.fresh, s.sulphur, s.oxide, REGIONS.indexOf(s.region), ...s.resources.weights, PYRE_RESOURCE_IDS.indexOf(s.resource), ...s.color].map(String).join(' '));
}
VOLCANOES.forEach((v, i) => out.push(['V', i, ...v.direction, ...v.east, ...v.north, v.radius].map(String).join(' ')));
LAVA_FIELDS.forEach((f, i) => out.push(['F', i, ...f.direction, ...f.east, ...f.north, f.radius].map(String).join(' ')));
CRATERS.forEach((c, i) => out.push(['C', i, ...c.direction, c.radius, c.depth].map(String).join(' ')));
const EPOCH = 1757000000000;
setPyreEpoch(EPOCH);
for (const offset of [0, 1000, 3600000, 86400000, 1e9, -5e8, 1.2e10]) { const f = pyreFrameAt(EPOCH + offset); out.push(['O', EPOCH + offset, EPOCH, ...f.position, ...f.x, ...f.y, ...f.z].map(String).join(' ')); }
out.push(['P', PYRE_PERIOD_SECONDS].map(String).join(' '));
out.push(['L', ...PYRE_LANDING_BODY_DIRECTION].map(String).join(' '));
process.stdout.write(out.join('\n') + '\n');
process.stderr.write(`pyre: ${dirs.length} surface samples\n`);
