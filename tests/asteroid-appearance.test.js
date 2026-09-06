import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Vector3, ShaderLib } from 'three';
import { createAsteroidGeometry, legacyAsteroidGeometry, asteroidRadius, ASTEROID_MAX_RADIUS } from '../src/asteroid-geometry.js';
import { createAsteroidMaterial } from '../src/asteroid-material.js';
const digest = array => createHash('sha256').update(Buffer.from(array.buffer, array.byteOffset, array.byteLength)).digest('hex');

test('all six small-rock meshes remain byte-identical to the prior mining-compatible LOD', () => {
  const baseline = [
    '4d374d8113872450349984375b2f3303f1d64bc29d288e09443b0957e3da3bfd',
    'c00292c73876804b58bafcb35f965167282bc3260a45fbf2286cd18738e75fff',
    '6b704c00737fadd3ba489999148225118466faf03835e742ab0b3aacf3a39239',
    '79ac0bcba92ca5766cce92cdb7fe151fb60525fafd9977527df26a691d308676',
    '3a8d482e8cd8e7b7666ed238116349ab77730820b282de6189da379ad29f1d39',
    '0ba03c0438c1271b53b82b0171848ce333d0bb09d3b90e0dc582c583898e99d3',
  ];
  for (let family = 0; family < 6; family++) {
    const geometry = legacyAsteroidGeometry(family, 2), wrapped = createAsteroidGeometry(family, 2, 0, { large: false });
    assert.equal(digest(geometry.attributes.position.array), baseline[family]);
    assert.deepEqual(wrapped.attributes.position.array, geometry.attributes.position.array);
    geometry.dispose(); wrapped.dispose();
  }
});
test('twenty-four large shapes are distinct, closed, finite and inside the descriptor clearance bound', () => {
  const hashes = new Set();
  for (let family = 0; family < 6; family++) for (let variant = 0; variant < 4; variant++) {
    const geometry = createAsteroidGeometry(family, 3, variant), p = geometry.attributes.position, n = geometry.attributes.normal;
    hashes.add(digest(p.array)); const edges = new Map(); let minimum = Infinity, maximum = 0;
    for (let i = 0; i < p.count; i++) {
      const point = new Vector3().fromBufferAttribute(p, i), normal = new Vector3().fromBufferAttribute(n, i), radius = point.length();
      minimum = Math.min(minimum, radius); maximum = Math.max(maximum, radius);
      assert.ok(radius <= ASTEROID_MAX_RADIUS + 1e-6 && radius >= .569999);
      assert.ok(Number.isFinite(normal.length()) && Math.abs(normal.length() - 1) < 1e-5);
    }
    assert.ok(maximum / minimum > 1.2, 'shape has appreciable broad relief rather than a rounded sphere');
    for (let i = 0; i < p.count; i += 3) {
      const ids = [0, 1, 2].map(j => new Vector3().fromBufferAttribute(p, i + j).toArray().map(v => Math.round(v * 1e5)).join(','));
      for (let j = 0; j < 3; j++) { const key = [ids[j], ids[(j + 1) % 3]].sort().join('/'); edges.set(key, (edges.get(key) ?? 0) + 1); }
    }
    assert.ok([...edges.values()].every(count => count === 2), 'every welded edge has exactly two faces');
    assert.ok(geometry.boundingSphere.radius <= 1.9 + 1e-6); assert.deepEqual(geometry.boundingSphere.center.toArray(), [0, 0, 0]);
    geometry.dispose();
  }
  assert.equal(hashes.size, 24);
});
test('near and far meshes sample one stable radial surface without changing broad shapes', () => {
  for (let family = 0; family < 6; family++) {
    const sampled = new Map();
    for (const detail of [1, 3, 7]) {
      const geometry = createAsteroidGeometry(family, detail, 2), p = geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const point = new Vector3().fromBufferAttribute(p, i), length = point.length(), direction = point.clone().normalize();
        assert.ok(Math.abs(length - asteroidRadius(direction, family, 2)) < 2e-6);
        const key = direction.toArray().map(v => Math.round(v * 1e5)).join(',');
        if (sampled.has(key)) assert.ok(Math.abs(sampled.get(key) - length) < 2e-6);
        else sampled.set(key, length);
      }
      geometry.dispose();
    }
  }
  assert.throws(() => asteroidRadius(new Vector3(), 0, 0), RangeError);
  assert.throws(() => createAsteroidGeometry(9), RangeError);
});
test('procedural material preserves instance tint, standard depth hooks and floating-origin eclipse inputs', () => {
  const originUniform = { value: new Vector3(100, 200, 300) }, material = createAsteroidMaterial({ originUniform, sunDirection: [3, 0, 0], moonRadius: 434350 });
  const shader = { uniforms: {}, vertexShader: ShaderLib.standard.vertexShader, fragmentShader: ShaderLib.standard.fragmentShader };
  material.onBeforeCompile(shader);
  assert.equal(shader.uniforms.asteroidOrigin, originUniform);
  assert.deepEqual(shader.uniforms.asteroidSun.value.toArray(), [1, 0, 0]);
  assert.ok(shader.vertexShader.includes('#include <logdepthbuf_vertex>'));
  assert.ok(shader.fragmentShader.includes('#include <logdepthbuf_fragment>'));
  assert.ok(shader.fragmentShader.includes('#include <color_fragment>'), 'built-in instance tint remains in the lighting pipeline');
  assert.ok(shader.fragmentShader.includes('dFdx(vAsteroidPoint)') && shader.fragmentShader.includes('fwidth(asteroidLayer)'));
  assert.equal(material.map, null); assert.equal(material.normalMap, null); assert.equal(material.emissive.getHex(), 0);
  assert.ok(material.roughness >= .8 && material.metalness <= .16);
  material.dispose();
});
