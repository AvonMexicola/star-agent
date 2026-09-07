// Native asset fixture authored by the Bastion builder; independent art review
// belongs to another reviewer. No model/material substitutions or game effects.
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const config = __BASTION_CONFIG__;
const raw = await (await fetch('/models/station-defense.glb')).arrayBuffer();
const servedSHA = [...new Uint8Array(await crypto.subtle.digest('SHA-256', raw))]
  .map(value => value.toString(16).padStart(2, '0')).join('');
if (servedSHA !== config.assetSHA) throw new Error('Served Bastion identity changed');
const loaded = await new GLTFLoader().parseAsync(raw, new URL('/models/', location.href).href);
const model = loaded.scene;
const rig = Object.fromEntries(['Bastion', 'Bastion_Base', 'Bastion_Yaw', 'Bastion_Pitch',
  'Bastion_Recoil_Port', 'Bastion_Recoil_Starboard', 'Bastion_Muzzle_Port', 'Bastion_Muzzle_Starboard']
  .map(name => [name, model.getObjectByName(name)]));
if (Object.values(rig).some(node => !node)) throw new Error('Missing exported Bastion rig');
const yaw = rig.Bastion_Yaw, pitch = rig.Bastion_Pitch;
const recoils = [rig.Bastion_Recoil_Port, rig.Bastion_Recoil_Starboard];
const muzzles = [rig.Bastion_Muzzle_Port, rig.Bastion_Muzzle_Starboard];
if (yaw.parent !== rig.Bastion || pitch.parent !== yaw ||
    muzzles.some(node => node.parent !== pitch) || recoils.some(node => node.parent !== pitch)) {
  throw new Error('Articulation parent contract changed');
}
if (pitch.position.distanceTo(new T.Vector3(...config.layout.pitchPivot)) > 1e-6) {
  throw new Error('Pitch pivot changed');
}

const renderer = new T.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true,
  preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(1600, 900);
renderer.outputColorSpace = T.SRGBColorSpace;
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
document.body.append(renderer.domElement);

const scene = new T.Scene();
scene.background = new T.Color('#18242b');
scene.add(model);
const pmrem = new T.PMREMGenerator(renderer);
const room = new RoomEnvironment();
const environment = pmrem.fromScene(room, 0.04);
scene.environment = environment.texture;
scene.environmentIntensity = 0.75;
room.dispose();
model.traverse(node => {
  if (!node.isMesh) return;
  const materials = Array.isArray(node.material) ? node.material : [node.material];
  node.castShadow = materials.every(material => !material.transparent);
  node.receiveShadow = true;
});

// Same exposure, environment and key/fill ratios as the verified rover native
// review. Scale light distances and shadow coverage to the 39 m battery.
const key = new T.DirectionalLight(0xffeedb, 2.6);
key.position.set(-80, 100, -60);
key.castShadow = true;
key.shadow.mapSize.set(4096, 4096);
key.shadow.bias = -0.00008;
key.shadow.normalBias = 0.020;
scene.add(key, key.target);
const fill = new T.DirectionalLight(0xc2e6f7, 1.0);
fill.position.set(80, 40, 70);
scene.add(fill, new T.HemisphereLight(0xdde8e5, 0x5c7380, 0.35));
const floor = new T.Mesh(new T.PlaneGeometry(140, 140), new T.MeshStandardMaterial({
  color: 0x28383e, roughness: 0.8, metalness: 0.1,
}));
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.012;
floor.receiveShadow = true;
scene.add(floor);
const grid = new T.GridHelper(100, 100, 0x647772, 0x354b51);
grid.position.y = -0.008;
grid.material.transparent = true;
grid.material.opacity = 0.4;
grid.material.depthWrite = false;
scene.add(grid);

