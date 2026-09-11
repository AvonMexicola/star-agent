import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createHub } from '../src/station-architecture.js';
import { attachPromenade, promenadeInteraction, addPromenadeShell, PROMENADE_SHOPS, PROMENADE_SEALED_DOOR, PROMENADE_VOLUMES, PROMENADE_SHELL } from '../src/station-promenade.js';
import { hubVolumes, hubFrameMethods, STATION_HUB_PORTAL } from '../src/station-hub-policy.js';
import { buildStationColliders, constrainStationSweep } from '../src/station-collision.js';
import { STATION_SHOPS } from '../src/station-shop.js';
import { SHIP_LAYOUT } from '../src/boarding.js';

const vector = point => new THREE.Vector3(...point);
const extentMin = new THREE.Vector3(-.25, -SHIP_LAYOUT.eyeHeight, -.25);
const extentMax = new THREE.Vector3(.25, .15, .25);
const sign = () => null; // Canvas typography is exercised by the browser suite.
const EYE = -8 + SHIP_LAYOUT.eyeHeight;
let cached;
async function asset() {
  if (!cached) cached = (async () => {
    const bytes = await readFile(new URL('../public/models/station-promenade.glb', import.meta.url));
    const gltf = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
    return { ...gltf, bytes: bytes.length };
  })();
  return cached;
}
/** The occupied hub exactly as StationComplex assembles it: the room BVH is
 * built from the procedural concourse and promenade shell BEFORE the authored
 * kit loads, and the kit contributes measured collision boxes instead of its
 * render triangles. Building the tree after attaching would make laid floor
 * finishes and threshold plates solid, which the runtime never does. */
async function hub() {
  const frame = createHub();
  Object.assign(frame, hubFrameMethods(), {
    toLocal: (world, target) => target.copy(world),
    toWorld: (local, target) => target.copy(local),
  });
  frame.group.updateMatrixWorld(true);
  frame.colliders = buildStationColliders(frame.group);
  attachPromenade(frame, await asset(), { sign });
  frame.group.updateMatrixWorld(true);
  return frame;
}
function sweep(tree, boxes, a, b, blocked = false, message = '') {
  const end = vector(b);
  const result = constrainStationSweep(tree, boxes, vector(a), end, extentMin, extentMax);
  assert.equal(result.hit, blocked, `${a} -> ${b} should be ${blocked ? 'blocked' : 'clear'} ${message}`);
  return result;
}
function upward(scene, x, y, z, limit = 6) {
  return new THREE.Raycaster(new THREE.Vector3(x, y, z), new THREE.Vector3(0, 1, 0), 0, limit).intersectObject(scene, true)[0];
}

test('promenade export fits its per-assembly budgets and measured bounds', async () => {
  const { scene, bytes } = await asset();
  scene.updateMatrixWorld(true);
  const manifest = JSON.parse(scene.userData.assetManifest);
  assert.equal(manifest.length, 32, 'every storefront, fixture and the bulkhead is measured independently');
  const allowed = manifest.map(({ bounds }) => new THREE.Box3(vector(bounds.min), vector(bounds.max)).expandByScalar(.002));
  let triangles = 0, meshes = 0;
  const point = new THREE.Vector3();
  scene.traverse(mesh => {
    if (!mesh.isMesh) return;
    meshes++;
    const positions = mesh.geometry.attributes.position;
    triangles += (mesh.geometry.index?.count ?? positions.count) / 3;
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
      assert.ok(allowed.some(box => box.containsPoint(point)), `vertex ${point.toArray()} lies outside its manifest`);
    }
  });
  assert.equal(triangles, manifest.reduce((sum, assembly) => sum + assembly.triangles, 0), 'manifest total matches actual index data');
  for (const assembly of manifest) {
    assert.ok(assembly.triangles > 0 && assembly.triangles <= 10_000, `${assembly.name} triangle budget`);
    assert.ok(assembly.standaloneBytes > 0 && assembly.standaloneBytes <= 1_000_000, `${assembly.name} byte budget`);
  }
  assert.ok(bytes <= manifest.reduce((sum, assembly) => sum + assembly.standaloneBytes, 0), 'batching is smaller than the complete individual exports');
  assert.equal(meshes, 10, 'one static draw per physical finish');
  assert.ok(bytes <= 4_400_000, `promenade download ${bytes}`);
  // This kit ships no image maps; the station finish generates metre UVs at
  // load, so a second authored UV channel on 150k vertices is not exported.
  assert.ok(!scene.getObjectByProperty('isMesh', true).geometry.hasAttribute('uv'));
  const bounds = new THREE.Box3().setFromObject(scene);
  assert.ok(bounds.min.x >= -13.31 && bounds.max.x <= 13.31, 'kit stays inside the annex hull');
  assert.ok(bounds.min.y >= -8.011 && bounds.max.y <= -3.44, 'nothing reaches through the corridor ceiling');
  assert.ok(bounds.min.z >= -49.68 && bounds.max.z <= -21.14, 'kit sits entirely aft of the concourse portal');
});

