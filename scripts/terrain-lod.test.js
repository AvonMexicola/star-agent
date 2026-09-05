import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { GRID, RADIUS, generatePatch } from '../src/world.js';
import {
  TERRAIN_MERGE_RATIO,
  TERRAIN_MORPH_SECONDS,
  TERRAIN_SPLIT_RATIO,
  addTerrainMorph,
  advanceTerrainMorph,
  terrainMorphValue,
  wantsTerrainSplit,
} from '../src/terrain-lod.js';
import { Planet } from '../src/planet.js';
import { configureLandMaterial } from '../src/terrain-material.js';

const CORE_COUNT = (GRID + 1) ** 2;
const EDGE_SOURCES = [
  Array.from({ length: GRID + 1 }, (_, i) => i),
  Array.from({ length: GRID + 1 }, (_, j) => j * (GRID + 1) + GRID),
  Array.from({ length: GRID + 1 }, (_, i) => GRID * (GRID + 1) + GRID - i),
  Array.from({ length: GRID + 1 }, (_, j) => (GRID - j) * (GRID + 1)),
];

function barycentricTerms(child, i, j) {
  const px = (child.ix % 2) * GRID / 2 + i / 2;
  const py = (child.iy % 2) * GRID / 2 + j / 2;
  const x = Math.min(GRID - 1, Math.floor(px));
  const y = Math.min(GRID - 1, Math.floor(py));
  const fx = px - x, fy = py - y;
  // The parent's index order is a-b-c, b-d-c: its diagonal runs b-c.
  return fx + fy <= 1
    ? [[x, y, 1 - fx - fy], [x + 1, y, fx], [x, y + 1, fy]]
    : [[x + 1, y, 1 - fy], [x + 1, y + 1, fx + fy - 1], [x, y + 1, 1 - fx]];
}

function expectedComponent(parent, child, descriptor, i, j, field, components, component) {
  const shift = field === 'positions' || field === 'waterPositions'
    ? parent.center[component] - child.center[component]
    : 0;
  let value = 0;
  for (const [x, y, weight] of barycentricTerms(descriptor, i, j)) {
    const vertex = y * (GRID + 1) + x;
    value += (parent[field][vertex * components + component] + shift) * weight;
  }
  return Math.fround(value);
}

function assertSameFloat(actual, expected, message) {
  assert.ok(actual === expected, `${message}: expected ${expected}, got ${actual}`);
}

function checkChildAgainstParent(parentDescriptor, childDescriptor) {
  const parent = generatePatch(parentDescriptor);
  const child = generatePatch(childDescriptor);
  const fields = [
    ['positions', 'parentPositions', 3],
    ['waterPositions', 'parentWaterPositions', 3],
    ['normals', 'parentNormals', 3],
    ['colors', 'parentColors', 3],
    ['heights', 'parentHeights', 1],
  ];

  for (let j = 0; j <= GRID; j++) for (let i = 0; i <= GRID; i++) {
    const vertex = j * (GRID + 1) + i;
    for (const [parentField, childField, components] of fields) for (let component = 0; component < components; component++) {
      const expected = expectedComponent(parent, child, childDescriptor, i, j, parentField, components, component);
      assertSameFloat(child[childField][vertex * components + component], expected,
        `${childDescriptor.face}/${childDescriptor.level}/${childDescriptor.ix}/${childDescriptor.iy} vertex ${i},${j} ${childField}[${component}]`);
    }
  }

  const depth = Math.max(4, (2 / 2 ** childDescriptor.level) * RADIUS * 0.045);
  let skirt = CORE_COUNT;
  for (const edge of EDGE_SOURCES) for (const source of edge) {
    for (const [positionField, normalField, colorField] of [
      ['positions', 'normals', 'colors'],
      ['parentPositions', 'parentNormals', 'parentColors'],
    ]) {
      let lowering = 0;
      for (let axis = 0; axis < 3; axis++) {
        const core = child[positionField][source * 3 + axis];
        const lowered = child[positionField][skirt * 3 + axis];
        assert.ok(Number.isFinite(lowered));
        lowering += (core - lowered) * child.directions[source * 3 + axis];
        assertSameFloat(child[normalField][skirt * 3 + axis], child[normalField][source * 3 + axis], `${normalField} skirt copy`);
        assertSameFloat(child[colorField][skirt * 3 + axis], child[colorField][source * 3 + axis], `${colorField} skirt copy`);
      }
      assert.ok(Math.abs(lowering - depth) < 0.02, `${positionField} skirt lowering ${lowering}, expected ${depth}`);
    }
    let waterLowering = 0, parentWaterLowering = 0;
    for (let axis = 0; axis < 3; axis++) {
      waterLowering += (child.waterPositions[source * 3 + axis] - child.waterPositions[skirt * 3 + axis]) * child.directions[source * 3 + axis];
      parentWaterLowering += (child.parentWaterPositions[source * 3 + axis] - child.parentWaterPositions[skirt * 3 + axis]) * child.directions[source * 3 + axis];
    }
    assert.ok(Math.abs(waterLowering - depth) < 0.02);
    assert.ok(Math.abs(parentWaterLowering - depth) < 0.02);
    assertSameFloat(child.parentHeights[skirt], child.parentHeights[source], 'parentHeight skirt copy');
    skirt++;
  }
  for (const field of ['parentPositions', 'parentWaterPositions', 'parentNormals', 'parentColors', 'parentHeights']) {
    assert.equal(child[field].every(Number.isFinite), true, `${field} must remain finite`);
  }
  return { parent, child };
}

