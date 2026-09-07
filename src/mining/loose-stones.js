import * as THREE from 'three';
import {SEED} from '../world.js';
import {AEON,bodyAltitude} from '../celestial.js';
import {legacyAsteroidGeometry} from '../asteroid-geometry.js';
import {createDensity,meshVolume} from './volume.js';
import {RockCollision} from './collision.js';
import {aeonStoneField,nearbyAeonStones,AEON_STONE_SCALES,AEON_STONE_RANGE} from './aeon-stones.js';
import {createStoneMaterial,addStoneFade} from './stone-material.js';

const unitScale=new THREE.Vector3(1,1,1),capacity=256;
function geometryFor(data){
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(data.positions,3));
  geometry.setAttribute('normal',new THREE.BufferAttribute(data.normals,3));
  geometry.computeBoundingSphere();return geometry;
}

/** Cheap distant instances, exact density meshes in tool range, at most three
 * editable workers owned by MiningField. Saved cuts never fall back to virgin
 * instances: their immutable geometry/collider remains available after eviction. */
export class LooseStones {
  constructor(scene,store){
    this.store=store;this.group=new THREE.Group();this.group.name='Aeon mineable loose stones';scene.add(this.group);
    this.camera={value:new THREE.Vector3()};this.templates=new Map();this.edited=new Map();this.descriptors=[];
    this.materials=[0,1,2].map(level=>{const material=createStoneMaterial();addStoneFade(material,this.camera,level);return material;});
    this.depths=[0,1,2].map(level=>{const material=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});addStoneFade(material,this.camera,level);return material;});
    this.stats={stones:0,nearInstances:0,farInstances:0,edited:0};
  }
  query(origin){
    if(this.seed!==SEED||!this.queryOrigin||origin.distanceToSquared(this.queryOrigin)>24**2){
      this.seed=SEED;this.queryOrigin=origin.clone();this.descriptors=nearbyAeonStones(origin);
    }
    return this.descriptors;
  }
  batch(geometry,level,size=capacity){
    const mesh=new THREE.InstancedMesh(geometry,this.materials[level],size);
    mesh.customDepthMaterial=this.depths[level];mesh.frustumCulled=false;mesh.castShadow=level!==1;mesh.receiveShadow=true;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.count=0;this.group.add(mesh);return mesh;
  }
  template(variant){
    if(this.templates.has(variant))return this.templates.get(variant);
    const field=createDensity((x,y,z)=>aeonStoneField(x,y,z,variant)),geometry=geometryFor(meshVolume(field,[1,0,0]));
    const distant=legacyAsteroidGeometry(variant,3);distant.scale(...Array(3).fill(AEON_STONE_SCALES[variant]));
    const entry={field,geometry,near:this.batch(geometry,0),far:this.batch(distant,1)};
    this.templates.set(variant,entry);return entry;
  }
  initialField(descriptor){return this.template(descriptor.variant).field;}
  saved(descriptor,live){
    const snapshot=this.store.state.rocks?.[descriptor.id];if(!snapshot)return null;
    let entry=this.edited.get(descriptor.id);
    if(entry?.revision===snapshot.revision)return entry;
    if(entry){entry.mesh.geometry.dispose();entry.mesh.dispose();entry.mesh.removeFromParent();}
    const geometry=live?.ready?live.mesh.geometry.clone():geometryFor(meshVolume(snapshot.field,[1,0,0]));
    const mesh=this.batch(geometry,2,1);
    entry={revision:snapshot.revision,mesh,collision:live?.ready?live.collision:new RockCollision(geometry.attributes.position.array)};
    this.edited.set(descriptor.id,entry);return entry;
  }
  update(origin,liveRocks){
    const descriptors=this.query(origin),matrix=new THREE.Matrix4(),local=new THREE.Vector3();
    // Subtract the double-precision camera origin before writing float matrices.
    this.group.position.set(0,0,0);this.camera.value.set(0,0,0);
    for(const entry of this.templates.values()){entry.near.count=0;entry.far.count=0;}
    for(const entry of this.edited.values())entry.mesh.count=0;
    const retained=new Set();let stones=0;
    for(const d of descriptors){
      const distance=d.position.distanceTo(origin);if(distance>AEON_STONE_RANGE)continue;
      stones++;retained.add(d.id);
      const live=liveRocks.get(d.id),saved=this.saved(d,live);
      matrix.compose(local.copy(d.position).sub(origin),d.quaternion,unitScale);
      if(live?.ready)continue;
      if(saved){saved.mesh.setMatrixAt(0,matrix);saved.mesh.count=1;saved.mesh.instanceMatrix.needsUpdate=true;continue;}
      const template=this.template(d.variant);
      for(const mesh of [distance<65?template.near:null,distance>45?template.far:null]){
        if(!mesh||mesh.count===capacity)continue;mesh.setMatrixAt(mesh.count++,matrix);
      }
    }
    for(const [id,entry] of this.edited)if(!retained.has(id)){entry.mesh.geometry.dispose();entry.mesh.dispose();entry.mesh.removeFromParent();this.edited.delete(id);}
    let nearInstances=0,farInstances=0;
    for(const entry of this.templates.values()){
      for(const mesh of [entry.near,entry.far])mesh.instanceMatrix.needsUpdate=true;
      nearInstances+=entry.near.count;farInstances+=entry.far.count;
    }
    this.stats={stones,nearInstances,farInstances,edited:this.edited.size};
  }
  collision(d){
    const saved=this.saved(d);if(saved)return saved.collision;
    const template=this.template(d.variant);
    return template.collision??=new RockCollision(template.geometry.attributes.position.array);
  }
  raycast(origin,direction,range,exclude=new Set()){
    let nearest=null;
    for(const d of this.descriptors){
      if(exclude.has(d.id)||origin.distanceTo(d.position)>range+3)continue;
      const inverse=d.quaternion.clone().invert(),local=origin.clone().sub(d.position).applyQuaternion(inverse);
      const hit=this.collision(d).raycast(local,direction.clone().applyQuaternion(inverse),nearest?.distance??range);
      if(!hit)continue;
      const point=hit.point.clone().applyQuaternion(d.quaternion).add(d.position);
      if(bodyAltitude(point,AEON)<.04)continue;
      let occluded=false;
      for(let distance=.15;distance<hit.distance;distance+=.15)if(bodyAltitude(origin.clone().addScaledVector(direction,distance),AEON)<.02){occluded=true;break;}
      if(!occluded)nearest={...hit,point,normal:hit.normal.applyQuaternion(d.quaternion),descriptor:d};
    }
    return nearest;
  }
  constrain(method,previous,proposed,exclude=new Set()){
    let point=proposed,hit=false,grounded=false;
    const flight=method==='constrainFlight',eva=method==='constrainEVA',reach=flight?14:4;
    for(const d of this.descriptors){
      if(exclude.has(d.id)||new THREE.Line3(previous,point).closestPointToPoint(d.position,true,new THREE.Vector3()).distanceToSquared(d.position)>reach**2)continue;
      const inverse=d.quaternion.clone().invert(),a=previous.clone().sub(d.position).applyQuaternion(inverse),b=point.clone().sub(d.position).applyQuaternion(inverse);
      const lift=new THREE.Vector3(0,flight?10:eva?.35:0),options=flight?{radius:10,height:20}:eva?{radius:.35,height:.7}:undefined;
      const result=this.collision(d).sweep(a.add(lift),b.add(lift),options);
      point=result.point.sub(lift).applyQuaternion(d.quaternion).add(d.position);hit ||= result.hit;grounded ||= result.grounded;
    }
    return {point,hit,grounded};
  }
  dispose(){
    for(const entry of this.templates.values())for(const mesh of [entry.near,entry.far]){mesh.geometry.dispose();mesh.dispose();}
    for(const entry of this.edited.values()){entry.mesh.geometry.dispose();entry.mesh.dispose();}
    for(const material of [...this.materials,...this.depths])material.dispose();this.group.removeFromParent();
  }
}
