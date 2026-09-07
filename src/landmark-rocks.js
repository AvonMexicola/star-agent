import * as THREE from 'three';
import {RADIUS,SEED} from './world.js';
import {RockCollision} from './mining/collision.js';
import {createLandmarkGeometry} from './landmark-geometry.js';
import {createLandmarkMaterial,addLandmarkFade} from './landmark-material.js';
import {landmarkCells,landmarkDescriptor,nearbyLandmarks,LANDMARK_RANGE,LANDMARK_BOUND} from './landmark-distribution.js';

const CAPACITY=256;
export class LandmarkRocks {
  constructor(scene,{clearings=[],render=true}={}){
    this.render=render;
    this.group=new THREE.Group();this.group.name='Aeon landmark bedrock';scene.add(this.group);
    this.templates=new Map();this.descriptors=new Map();this.queue=[];this.requested=new Set();this.grounded=false;
    // Existing authored outposts win over newly introduced scenery. Capture
    // restored claims once, so placing a new piece cannot make a rock disappear.
    this.clearings=clearings.map(c=>({position:new THREE.Vector3(...c.position),radius:c.radius}));
    this.materials=render?[0,1,2,3].map(level=>{const material=createLandmarkMaterial();addLandmarkFade(material,level);return material;}):[];
    this.depths=render?[0,1,2,3].map(level=>{const material=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});addLandmarkFade(material,level);return material;}):[];
    this.stats={resident:0,visible:0,pending:0,triangles:0,draws:0,nearest:null};
    if(render&&typeof Worker!=='undefined'){
      this.worker=new Worker(new URL('./landmark.worker.js',import.meta.url),{type:'module'});
      this.worker.onmessage=({data})=>{
        const g=new THREE.BufferGeometry();
        for(const [name,array] of [['position',data.positions],['normal',data.normals],['color',data.colors]])g.setAttribute(name,new THREE.BufferAttribute(array,3));
        g.computeBoundingSphere();this.publish(data.variant,data.lod,g);
      };
      this.worker.onerror=()=>{console.warn('Landmark worker unavailable; using bounded local geometry fallback.');this.worker.terminate();this.worker=null;};
    }
  }
  entry(variant){
    if(!this.templates.has(variant))this.templates.set(variant,{geometries:[],meshes:[],collision:null});
    return this.templates.get(variant);
  }
  protected(d){return (this.useClearings?.()??true)&&this.clearings.some(c=>d.position.distanceTo(c.position)<c.radius+d.footprint+12);}
  publish(variant,lod,geometry){
    const entry=this.entry(variant);
    if(entry.geometries[lod]){geometry.dispose();return;}
    entry.geometries[lod]=geometry;
    if(!this.render)return;
    const levels=lod===2?[2,3]:[lod];
    for(const level of levels){
      const mesh=new THREE.InstancedMesh(geometry,this.materials[level],CAPACITY);
      mesh.count=0;mesh.frustumCulled=false;mesh.castShadow=lod===0;mesh.receiveShadow=true;
      mesh.customDepthMaterial=this.depths[level];mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      entry.meshes[level]=mesh;this.group.add(mesh);
    }
  }
  geometry(variant){
    const entry=this.entry(variant);
    // Only a physical contact may demand the near mesh synchronously. Ordinary
    // travel streams all visual templates on a single worker and retains a far
    // representation until every finer level is ready.
    if(!entry.geometries[0])this.publish(variant,0,createLandmarkGeometry(variant,0));
    return entry.geometries[0];
  }
  collider(d){const entry=this.entry(d.variant);return entry.collision??=new RockCollision(this.geometry(d.variant).attributes.position.array);}
  update(origin,camera){
    const clearingMode=this.useClearings?.()??true;
    if(clearingMode!==this.clearingMode){this.clearingMode=clearingMode;this.queryOrigin=null;this.descriptors.clear();}
    for(const entry of this.templates.values())for(const mesh of entry.meshes)if(mesh)mesh.count=0;
    const altitude=origin.length()-RADIUS;
    this.group.visible=Math.abs(altitude)<12000;
    if(!this.group.visible){this.descriptors.clear();this.queryOrigin=null;this.queue=[];this.stats={...this.stats,resident:0,visible:0,pending:0,triangles:0,draws:0,nearest:null};return;}
    if(this.seed!==SEED||!this.queryOrigin||origin.distanceToSquared(this.queryOrigin)>160**2){
      if(this.seed!==SEED)this.descriptors.clear();this.seed=SEED;this.queryOrigin=origin.clone();
      this.queue=landmarkCells(origin,LANDMARK_RANGE+320);this.cursor=0;
      for(const [id,d] of this.descriptors)if(d.position.distanceTo(origin)>LANDMARK_RANGE+480)this.descriptors.delete(id);
    }
    const start=performance.now();let processed=0;
    while(this.cursor<this.queue.length&&(processed<4||performance.now()-start<1.4)){
      const cell=this.queue[this.cursor++],d=landmarkDescriptor(cell.row,cell.column);processed++;
      if(d&&!this.protected(d))this.descriptors.set(d.id,d);
    }
    const matrix=new THREE.Matrix4(),local=new THREE.Vector3(),scale=new THREE.Vector3(),sphere=new THREE.Sphere(),frustum=new THREE.Frustum();
    if(camera){camera.updateMatrixWorld();frustum.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));}
    let visible=0,nearest=null,fallbackBuilt=false;
    for(const d of this.descriptors.values()){
      if(this.protected(d))continue;
      const distance=d.position.distanceTo(origin);if(distance>LANDMARK_RANGE)continue;
      if(!nearest||distance<nearest.distance)nearest={id:d.id,name:d.name,position:d.position.toArray(),variant:d.variant,scale:d.scale,distance};
      local.copy(d.position).sub(origin);sphere.set(local,LANDMARK_BOUND);
      if(camera&&distance>320&&!frustum.intersectsSphere(sphere))continue;
      const entry=this.entry(d.variant);
      if(this.worker&&!this.requested.has(d.variant)){this.requested.add(d.variant);this.worker.postMessage({variant:d.variant});}
      if(!this.worker&&!fallbackBuilt&&(!entry.geometries[0]||!entry.geometries[1]||!entry.geometries[2])){
        for(const lod of [2,1,0])if(!entry.geometries[lod])this.publish(d.variant,lod,createLandmarkGeometry(d.variant,lod));fallbackBuilt=true;
      }
      const ready=entry.geometries[0]&&entry.geometries[1]&&entry.geometries[2];
      const levels=ready?[distance<580?0:null,distance>420&&distance<1950?1:null,distance>1500?2:null]:[3];
      matrix.compose(local,d.quaternion,scale.setScalar(d.scale));let rendered=false;
      for(const level of levels){
        const mesh=level===null?null:entry.meshes[level];if(!mesh||mesh.count>=CAPACITY)continue;
        mesh.setMatrixAt(mesh.count++,matrix);rendered=true;
      }
      if(rendered)visible++;
    }
    let triangles=0,draws=0;
    for(const entry of this.templates.values())for(const mesh of entry.meshes)if(mesh){
      mesh.instanceMatrix.needsUpdate=true;
      if(mesh.count){triangles+=mesh.count*mesh.geometry.attributes.position.count/3;draws++;}
    }
    this.stats={resident:this.descriptors.size,visible,pending:this.queue.length-(this.cursor??0)+[...this.requested].filter(v=>!this.entry(v).geometries[0]).length,triangles,draws,nearest};
  }
  candidates(a,b,margin=0){
    const length=a.distanceTo(b),middle=a.clone().lerp(b,.5);
    if(Math.abs(middle.length()-RADIUS)>12000&&Math.min(a.length(),b.length())>RADIUS+12000)return [];
    const result=new Map();
    // Collision queries do not depend on visual residency. Navigation already
    // substeps flight; this also covers a direct long sweep with clear endpoints.
    const steps=Math.max(1,Math.ceil(length/1000));
    for(let i=0;i<steps;i++){
      const center=a.clone().lerp(b,(i+.5)/steps);
      if(Math.abs(center.length()-RADIUS)>12000)continue;
      for(const d of nearbyLandmarks(center,Math.min(800,length/steps*.5+margin+LANDMARK_BOUND)))if(!this.protected(d))result.set(d.id,d);
    }
    return [...result.values()];
  }
  raycast(origin,direction,range){
    const end=origin.clone().addScaledVector(direction,range),line=new THREE.Line3(origin,end);let nearest=null;
    for(const d of this.candidates(origin,end)){
      if(line.closestPointToPoint(d.position,true,new THREE.Vector3()).distanceTo(d.position)>LANDMARK_BOUND)continue;
      const inverse=d.quaternion.clone().invert(),local=origin.clone().sub(d.position).applyQuaternion(inverse).divideScalar(d.scale);
      const hit=this.collider(d).raycast(local,direction.clone().applyQuaternion(inverse),(nearest?.distance??range)/d.scale);
      if(hit)nearest={...hit,point:hit.point.applyQuaternion(d.quaternion).multiplyScalar(d.scale).add(d.position),normal:hit.normal.applyQuaternion(d.quaternion),distance:hit.distance*d.scale,descriptor:{...d,key:d.id}};
    }
    return nearest;
  }
  constrain(previous,proposed,{radius=.25,height=1.75,lift=0}={}){
    let point=proposed.clone(),hit=false,grounded=false;
    for(const d of this.candidates(previous,point,radius)){
      if(new THREE.Line3(previous,point).closestPointToPoint(d.position,true,new THREE.Vector3()).distanceTo(d.position)>LANDMARK_BOUND+radius)continue;
      const inverse=d.quaternion.clone().invert();
      const local=p=>p.clone().sub(d.position).applyQuaternion(inverse).add(new THREE.Vector3(0,lift,0)).divideScalar(d.scale);
      const result=this.collider(d).sweep(local(previous),local(point),{radius:radius/d.scale,height:height/d.scale});
      point.copy(result.point).multiplyScalar(d.scale).sub(new THREE.Vector3(0,lift,0)).applyQuaternion(d.quaternion).add(d.position);
      hit ||= result.hit;grounded ||= result.grounded;
    }
    this.grounded=grounded;return {point,hit,grounded};
  }
  dispose(){
    this.worker?.terminate();for(const entry of this.templates.values()){
      for(const mesh of entry.meshes)mesh?.dispose();for(const geometry of entry.geometries)geometry?.dispose();
    }
    for(const material of [...this.materials,...this.depths])material.dispose();this.group.removeFromParent();this.templates.clear();this.descriptors.clear();
  }
}

export function createLandmarkObstacles(base,landmarks,nav){
  let grounded=false;
  function constrain(method,a,b,options){
    const prior=base[method](a,b),result=landmarks.constrain(a,prior?.point??b,options);
    grounded=result.grounded;
    return {...prior,...result,hit:Boolean(prior?.hit||result.hit),grounded:Boolean(prior?.grounded||result.grounded)};
  }
  return {
    get grounded(){return base.grounded||grounded;},
    constrainWalker(a,b){return constrain('constrainWalker',a,b,{radius:.25,height:nav.layout.eyeHeight+.1});},
    constrainEVA(a,b){return constrain('constrainEVA',a,b,{radius:.35,height:.7,lift:.35});},
    constrainFlight(a,b){
      // Conservative sphere enclosing the actual active ship's flight envelope,
      // including Atlas. Uniform descriptor scale is applied to contact too.
      const {min,max}=nav.layout.flightBounds,eye=nav.layout.seatEye;
      const radius=Math.hypot(...min.map((v,i)=>Math.max(Math.abs(v-eye[i]),Math.abs(max[i]-eye[i]))));
      return constrain('constrainFlight',a,b,{radius,height:radius*2,lift:radius});
    },
  };
}