test('all child quadrants reconstruct coastal parent Float32 triangles and skirts', () => {
  const parentDescriptor = { face: 4, level: 7, ix: 92, iy: 82 };
  const parent = generatePatch(parentDescriptor);
  const coreHeights = parent.heights.slice(0, CORE_COUNT);
  assert.ok(Math.min(...coreHeights) < 0 && Math.max(...coreHeights) > 0, 'fixture must cross the actual coastline');
  for (let qy = 0; qy < 2; qy++) for (let qx = 0; qx < 2; qx++) {
    checkChildAgainstParent(parentDescriptor, {
      face: parentDescriptor.face,
      level: parentDescriptor.level + 1,
      ix: parentDescriptor.ix * 2 + qx,
      iy: parentDescriptor.iy * 2 + qy,
    });
  }
});

test('parent reconstruction holds at a cube-face edge and at high LOD', () => {
  const fixtures = [
    { face: 0, level: 4, ix: 0, iy: 7 },
    { face: 4, level: 15, ix: 23652, iy: 21092 },
  ];
  for (const parent of fixtures) for (let qy = 0; qy < 2; qy++) for (let qx = 0; qx < 2; qx++) {
    checkChildAgainstParent(parent, {
      face: parent.face,
      level: parent.level + 1,
      ix: parent.ix * 2 + qx,
      iy: parent.iy * 2 + qy,
    });
  }
});

test('terrain split threshold has hysteresis and respects maximum level', () => {
  const width = 100;
  assert.equal(wantsTerrainSplit(2, 17, 1e9, width, false), true);
  assert.equal(wantsTerrainSplit(17, 17, 0, width, true), false);
  assert.equal(wantsTerrainSplit(8, 17, width * TERRAIN_SPLIT_RATIO, width, false), false);
  assert.equal(wantsTerrainSplit(8, 17, width * TERRAIN_SPLIT_RATIO - 1e-9, width, false), true);
  assert.equal(wantsTerrainSplit(8, 17, width * 2, width, true), true);
  assert.equal(wantsTerrainSplit(8, 17, width * TERRAIN_MERGE_RATIO, width, true), false);
});

test('terrain morph takes the same elapsed time at any frame rate and reverses continuously', () => {
  for (const fps of [10, 30, 60]) {
    const steps = Math.round(TERRAIN_MORPH_SECONDS * fps);
    const dt = TERRAIN_MORPH_SECONDS / steps;
    let progress = 0;
    for (let frame = 0; frame < steps; frame++) {
      progress = advanceTerrainMorph(progress, 1, dt);
      if (frame < steps - 1) assert.ok(progress < 1, `${fps} Hz transition completed early`);
    }
    assert.ok(Math.abs(progress - 1) < 1e-14, `${fps} Hz transition did not complete in ${TERRAIN_MORPH_SECONDS}s`);
  }
  assert.equal(advanceTerrainMorph(0.2, 1, 5), 1, 'long/background frame reaches the upper target');
  assert.equal(advanceTerrainMorph(0.8, 0, 5), 0, 'long/background frame reaches the lower target');
  assert.equal(advanceTerrainMorph(0.4, 1, -1), 0.4);
  const forward = advanceTerrainMorph(0.35, 1, 0.06);
  const reversed = advanceTerrainMorph(forward, 0, 0.06);
  assert.ok(Math.abs(reversed - 0.35) < 1e-15);
  assert.equal(advanceTerrainMorph(0.99, 1, 0.1), 1);
  assert.equal(advanceTerrainMorph(0.01, 0, 0.1), 0);
  assert.equal(terrainMorphValue(0), 0);
  assert.equal(terrainMorphValue(0.5), 0.5);
  assert.equal(terrainMorphValue(1), 1);
  let previous = -1;
  for (let step = 0; step <= 100; step++) {
    const value = terrainMorphValue(step / 100);
    assert.ok(value >= previous && value >= 0 && value <= 1);
    previous = value;
  }
});

