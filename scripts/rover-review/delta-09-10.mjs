// Strict independent geometry/rig comparison for the frozen 09 -> 10 finish change.
// No browser, production edits, or mechanism-contact rerun.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {readAsset} from './asset.mjs';
import {ASSET, LAYOUT, outputPath} from './config.mjs';

const BEFORE_SHA = '0ce536332a9e1b29d89d29981e510739c975cd739514cfe1e9e0b810120617fb';
const AFTER_SHA = '88448d9dd48e0a0acdb2397465302e8ab41335b8ffaab6234050d136bf6cc78f';
const beforeFile = process.env.ROVER_BEFORE_GLB;
const beforeLayout = process.env.ROVER_BEFORE_LAYOUT;
if (!beforeFile || !beforeLayout) throw Error('Set ROVER_BEFORE_GLB and ROVER_BEFORE_LAYOUT to the archived 09 inputs.');
const a = readAsset('rover-before', beforeFile);
const b = readAsset('rover-after', ASSET);
if (a.sha256 !== BEFORE_SHA || b.sha256 !== AFTER_SHA) throw Error('Frozen 09/10 input identity mismatch.');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const same = (x, y) => JSON.stringify(x) === JSON.stringify(y);
const failures = [];
const check = (condition, label) => { if (!condition) failures.push(label); return condition; };

// Exact round-trip JavaScript double strings: no geometric rounding/tolerance.
// Only cyclic rotation is normalized. Reversed winding remains different.
function cyclic(rows) {
  return [0, 1, 2].map(i => [rows[i], rows[(i + 1) % 3], rows[(i + 2) % 3]].join('|')).sort()[0];
}
function add(bag, key) { bag.set(key, (bag.get(key) || 0) + 1); }
function compareBags(x, y) {
  let identical = 0, removed = 0, added = 0;
  const examples = [];
  for (const key of new Set([...x.keys(), ...y.keys()])) {
    const n = x.get(key) || 0, m = y.get(key) || 0;
    identical += Math.min(n, m);
    removed += Math.max(0, n - m);
    added += Math.max(0, m - n);
    if (n !== m && examples.length < 5) examples.push({key, before: n, after: m});
  }
  return {identical, removed, added, exact: removed === 0 && added === 0, examples};
}

function bags(asset) {
  const frame = asset.frame(), world = new Map(), local = new Map();
  const attributes = new Map(), normals = new Map(), primitiveRecords = [];
  let triangles = 0, vertices = 0;
  for (let node = 0; node < asset.j.nodes.length; node++) {
    const n = asset.j.nodes[node];
    if (n.mesh === undefined) continue;
    if (!frame.world[node]) throw Error('Unreachable mesh node: ' + node);
    for (const [primitiveIndex, p] of asset.j.meshes[n.mesh].primitives.entries()) {
      if ((p.mode ?? 4) !== 4) throw Error('Non-triangle primitive is outside this strict probe.');
      if (p.targets?.length) throw Error('Morph targets require a separate resolved comparison.');
      const pos = asset.access(p.attributes.POSITION);
      const indices = p.indices === undefined ? pos.map((_, i) => i) : asset.access(p.indices).flat();
      if (indices.length % 3) throw Error('Invalid triangle index count.');
      const mesh = frame.meshes.filter(m => m.node === node)[primitiveIndex];
      if (!mesh) throw Error('Frame helper omitted a hidden primitive; add explicit support before claiming full identity.');
      const semanticKeys = Object.keys(p.attributes).filter(k => k !== 'NORMAL').sort();
      const decoded = Object.fromEntries(semanticKeys.map(k => [k, asset.access(p.attributes[k])]));
      const ns = p.attributes.NORMAL === undefined ? null : asset.access(p.attributes.NORMAL);
      const prefix = `${node}:${n.name}:${primitiveIndex}:${p.material ?? -1}|`;
      vertices += pos.length;
      primitiveRecords.push({node, name: n.name, primitiveIndex, material: p.material ?? null,
        mode: p.mode ?? 4, attributes: Object.keys(p.attributes).sort(), triangles: indices.length / 3});
      for (let k = 0; k < indices.length; k += 3) {
        const ids = indices.slice(k, k + 3);
        add(local, prefix + cyclic(ids.map(i => JSON.stringify(pos[i]))));
        add(world, prefix + cyclic(ids.map(i => JSON.stringify(mesh.vertices[i].toArray()))));
        add(attributes, prefix + cyclic(ids.map(i => JSON.stringify(semanticKeys.map(key => [key, decoded[key][i]])))));
        add(normals, prefix + cyclic(ids.map(i => JSON.stringify([pos[i], ns?.[i] ?? null]))));
        triangles++;
      }
    }
  }
  return {frame, world, local, attributes, normals, primitiveRecords, triangles, vertices};
}

const x = bags(a), y = bags(b);
const worldTriangles = compareBags(x.world, y.world);
const localTriangles = compareBags(x.local, y.local);
const nonNormalTriangleAttributes = compareBags(x.attributes, y.attributes);
const normalDecoratedTriangles = compareBags(x.normals, y.normals);
check(worldTriangles.exact, 'World triangle multiset changed.');
check(localTriangles.exact, 'Per-node local triangle multiset changed.');
check(nonNormalTriangleAttributes.exact, 'Triangle attributes other than NORMAL changed (including UV/material association).');
check(same(x.primitiveRecords, y.primitiveRecords), 'Primitive semantic/assignment contract changed.');
const nodesIdentical = check(same(a.j.nodes, b.j.nodes), 'Node hierarchy/TRS/extras changed.');
const scenesIdentical = check(same(a.j.scenes, b.j.scenes) && a.j.scene === b.j.scene, 'Scene membership changed.');
const allWorldMatricesIdentical = check(same(x.frame.world.map(m => m.elements), y.frame.world.map(m => m.elements)), 'A node world matrix changed.');

