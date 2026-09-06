import * as THREE from 'three';
import { MOON_LANDING_DIRECTION, LANDING_FRAME, MOON_RADIUS } from '../moon-world.js';
import { bodySurfacePoint, bodyAltitude, SELENE } from '../celestial.js';
import { RockCollision } from './collision.js';
import { MiningStore } from './store.js';

export class MineableRock {
  constructor(scene,storage,{worker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'})}={}){
    this.store=new MiningStore(storage);this.worker=worker;this.scene=scene;this.pending=false;this.ready=false;this.budget=0;this.sequence=0;this.grounded=false;this.meshMs=0;this.publishMs=0;
    const up=new THREE.Vector3(...MOON_LANDING_DIRECTION),east=new THREE.Vector3(...LANDING_FRAME.east),north=new THREE.Vector3(...LANDING_FRAME.north);
    // Behind and to the left of the ramp, entirely within the level landing shelf.
    const direction=up.clone().addScaledVector(east,-19/MOON_RADIUS).addScaledVector(north,8/MOON_RADIUS).normalize();
    this.position=bodySurfacePoint(direction,SELENE,1.35);this.up=direction;
    this.quaternion=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(east,direction,east.clone().cross(direction).normalize()));
    this.inverse=this.quaternion.clone().invert();
    this.group=new THREE.Group();this.group.name='Crescent copper deposit';this.group.quaternion.copy(this.quaternion);scene.add(this.group);
    this.material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.88,metalness:.16,side:THREE.DoubleSide});
    this.material.onBeforeCompile=shader=>{
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vRockPoint;').replace('#include <begin_vertex>','#include <begin_vertex>\nvRockPoint=position;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vRockPoint;').replace('#include <color_fragment>',`#include <color_fragment>
        float grain=sin(vRockPoint.x*137.0+sin(vRockPoint.z*81.0))*sin(vRockPoint.y*119.0+vRockPoint.z*67.0);
        float fade=1.0-smoothstep(.2,1.0,length(fwidth(vRockPoint))*120.0);
        diffuseColor.rgb*=1.0+grain*.15*fade;`);
    };
    this.material.customProgramCacheKey=()=> 'mineable-rock-v1';
    this.worker.onmessage=({data})=>this.receive(data);
    this.worker.onerror=()=>{this.pending=false;this.error='Rock worker unavailable. Mining paused.';};
    this.request();
  }
  toLocal(point){return point.clone().sub(this.position).applyQuaternion(this.inverse);}
  toWorld(point){return point.clone().applyQuaternion(this.quaternion).add(this.position);}
  request(point,budget){
    if(this.pending||this.error)return false;
    this.pending=true;this.job={id:++this.sequence,revision:this.store.state.revision,carving:Boolean(point)};
    const field=this.store.state.field.slice();this.worker.postMessage({...this.job,field,point,budget},[field.buffer]);return true;
  }
  receive(data){
    if(!this.job||data.id!==this.job.id)return;
    this.pending=false;if(data.error){this.error=data.error;return;}if(data.empty)return;
    const start=performance.now();
    // Prepare the collider before publishing either representation. A rejected
    // save or stale job leaves both visible mesh and collision untouched.
    const geometry=new THREE.BufferGeometry();
    for(const key of ['positions','normals','colors'])geometry.setAttribute({positions:'position',normals:'normal',colors:'color'}[key],new THREE.BufferAttribute(data[key],3));
    geometry.computeBoundingSphere();const collision=new RockCollision(data.positions);
    if(this.job.revision!==this.store.state.revision||(this.job.carving&&!this.store.commit(data,this.job.revision))){geometry.dispose();return;}
    if(this.mesh){const old=this.mesh.geometry;this.mesh.geometry=geometry;old.dispose();}
    else{this.mesh=new THREE.Mesh(geometry,this.material);this.mesh.castShadow=true;this.mesh.receiveShadow=true;this.group.add(this.mesh);}
    this.collision=collision;this.ready=true;this.meshMs=data.meshMs;this.publishMs=performance.now()-start;
  }
  raycast(origin,direction,range=8){
    if(!this.ready||origin.distanceTo(this.position)>range+4)return null;
    const localOrigin=this.toLocal(origin),localDirection=direction.clone().applyQuaternion(this.inverse),hit=this.collision.raycast(localOrigin,localDirection,range);
    if(!hit)return null;
    const point=this.toWorld(hit.point);
    // The exposed rock can be mined; the untouched moon underneath cannot.
    if(bodyAltitude(point,SELENE)<.04)return null;
    // Reject terrain occlusion along the short tool ray.
    for(let d=.15;d<hit.distance;d+=.15)if(bodyAltitude(origin.clone().addScaledVector(direction,d),SELENE)<.02)return null;
    return {...hit,point,localPoint:hit.point,normal:hit.normal.applyQuaternion(this.quaternion)};
  }
  /** Equipment adapter: point must be the validated nearest rock hit, in world metres. */
  onMine({point,dt,rate=.35},direction){
    if(!this.ready||this.store.blocked||this.store.free<.0001||this.error)return;
    this.budget=Math.min(.045,this.budget+Math.min(.1,Math.max(0,dt))*Math.max(0,Math.min(.35,rate)));
    if(this.pending||this.budget<.018)return;
    const local=this.toLocal(point.clone().addScaledVector(direction,.08));
    const budget=Math.min(this.budget,this.store.free/12);this.budget=0;
    this.request(local.toArray(),budget);
  }
  constrainWalker(previous,proposed){
    this.grounded=false;if(!this.ready||previous.distanceTo(this.position)>6&&proposed.distanceTo(this.position)>6)return {point:proposed,hit:false};
    const result=this.collision.sweep(this.toLocal(previous),this.toLocal(proposed));this.grounded=result.grounded;
    return {...result,point:this.toWorld(result.point)};
  }
  constrainFlight(previous,proposed){
    if(!this.ready)return {point:proposed,hit:false};
    const a=this.toLocal(previous),b=this.toLocal(proposed);
    // Broad phase before the more expensive swept ship-clearance sphere.
    if(new THREE.Line3(a,b).closestPointToPoint(new THREE.Vector3(),true,new THREE.Vector3()).length()>14)return {point:proposed,hit:false};
    const lift=new THREE.Vector3(0,10,0);
    const result=this.collision.sweep(a.add(lift),b.add(lift),{radius:10,height:20});result.point.sub(lift);
    return {...result,point:this.toWorld(result.point)};
  }
  update(origin){this.group.position.copy(this.position).sub(origin);this.group.visible=origin.distanceTo(this.position)<40000;}
  get state(){return {ready:this.ready,pending:this.pending,revision:this.store.state.revision,position:this.position.toArray(),pack:[...this.store.state.pack],ship:[...this.store.state.ship],saved:this.store.saved,error:this.error||this.store.warning,triangles:this.mesh?.geometry.attributes.position.count/3||0,meshMs:this.meshMs,publishMs:this.publishMs};}
  dispose(){this.worker.terminate();this.mesh?.geometry.dispose();this.material.dispose();this.scene.remove(this.group);}
}