test('terrain morph shader preserves log depth and optionally morphs shading', () => {
  const compile = shading => {
    const material = new THREE.MeshStandardMaterial();
    addTerrainMorph(material, { value: 0.25 }, shading);
    const shader = {
      uniforms: {},
      vertexShader: '#include <common>\n#include <beginnormal_vertex>\n#include <color_vertex>\n#include <begin_vertex>\n#include <logdepthbuf_vertex>',
      fragmentShader: '#include <logdepthbuf_fragment>',
    };
    material.onBeforeCompile(shader);
    return { material, shader };
  };
  const land = compile(true);
  assert.match(land.shader.vertexShader, /mix\(parentPosition, position, terrainMorph\)/);
  assert.match(land.shader.vertexShader, /mix\(parentNormal, normal, terrainMorph\)/);
  assert.match(land.shader.vertexShader, /mix\(parentColor, color, terrainMorph\)/);
  assert.match(land.shader.vertexShader, /#include <logdepthbuf_vertex>/);
  assert.match(land.shader.fragmentShader, /#include <logdepthbuf_fragment>/);
  land.material.dispose();
  const depth = compile(false);
  assert.match(depth.shader.vertexShader, /attribute vec3 parentPosition/);
  assert.doesNotMatch(depth.shader.vertexShader, /parentNormal|parentColor/);
  depth.material.dispose();
});

test('Planet patch materials share template resources without cloning uniform userData', () => {
  const planet = Object.create(Planet.prototype);
  planet.scene = new THREE.Scene();
  planet.origin = new THREE.Vector3();
  planet.frame = 12;
  planet.jobs = new Map();
  planet.dispatch = () => {};
  const albedo = { value: new THREE.DataTexture(new Uint8Array(4), 1, 1) };
  const albedoReady = { value: 1 };
  planet.landMaterial = configureLandMaterial(new THREE.MeshStandardMaterial(), { planetAlbedo: albedo, albedoReady });
  planet.landMaterial.userData.cloneBomb = { toJSON() { throw new Error('patch cloned template userData'); } };
  planet.landMaterial.clone = () => { throw new Error('patch cloned land template'); };
  planet.waterMaterial = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { sunDirection: { value: new THREE.Vector3() }, time: { value: 0 } },
    vertexShader: 'void main(){gl_Position=vec4(position,1.0);}',
    fragmentShader: 'void main(){gl_FragColor=vec4(1.0);}',
  });
  planet.waterMaterial.clone = () => { throw new Error('patch cloned water template'); };

  const node = lifecycleNode(8);
  node.queued = true;
  planet.jobs.set(91, node);
  const data = generatePatch({ face: 4, level: 8, ix: 184, iy: 164 });
  assert.ok(data.heights.some(height => height < 50), 'fixture must create a water patch');
  assert.doesNotThrow(() => planet.receive({ busy: true }, { id: 91, ...data }));
  assert.equal(node.mesh.children.length, 2);

  const [land, water] = node.mesh.children;
  assert.notEqual(land.material, planet.landMaterial);
  assert.equal(Object.keys(land.material.userData).length, 0);
  assert.notEqual(water.material, planet.waterMaterial);
  assert.equal(water.material.uniforms.sunDirection, planet.waterMaterial.uniforms.sunDirection);
  assert.equal(water.material.uniforms.terrainMorph, node.morph);

  const shader = {
    uniforms: {}, defines: {},
    vertexShader: '#include <common>\n#include <beginnormal_vertex>\n#include <color_vertex>\n#include <begin_vertex>\n#include <worldpos_vertex>',
    fragmentShader: '#include <common>\n#include <color_fragment>\n#include <roughnessmap_fragment>\n#include <normal_fragment_maps>\n#include <aomap_fragment>',
  };
  land.material.onBeforeCompile(shader);
  assert.equal(shader.uniforms.tmCell, planet.landMaterial.userData.tmUniforms.tmCell);
  assert.equal(shader.uniforms.planetAlbedo, albedo);
  assert.equal(shader.uniforms.terrainMorph, node.morph);

  // A finer child can resolve entirely dry land while its coarse parent still
  // contains water. Keep the water draw until the parent-to-child morph ends.
  const dryNode = lifecycleNode(8);
  dryNode.queued = true;
  planet.jobs.set(92, dryNode);
  const dryData = generatePatch({ face: 4, level: 8, ix: 184, iy: 166 });
  assert.equal(dryData.heights.every(height => height >= 50), true, 'fixture fine patch must be dry');
  dryData.parentHeights[0] = 0;
  assert.equal(dryData.parentHeights.some(height => height < 50), true);
  planet.receive({ busy: true }, { id: 92, ...dryData });
  assert.equal(dryNode.mesh.children.length, 2, 'parent-wet morph target requires a water mesh');

  planet.disposeNode(node);
  planet.disposeNode(dryNode);
  planet.landMaterial.dispose();
  planet.waterMaterial.dispose();
  albedo.value.dispose();
});

