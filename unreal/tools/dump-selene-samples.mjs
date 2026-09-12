// Dumps reference Selene (moon) surface samples from the browser generator so
// the C++ port can be checked against it. One line per sample:
//   x y z height rockRelief albedo frost r g b wBasalt wCopper wIce dominant province region
// dominant: 0 basalt, 1 copper, 2 ice. province/region: index into PLACES below
// (the same order as StarAgent::Selene::Place). Numbers use JavaScript's
// shortest round-trip form, which strtod restores exactly.
//
//   node dump-selene-samples.mjs --count 20000 > build/selene.txt
import { moonSurface, moonRegion, CRATERS, LOCAL_CRATERS, RESOURCE_PROVINCES, MOON_LANDING_DIRECTION, LANDING_FRAME, MOON_RADIUS } from '../../src/moon-world.js';
import { cubeDirection } from '../../src/world.js';

const args = Object.fromEntries(process.argv.slice(2).join(' ').split('--').filter(Boolean).map(s => { const [k, v] = s.trim().split(/\s+/); return [k, v]; }));
const count = Number(args.count ?? 20000);
const PLACES = ['BASALT HIGHLANDS', 'FROSTWALL ICE PROVINCE', 'COPPER EJECTA PROVINCE', 'NORTH GLASS FIELDS', 'FAR COPPER BASINS', 'SOUTH ICE FIELDS',
  'FAR HIGHLANDS', 'CRESCENT RIM', 'OBSIDIAN CROWN', 'TWIN SPIRES', 'FROSTWALL', 'COPPER EJECTA', 'GLASS RIFT', 'CRESCENT BASIN', 'ASH HIGHLANDS'];
const RESOURCES = ['basalt', 'copper', 'ice'];

let state = 0x53454c45 ^ 0x9e3779b9;
function rnd() { state ^= state << 13; state >>>= 0; state ^= state >>> 17; state ^= state << 5; state >>>= 0; return state / 4294967296; }
function sphere() {
  let u, v, s; do { u = rnd() * 2 - 1; v = rnd() * 2 - 1; s = u * u + v * v; } while (s >= 1 || s === 0);
  const f = 2 * Math.sqrt(1 - s); return [u * f, v * f, 1 - 2 * s];
}
const unit = d => { const l = Math.hypot(...d); return [d[0] / l, d[1] / l, d[2] / l]; };
// Tangent frame at a direction, for rim points and offsets.
function tangents(d) {
  const up = Math.abs(d[1]) < .9 ? [0, 1, 0] : [1, 0, 0];
  const e = unit([up[1] * d[2] - up[2] * d[1], up[2] * d[0] - up[0] * d[2], up[0] * d[1] - up[1] * d[0]]);
  const n = [d[1] * e[2] - d[2] * e[1], d[2] * e[0] - d[0] * e[2], d[0] * e[1] - d[1] * e[0]];
  return [e, n];
}
const offset = (d, e, n, a, b) => unit([d[0] + e[0] * a + n[0] * b, d[1] + e[1] * a + n[1] * b, d[2] + e[2] * a + n[2] * b]);

const dirs = [];
for (let face = 0; face < 6; face++) for (const u of [-1, 0, 1]) for (const v of [-1, 0, 1]) dirs.push(cubeDirection(face, u, v));
dirs.push([0, 1, 0], [0, -1, 0]);
for (let i = 0; i < count; i++) dirs.push(sphere());
// Crater centres, floors, rims and ejecta aprons.
for (const c of CRATERS) {
  const [e, n] = tangents(c.direction);
  dirs.push([...c.direction]);
  for (const k of [.5, 1.0, 1.02, 1.17, 1.4]) for (let j = 0; j < 4; j++) {
    const a = j * Math.PI / 2 + .3; dirs.push(offset(c.direction, e, n, Math.cos(a) * c.radius * k, Math.sin(a) * c.radius * k));
  }
}
// Landing basin: local craters, named regions, the fault, metre-scale clusters.
const landing = [...MOON_LANDING_DIRECTION], E = LANDING_FRAME.east, N = LANDING_FRAME.north;
const local = (u, v) => offset(landing, E, N, u / MOON_RADIUS, v / MOON_RADIUS);
for (const c of LOCAL_CRATERS) { const [e, n] = tangents(c.direction); dirs.push([...c.direction]); for (const k of [.6, 1.0, 1.3]) for (let j = 0; j < 3; j++) { const a = j * 2.1; dirs.push(offset(c.direction, e, n, Math.cos(a) * c.radius * k, Math.sin(a) * c.radius * k)); } }
for (const [u, v] of [[0, 0], [-7600, -5300], [-11000, 6500], [5400, 11500], [2600, -3400], [-1350, 100], [-220, 0], [-600, 3000], [15000, 0], [0, 22000], [0, -26000], [30000, 0], [-40000, 5000]]) {
  dirs.push(local(u, v));
  for (let i = 0; i < 20; i++) dirs.push(local(u + (rnd() - .5) * 8, v + (rnd() - .5) * 8));
  for (let i = 0; i < 20; i++) dirs.push(local(u + (rnd() - .5) * 6000, v + (rnd() - .5) * 6000));
}
for (let i = 0; i < 400; i++) { const v = (rnd() - .5) * 30000; dirs.push(local(-220 + Math.sin(v / 900) * 380 + Math.sin(v / 240) * 65 + (rnd() - .5) * 400, v)); }
// Provinces: centre, core, tendrils and edge, in each province frame.
for (const p of RESOURCE_PROVINCES) {
  const [e, n] = tangents(p.direction); const r = p.radius / MOON_RADIUS;
  dirs.push([...p.direction]);
  for (let i = 0; i < 300; i++) { const a = rnd() * Math.PI * 2, k = Math.sqrt(rnd()) * 2.1; dirs.push(offset(p.direction, e, n, Math.cos(a) * r * k, Math.sin(a) * r * k)); }
}
// Random metre-scale clusters anywhere.
for (let k = 0; k < 40; k++) { const c = sphere(); for (let i = 0; i < 20; i++) dirs.push(unit([c[0] + (rnd() - .5) * 8 / MOON_RADIUS, c[1] + (rnd() - .5) * 8 / MOON_RADIUS, c[2] + (rnd() - .5) * 8 / MOON_RADIUS])); }

const out = [];
for (const [x, y, z] of dirs) {
  const s = moonSurface(x, y, z), region = moonRegion(x, y, z);
  const province = PLACES.indexOf(s.resources.province), reg = PLACES.indexOf(region), dom = RESOURCES.indexOf(s.resources.dominant);
  if (province < 0 || reg < 0 || dom < 0) throw new Error(`unknown name ${s.resources.province} / ${region} / ${s.resources.dominant}`);
  out.push([x, y, z, s.height, s.rockRelief, s.albedo, s.frost, ...s.color, ...s.resources.weights, dom, province, reg].map(String).join(' '));
}
process.stdout.write(out.join('\n') + '\n');
process.stderr.write(`selene: ${out.length} samples\n`);
