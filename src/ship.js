import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** A compact landing-capable explorer: Y up, nose -Z, landing pads at Y = 0. */
export function createShip() {
  const ship = new THREE.Group();
  ship.name = 'Nomad surface explorer';
  const materials = {
    hull: new THREE.MeshStandardMaterial({ color: 0xc8d2cf, metalness: .48, roughness: .39 }),
    trim: new THREE.MeshStandardMaterial({ color: 0x788d90, metalness: .7, roughness: .34 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x15232b, metalness: .63, roughness: .44 }),
    black: new THREE.MeshStandardMaterial({ color: 0x070e14, metalness: .25, roughness: .75 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x153e5b, metalness: .73, roughness: .12, emissive: 0x08283b, emissiveIntensity: .4 }),
    mint: new THREE.MeshStandardMaterial({ color: 0x99ffe0, emissive: 0x62ffd1, emissiveIntensity: 2.2, toneMapped: false }),
    amber: new THREE.MeshStandardMaterial({ color: 0xffc46c, emissive: 0xff9c36, emissiveIntensity: 1.7, toneMapped: false }),
    engine: new THREE.MeshStandardMaterial({ color: 0x91ddff, emissive: 0x278ddd, emissiveIntensity: 1.6, toneMapped: false }),
  };
  function mesh(geometry, material, x = 0, y = 0, z = 0) {
    const part = new THREE.Mesh(geometry, material);
    part.position.set(x, y, z);
    ship.add(part);
    return part;
  }
  function box(x, y, z, sx, sy, sz, material) {
    return mesh(new THREE.BoxGeometry(sx, sy, sz), material, x, y, z);
  }
  function strut(from, to, radius, material) {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to);
    const part = mesh(new THREE.CylinderGeometry(radius, radius, a.distanceTo(b), 6), material);
    part.position.copy(a).add(b).multiplyScalar(.5);
    part.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
    return part;
  }
  // Octagonal hull rings give the main body a continuous, faceted silhouette.
  function loft(rings, material) {
    const points = [];
    for (const [z, width, floor, ceiling] of rings) {
      const height = ceiling - floor;
      for (const [x, y] of [[-.65, 0], [.65, 0], [1, .25], [1, .75], [.55, 1], [-.55, 1], [-1, .75], [-1, .25]]) {
        points.push(new THREE.Vector3(x * width, floor + y * height, z));
      }
    }
    const vertices = [];
    const triangle = (a, b, c) => vertices.push(...points[a].toArray(), ...points[b].toArray(), ...points[c].toArray());
    for (let ring = 0; ring < rings.length - 1; ring++) {
      for (let i = 0; i < 8; i++) {
        const a = ring * 8 + i, b = ring * 8 + (i + 1) % 8, c = a + 8, d = b + 8;
        triangle(a, b, c); triangle(b, d, c);
      }
    }
    const end = (rings.length - 1) * 8;
    for (let i = 1; i < 7; i++) { triangle(0, i + 1, i); triangle(end, end + i, end + i + 1); }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
    return mesh(geometry, material);
  }
  function panel(points, top, thickness, material) {
    const shape = new THREE.Shape();
    shape.moveTo(...points[0]);
    for (const point of points.slice(1)) shape.lineTo(...point);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, steps: 1 });
    geometry.rotateX(Math.PI / 2);
    return mesh(geometry, material, 0, top, 0);
  }

  loft([[-6.2, .18, 1.4, 1.6], [-4.8, .94, 1.02, 2.12], [-2.1, 1.64, .88, 2.52], [1.55, 1.75, .88, 2.5], [4.45, 1.25, 1.1, 2.2]], materials.hull);
  loft([[-5.9, .2, 1.33, 1.48], [-3.7, 1.1, .8, 1.1], [2.9, 1.25, .8, 1.08], [4.5, .9, 1.08, 1.28]], materials.dark);
  loft([[-4.45, .50, 1.9, 2.18], [-2.55, 1.04, 2.32, 3.18], [-.9, .88, 2.42, 3.14], [-.5, .65, 2.4, 2.72]], materials.dark);
  loft([[-4.3, .47, 2.01, 2.23], [-2.5, .985, 2.43, 3.21], [-1.08, .83, 2.52, 3.17]], materials.glass);
  strut([0, 2.23, -4.31], [0, 3.23, -2.51], .038, materials.trim);
  strut([0, 3.23, -2.51], [0, 3.2, -1.08], .038, materials.trim);
  for (const side of [-1, 1]) {
    strut([side * .97, 2.58, -2.50], [side * .54, 3.22, -2.50], .04, materials.hull);
    strut([side * .54, 3.22, -2.50], [0, 3.23, -2.50], .04, materials.hull);
    const reflect = (points) => points.map(([x, z]) => [side * x, z]);
    panel(reflect([[1.2, -2.2], [5.3, 1.65], [4.65, 3.28], [1.35, 2.85]]), 1.71, .29, materials.hull);
    panel(reflect([[1.9, -.83], [4.78, 1.86], [4.3, 2.36], [1.95, 1.95]]), 1.726, .025, materials.dark);
    panel(reflect([[2.25, -.15], [4.45, 1.92], [4.24, 2.02], [2.22, .12]]), 1.755, .023, materials.trim);
    // Short forward canards echo the large swept wings.
    panel(reflect([[.8, -4.35], [2.13, -3.22], [1.7, -2.5], [1.15, -2.98]]), 1.57, .12, materials.trim);
    box(side * 4.78, 1.84, 2.09, .08, .09, .7, side === -1 ? materials.amber : materials.mint);

    // Twin outboard nacelles with dark inlet, metal rim and recessed blue core.
    loft([[-.48, .46, 1.14, 2.06], [.05, .61, 1.03, 2.21], [3.93, .58, 1.05, 2.21], [4.55, .43, 1.15, 2.04]], materials.trim).position.x = side * 2.06;
    const inlet = mesh(new THREE.CylinderGeometry(.36, .36, .08, 12), materials.black, side * 2.06, 1.6, -.5);
    inlet.rotation.x = Math.PI / 2;
    const exhaust = mesh(new THREE.CylinderGeometry(.47, .40, .6, 12, 1, true), materials.dark, side * 2.06, 1.6, 4.59);
    exhaust.rotation.x = Math.PI / 2;
    mesh(new THREE.TorusGeometry(.435, .065, 6, 12), materials.trim, side * 2.06, 1.6, 4.9);
    // CircleGeometry faces +Z, the aft-facing side of the ship.
    mesh(new THREE.CircleGeometry(.33, 12), materials.engine, side * 2.06, 1.6, 4.85);
    for (let i = 0; i < 5; i++) box(side * 2.06, 2.21, 1.0 + i * .39, .62, .045, .14, materials.dark);

    // Angled gear carries the belly above the ground; broad pads end at y = 0.
    for (const z of [-2.65, 2.72]) {
      strut([side * 1.22, 1.1, z], [side * 1.92, .2, z + .25], .105, materials.trim);
      strut([side * 1.3, .92, z + .55], [side * 1.92, .2, z + .25], .055, materials.dark);
      box(side * 1.92, .085, z + .25, .68, .17, .96, materials.dark);
      box(side * 1.92, .18, z + .25, .42, .045, .65, materials.trim);
    }
    box(side * .72, 1.47, -4.84, .16, .10, .1, materials.mint);
    box(side * 1.71, 1.63, -.3, .04, .075, 1.2, materials.mint);
    box(side * 1.695, 1.32, 1.45, .055, .1, .68, materials.amber);
  }

  // Dorsal equipment, recessed service hatch, and an aft boarding step.
  loft([[-.35, .57, 2.45, 2.59], [.3, .68, 2.46, 2.88], [2.2, .62, 2.46, 2.82], [3.05, .45, 2.34, 2.45]], materials.hull);
  box(0, 2.86, 1.1, .86, .03, 1.18, materials.dark);
  for (let i = 0; i < 6; i++) box(0, 2.895, .64 + i * .18, .74, .035, .045, materials.trim);
  box(0, 1.6, 4.49, 1.05, .72, .08, materials.dark);
  box(0, .68, 4.62, 1.1, .14, .65, materials.trim);
  box(0, .35, 4.99, 1.0, .13, .42, materials.dark);
  strut([.53, 2.68, 2.22], [.53, 3.58, 2.44], .022, materials.dark);
  mesh(new THREE.SphereGeometry(.06, 6, 4), materials.amber, .53, 3.58, 2.44);
  // The craft is rigid, so consolidate its detail into one draw call per finish.
  const batches = new Map();
  for (const part of [...ship.children]) {
    part.updateMatrix();
    const geometry = part.geometry.index ? part.geometry.toNonIndexed() : part.geometry.clone();
    geometry.deleteAttribute('uv');
    geometry.applyMatrix4(part.matrix);
    if (!batches.has(part.material)) batches.set(part.material, []);
    batches.get(part.material).push(geometry);
    part.geometry.dispose();
    ship.remove(part);
  }
  for (const [material, geometries] of batches) {
    mesh(mergeGeometries(geometries), material);
    geometries.forEach((geometry) => geometry.dispose());
  }
  ship.userData.dimensions = { length: 11.4, width: 10.6, height: 3.64 };
  return ship;
}
