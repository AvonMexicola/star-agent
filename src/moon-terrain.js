import * as THREE from 'three';
import { cubeDirection, MOON_RADIUS, MOON_POSITION, moonSurface } from './world.js';
import { terrainGridForLevel } from './terrain-resolution.js';
import { MOON_MAX_HEIGHT } from './moon-world.js';
import { generateMoonPatch } from './moon-patch.js';
export { generateMoonPatch, MOON_GRID } from './moon-patch.js';
import { patchSurfaceMaterial, patchSurfaceUV } from './patch-surface.js';

export const MOON_MAX_LEVEL=17;

export class MoonTerrain {
  constructor(scene,material){
    this.scene=scene;this.material=material;this.nodes=new Map();this.origin=new THREE.Vector3();this.local=new THREE.Vector3();this.visibleCount=0;this.maxLevel=0;
    this.queue=[];this.jobs=new Map();this.workers=[];this.completedBuilds=0;
    this.roots=Array.from({length:6},(_,face)=>this.node(face,0,0,0));
    for(const node of this.roots)this.build(node);
    // Keep initial globe coverage synchronous. Detailed flight patches are CPU
    // work and must not block camera/input updates while the player descends.
    if(typeof Worker!=='undefined')for(let i=0;i<2;i++){
      const worker=new Worker(new URL('./moon-terrain.worker.js',import.meta.url),{type:'module'}),slot={worker,busy:false};
      worker.onmessage=({data})=>{
        slot.busy=false;const node=this.jobs.get(data.id);this.jobs.delete(data.id);
        if(node){node.queued=false;if(data.error){this.error=data.error;console.error(data.error);}else{this.install(node,data);this.completedBuilds++;}}
        this.dispatch();
      };
      worker.onerror=error=>{this.error='Lunar terrain worker failed';console.error(this.error,error.message);};
      this.workers.push(slot);
    }
  }
  node(face,level,ix,iy){
    const key=`${face}/${level}/${ix}/${iy}`;if(this.nodes.has(key))return this.nodes.get(key);
    const size=2/2**level,d=cubeDirection(face,-1+(ix+.5)*size,-1+(iy+.5)*size),normal=new THREE.Vector3(...d);
    const node={key,face,level,ix,iy,size,normal,surface:normal.clone().multiplyScalar(MOON_RADIUS+moonSurface(...d).height),children:null,mesh:null,lastUsed:performance.now()};
    this.nodes.set(key,node);return node;
  }
  build(node){
    if(node.mesh)return;
    const grid=terrainGridForLevel(node.level);
    this.install(node,generateMoonPatch({...node,grid,surfaceDetail:grid===32}));
  }
  request(node){if(!node.mesh&&!node.queued){node.queued=true;this.queue.push(node);}}
  dispatch(){
    this.queue.sort((a,b)=>a.surface.distanceTo(this.local)/a.size-b.surface.distanceTo(this.local)/b.size);
    for(const slot of this.workers)if(!slot.busy&&this.queue.length){
      const node=this.queue.shift(),grid=terrainGridForLevel(node.level);slot.busy=true;this.jobs.set(node.key,node);
      slot.worker.postMessage({id:node.key,face:node.face,level:node.level,ix:node.ix,iy:node.iy,grid,surfaceDetail:grid===32});
    }
  }
  install(node,data){
    const grid=terrainGridForLevel(node.level),geometry=new THREE.BufferGeometry();
    for(const [name,values] of [['position',data.positions],['normal',data.normals],['moonDirection',data.directions],['moonPoint',data.points],['color',data.colors]])geometry.setAttribute(name,new THREE.BufferAttribute(values,3));
    geometry.setAttribute('rockRelief',new THREE.BufferAttribute(data.rockReliefs,1));
    geometry.setAttribute('moonSurfaceData',new THREE.BufferAttribute(data.surface,2));
    geometry.setAttribute('uv',new THREE.BufferAttribute(data.field?patchSurfaceUV(grid,data.field.width):new Float32Array(data.positions.length/3*2),2));
    geometry.setIndex(new THREE.BufferAttribute(data.indices,1));geometry.computeBoundingSphere();
    node.center=new THREE.Vector3(...data.center);node.mesh=new THREE.Mesh(geometry,data.field?patchSurfaceMaterial(this.material,data.field):this.material);node.mesh.name=`Selene terrain ${node.key}`;
    node.mesh.receiveShadow=true;node.mesh.castShadow=node.level>=12;node.mesh.visible=false;this.scene.add(node.mesh);
  }
  update(worldPosition,origin){
    this.origin.copy(origin);this.local.copy(worldPosition).sub(new THREE.Vector3(...MOON_POSITION));
    const radius=this.local.length(),radial=this.local.clone().normalize(),now=performance.now();
    for(const node of this.queue)node.queued=false;this.queue=[];
    for(const node of this.nodes.values())if(node.mesh)node.mesh.visible=false;
    let budget=8,builds=0;this.visibleCount=0;this.maxLevel=0;this.waitingCount=0;
    const distance=node=>node.surface.distanceTo(this.local);
    const visit=node=>{
      if(node.level>1&&node.normal.dot(radial)<MOON_RADIUS/Math.max(MOON_RADIUS,radius)-node.size*1.5-MOON_MAX_HEIGHT/MOON_RADIUS)return;
      node.lastUsed=now;
      const split=node.level<(radius<MOON_RADIUS*12?3:2)||(node.level<MOON_MAX_LEVEL&&distance(node)<node.size*MOON_RADIUS*1.8);
      if(split){
        if(!node.children)node.children=[this.node(node.face,node.level+1,node.ix*2,node.iy*2),this.node(node.face,node.level+1,node.ix*2+1,node.iy*2),this.node(node.face,node.level+1,node.ix*2,node.iy*2+1),this.node(node.face,node.level+1,node.ix*2+1,node.iy*2+1)];
        // All four siblings are required for parent replacement, even when one
        // is horizon-culled. Retain these dependencies to avoid eviction/rebuild
        // loops that repeatedly expose coarse fallback mountains.
        for(const child of node.children)child.lastUsed=now;
        for(const child of [...node.children].sort((a,b)=>distance(a)-distance(b)))if(!child.mesh){
          if(this.workers.length)this.request(child);
          else{const cost=(terrainGridForLevel(child.level)/16)**2;if(budget>=cost){this.build(child);budget-=cost;builds++;}}
        }
        // A parent remains visible until every child has geometry, including
        // during a rapid descent or a cache miss after returning from Aeon.
        if(node.children.every(child=>child.mesh)){for(const child of [...node.children].sort((a,b)=>distance(a)-distance(b)))visit(child);return;}
        this.waitingCount++;
      }
      if(node.mesh){node.mesh.visible=true;this.visibleCount++;this.maxLevel=Math.max(this.maxLevel,node.level);}
    };
    for(const root of [...this.roots].sort((a,b)=>distance(a)-distance(b)))visit(root);
    for(const node of this.nodes.values())if(node.mesh)node.mesh.position.copy(node.center).add(new THREE.Vector3(...MOON_POSITION)).sub(origin);
    this.buildsLastFrame=builds+this.completedBuilds;this.completedBuilds=0;this.dispatch();
    if(this.nodes.size>900)for(const node of this.nodes.values()){
      if(node.level<=2||node.mesh?.visible||now-node.lastUsed<8000)continue;
      if(node.mesh){this.disposeMesh(node.mesh);node.mesh=null;}
      // Keep cheap nodes so retained child references cannot point at orphaned
      // duplicate meshes after revisiting an evicted region.
    }
  }
  get ready(){return this.maxLevel>=2;}
  disposeMesh(mesh){this.scene.remove(mesh);mesh.geometry.dispose();if(mesh.material!==this.material)mesh.material.dispose();}
  dispose(){for(const slot of this.workers)slot.worker.terminate();this.queue=[];this.jobs.clear();for(const node of this.nodes.values())if(node.mesh)this.disposeMesh(node.mesh);this.nodes.clear();}
}
