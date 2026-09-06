import * as THREE from 'three';
import { RADIUS, MAX_LEVEL, cubeDirection, terrainHeight } from './world.js';
import { createWaterMaterial, updateWaterMaterial } from './water.js';
import { createGroundTextures } from './ground-textures.js';
import { acquireTerrainMaps } from './terrain-maps.js';
import { OrbitalSurface } from './orbital-surface.js';
import { terrainGridForLevel } from './terrain-resolution.js';
import { patchSurfaceMaterial, patchSurfaceUV } from './patch-surface.js';
import { SEED } from './generation.js';
import { createSurfaceTexture, configureTerrainMaterial } from './surface-materials.js';

export class Planet {
  constructor(scene) {
    this.scene=scene;this.nodes=new Map();this.queue=[];this.workers=[];this.nextId=0;this.jobs=new Map();
    this.visibleCount=0;this.maxVisibleLevel=0;this.origin=new THREE.Vector3();this.cameraWorld=new THREE.Vector3(0,0,RADIUS*2);
    this.landMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.96,metalness:0,side:THREE.DoubleSide});
    this.orbitalSurface=new OrbitalSurface('aeon');this.orbitalSurface.start();
    this.albedoUniform=this.orbitalSurface.color;this.albedoReady=this.orbitalSurface.ready;
    // Small-scale surface grain in metres, independent of the patch LOD.
    this.surfaceTexture=createSurfaceTexture();
    this.groundTextures=createGroundTextures();
    this.terrainMaps=acquireTerrainMaps();
    configureTerrainMaterial(this.landMaterial,this.surfaceTexture,this.albedoUniform,this.albedoReady,this.groundTextures,this.terrainMaps,this.orbitalSurface);
    this.waterMaterial=createWaterMaterial();
    for(let i=0;i<Math.min(3,Math.max(1,(navigator.hardwareConcurrency||4)-2));i++){
      const worker=new Worker(new URL('./terrain.worker.js',import.meta.url),{type:'module'});
      const slot={worker,busy:false};worker.onmessage=e=>this.receive(slot,e.data);
      worker.onerror=e=>{console.error('Terrain worker failed',e);this.error='Terrain worker failed. Reload to retry.';slot.busy=false;};this.workers.push(slot);
    }
    this.roots=Array.from({length:6},(_,face)=>this.node(face,0,0,0));
    this.select();
  }
  node(face,level,ix,iy){
    const key=`${face}/${level}/${ix}/${iy}`;
    if(this.nodes.has(key))return this.nodes.get(key);
    const size=2/2**level,d=cubeDirection(face,-1+(ix+.5)*size,-1+(iy+.5)*size);
    const node={key,face,level,ix,iy,size,normal:new THREE.Vector3(...d),center:new THREE.Vector3(...d).multiplyScalar(RADIUS),surfaceCenter:new THREE.Vector3(...d).multiplyScalar(RADIUS+Math.max(0,terrainHeight(...d))),children:null,mesh:null,queued:false,lastUsed:performance.now()};
    this.nodes.set(key,node);return node;
  }
  request(node){if(node.mesh||node.queued)return;node.queued=true;this.queue.push(node);}
  dispatch(){
    this.queue.sort((a,b)=>(a.center.distanceTo(this.cameraWorld)/(a.size*RADIUS))-(b.center.distanceTo(this.cameraWorld)/(b.size*RADIUS)));
    for(const slot of this.workers){if(slot.busy||!this.queue.length)continue;const node=this.queue.shift();const id=this.nextId++;this.jobs.set(id,node);slot.busy=true;const grid=terrainGridForLevel(node.level);slot.worker.postMessage({id,face:node.face,level:node.level,ix:node.ix,iy:node.iy,grid,surfaceDetail:grid===32,seed:SEED});}
  }
  receive(slot,data){
    slot.busy=false;const node=this.jobs.get(data.id);this.jobs.delete(data.id);
    if(!node){this.dispatch();return;}
    node.queued=false;
    if(data.error){this.error=data.error;console.error(data.error);return;}
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(data.positions,3));
    geometry.setAttribute('normal',new THREE.BufferAttribute(data.normals,3));
    geometry.setAttribute('color',new THREE.BufferAttribute(data.colors,3));
    geometry.setAttribute('direction',new THREE.BufferAttribute(data.directions,3));
    geometry.setAttribute('terrainHeight',new THREE.BufferAttribute(data.heights,1));
    // Keep detail fixed across patch seams and origin rebases. 256 m is a whole
    // number of texture periods; discard only whole periods in CPU doubles.
    const surfacePoints=new Float32Array(data.positions.length);
    for(let i=0;i<surfacePoints.length;i++)surfacePoints[i]=data.positions[i]+((data.center[i%3]%256)+256)%256;
    geometry.setAttribute('surfacePoint',new THREE.BufferAttribute(surfacePoints,3));
    geometry.setIndex(new THREE.BufferAttribute(data.indices,1));geometry.computeBoundingSphere();
    if(data.field)geometry.setAttribute('uv',new THREE.BufferAttribute(patchSurfaceUV(terrainGridForLevel(node.level),data.field.width),2));
    const land=new THREE.Mesh(geometry,data.field?patchSurfaceMaterial(this.landMaterial,data.field):this.landMaterial);
    land.receiveShadow=true;land.castShadow=node.level>=12;
    const group=new THREE.Group();group.add(land);
    if(data.heights.some(h=>h<50)){
      const waterGeometry=new THREE.BufferGeometry();
      waterGeometry.setAttribute('position',new THREE.BufferAttribute(data.waterPositions,3));
      waterGeometry.setAttribute('direction',new THREE.BufferAttribute(data.directions,3));
      waterGeometry.setAttribute('terrainHeight',new THREE.BufferAttribute(data.heights,1));
      waterGeometry.setIndex(new THREE.BufferAttribute(data.indices,1));waterGeometry.computeBoundingSphere();
      group.add(new THREE.Mesh(waterGeometry,this.waterMaterial));
    }
    node.center.set(...data.center);node.mesh=group;group.position.copy(node.center).sub(this.origin);group.visible=false;this.scene.add(group);
    this.dispatch();
  }
  select(){
    this.visibleCount=0;this.maxVisibleLevel=0;this.waitingCount=0;
    const length=this.cameraWorld.length(),radial=this.cameraWorld.clone().normalize();
    const now=performance.now();
    for(const n of this.nodes.values())if(n.mesh)n.mesh.visible=false;
    // Discard stale unstarted jobs when the observer moves or quick-transits.
    for(const n of this.queue)n.queued=false;this.queue=[];
    const visit=node=>{
      if(node.level>1 && node.normal.dot(radial)<RADIUS/Math.max(RADIUS,length)-node.size*1.5-.035)return;
      node.lastUsed=now;
      this.request(node);
      const distance=Math.max(3,node.surfaceCenter.distanceTo(this.cameraWorld));
      const split=node.level<3 || (distance<node.size*RADIUS*1.8 && node.level<MAX_LEVEL);
      if(split && node.mesh){
        if(!node.children)node.children=[this.node(node.face,node.level+1,node.ix*2,node.iy*2),this.node(node.face,node.level+1,node.ix*2+1,node.iy*2),this.node(node.face,node.level+1,node.ix*2,node.iy*2+1),this.node(node.face,node.level+1,node.ix*2+1,node.iy*2+1)];
        // Parent replacement needs every sibling, including culled ones. Keep
        // those dependencies resident instead of evicting and rebuilding them.
        for(const child of node.children){child.lastUsed=now;this.request(child);}
        if(node.children.every(c=>c.mesh)){for(const child of node.children)visit(child);return;}
      }
      if(split)this.waitingCount++;
      if(node.mesh){node.mesh.visible=true;this.visibleCount++;this.maxVisibleLevel=Math.max(this.maxVisibleLevel,node.level);}
    };
    for(const root of this.roots)visit(root);
    // Bounded GPU cache. Keep ancestor nodes for immediate fallback while flying.
    if(this.nodes.size>1100){for(const node of this.nodes.values()){if(node.level<=3||!node.mesh||node.mesh.visible||node.queued||now-node.lastUsed<8000)continue;this.disposeMesh(node.mesh);node.mesh=null;node.children=null;}}
    this.dispatch();
  }
  update(worldPosition,origin,sunDirection,time,altitude){
    this.cameraWorld.copy(worldPosition);this.origin.copy(origin);
    for(const node of this.nodes.values())if(node.mesh)node.mesh.position.copy(node.center).sub(origin);
    updateWaterMaterial(this.waterMaterial,origin,sunDirection,time,altitude);
    if(!this.lastSelect||performance.now()-this.lastSelect>160){this.select();this.lastSelect=performance.now();}
  }
  get ready(){return this.roots.every(n=>n.mesh);}
  get pending(){return this.queue.length+this.jobs.size;}
  get detailStats(){return {orbitalResolution:this.orbitalSurface.resolution,waiting:this.waitingCount,settled:this.pending===0&&this.waitingCount===0};}
  disposeMesh(mesh){mesh.traverse(o=>{o.geometry?.dispose();if(o.material&&o.material!==this.landMaterial&&o.material!==this.waterMaterial)o.material.dispose();});this.scene.remove(mesh);}
  dispose(){this.orbitalSurface.dispose();this.surfaceTexture.dispose();this.groundTextures.dispose();this.terrainMaps.dispose();for(const slot of this.workers)slot.worker.terminate();for(const n of this.nodes.values())if(n.mesh)this.disposeMesh(n.mesh);this.landMaterial.dispose();this.waterMaterial.dispose();}
}