function resolvedAnimations(asset) {
  return (asset.j.animations || []).map(clip => ({...clip, samplers: clip.samplers.map(s => ({
    interpolation: s.interpolation || 'LINEAR', input: asset.access(s.input), output: asset.access(s.output)
  }))}));
}
function resolvedSkins(asset) {
  return (asset.j.skins || []).map(s => ({...s, inverseBindMatrices:
    s.inverseBindMatrices === undefined ? null : asset.access(s.inverseBindMatrices)}));
}
const animationsIdentical = check(same(resolvedAnimations(a), resolvedAnimations(b)), 'Resolved animation values changed.');
const skinsIdentical = check(same(resolvedSkins(a), resolvedSkins(b)), 'Skin/bind data changed.');
const layout09 = fs.readFileSync(beforeLayout), layout10 = fs.readFileSync(LAYOUT);
const layoutIdentical = check(layout09.equals(layout10), 'Canonical layout bytes changed.');

function imagePayloads(file, asset) {
  const bytes = fs.readFileSync(file), bin = 28 + bytes.readUInt32LE(12);
  return (asset.j.images || []).map((im, index) => {
    if (im.bufferView === undefined) throw Error('External image is outside this strict probe.');
    const v = asset.j.bufferViews[im.bufferView];
    const payload = bytes.subarray(bin + (v.byteOffset || 0), bin + (v.byteOffset || 0) + v.byteLength);
    return {index, mimeType: im.mimeType, bytes: payload.length, sha256: hash(payload)};
  });
}
const images09 = imagePayloads(beforeFile, a), images10 = imagePayloads(ASSET, b);
const imageChanges = images09.map((im, i) => ({index: i, changed: im.sha256 !== images10[i]?.sha256, before: im, after: images10[i]}));
const textureSource = (asset, t) => {
  const texture = asset.j.textures[t];
  return texture.extensions?.EXT_texture_webp?.source ?? texture.source;
};
const ormImageIndices = new Set(a.j.materials.flatMap(m => {
  const t = m.pbrMetallicRoughness?.metallicRoughnessTexture;
  return t ? [textureSource(a, t.index)] : [];
}));
const materialsIdentical = check(same(a.j.materials, b.j.materials), 'glTF material records changed outside the declared packed swatch update.');
const textureRecordsIdentical = check(same(a.j.textures, b.j.textures) && same(a.j.samplers, b.j.samplers), 'Texture/sampler bindings changed.');
check(images09.length === images10.length, 'Embedded image count changed.');
check(imageChanges.every(im => !im.changed || ormImageIndices.has(im.index)), 'An image outside the ORM swatch changed.');
check(hash(fs.readFileSync(ASSET)) === AFTER_SHA, 'Live candidate changed during the comparison.');

const mechanismNodes = a.j.nodes.map((n, i) => ({n, i})).filter(({n}) =>
  /^(Suspension_|Steer_|Axle_|Wheel_|Arm_|Damper_|Cutter_|Muzzle_|CabinDoor$|BoardingSteps$|SteeringYoke$)/.test(n.name || ''));
const report = {
  pass: failures.length === 0, failures,
  beforeSHA: a.sha256, afterSHA: b.sha256, beforeBytes: a.bytes, afterBytes: b.bytes,
  trianglesBefore: x.triangles, trianglesAfter: y.triangles,
  packedVerticesBefore: x.vertices, packedVerticesAfter: y.vertices,
  primitiveCount: x.primitiveRecords.length, nodeCount: a.j.nodes.length,
  worldTriangles, localTriangles, nonNormalTriangleAttributes, normalDecoratedTriangles,
  nodesIdentical, scenesIdentical, allWorldMatricesIdentical, animationsIdentical, skinsIdentical,
  animationClips: (a.j.animations || []).length, skins: (a.j.skins || []).length,
  layoutIdentical, beforeLayoutSHA: hash(layout09), afterLayoutSHA: hash(layout10),
  mechanismNodes: mechanismNodes.map(({n, i}) => ({index: i, name: n.name})),
  restBoundsBefore: {min: x.frame.bounds.min.toArray(), max: x.frame.bounds.max.toArray()},
  restBoundsAfter: {min: y.frame.bounds.min.toArray(), max: y.frame.bounds.max.toArray()},
  materialsIdentical, textureRecordsIdentical, ormImageIndices: [...ormImageIndices], imageChanges,
  method: 'All triangle primitives, winding-preserving exact JavaScript-double coordinate multisets without rounding, retaining duplicates and node/primitive/material association. UV and every non-NORMAL triangle-corner attribute compared independently of changed vertex welding.',
  scope: 'Establishes asset geometry, rig and layout identity. Identical local triangles under identical node transforms remain identical for the same runtime articulation. No new contact sweep, renderer, motion-quality, runtime input, save or art acceptance is claimed.'
};
fs.writeFileSync(outputPath('delta-09-10.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({...report, mechanismNodes: mechanismNodes.length,
  worldTriangles: {...worldTriangles, examples: undefined}, localTriangles: {...localTriangles, examples: undefined},
  nonNormalTriangleAttributes: {...nonNormalTriangleAttributes, examples: undefined},
  normalDecoratedTriangles: {...normalDecoratedTriangles, examples: undefined}}, null, 2));
if (failures.length) process.exitCode = 1;
