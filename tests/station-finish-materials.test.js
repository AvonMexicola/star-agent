import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createStationFinishMaterials, ensureStationMaterialUVs } from '../src/station-finish-materials.js';
import { prepareStationFinishShadows, updateStationFinishSun } from '../src/station-finish-lighting.js';

const palette = { ivory: 'ivory', petrol: 'darkslategray', steel: 'slategray', dark: 'dimgray', rubber: 'black', ochre: 'goldenrod', cool: 'lightsteelblue' };
const kit = () => createStationFinishMaterials({ palette, textureLoader: { loadAsync: async () => new THREE.Texture() } });
const source = name => Object.assign(new THREE.MeshStandardMaterial(), { name });

test('station missing UVs cover two physical metres per interval on each hard face', () => {
  const geometry = new THREE.BoxGeometry(2, 4, 6);
  geometry.deleteAttribute('uv');
  assert.equal(ensureStationMaterialUVs(geometry, new THREE.Vector3(2, 1, 1)), true);
  const uv = geometry.getAttribute('uv');
  const normal = geometry.getAttribute('normal');
  const widths = [];
  for (let start = 0; start < uv.count; start += 4) {
    const x = [], y = [];
    for (let j = start; j < start + 4; j++) { x.push(uv.getX(j)); y.push(uv.getY(j)); }
    widths.push([Math.max(...x) - Math.min(...x), Math.max(...y) - Math.min(...y)]);
    assert.equal(normal.getX(start) ** 2 + normal.getY(start) ** 2 + normal.getZ(start) ** 2, 1);
  }
  assert.deepEqual(widths, [[3, 2], [3, 2], [2, 3], [2, 3], [2, 2], [2, 2]]);
  assert.equal(ensureStationMaterialUVs(geometry), false, 'authored/generated UVs are not overwritten');
});

test('station finish shares materials and UV storage across repeated pods and preserves custom/emissive assets', async () => {
  const finish = await kit();
  const root = new THREE.Group();
  const geometry = new THREE.BoxGeometry(); geometry.deleteAttribute('uv');
  const wall = new THREE.Mesh(geometry, source('Hull'));
  const repeated = new THREE.Mesh(geometry, source('HullPanel'));
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(), source('Hull'));
  lamp.material.emissive.set('white'); lamp.material.emissiveIntensity = 2;
  const custom = new THREE.Mesh(new THREE.BoxGeometry(), source('Hull'));
  custom.material.onBeforeCompile = () => {};
  const lampMaterial = lamp.material, customMaterial = custom.material;
  root.add(wall, repeated, lamp, custom);
  finish.apply(root);
  assert.equal(wall.material, repeated.material);
  assert.equal(wall.material, finish.materials.ivory);
  assert.equal(lamp.material, lampMaterial);
  assert.equal(custom.material, customMaterial);
  assert.equal(finish.stats.generatedUVs, 1);
  assert.equal(finish.stats.replacedMeshes, 2);
  const clone = root.clone(true);
  finish.apply(clone);
  assert.equal(clone.children[0].geometry, geometry);
  assert.equal(clone.children[0].material, wall.material);
  assert.equal(finish.stats.replacedMeshes, 2, 'applying after cloning is idempotent');
});

test('station colour and independent relief use correct colour spaces and native log-depth shader path', async () => {
  const finish = await kit();
  assert.equal(finish.textures.deck.colorSpace, THREE.SRGBColorSpace);
  assert.equal(finish.textures.powdercoat.colorSpace, THREE.NoColorSpace);
  assert.equal(finish.textures.brushed.colorSpace, THREE.NoColorSpace);
  assert.equal(finish.textures.deck.repeat.x, 1);
  assert.equal(finish.textures.deck.wrapS, THREE.MirroredRepeatWrapping);
  assert.equal(finish.textures.deck.wrapT, THREE.MirroredRepeatWrapping);
  for (const material of Object.values(finish.materials)) {
    assert.equal(material.onBeforeCompile, THREE.Material.prototype.onBeforeCompile);
    assert.equal(material.userData.stationFinished, true);
    assert.equal(material.userData.unweathered, true);
    assert.ok(material.bumpScale < .002, 'manufacturing grain stays below two millimetres');
  }
  assert.equal(finish.materials.deck.map, finish.textures.deck);
  assert.notEqual(finish.materials.deck.bumpMap, finish.materials.deck.map);
  assert.ok(finish.stats.estimatedTextureBytes < 7 * 1024 * 1024);
});