let lifecycleKey = 0;
function lifecycleNode(level, { mesh = true, residentFrame = 0 } = {}) {
  return {
    key: `${level}/${lifecycleKey++}`,
    level,
    size: 2 / 2 ** level,
    normal: new THREE.Vector3(0, 0, 1),
    surfaceCenter: new THREE.Vector3(0, 0, RADIUS),
    center: new THREE.Vector3(0, 0, RADIUS),
    mesh: mesh ? { visible: false } : null,
    queued: false,
    lastUsed: 0,
    refined: false,
    wantsSplit: false,
    progress: 0,
    target: 0,
    childMorph: { value: 0 },
    morph: { value: 1 },
    residentFrame,
    children: null,
  };
}

function lifecycleFixture(root, frame = 10) {
  const planet = Object.create(Planet.prototype);
  const all = [];
  const collect = node => { all.push(node); for (const child of node.children ?? []) collect(child); };
  collect(root);
  planet.nodes = new Map(all.map(node => [node.key, node]));
  planet.roots = [root];
  planet.queue = [];
  planet.jobs = new Map();
  planet.frame = frame;
  planet.visibleCount = 0;
  planet.maxVisibleLevel = 0;
  planet.cameraWorld = new THREE.Vector3(0, 0, RADIUS + 3);
  planet.requested = [];
  planet.request = node => { planet.requested.push(node); };
  planet.dispatch = () => {};
  return planet;
}

test('Planet retains parent until all four children have survived two frames', () => {
  const parent = lifecycleNode(16);
  parent.children = Array.from({ length: 4 }, (_, index) => lifecycleNode(17, { residentFrame: index === 3 ? 9 : 8 }));
  const planet = lifecycleFixture(parent, 10);
  planet.select();
  assert.equal(parent.refined, false);
  assert.equal(parent.mesh.visible, true);
  assert.equal(parent.children.every(child => child.mesh.visible === false), true);

  parent.children[3].residentFrame = 8;
  planet.select();
  assert.equal(parent.refined, true);
  assert.equal(parent.mesh.visible, false);
  assert.equal(parent.children.every(child => child.mesh.visible), true);
  assert.equal(parent.target, 1);

  parent.refined = false;
  parent.children[2].mesh = null;
  planet.select();
  assert.equal(parent.refined, false);
  assert.equal(parent.mesh.visible, true, 'one missing quadrant must retain the complete parent');
});

test('Planet reverses a merge without swapping meshes and collapses descendants first', () => {
  const parent = lifecycleNode(15);
  parent.refined = true; parent.wantsSplit = true; parent.progress = 0.45; parent.childMorph.value = terrainMorphValue(parent.progress);
  parent.children = Array.from({ length: 4 }, () => lifecycleNode(16));
  const planet = lifecycleFixture(parent);
  planet.cameraWorld.z = RADIUS + parent.size * RADIUS * 3;
  planet.select();
  assert.equal(parent.target, 0);
  assert.equal(parent.refined, true);
  assert.equal(parent.mesh.visible, false);
  assert.equal(parent.children.every(child => child.mesh.visible), true);

  planet.cameraWorld.z = RADIUS + 3;
  planet.select();
  assert.equal(parent.target, 1);
  assert.equal(parent.refined, true);
  assert.equal(parent.mesh.visible, false, 'reversal must keep rendering the morphing children');

  const branch = parent.children[0];
  branch.refined = true; branch.wantsSplit = true; branch.progress = 1; branch.childMorph.value = 1;
  branch.children = Array.from({ length: 4 }, () => lifecycleNode(17));
  for (const grandchild of branch.children) planet.nodes.set(grandchild.key, grandchild);
  parent.progress = 1; parent.childMorph.value = 1;
  planet.cameraWorld.z = RADIUS + parent.size * RADIUS * 3;
  planet.select();
  assert.equal(branch.target, 0);
  assert.equal(parent.target, 1, 'parent waits while a child branch collapses');

  branch.progress = 0; branch.childMorph.value = 0;
  planet.select();
  assert.equal(branch.refined, false);
  assert.equal(parent.target, 1, 'parent observes descendant completion on the next traversal');
  planet.select();
  assert.equal(parent.target, 0);
  assert.equal(parent.children.every(child => child.mesh.visible), true);

  parent.progress = 0; parent.childMorph.value = 0;
  planet.select();
  assert.equal(parent.refined, false);
  assert.equal(parent.mesh.visible, true);
  assert.equal(parent.children.every(child => child.mesh.visible === false), true);
});
