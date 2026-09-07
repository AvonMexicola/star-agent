import {landmarkExcludes} from './landmark-distribution.js';
import * as THREE from 'three';
import { DistantMeadow } from './distant-meadow.js';
import { Meadow } from './meadow.js';
import { createBranchGeometry, createNeedleTexture, addFoliageWind, createTreeImpostor } from './foliage.js';
import { createSurfaceTexture } from './surface-materials.js';
import { RADIUS, terrainHeight, biomeAt, hash } from './world.js';

import { ForestStream } from './forest-stream.js';
import { FOREST_GENERATOR_VERSION, FOREST_RECORD_STRIDE } from './forest-distribution.js';
import { TREE_LODS, TREE_REBUILD_DISTANCE, treeLodIncludes, addTreeLod, addVegetationFade } from './tree-lod.js';

const TAU = Math.PI * 2;
const UP = new THREE.Vector3(0, 1, 0);
const TREE_LIMIT = TREE_LODS[0].capacity;
const GRASS_LIMIT = 6000;

export function treeVariant(col,row,latitude,height) {
  const choice=hash(col,row,1259),cold=Math.abs(latitude)>.57||height>1400;
  return cold?(choice<.8?0:1):(choice<.27?0:choice<.57?1:2);
}

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
    this.stats = { trees: 0, grassTufts: 0, rocks: 0, rebuilds: 0, forestGeneratorVersion: FOREST_GENERATOR_VERSION };
    this.exclusionPosition = null;
    this.exclusionDirection = new THREE.Vector3();
    this.exclusionRadius = 13;
    this.exclusionDirty = false;

    this.windTime = { value: 0 };
    this.lodCamera = { value: new THREE.Vector3() };
    this.stream = new ForestStream();
    this.lastPlan = new THREE.Vector3(Infinity,Infinity,Infinity);
    this.lastDetails = new THREE.Vector3(Infinity,Infinity,Infinity);
    this.detailCache = new Map();
    this.hasOrigin = false;
    this.surfaceTexture = createSurfaceTexture();
    this.treeSets=Array.from({length:3},(_,variant)=>{
      const needleTexture = createNeedleTexture(variant===2);
      const trunk = new THREE.CylinderGeometry(.012, .027, .94, 9);
      trunk.translate(0, .47, 0);
      const trunks = this.makeMesh(trunk, { color: 0x655747, roughness: 1, bumpMap: this.surfaceTexture, bumpScale: .04 }, TREE_LIMIT);
      const foliage = this.makeMesh(createBranchGeometry(false,variant), { color: 0xffffff, map: needleTexture, alphaTest: .32, side: THREE.DoubleSide, vertexColors: true, roughness: .9 }, TREE_LIMIT);
      addFoliageWind(foliage.material, this.windTime);
      foliage.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: needleTexture, alphaTest: .32, side: THREE.DoubleSide });
      addFoliageWind(foliage.customDepthMaterial, this.windTime);
      const midTrunks = this.makeMesh(trunk.clone(), { color: 0x655747, roughness: 1 }, TREE_LODS[1].capacity);
      const midFoliage = this.makeMesh(createBranchGeometry(true,variant), { color: 0xffffff, map: needleTexture, alphaTest: .27, side: THREE.DoubleSide, vertexColors: true, roughness: .9 }, TREE_LODS[1].capacity);
      addFoliageWind(midFoliage.material, this.windTime);
      midFoliage.castShadow = midTrunks.castShadow = false;
      const impostor = createTreeImpostor(needleTexture,variant);
      const impostorTexture = impostor.texture;
      const farFoliage = this.makeMesh(impostor.geometry, { color: 0xffffff, map: impostor.texture, alphaTest: .2, side: THREE.DoubleSide, roughness: .95 }, TREE_LODS[2].capacity);
      farFoliage.castShadow = false;
      // Both sides represent the same rounded crown. DoubleSide's default normal
      // flip would turn half the distant trees into bright/dark paper crosses.
      farFoliage.material.onBeforeCompile = shader => {
        shader.fragmentShader = shader.fragmentShader
          .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal *= faceDirection;')
          .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= mix(.68,.93,vMapUv.y);');
      };
      farFoliage.material.customProgramCacheKey = () => 'rounded-tree-impostor-v2';
      const treeMeshes = [[trunks, foliage], [midTrunks, midFoliage], [farFoliage]];
      for (let level = 0; level < 3; level++) for (const mesh of treeMeshes[level]) addTreeLod(mesh.material, level, this.lodCamera);
      addTreeLod(foliage.customDepthMaterial, 0, this.lodCamera);
      trunks.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
      addTreeLod(trunks.customDepthMaterial, 0, this.lodCamera);
      return {meshes:treeMeshes,needleTexture,impostorTexture};
    });
    this.treeMeshes=[0,1,2].map(level=>this.treeSets.flatMap(set=>set.meshes[level]));
    this.grass = this.makeMesh(grassGeometry(), { color: 0xffffff, roughness: 1, side: THREE.DoubleSide }, GRASS_LIMIT);
    this.meadow = new Meadow(scene, this);this.distantMeadow=new DistantMeadow(scene,this);
    // Loose stones are rendered and persisted by MiningField.
    for(const mesh of this.treeMeshes.flat()) {
      addVegetationFade(mesh.material,this.lodCamera,this.windTime);
      if(mesh.customDepthMaterial)addVegetationFade(mesh.customDepthMaterial,this.lodCamera,this.windTime);
    }
    addVegetationFade(this.grass.material,this.lodCamera,this.windTime,[90,110]);

  }

  makeMesh(geometry, materialOptions, capacity) {
    const mesh = new THREE.InstancedMesh(geometry, new THREE.MeshStandardMaterial(materialOptions), capacity);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('instanceBirth',new THREE.InstancedBufferAttribute(new Float32Array(capacity),1).setUsage(THREE.DynamicDrawUsage));
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
    if(landmarkExcludes(x,y,z,canopyMargin))return true;
    if (!this.exclusionPosition) return false;
    // Compare unit directions at planet radius so terrain height cannot shrink
    // the clearing. Subtraction and multiplication both remain in CPU doubles.
    const dx = (x - this.exclusionDirection.x) * RADIUS;
    const dy = (y - this.exclusionDirection.y) * RADIUS;
    const dz = (z - this.exclusionDirection.z) * RADIUS;
    const radius = this.exclusionRadius + canopyMargin;
    return dx * dx + dy * dy + dz * dz < radius * radius;
  }

  update(worldPosition, renderOrigin, elapsedSeconds, walking = false, downwash = null) {
    this.distantMeadow.update(worldPosition,renderOrigin,elapsedSeconds);
    this.meadow.update(worldPosition, renderOrigin, elapsedSeconds, walking, downwash);
    this.windTime.value = elapsedSeconds;
    const distance=worldPosition.length();
    if(distance<1){this.group.visible=false;return;}
    this.direction.copy(worldPosition).divideScalar(distance);
    const height=terrainHeight(this.direction.x,this.direction.y,this.direction.z);
    const altitude=distance-RADIUS-Math.max(0,height);
    this.group.visible=altitude<1800&&altitude>-50;
    // Preload before trees enter their 1.4 km distance fade on descent.
    if(altitude>2600||altitude<-50)return;
    let dirty=false;
    if(worldPosition.distanceToSquared(this.lastPlan)>128**2){
      dirty=this.stream.plan(this.direction);this.lastPlan.copy(worldPosition);
    }
    dirty=this.stream.publish(elapsedSeconds)||dirty;
    if(!this.hasOrigin||worldPosition.distanceToSquared(this.origin)>5000**2){
      this.origin.copy(this.direction).multiplyScalar(RADIUS+height);this.hasOrigin=true;
      this.lastPosition.set(Infinity,Infinity,Infinity);this.lastDetails.set(Infinity,Infinity,Infinity);
    }
    if(dirty||this.exclusionDirty||worldPosition.distanceToSquared(this.lastPosition)>TREE_REBUILD_DISTANCE**2){
      this.lastPosition.copy(worldPosition);const start=performance.now();
      this.rebuildTrees();this.stats.treeUploadMs=performance.now()-start;
    }
    if(altitude<320&&(this.exclusionDirty||worldPosition.distanceToSquared(this.lastDetails)>20**2)){
      this.lastDetails.copy(worldPosition);this.rebuildDetails(worldPosition.clone().normalize());
    } else if(altitude>=320){this.grass.count=0;this.stats.grassTufts=this.stats.rocks=0;this.lastDetails.set(Infinity,Infinity,Infinity);}
    this.exclusionDirty=false;
    this.lodCamera.value.copy(worldPosition).sub(this.origin);
    this.group.position.copy(this.origin).sub(renderOrigin);
    this.stats.meadow = this.meadow.stats;this.stats.distantMeadow=this.distantMeadow.stats;
    this.stats.pendingTiles=this.stream.pending;this.stats.residentTiles=this.stream.tiles.size;
    this.stats.generatedTiles=this.stream.generated;this.stats.error=this.stream.error;
  }

  // Each latitude row has a fixed, integer number of longitude cells. Sampling
  // around a new viewer position therefore preserves every shared world's cell.
  // Longitude wraps cleanly, and spacing stays useful at high latitudes too.
  scatter(center,radius,spacing,seed,visit){
    for(const r of this.scatterRecords(center,radius,spacing,seed))visit(r.x,r.y,r.z,r.col,r.row,r.a,r.b);
  }
  *scatterRecords(center, radius, spacing, seed) {
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
        yield {x,y,z,col:wrapped,row,a,b};
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

  upload(mesh) {
    if (!mesh.count) return;
    // Only upload live instances, not the unused capacity of every LOD buffer.
    for (const attribute of [mesh.instanceMatrix, mesh.geometry.attributes.instanceBirth, mesh.instanceColor]) {
      if (!attribute) continue;
      attribute.clearUpdateRanges();
      attribute.addUpdateRange(0, mesh.count * attribute.itemSize);
      attribute.needsUpdate = true;
    }
  }

  rebuildTrees() {
    let trees=0;const lodCounts=[0,0,0],speciesCounts=[0,0,0],setCounts=this.treeSets.map(()=>[0,0,0]);
    for(const tile of this.stream.tiles.values())for(let k=0;k<tile.records.length;k+=FOREST_RECORD_STRIDE){
      const r=tile.records,x=r[k],y=r[k+1],z=r[k+2],h=r[k+3],width=r[k+4],size=r[k+5],angle=r[k+6],a=r[k+7],b=r[k+8];
      if(this.isExcluded(x,y,z,5))continue;
      const distance=Math.hypot(x*(RADIUS+h)-this.lastPosition.x,y*(RADIUS+h)-this.lastPosition.y,z*(RADIUS+h)-this.lastPosition.z);
      if(distance>1400+TREE_REBUILD_DISTANCE+25)continue;
      const variant=treeVariant(Math.round(x*RADIUS/16),Math.round(z*RADIUS/16),y,h);
      trees++;speciesCounts[variant]++;
      for(let level=0;level<3;level++){
        if(!treeLodIncludes(distance,level)||setCounts[variant][level]>=TREE_LODS[level].capacity)continue;
        const meshes=this.treeSets[variant].meshes[level],index=setCounts[variant][level]++;lodCounts[level]++;
        this.place(meshes[0],index,x,y,z,h-.08,width,size,width,angle);
        if(meshes[1])meshes[1].setMatrixAt(index,this.matrix);
        for(const mesh of meshes)mesh.geometry.attributes.instanceBirth.setX(index,tile.born+a*.2);
        this.color.setRGB(.52+a*.18,.60+b*.18,.48+a*.16);
        if(variant===1){this.color.r*=.9;this.color.b*=.83;}
        if(variant===2){this.color.r*=.94;this.color.g*=1.08;this.color.b*=.76;}
        meshes[meshes.length-1].setColorAt(index,this.color);
      }
    }
    for(let variant=0;variant<3;variant++)for(let level=0;level<3;level++)for(const mesh of this.treeSets[variant].meshes[level]){mesh.count=setCounts[variant][level];this.upload(mesh);}
    Object.assign(this.stats,{trees,species:speciesCounts,treeLods:lodCounts,treeRange:1400,rebuilds:this.stats.rebuilds+1});
  }

  rebuildDetails(direction) {
    this.grass.count=0;
    this.upload(this.grass);
    Object.assign(this.stats,{grassTufts:0,rocks:0});
  }

  dispose() {
    this.stream.dispose();
    this.meadow.dispose();this.distantMeadow.dispose();
    for (const mesh of [...this.treeMeshes.flat(), this.grass]) {
      mesh.geometry.dispose();
      mesh.material.dispose();
      mesh.dispose();
    }
    for(const set of this.treeSets){set.impostorTexture.dispose();set.needleTexture.dispose();for(const mesh of set.meshes[0])mesh.customDepthMaterial?.dispose();}
    this.surfaceTexture.dispose();
    this.group.removeFromParent();
  }
}