test('only the authored control-room pane is dimmed; navigation and working lights retain their materials', async () => {
  const finish = await kit(), root = new THREE.Group();
  const names = ['ControlGlass', 'Window', 'HangarLight', 'Mint', 'Amber', 'NavLight_Red', 'NavLight_Green'];
  const meshes = names.map(name => {
    const material = source(name); material.emissive.set('white'); material.emissiveIntensity = 3.2;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material); root.add(mesh); return {mesh, material};
  });
  const glass = new THREE.Mesh(new THREE.BoxGeometry(), source('FinishGlass')); glass.material.transparent = true; root.add(glass);
  finish.apply(root);
  assert.equal(meshes[0].mesh.material, finish.materials.galleryBack);
  assert.ok(meshes[0].mesh.material.emissiveIntensity < .1);
  for (const {mesh, material} of meshes.slice(1)) assert.equal(mesh.material, material);
  assert.equal(glass.material, finish.materials.observationGlass);
  assert.equal(glass.material.depthWrite, false);
  assert.ok(glass.material.opacity < .2);
});

test('hangar sun shadows restore the original flight settings and update projection only on transitions', () => {
  const sun = new THREE.DirectionalLight('white', 4.1);
  const camera = sun.shadow.camera;
  Object.assign(camera, { left: -120, right: 135, top: 99, bottom: -80, near: 2, far: 700 });
  sun.shadow.normalBias = .13;
  const bounds = ['left', 'right', 'top', 'bottom'].map(key => camera[key]);
  let updates = 0;
  const update = camera.updateProjectionMatrix.bind(camera);
  camera.updateProjectionMatrix = () => { updates++; update(); };
  updateStationFinishSun(sun, false);
  const flightProjection = camera.projectionMatrix.clone();
  assert.equal(sun.intensity, 4.1);
  updateStationFinishSun(sun, true);
  assert.equal(sun.intensity, .65);
  assert.deepEqual(['left', 'right', 'top', 'bottom'].map(key => camera[key]), [-45, 45, 45, -45]);
  assert.equal(sun.shadow.normalBias, .045);
  assert.equal(camera.near, 2); assert.equal(camera.far, 700);
  assert.equal(camera.projectionMatrix.equals(flightProjection), false);
  const transitions = updates;
  for (let frame = 0; frame < 10; frame++) updateStationFinishSun(sun, true);
  assert.equal(updates, transitions, 'steady hangar frames do not rebuild the shadow projection');
  updateStationFinishSun(sun, false);
  assert.equal(sun.intensity, 4.1);
  assert.equal(sun.shadow.normalBias, .13);
  assert.deepEqual(['left', 'right', 'top', 'bottom'].map(key => camera[key]), bounds);
  assert.ok(camera.projectionMatrix.equals(flightProjection));
});

test('print and glazing shadow policy removes opaque shadow cards while retaining manufactured prop shadows', () => {
  const root = new THREE.Group();
  const add = (name, material = new THREE.MeshStandardMaterial()) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), material);
    mesh.name = name; mesh.castShadow = true; mesh.receiveShadow = true; root.add(mesh); return mesh;
  };
  const sign = add('Sign_Print_Selene'), marking = add('DeckMarkings_1'), number = add('DeckNumber');
  const glass = add('Detail_OperationsGlass', new THREE.MeshStandardMaterial({ transparent: true, opacity: .14 }));
  const mixed = add('MixedGlazing', [new THREE.MeshStandardMaterial(), new THREE.MeshStandardMaterial({ transparent: true })]);
  const frame = add('Detail_PrintFrame'), caseMesh = add('StationProps_Petrol');
  prepareStationFinishShadows(root);
  for (const mesh of [sign, marking, number, glass, mixed]) {
    assert.equal(mesh.castShadow, false, `${mesh.name} must not cast an opaque card shadow`);
    assert.equal(mesh.receiveShadow, true, 'paper and glazing still receive scene lighting/shadows');
  }
  assert.equal(frame.castShadow, true, 'physical poster frame retains its contact shadow');
  assert.equal(caseMesh.castShadow, true, 'manufactured storage retains its grounding shadow');
});