test('the concourse aft wall opens onto a walkable corridor and every unit can be entered', async () => {
  const frame = await hub();
  const tree = frame.colliders;
  // The former dead-end directory wall is now a route: this walk starts inside
  // the concourse, crosses the portal and reaches the aft hall.
  sweep(tree, frame.staticBoxes, [0, EYE, -14], [0, EYE, -46], false, 'concourse to aft hall');
  for (const x of [-3.6, 3.6]) sweep(tree, frame.staticBoxes, [x, EYE, -20], [x, EYE, -46], false, 'corridor edge lane');
  for (const { x, z, shopId } of PROMENADE_SHOPS) {
    const side = Math.sign(x);
    sweep(tree, frame.staticBoxes, [side * 3.9, EYE, z], [x, EYE, z], false, `entering ${shopId}`);
    sweep(tree, frame.staticBoxes, [x, EYE, z], [side * 11.4, EYE, z], true, `${shopId} counter is solid`);
    sweep(tree, frame.staticBoxes, [x, EYE, z], [x, EYE, z + 3.4], false, `browsing along ${shopId}`);
  }
  // The mid court is open to the station windows; its glazing, seating and
  // planting are solid.
  for (const side of [-1, 1]) {
    sweep(tree, frame.staticBoxes, [0, EYE, -30.9], [side * 12.2, EYE, -30.9], false, 'mid-court wing');
    sweep(tree, frame.staticBoxes, [side * 12.2, EYE, -30.9], [side * 14.6, EYE, -30.9], true, 'mid-court glazing');
    sweep(tree, frame.staticBoxes, [side * 9.4, EYE, -30.9], [side * 9.4, EYE, -33.9], true, 'a passenger cannot walk through the bench and planter');
    sweep(tree, frame.staticBoxes, [side * 12.2, EYE, -30.9], [side * 12.2, EYE, -33.9], false, 'a window lane stays open beside the seating');
  }
});

test('the aft bulkhead is locked, and its door reports sealed rather than opening', async () => {
  const frame = await hub();
  const tree = frame.colliders;
  sweep(tree, frame.staticBoxes, [0, EYE, -45], [0, EYE, -50.5], true, 'sealed pressure leaves');
  for (const x of [-2.4, 2.4]) sweep(tree, frame.staticBoxes, [x, EYE, -45], [x, EYE, -50.5], true, 'both leaves are solid');
  const { z, approach } = PROMENADE_SEALED_DOOR;
  const at = promenadeInteraction(new THREE.Vector3(0, EYE, z + approach - .3));
  assert.equal(at?.kind, 'unavailable', 'the door is an explained obstacle, not an unhandled wall');
  assert.match(at.label, /SEALED/);
  assert.equal(promenadeInteraction(new THREE.Vector3(0, EYE, z + approach + 2)), null, 'the notice does not follow the player up the corridor');
  const scene = (await asset()).scene;
  assert.ok(scene.getObjectByName('SealedDoorSign'), 'the header carries a runtime destination sign');
  assert.ok(scene.getObjectByName('SealedDoorPanel'), 'the control panel carries its own sealed label');
});

