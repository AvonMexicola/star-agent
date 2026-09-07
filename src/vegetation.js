import * as THREE from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { createBranchGeometry, createNeedleTexture, addFoliageWind, createTreeImpostor } from './foliage.js';
import { createSurfaceTexture } from './surface-materials.js';
import { RADIUS, terrainHeight, terrainSample, moisture, biomeAt, hash } from './world.js';

import { TREE_LODS, TREE_RADIUS, TREE_REBUILD_DISTANCE, treeLodIncludes, addTreeLod } from './tree-lod.js';

const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);
const TREE_LIMIT = TREE_LODS[0].capacity;
const GRASS_LIMIT = 12000;
const ROCK_LIMIT = 600;

// Three bent blades form each tuft; the base of every blade is exactly y = 0.
function grassGeometry() {
  const vertices = [];
  for (let blade = 0; blade < 3; blade++) {
    const angle = (blade / 3) * Math.PI;
    const c = Math.cos(angle), s = Math.sin(angle);
    const points = [[-.07, 0, 0], [.07, 0, 0], [-.035, .58, .06], [.035, .58, .06], [.025, 1, .17]];
    for (const index of [0, 1, 2, 1, 3, 2, 2, 3, 4]) {
      const [x, y, z] = points[index];
      vertices.push(x * c - z * s, y, x * s + z * c);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** Local vegetation on a globe. World coordinates and patch origins stay doubles;
 * only the differences from the patch origin enter instance float matrices. */
export class Vegetation {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.name = 'Procedural surface vegetation';
    scene.add(this.group);
    this.origin = new THREE.Vector3();
    this.lastPosition = new THREE.Vector3(Infinity, Infinity, Infinity);
    this.direction = new THREE.Vector3();
    this.point = new THREE.Vector3();
    this.rotation = new THREE.Quaternion();
    this.yaw = new THREE.Quaternion();
    this.scale = new THREE.Vector3();
    this.matrix = new THREE.Matrix4();
    this.color = new THREE.Color();
    this.stats = { trees: 0, grassTufts: 0, rocks: 0, rebuilds: 0 };
    this.exclusionPosition = null;
    this.exclusionDirection = new THREE.Vector3();
    this.exclusionRadius = 13;
    this.exclusionDirty = false;

    this.windTime = { value: 0 };
    this.lodCamera = { value: new THREE.Vector3() };
    this.treeCache = new Map();
    this.needleTexture = createNeedleTexture();
    this.surfaceTexture = createSurfaceTexture();
    const trunk = new THREE.CylinderGeometry(.012, .027, .94, 9);
    trunk.translate(0, .47, 0);
    this.trunks = this.makeMesh(trunk, { color: 0x655747, roughness: 1, bumpMap: this.surfaceTexture, bumpScale: .04 }, TREE_LIMIT);
    this.foliage = this.makeMesh(createBranchGeometry(), { color: 0xffffff, map: this.needleTexture, alphaTest: .32, side: THREE.DoubleSide, vertexColors: true, roughness: .9 }, TREE_LIMIT);
    addFoliageWind(this.foliage.material, this.windTime);
    this.foliage.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: this.needleTexture, alphaTest: .32, side: THREE.DoubleSide });
    addFoliageWind(this.foliage.customDepthMaterial, this.windTime);
    this.midTrunks = this.makeMesh(trunk.clone(), { color: 0x655747, roughness: 1 }, TREE_LODS[1].capacity);
    this.midFoliage = this.makeMesh(createBranchGeometry(true), { color: 0xffffff, map: this.needleTexture, alphaTest: .27, side: THREE.DoubleSide, vertexColors: true, roughness: .9 }, TREE_LODS[1].capacity);
    addFoliageWind(this.midFoliage.material, this.windTime);
    this.midFoliage.castShadow = this.midTrunks.castShadow = false;
    const impostor = createTreeImpostor(this.needleTexture);
    this.impostorTexture = impostor.texture;
    this.farFoliage = this.makeMesh(impostor.geometry, { color: 0xffffff, map: impostor.texture, alphaTest: .2, side: THREE.DoubleSide, roughness: .95 }, TREE_LODS[2].capacity);
    this.farFoliage.castShadow = false;
    // Both sides represent the same rounded crown. DoubleSide's default normal
    // flip would turn half the distant trees into bright/dark paper crosses.
    this.farFoliage.material.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal *= faceDirection;')
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= mix(.5,.85,vMapUv.y);');
    };
    this.farFoliage.material.customProgramCacheKey = () => 'rounded-tree-impostor-v1';
    this.treeMeshes = [[this.trunks, this.foliage], [this.midTrunks, this.midFoliage], [this.farFoliage]];
    for (let level = 0; level < 3; level++) for (const mesh of this.treeMeshes[level]) addTreeLod(mesh.material, level, this.lodCamera);
    addTreeLod(this.foliage.customDepthMaterial, 0, this.lodCamera);
    this.trunks.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    addTreeLod(this.trunks.customDepthMaterial, 0, this.lodCamera);
    this.grass = this.makeMesh(grassGeometry(), { color: 0xffffff, roughness: 1, side: THREE.DoubleSide }, GRASS_LIMIT);
    const rockSource = new THREE.IcosahedronGeometry(.5, 2);
    rockSource.deleteAttribute('normal');
    const rock = mergeVertices(rockSource);
    rockSource.dispose();
    const points = rock.getAttribute('position');
    for (let i = 0; i < points.count; i++) {
      const x = points.getX(i), y = points.getY(i), z = points.getZ(i);
      const displacement = 1 + .13 * Math.sin(x*17+y*11) * Math.cos(z*13-x*9);
      points.setXYZ(i,x*displacement,y*displacement,z*displacement);
    }
    rock.computeVertexNormals();
    rock.translate(0, .24, 0);
    this.rocks = this.makeMesh(rock, { color: 0xffffff, roughness: .9, bumpMap: this.surfaceTexture, bumpScale: .055 }, ROCK_LIMIT);
  }

  makeMesh(geometry, materialOptions, capacity) {
    const mesh = new THREE.InstancedMesh(geometry, new THREE.MeshStandardMaterial(materialOptions), capacity);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
    // Disabling aggregate culling avoids stale bounds
    // during origin rebasing and successive patches with different populations.
    mesh.frustumCulled = false;
    mesh.receiveShadow = true;
    mesh.castShadow = capacity !== GRASS_LIMIT;
    this.group.add(mesh);
    return mesh;
  }

  /** Reserve a horizontal landing clearing; safe to call every frame. */
  setExclusion(worldPositionOrNull, radius = 13) {
    if (!worldPositionOrNull) {
      if (this.exclusionPosition === null) return;
      this.exclusionPosition = null;
      this.exclusionDirty = true;
      return;
    }
    const clearingRadius = Number.isFinite(radius) ? Math.max(0, radius) : 13;
    if (this.exclusionPosition?.equals(worldPositionOrNull) && this.exclusionRadius === clearingRadius) return;
    if (!this.exclusionPosition) this.exclusionPosition = new THREE.Vector3();
    this.exclusionPosition.copy(worldPositionOrNull);
    this.exclusionDirection.copy(worldPositionOrNull).normalize();
    this.exclusionRadius = clearingRadius;
    this.exclusionDirty = true;
  }

  isExcluded(x, y, z, canopyMargin = 0) {
    if (!this.exclusionPosition) return false;
    // Compare unit directions at planet radius so terrain height cannot shrink
    // the clearing. Subtraction and multiplication both remain in CPU doubles.
    const dx = (x - this.exclusionDirection.x) * RADIUS;
    const dy = (y - this.exclusionDirection.y) * RADIUS;
    const dz = (z - this.exclusionDirection.z) * RADIUS;
    const radius = this.exclusionRadius + canopyMargin;
    return dx * dx + dy * dy + dz * dz < radius * radius;
  }

  update(worldPosition, renderOrigin, elapsedSeconds) {
    this.windTime.value = elapsedSeconds;
    const distance = worldPosition.length();
    if (distance < 1) { this.group.visible = false; return; }
    this.direction.copy(worldPosition).divideScalar(distance);
    const height = terrainHeight(this.direction.x, this.direction.y, this.direction.z);
    const altitude = distance - RADIUS - Math.max(0, height);
    this.group.visible = altitude < 1800 && altitude > -50;
    if (!this.group.visible) return;

    if (this.exclusionDirty || worldPosition.distanceToSquared(this.lastPosition) > TREE_REBUILD_DISTANCE ** 2) {
      this.lastPosition.copy(worldPosition);
      this.origin.copy(this.direction).multiplyScalar(RADIUS + height);
      this.rebuild(this.direction);
      this.exclusionDirty = false;
    }
    this.lodCamera.value.copy(worldPosition).sub(this.origin);
    this.group.position.copy(this.origin).sub(renderOrigin);
  }

  // Each latitude row has a fixed, integer number of longitude cells. Sampling
  // around a new viewer position therefore preserves every shared world's cell.
  // Longitude wraps cleanly, and spacing stays useful at high latitudes too.
  scatter(center, radius, spacing, seed, visit) {
    const latitude = Math.asin(THREE.MathUtils.clamp(center.y, -1, 1));
    const longitude = Math.atan2(center.x, center.z);
    const rowSize = spacing / RADIUS;
    const firstRow = Math.floor((latitude - radius / RADIUS) / rowSize) - 1;
    const lastRow = Math.ceil((latitude + radius / RADIUS) / rowSize) + 1;
    for (let row = firstRow; row <= lastRow; row++) {
      const rowLatitude = (row + .5) * rowSize;
      if (Math.abs(rowLatitude) >= Math.PI / 2) continue;
      const columns = Math.max(1, Math.round(TAU * RADIUS * Math.cos(rowLatitude) / spacing));
      const columnSize = TAU / columns;
      const centerColumn = Math.floor((longitude + Math.PI) / columnSize);
      const reach = Math.ceil(radius / spacing) + 2;
      for (let column = centerColumn - reach; column <= centerColumn + reach; column++) {
        const wrapped = ((column % columns) + columns) % columns;
        const a = hash(wrapped, row, seed);
        const b = hash(wrapped, row, seed + 41);
        const lat = (row + .15 + a * .7) * rowSize;
        const lon = (wrapped + .15 + b * .7) * columnSize - Math.PI;
        const cosLat = Math.cos(lat);
        const x = cosLat * Math.sin(lon), y = Math.sin(lat), z = cosLat * Math.cos(lon);
        const dx = (x - center.x) * RADIUS, dy = (y - center.y) * RADIUS, dz = (z - center.z) * RADIUS;
        if (dx * dx + dy * dy + dz * dz > radius * radius) continue;
        visit(x, y, z, wrapped, row, a, b);
      }
    }
  }

  place(mesh, index, x, y, z, height, scaleX, scaleY, scaleZ, angle) {
    this.point.set(x, y, z).multiplyScalar(RADIUS + height).sub(this.origin);
    this.direction.set(x, y, z);
    this.rotation.setFromUnitVectors(UP, this.direction);
    this.yaw.setFromAxisAngle(UP, angle);
    this.rotation.multiply(this.yaw);
    this.scale.set(scaleX, scaleY, scaleZ);
    this.matrix.compose(this.point, this.rotation, this.scale);
    mesh.setMatrixAt(index, this.matrix);
  }

  rebuild(direction) {
    // place() reuses the direction scratch vector, so preserve the patch center.
    const center = direction.clone();
    let trees = 0, grassTufts = 0, rocks = 0;
    const lodCounts = [0, 0, 0], nextCache = new Map();
    this.scatter(center, TREE_RADIUS, 12, 711, (x, y, z, col, row, a, b) => {
      if (Math.abs(y) > .84 || this.isExcluded(x, y, z, 5)) return;
      const key = `${col}/${row}`;
      let record = this.treeCache.get(key);
      if (!record) {
        const {height:h,rockRelief}=terrainSample(x,y,z), m = moisture(x, y, z);
        const density = m > .46 ? Math.min(.86, .58 + (m - .46) * 2) : m > .4 ? .025 : 0;
        record = { h, present: rockRelief<.12 && h >= 12 && h <= 2200 && hash(col, row, 911) <= density };
      }
      nextCache.set(key, record);
      if (!record.present) return;
      const h = record.h, size = 7 + hash(col, row, 1103) * 13, width = size * (.83 + b * .28);
      const distance = Math.hypot(x*(RADIUS+h)-this.lastPosition.x,y*(RADIUS+h)-this.lastPosition.y,z*(RADIUS+h)-this.lastPosition.z);
      trees++;
      for (let level = 0; level < 3; level++) {
        if (!treeLodIncludes(distance, level) || lodCounts[level] >= TREE_LODS[level].capacity) continue;
        const meshes = this.treeMeshes[level], index = lodCounts[level]++;
        this.place(meshes[0], index, x, y, z, h - .08, width, size, width, a * TAU);
        if (meshes[1]) meshes[1].setMatrixAt(index, this.matrix);
        this.color.setRGB(.52 + a * .18, .60 + b * .18, .48 + a * .16);
        if (level === 2) this.color.multiplyScalar(.55);
        meshes[meshes.length - 1].setColorAt(index, this.color);
      }
    });
    this.treeCache = nextCache;
    for (let level = 0; level < 3; level++) for (const mesh of this.treeMeshes[level]) mesh.count = lodCounts[level];

    this.scatter(center, 170, 4.5, 1933, (x, y, z, col, row, a, b) => {
      if (grassTufts >= GRASS_LIMIT || Math.abs(y) > .84 || this.isExcluded(x, y, z)) return;
      const {height:h,rockRelief}=terrainSample(x,y,z);
      if (rockRelief>.12 || h < 2 || h > 2200 || hash(col, row, 2111) > .86) return;
      const size = .22 + a * .36;
      this.place(this.grass, grassTufts, x, y, z, h - .025, .3 + b*.5, size, .3 + b*.5, b * TAU);
      this.color.setRGB(.11 + a * .10, .16 + b * .09, .045 + a * .045);
      this.grass.setColorAt(grassTufts++, this.color);
    });

    // Fine undergrowth around the viewer complements the sparse distant tufts.
    this.scatter(center, 45, 1, 2099, (x,y,z,col,row,a,b) => {
      if (grassTufts >= GRASS_LIMIT || Math.abs(y) > .84 || this.isExcluded(x,y,z) || a > .8) return;
      const {height:h,rockRelief}=terrainSample(x,y,z);
      if (rockRelief>.12 || h < 12 || h > 2200 || moisture(x,y,z) < .44) return;
      const size = .12+a*.24;
      this.place(this.grass,grassTufts,x,y,z,h-.025,.22+b*.3,size,.22+b*.3,b*TAU);
      this.color.setRGB(.10+a*.09,.13+b*.07,.035+a*.04);
      this.grass.setColorAt(grassTufts++,this.color);
    });

    this.scatter(center, 300, 25, 3011, (x, y, z, col, row, a, b) => {
      if (rocks >= ROCK_LIMIT || a > .45 || this.isExcluded(x, y, z)) return;
      const h = terrainHeight(x, y, z);
      if (h < .5) return;
      const biome = biomeAt(x, y, z, h);
      if (biome === 'POLAR ICE') return;
      const size = .5 + b * b * 3.5;
      this.place(this.rocks, rocks, x, y, z, h - .07, size, size * (.5 + a), size * (.65 + b * .5), a * TAU);
      const shade = .23 + b * .17;
      this.color.setRGB(shade, shade * 1.025, shade * .96);
      this.rocks.setColorAt(rocks++, this.color);
    });

    this.grass.count = grassTufts;
    this.rocks.count = rocks;
    for (const mesh of [...this.treeMeshes.flat(), this.grass, this.rocks]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    this.stats = { trees, treeLods: lodCounts, treeRange: 1400, grassTufts, rocks, rebuilds: this.stats.rebuilds + 1 };
  }

  dispose() {
    for (const mesh of [...this.treeMeshes.flat(), this.grass, this.rocks]) {
      mesh.geometry.dispose();
      mesh.material.dispose();
      mesh.dispose();
    }
    this.impostorTexture.dispose();
    this.trunks.customDepthMaterial.dispose();
    this.needleTexture.dispose();
    this.surfaceTexture.dispose();
    this.foliage.customDepthMaterial.dispose();
    this.group.removeFromParent();
  }
}