function vertices(root = model) {
  scene.updateMatrixWorld(true);
  const output = [], point = new T.Vector3();
  root.traverseVisible(node => {
    if (!node.isMesh) return;
    for (let i = 0; i < node.geometry.attributes.position.count; i++) {
      node.getVertexPosition(i, point);
      output.push(point.clone().applyMatrix4(node.matrixWorld));
    }
  });
  return output;
}
const boxRecord = box => ({ min: box.min.toArray(), max: box.max.toArray() });
function materialRecords() {
  const records = new Map();
  model.traverse(node => {
    if (!node.isMesh) return;
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      if (records.has(material.uuid)) continue;
      records.set(material.uuid, {
        name: material.name, type: material.type, side: material.side,
        transparent: material.transparent, opacity: material.opacity,
        color: material.color?.toArray(), roughness: material.roughness,
        metalness: material.metalness, vertexColors: material.vertexColors,
        emissive: material.emissive?.toArray(), emissiveIntensity: material.emissiveIntensity,
        normalScale: material.normalScale?.toArray(),
        maps: ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap'].map(slot => {
          const texture = material[slot];
          return { slot, present: Boolean(texture), name: texture?.name,
            width: texture?.image?.width, height: texture?.image?.height,
            colorSpace: texture?.colorSpace, channel: texture?.channel };
        }),
      });
    }
  });
  return [...records.values()];
}
const nativeMaterials = materialRecords();
let assetTriangles = 0, assetMeshes = 0;
model.traverse(node => {
  if (!node.isMesh) return;
  assetMeshes++;
  assetTriangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3;
});
if (assetTriangles !== 9177 || assetMeshes !== 9 || nativeMaterials.length !== 2) {
  throw new Error('Unexpected native asset resource counts');
}
const mapped = nativeMaterials.find(material => material.maps.some(map => map.present));
if (!mapped || mapped.maps.filter(map => map.present).some(map => map.width !== 512 || map.height !== 512)) {
  throw new Error('Native PBR map decode/dimensions failed');
}

function pose(spec) {
  yaw.rotation.set(0, spec.yaw ?? 0, 0);
  pitch.rotation.set(spec.pitch ?? 0, 0, 0);
  const offsets = [spec.portRecoil ?? 0, spec.starboardRecoil ?? 0];
  for (let i = 0; i < 2; i++) {
    recoils[i].position.set(0, 0, offsets[i]);
    muzzles[i].position.fromArray(config.layout.muzzles[i].position);
    muzzles[i].position.z += offsets[i];
  }
  scene.updateMatrixWorld(true);
  const ry = new T.Matrix4().makeRotationY(spec.yaw ?? 0);
  const rx = new T.Matrix4().makeRotationX(spec.pitch ?? 0);
  const expectedDirection = new T.Vector3(0, 0, -1).transformDirection(rx).transformDirection(ry);
  const records = muzzles.map((node, i) => {
    const expected = new T.Vector3(...config.layout.muzzles[i].position);
    expected.z += offsets[i];
    expected.applyMatrix4(rx).add(new T.Vector3(...config.layout.pitchPivot)).applyMatrix4(ry);
    const actual = node.getWorldPosition(new T.Vector3());
    const direction = new T.Vector3(0, 0, -1).transformDirection(node.matrixWorld);
    const error = actual.distanceTo(expected);
    if (error > 1e-5 || direction.dot(expectedDirection) < 1 - 1e-9) {
      throw new Error('Actual native muzzle pose does not match requested pose');
    }
    return { name: node.name, recoil: offsets[i], position: actual.toArray(),
      direction: direction.toArray(), positionErrorMetres: error };
  });
  return { yaw: yaw.rotation.y, pitch: pitch.rotation.x, muzzles: records };
}

function fit(points, direction) {
  const bounds = new T.Box3().setFromPoints(points);
  const target = bounds.getCenter(new T.Vector3());
  const camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 400);
  camera.position.copy(target).addScaledVector(new T.Vector3(...direction).normalize(), 140);
  camera.lookAt(target);
  camera.updateMatrixWorld(true);
  const projected = new T.Box3().setFromPoints(points.map(point =>
    point.clone().applyMatrix4(camera.matrixWorldInverse)));
  const center = projected.getCenter(new T.Vector3());
  const correction = new T.Vector3(center.x, center.y, 0).applyQuaternion(camera.quaternion);
  camera.position.add(correction);
  target.add(correction);
  camera.lookAt(target);
  const size = projected.getSize(new T.Vector3());
  const height = Math.max(size.y, size.x / (1600 / 900)) * 1.16;
  Object.assign(camera, { left: -height * (1600 / 900) / 2, right: height * (1600 / 900) / 2,
    bottom: -height / 2, top: height / 2 });
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return { camera, target, height, bounds };
}

