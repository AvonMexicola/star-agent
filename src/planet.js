import { attachRockMaterial } from './rock-material.js';
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
import { wantsTerrainSplit, advanceTerrainMorph, terrainMorphValue, addTerrainMorph } from './terrain-lod.js';

export class Planet {
  constructor(scene) {
    this.scene=scene;this.nodes=new Map();this.queue=[];this.workers=[];this.nextId=0;this.jobs=new Map();
    this.frame=0;this.visibleCount=0;this.maxVisibleLevel=0;this.origin=new THREE.Vector3();this.cameraWorld=new THREE.Vector3(0,0,RADIUS*2);
    this.landMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.96,metalness:0,side:THREE.DoubleSide});
    this.orbitalSurface=new OrbitalSurface('aeon');this.orbitalSurface.start();
    this.albedoUniform=this.orbitalSurface.color;this.albedoReady=this.orbitalSurface.ready;
    // Small-scale surface grain in metres, independent of the patch LOD.
    this.surfaceTexture=createSurfaceTexture();
    this.groundTextures=createGroundTextures();
    this.terrainMaps=acquireTerrainMaps();
    configureTerrainMaterial(this.landMaterial,this.surfaceTexture,this.albedoUniform,this.albedoReady,this.groundTextures,this.terrainMaps,this.orbitalSurface);
    this.releaseRockMaterial=attachRockMaterial(this.landMaterial,{pointAttribute:'surfacePoint',tint:[1.12,1.1,1.06]});
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
    const node={key,face,level,ix,iy,size,normal:new THREE.Vector3(...d),center:new THREE.Vector3(...d).multiplyScalar(RADIUS),surfaceCenter:new THREE.Vector3(...d).multiplyScalar(RADIUS+Math.max(0,terrainHeight(...d))),children:null,mesh:null,queued:false,lastUsed:performance.now(),refined:false,wantsSplit:false,progress:0,target:0,childMorph:{value:0},morph:{value:1},residentFrame:0};
    this.nodes.set(key,node);return node;
  }
  request(node){if(node.mesh||node.queued)return;node.queued=true;this.queue.push(node);}
  dispatch(){
    this.queue.sort((a,b)=>(a.center.distanceTo(this.cameraWorld)/(a.size*RADIUS))-(b.center.distanceTo(this.cameraWorld)/(b.size*RADIUS)));
    for(const slot of this.workers){if(slot.busy||!this.queue.length)continue;const node=this.queue.shift();const id=this.nextId++;this.jobs.set(id,node);slot.busy=true;const grid=terrainGridForLevel(node.level);slot.worker.postMessage({id,face:node.face,level:node.level,ix:node.ix,iy:node.iy,grid,parentGrid:terrainGridForLevel(Math.max(0,node.level-1)),surfaceDetail:grid===32,seed:SEED});}
  }
  receive(slot,data){
    slot.busy=false;const node=this.jobs.get(data.id);this.jobs.delete(data.id);
    if(!node){this.dispatch();return;}
    node.queued=false;
    if(data.error){this.error=data.error;console.error(data.error);return;}
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(data.positions,3));
    geometry.setAttribute('parentPosition',new THREE.BufferAttribute(data.parentPositions,3));
    geometry.setAttribute('parentNormal',new THREE.BufferAttribute(data.parentNormals,3));
    geometry.setAttribute('parentColor',new THREE.BufferAttribute(data.parentColors,3));
    geometry.setAttribute('normal',new THREE.BufferAttribute(data.normals,3));
    geometry.setAttribute('color',new THREE.BufferAttribute(data.colors,3));
    geometry.setAttribute('direction',new THREE.BufferAttribute(data.directions,3));
    geometry.setAttribute('terrainHeight',new THREE.BufferAttribute(data.heights,1));
    geometry.setAttribute('rockRelief',new THREE.BufferAttribute(data.rockReliefs,1));
    // Keep detail fixed across patch seams and origin rebases. 256 m is a whole
    // number of texture periods; discard only whole periods in CPU doubles.
    const surfacePoints=new Float32Array(data.positions.length);
    for(let i=0;i<surfacePoints.length;i++)surfacePoints[i]=data.positions[i]+((data.center[i%3]%256)+256)%256;
    geometry.setAttribute('surfacePoint',new THREE.BufferAttribute(surfacePoints,3));
    geometry.setIndex(new THREE.BufferAttribute(data.indices,1));this.boundGeometry(geometry);
    // Material.copy JSON-clones userData, which here contains the shared 2 MB
    // albedo texture and detail uniforms. Keep those resources shared instead.
    if(data.field)geometry.setAttribute('uv',new THREE.BufferAttribute(patchSurfaceUV(terrainGridForLevel(node.level),data.field.width),2));
    const material=data.field?patchSurfaceMaterial(this.landMaterial,data.field):new THREE.MeshStandardMaterial({vertexColors:true,roughness:.96,metalness:0,side:THREE.DoubleSide});
    material.onBeforeCompile=this.landMaterial.onBeforeCompile;
    material.customProgramCacheKey=this.landMaterial.customProgramCacheKey;
    addTerrainMorph(material,node.morph);
    const land=new THREE.Mesh(geometry,material);
    land.customDepthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:THREE.DoubleSide});
    addTerrainMorph(land.customDepthMaterial,node.morph,false);
    land.receiveShadow=true;land.castShadow=node.level>=12;
    const group=new THREE.Group();group.add(land);
    if(data.heights.some(h=>h<50)||data.parentHeights.some(h=>h<50)){
      const waterGeometry=new THREE.BufferGeometry();
      waterGeometry.setAttribute('position',new THREE.BufferAttribute(data.waterPositions,3));
      waterGeometry.setAttribute('parentPosition',new THREE.BufferAttribute(data.parentWaterPositions,3));
      waterGeometry.setAttribute('parentHeight',new THREE.BufferAttribute(data.parentHeights,1));
      waterGeometry.setAttribute('direction',new THREE.BufferAttribute(data.directions,3));
      waterGeometry.setAttribute('terrainHeight',new THREE.BufferAttribute(data.heights,1));
      waterGeometry.setIndex(new THREE.BufferAttribute(data.indices,1));this.boundGeometry(waterGeometry);
      const waterMaterial=new THREE.ShaderMaterial({
        side:this.waterMaterial.side,vertexShader:this.waterMaterial.vertexShader,fragmentShader:this.waterMaterial.fragmentShader,
        uniforms:{...this.waterMaterial.uniforms,terrainMorph:node.morph},
      });
      group.add(new THREE.Mesh(waterGeometry,waterMaterial));
    }
    node.residentFrame=this.frame;node.center.set(...data.center);node.mesh=group;group.position.copy(node.center).sub(this.origin);group.visible=false;this.scene.add(group);
    this.dispatch();
  }
  boundGeometry(geometry){
    geometry.boundingBox=new THREE.Box3().setFromBufferAttribute(geometry.attributes.position);
    geometry.boundingBox.union(new THREE.Box3().setFromBufferAttribute(geometry.attributes.parentPosition));
    geometry.boundingSphere=geometry.boundingBox.getBoundingSphere(new THREE.Sphere());
  }
  disposeNode(node){
    node.mesh.traverse(o=>{o.geometry?.dispose();o.material?.dispose();o.customDepthMaterial?.dispose();});
    this.scene.remove(node.mesh);node.mesh=null;node.children=null;node.refined=false;
    node.progress=node.target=node.childMorph.value=0;
  }
  select(){
    this.visibleCount=0;this.maxVisibleLevel=0;this.waitingCount=0;this.mergingCount=0;
    const length=this.cameraWorld.length(),radial=this.cameraWorld.clone().normalize();
    const now=performance.now();
    for(const n of this.nodes.values())if(n.mesh)n.mesh.visible=false;
    for(const n of this.queue)n.queued=false;this.queue=[];
    const visit=(node,collapse=false)=>{
      if(!collapse&&node.level>1 && node.normal.dot(radial)<RADIUS/Math.max(RADIUS,length)-node.size*1.5-.035)return;
      node.lastUsed=now;this.request(node);
      const distance=Math.max(3,node.surfaceCenter.distanceTo(this.cameraWorld));
      node.wantsSplit=!collapse&&wantsTerrainSplit(node.level,MAX_LEVEL,distance,node.size*RADIUS,node.wantsSplit);
      if(node.wantsSplit&&node.mesh&&node.morph.value===1){
        if(!node.children)node.children=[this.node(node.face,node.level+1,node.ix*2,node.iy*2),this.node(node.face,node.level+1,node.ix*2+1,node.iy*2),this.node(node.face,node.level+1,node.ix*2,node.iy*2+1),this.node(node.face,node.level+1,node.ix*2+1,node.iy*2+1)];
        for(const child of node.children){child.lastUsed=now;this.request(child);}
        // Retain the complete parent until every child has survived two frames.
        if(!node.refined&&node.children.every(c=>c.mesh&&this.frame-c.residentFrame>=2)){
          // A cached subtree may be finer than this new parent transition.
          // Start its immediate children on the parent surface as one level.
          for(const child of node.children){child.refined=false;child.progress=child.target=child.childMorph.value=0;}
          node.refined=true;
        }
      }
      if(node.refined){
        const merging=!node.wantsSplit;
        if(merging)this.mergingCount++;
        // Collapse descendants first, so we only ever replace one complete level.
        node.target=merging&&node.children.every(c=>!c.refined)?0:1;
        if(merging&&node.progress===0&&node.children.every(c=>!c.refined))node.refined=false;
        else {
          for(const child of node.children){child.morph.value=node.childMorph.value;visit(child,merging);}
          return;
        }
      }
      if(node.wantsSplit&&!node.refined)this.waitingCount++;
      if(node.mesh){node.mesh.visible=true;this.visibleCount++;this.maxVisibleLevel=Math.max(this.maxVisibleLevel,node.level);}
    };
    for(const root of this.roots)visit(root);
    if(this.nodes.size>1100){for(const node of this.nodes.values()){
      if(node.level<=3||!node.mesh||node.mesh.visible||node.queued||now-node.lastUsed<8000)continue;
      this.disposeNode(node);
    }}
    this.dispatch();
  }
  update(worldPosition,origin,sunDirection,time,altitude){
    this.frame++;
    const now=performance.now();
    const dt=this.lastMorphTime===undefined?0:Math.max(0,(now-this.lastMorphTime)/1000);this.lastMorphTime=now;
    this.cameraWorld.copy(worldPosition);this.origin.copy(origin);
    for(const node of this.nodes.values()){
      node.progress=advanceTerrainMorph(node.progress,node.target,dt);
      node.childMorph.value=terrainMorphValue(node.progress);
      if(node.children)for(const child of node.children)child.morph.value=node.childMorph.value;
      if(node.mesh)node.mesh.position.copy(node.center).sub(origin);
    }
    updateWaterMaterial(this.waterMaterial,origin,sunDirection,time,altitude);
    if(!this.lastSelect||performance.now()-this.lastSelect>100){this.select();this.lastSelect=performance.now();}
  }
  get lodStats(){
    let morphing=0;for(const n of this.nodes.values())if(n.mesh?.visible&&n.morph.value>0&&n.morph.value<1)morphing++;
    return {morphing,waiting:this.waitingCount,merging:this.mergingCount,settled:this.pending===0&&morphing===0&&this.waitingCount===0&&this.mergingCount===0,visible:this.visibleCount,error:this.error||null};
  }
  get ready(){return this.roots.every(n=>n.mesh);}
  get pending(){return this.queue.length+this.jobs.size;}
  get detailStats(){return {orbitalResolution:this.orbitalSurface.resolution,...this.lodStats};}
  dispose(){this.releaseRockMaterial();this.orbitalSurface.dispose();this.surfaceTexture.dispose();this.groundTextures.dispose();this.terrainMaps.dispose();for(const slot of this.workers)slot.worker.terminate();for(const n of this.nodes.values())if(n.mesh)this.disposeNode(n);this.landMaterial.dispose();this.waterMaterial.dispose();}
}