test('each unit has its own opaque ceiling and keeps full walking headroom', async () => {
  const scene = (await asset()).scene.clone(true);
  scene.updateMatrixWorld(true);
  for (const { x, z } of PROMENADE_SHOPS) {
    const side = Math.sign(x);
    // Cast from above the tallest fixture in any unit (a shelving header tops
    // out at -5.3) so this measures the ceiling rather than the merchandise.
    for (const dx of [5.6, 8, 10.4, 12.4]) for (const dz of [-3.4, -1.1, 1.2, 3.5]) {
      const hit = upward(scene, side * dx, -5, z + dz);
      assert.ok(hit, `unit ceiling closes the sky above ${side * dx},${z + dz}`);
      assert.ok(hit.point.y >= -4.67 && hit.point.y <= -4.37, `visible underside clearance ${hit.point.y}`);
    }
    // An oblique view from the customer aisle must meet the storefront fascia
    // or the ceiling, never escape over a low wall into space.
    for (const dz of [-2.6, 0, 2.6]) {
      const ray = new THREE.Raycaster(new THREE.Vector3(side * 6.4, -6.25, z + dz), new THREE.Vector3(-side * .8, .6, 0).normalize(), 0, 20);
      const hit = ray.intersectObject(scene, true)[0];
      assert.ok(hit && hit.point.y >= -4.8 && hit.point.y <= -3.4, 'the aisle looks up into a sealed soffit');
    }
  }
});

test('the corridor shell is sealed overhead and underfoot along its whole length', async () => {
  const frame = await hub();
  for (let z = -20; z >= -49; z -= 1.5) {
    for (const x of [-4.2, 0, 4.2]) {
      const above = upward(frame.group, x, -6.1, z);
      assert.ok(above, `corridor ceiling exists above ${x},${z}`);
      assert.ok(above.point.y <= -3.4, `corridor ceiling is overhead at ${x},${z}`);
      const below = new THREE.Raycaster(new THREE.Vector3(x, -6.1, z), new THREE.Vector3(0, -1, 0), 0, 4).intersectObject(frame.group, true)[0];
      assert.ok(below && Math.abs(below.point.y + 8) < .02, `deck is underfoot at ${x},${z}`);
    }
  }
});

test('hub volumes give deck support across both rooms and stop at their walls', async () => {
  const frame = await hub();
  assert.equal(hubVolumes(frame).length, 3, 'concourse plus the two promenade volumes');
  const supported = point => frame.deckPoint(vector(point), SHIP_LAYOUT.eyeHeight);
  for (const point of [[0, EYE, 10], [0, EYE, -18], [0, EYE, -25], [-11, EYE, -25.7], [11, EYE, -38.9], [12.5, EYE, -32.3], [0, EYE, -48]]) {
    assert.ok(supported(point), `deck support at ${point}`);
  }
  for (const point of [[0, EYE, -52], [11, EYE, -47], [-11, EYE, -20], [15, EYE, -32.3]]) {
    assert.equal(supported(point), null, `no invented floor beside the corridor at ${point}`);
  }
  assert.equal(frame.isInsideHangar(vector([0, EYE, -40])), true);
  assert.equal(frame.isInsideHangar(vector([0, EYE, -60])), false);
  // The two annex volumes overlap the concourse box at the portal, so a step
  // across the threshold is never unsupported for a frame.
  const concourse = frame.interiorBox, corridor = new THREE.Box3(vector(PROMENADE_VOLUMES[0].min), vector(PROMENADE_VOLUMES[0].max));
  assert.ok(corridor.max.z > concourse.min.z + .3, 'promenade volume overlaps the concourse deck support inset');
  assert.equal(STATION_HUB_PORTAL.z, concourse.min.z, 'the opening is cut in the wall the concourse volume ends at');
});

test('counter approaches resolve to the right catalogue and stay apart', async () => {
  for (const { shopId, name, x, z } of PROMENADE_SHOPS) {
    const at = promenadeInteraction(new THREE.Vector3(x, EYE, z));
    assert.equal(at?.kind, 'shop');
    assert.equal(at.shopId, shopId);
    assert.equal(at.label, `F · ${name}`);
    assert.ok(Object.hasOwn(STATION_SHOPS, shopId), `${shopId} has a real catalogue`);
    assert.equal(STATION_SHOPS[shopId].name, name, 'storefront sign and modal title agree');
    assert.equal(promenadeInteraction(new THREE.Vector3(x, EYE, z + 2.4)), null, 'the prompt ends within reach of the counter');
  }
  const corridor = promenadeInteraction(new THREE.Vector3(0, EYE, -25.7));
  assert.equal(corridor, null, 'walking the corridor offers nothing to press');
});