function projectedBounds(points, camera) {
  const box = new T.Box3().setFromPoints(points.map(point => point.clone().project(camera)));
  return boxRecord(box);
}
function fitShadow(points) {
  const direction = key.target.position.clone().sub(key.position).normalize();
  const coverage = points.map(point => point.clone());
  for (const point of points) {
    if (point.y >= floor.position.y) coverage.push(point.clone().addScaledVector(direction,
      (floor.position.y - point.y) / direction.y));
  }
  key.shadow.updateMatrices(key);
  const box = new T.Box3().setFromPoints(coverage.map(point =>
    point.applyMatrix4(key.shadow.camera.matrixWorldInverse)));
  const camera = key.shadow.camera;
  Object.assign(camera, { left: box.min.x - 0.5, right: box.max.x + 0.5,
    bottom: box.min.y - 0.5, top: box.max.y + 0.5,
    near: Math.max(0.1, -box.max.z - 1), far: -box.min.z + 1 });
  camera.updateProjectionMatrix();
  key.shadow.updateMatrices(key);
  return { left: camera.left, right: camera.right, bottom: camera.bottom, top: camera.top,
    near: camera.near, far: camera.far, bias: key.shadow.bias, normalBias: key.shadow.normalBias,
    mapSize: key.shadow.mapSize.toArray() };
}

const gl = renderer.getContext();
const debug = gl.getExtension('WEBGL_debug_renderer_info');
const backend = debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
if (/swiftshader|llvmpipe|software/i.test(backend)) throw new Error('Hardware capture required; no software fallback');
window.bastionReview = {
  ready: true, servedSHA, backend, assetTriangles, assetMeshes, nativeMaterials,
  async draw(spec) {
    document.querySelector('#caption').textContent = spec.label;
    const poseRecord = pose(spec);
    const allPoints = vertices();
    const framed = spec.detail === 'bores' ? allPoints.filter(point => point.z < -23.8)
      : spec.detail === 'base' ? allPoints.filter(point => point.z >= -8.15) : allPoints;
    if (framed.length < 100) throw new Error('Empty inspection target');
    const fitted = fit(framed, spec.direction);
    const margins = projectedBounds(framed, fitted.camera);
    if (Math.max(...margins.min.slice(0, 2).map(Math.abs),
      ...margins.max.slice(0, 2).map(Math.abs)) > 0.87) throw new Error('Vertex framing guard failed');
    if (margins.min[2] < -1 || margins.max[2] > 1) throw new Error('Inspection depth clipping');
    const shadowFrustum = fitShadow(allPoints);
    renderer.compile(scene, fitted.camera);
    renderer.render(scene, fitted.camera);
    await new Promise(requestAnimationFrame);
    renderer.render(scene, fitted.camera);
    if (JSON.stringify(materialRecords()) !== JSON.stringify(nativeMaterials)) {
      throw new Error('Imported native material was altered by the fixture');
    }
    const buffer = renderer.getDrawingBufferSize(new T.Vector2()).toArray();
    if (buffer[0] !== 1600 || buffer[1] !== 900) throw new Error('Unexpected render scale');
    return {
      file: spec.name + '.png', spec, pose: poseRecord, viewport: [1600, 900], renderBuffer: buffer,
      camera: { type: 'OrthographicCamera', position: fitted.camera.position.toArray(),
        target: fitted.target.toArray(), height: fitted.height,
        projectionMatrix: fitted.camera.projectionMatrix.toArray() },
      modelBounds: boxRecord(new T.Box3().setFromPoints(allPoints)),
      framedBounds: boxRecord(fitted.bounds), framedVertexCount: framed.length,
      fullVertexCount: allPoints.length, framedMarginsNDC: margins,
      fullModelMarginsNDC: projectedBounds(allPoints, fitted.camera),
      detailCrop: spec.detail ?? null,
      sceneDrawCalls: renderer.info.render.calls, sceneTriangles: renderer.info.render.triangles,
      sceneLines: renderer.info.render.lines, assetTriangles, assetMeshes,
      shadows: { rendererEnabled: renderer.shadowMap.enabled, keyCasts: key.castShadow,
        floorReceives: floor.receiveShadow, frustum: shadowFrustum },
      nativeMaterialsUnchanged: true,
      scope: 'Isolated native PBR still. Explicit detail crops, actual named poses. No station integration, transition quality, strike authority or FPS certification.',
    };
  },
};