test('display stock is varied, human scale and sits on real fixtures', async () => {
  const { scene } = await asset();
  scene.updateMatrixWorld(true);
  const stock = JSON.parse(scene.userData.stockManifest);
  const of = kind => stock.filter(item => item.kind === kind);
  const size = item => vector(item.bounds.max).sub(vector(item.bounds.min));
  assert.ok(new Set(stock.map(item => item.kind)).size >= 10, 'four units do not repeat one prop');
  for (const [kind, minimum] of [['hangingGarment', 8], ['foldedStack', 9], ['growTray', 6], ['potPlant', 12], ['hullModel', 6], ['mealTin', 6], ['giftBox', 4]]) {
    assert.ok(of(kind).length >= minimum, `${kind} count ${of(kind).length}`);
  }
  for (const item of of('hangingGarment')) {
    const extent = size(item);
    assert.ok(extent.y > .75 && extent.y < 1.25, `a hung garment is ${extent.y} m tall`);
    assert.ok(extent.x < .45 && extent.z < .45, 'garments keep a wearable width and depth');
  }
  for (const item of of('potPlant')) {
    const extent = size(item);
    assert.ok(extent.y > .25 && extent.y < 1.05, `a potted plant is ${extent.y} m tall`);
  }
  for (const item of of('hullModel')) assert.ok(size(item).z < .55, 'display hulls stay desk scale, not parked ships');
  for (const item of of('mealTin')) assert.ok(size(item).y < .16, 'meal tins are trays, not crates');
  // Every unit's stock belongs to that unit's own fixtures.
  for (const prefix of ['Galley', 'Outfitter', 'Hydroponics', 'Souvenir']) {
    assert.ok(stock.some(item => item.rack.startsWith(prefix)), `${prefix} has authored display stock`);
  }
  const garment = of('hangingGarment')[0];
  const rail = new THREE.Raycaster(new THREE.Vector3(garment.bounds.min[0] - .4, garment.bounds.max[1] - .1,
    (garment.bounds.min[2] + garment.bounds.max[2]) / 2), new THREE.Vector3(1, 0, 0), 0, 1).intersectObject(scene, true)[0];
  assert.ok(rail, 'a hung garment has real geometry where its manifest says it is');
});

test('the suspended gantry clears a walking body and leaves the portal open', async () => {
  const frame = await hub();
  for (const x of [-4, -2, 0, 2, 4]) sweep(frame.colliders, [], [x, EYE, -14], [x, EYE, -19.5], false, 'walking beneath the hanging sign');
  // Its underside stays clear of a jumping head, and it hangs ahead of the wall.
  const box = new THREE.Box3();
  frame.promenade.group.updateMatrixWorld(true);
  frame.promenade.group.traverse(mesh => { if (mesh.isMesh && mesh.name.startsWith('PromenadeStructure')) box.expandByObject(mesh); });
  assert.ok(box.max.z > -18, 'the gantry is inside the concourse, in front of the portal');
  const under = upward(frame.promenade.group, 0, -5.6, -17, 1.2);
  assert.ok(under, 'the sign box has a real underside');
  assert.ok(under.point.y <= -4.85 && under.point.y >= -5.0, `sign underside at ${under?.point.y}`);
  assert.ok(under.point.y - (-8) > 2.9, 'a standing passenger walks under the gantry with clearance');
});

test('the distant annex shell covers the walkable rooms and adds no flight collision', async () => {
  const parent = new THREE.Group();
  addPromenadeShell(parent, new THREE.MeshBasicMaterial());
  assert.equal(parent.children.length, PROMENADE_SHELL.length);
  parent.updateMatrixWorld(true);
  const shell = new THREE.Box3().setFromObject(parent);
  for (const { min, max } of PROMENADE_VOLUMES) {
    // Each volume is authored 0.35 m proud of its walls; the shell wraps the
    // actual room, and its forward end is covered by the concourse's own shell.
    const room = new THREE.Box3(vector(min), vector(max)).expandByScalar(-.35);
    assert.ok(shell.containsBox(room), `the shell encloses ${min}..${max}`);
  }
  assert.ok(shell.max.z >= -19, 'the annex shell meets the concourse shell without a gap');
  // Named Detail so buildStationColliders skips it: the hub's own geometry is
  // the solid a ship hits, exactly as the concourse shell already works.
  for (const mesh of parent.children) assert.match(mesh.name, /Detail/);
  assert.equal(buildStationColliders(parent).bounds.isEmpty(), true, 'the stand-in contributes no collision triangles');
  // It must not reach forward past the concourse wall, which has its own shell.
  assert.ok(shell.max.z <= -18.5, 'the annex shell stops at the concourse wall');
});
