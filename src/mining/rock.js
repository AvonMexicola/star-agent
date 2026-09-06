import * as THREE from 'three';
import { MOON_LANDING_DIRECTION, LANDING_FRAME, MOON_RADIUS, MOON_POSITION, moonResources, MOON_RESOURCE_VERSION } from '../moon-world.js';
import { bodySurfacePoint, bodyAltitude, SELENE } from '../celestial.js';
import { RockCollision } from './collision.js';
import { MiningStore } from './store.js';
import { ROCK_ID, normalizeResourceWeights, MINERAL_GLSL, RESOURCE_VEIN_VERSION } from './volume.js';

export class MineableRock {
  constructor(scene,storage,{worker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'}),store=null,rockId=ROCK_ID,position=null,quaternion=null,initialField=null,space=false,resourceWeights=null}={}){
    this.store=store??new MiningStore(storage);this.rockId=rockId;this.initialField=initialField;this.space=space;this.worker=worker;this.scene=scene;this.pending=false;this.ready=false;this.budget=0;this.sequence=0;this.grounded=false;this.meshMs=0;this.publishMs=0;
    const up=new THREE.Vector3(...MOON_LANDING_DIRECTION),east=new THREE.Vector3(...LANDING_FRAME.east),north=new THREE.Vector3(...LANDING_FRAME.north);
    // Behind and to the left of the ramp, entirely within the level landing shelf.
    const direction=up.clone().addScaledVector(east,-19/MOON_RADIUS).addScaledVector(north,8/MOON_RADIUS).normalize();
    this.position=bodySurfacePoint(direction,SELENE,1.35);this.up=direction;
    this.quaternion=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(east,direction,east.clone().cross(direction).normalize()));
    if(position)this.position.copy(position);if(quaternion)this.quaternion.copy(quaternion);
    const resourceDirection=this.position.clone().sub(new THREE.Vector3(...MOON_POSITION)).normalize();
    this.resourceWeights=normalizeResourceWeights(resourceWeights??(space?null:moonResources(...resourceDirection.toArray()).weights));
    this.resourceVersion=space?RESOURCE_VEIN_VERSION:`${MOON_RESOURCE_VERSION}.${RESOURCE_VEIN_VERSION}`;
    this.inverse=this.quaternion.clone().invert();
    this.group=new THREE.Group();this.group.name='Crescent copper deposit';this.group.quaternion.copy(this.quaternion);scene.add(this.group);
    this.material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.88,metalness:.16,side:THREE.DoubleSide});
    this.material.onBeforeCompile=shader=>{
      shader.uniforms.uRockResourceWeights={value:new THREE.Vector3(...(this.resourceWeights??[0,0,0]))};
      shader.uniforms.uRockResourceProfile={value:Boolean(this.resourceWeights)};
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vRockPoint;').replace('#include <begin_vertex>','#include <begin_vertex>\nvRockPoint=position;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>\nvarying vec3 vRockPoint;\nuniform vec3 uRockResourceWeights;\nuniform bool uRockResourceProfile;\n${MINERAL_GLSL}`).replace('#include <color_fragment>',`#include <color_fragment>
        float grain=sin(vRockPoint.x*137.0+sin(vRockPoint.z*81.0))*sin(vRockPoint.y*119.0+vRockPoint.z*67.0);
        float fade=1.0-smoothstep(.2,1.0,length(fwidth(vRockPoint))*120.0);
        float kind=rockMineral(vRockPoint,uRockResourceWeights,uRockResourceProfile);
        diffuseColor.rgb=rockMineralColor(kind);
        diffuseColor.rgb*=1.0+grain*.15*fade;`);
    };
    this.material.customProgramCacheKey=()=> 'mineable-rock-resources-v1';
    this.worker.onmessage=({data})=>this.receive(data);
    this.worker.onerror=()=>{this.pending=false;this.error='Rock worker unavailable. Mining paused.';};
    this.request();
  }
  get snapshot(){return this.rockId===ROCK_ID?this.store.state:this.store.getRock(this.rockId,this.initialField);}
  toLocal(point){return point.clone().sub(this.position).applyQuaternion(this.inverse);}
  toWorld(point){return point.clone().applyQuaternion(this.quaternion).add(this.position);}
  request(point,budget){
    if(this.pending||this.error)return false;
    this.pending=true;this.job={id:++this.sequence,revision:this.snapshot.revision,carving:Boolean(point),point:point?this.toWorld(new THREE.Vector3(...point)):null};
    const field=this.snapshot.field.slice();this.worker.postMessage({...this.job,field,point,budget,resourceWeights:this.resourceWeights},[field.buffer]);return true;
  }
  receive(data){
    if(this.disposed||!this.job||data.id!==this.job.id)return;
    this.pending=false;if(data.error){this.error=data.error;return;}if(data.empty)return;
    const start=performance.now();
    // Prepare the collider before publishing either representation. A rejected
    // save or stale job leaves both visible mesh and collision untouched.
    const geometry=new THREE.BufferGeometry();
    for(const key of ['positions','normals','colors'])geometry.setAttribute({positions:'position',normals:'normal',colors:'color'}[key],new THREE.BufferAttribute(data[key],3));
    geometry.computeBoundingSphere();const collision=new RockCollision(data.positions,data.collision);
    if(this.job.revision!==this.snapshot.revision||(this.job.carving&&!(this.rockId===ROCK_ID?this.store.commit(data,this.job.revision):this.store.commitRock(this.rockId,data,this.job.revision)))){geometry.dispose();return;}
    if(this.mesh){const old=this.mesh.geometry;this.mesh.geometry=geometry;old.dispose();}
    else{this.mesh=new THREE.Mesh(geometry,this.material);this.mesh.castShadow=true;this.mesh.receiveShadow=true;this.group.add(this.mesh);}
    this.collision=collision;this.ready=true;this.meshMs=data.meshMs;this.publishMs=performance.now()-start;
    if(this.job.carving&&data.removed>0)this.onExtract?.({point:this.job.point.clone(),normal:this.job.normal?.clone(),yields:[...data.yieldVolume]});
  }
  raycast(origin,direction,range=8){
    if(!this.ready||origin.distanceTo(this.position)>range+4)return null;
    const localOrigin=this.toLocal(origin),localDirection=direction.clone().applyQuaternion(this.inverse),hit=this.collision.raycast(localOrigin,localDirection,range);
    if(!hit)return null;
    const point=this.toWorld(hit.point);
    // The exposed rock can be mined; the untouched moon underneath cannot.
    if(!this.space&&bodyAltitude(point,SELENE)<.04)return null;
    // Reject terrain occlusion along the short tool ray.
    for(let d=.15;!this.space&&d<hit.distance;d+=.15)if(bodyAltitude(origin.clone().addScaledVector(direction,d),SELENE)<.02)return null;
    return {...hit,point,localPoint:hit.point,normal:hit.normal.applyQuaternion(this.quaternion)};
  }
  /** Equipment adapter: point must be the validated nearest rock hit, in world metres. */
  onMine({point,normal,dt,rate=.35},direction){
    if(!this.ready||this.store.blocked||this.store.free<.0001||this.error)return;
    if(this.rockId!==ROCK_ID&&this.store.canEditRock&&!this.store.canEditRock(this.rockId)){this.store.warning="Survey save full. Existing deposits remain mineable.";return;}
    this.budget=Math.min(.045,this.budget+Math.min(.1,Math.max(0,dt))*Math.max(0,Math.min(.35,rate)));
    if(this.pending||this.budget<.018)return;
    const local=this.toLocal(point.clone().addScaledVector(direction,.08));
    const budget=Math.min(this.budget,this.store.free/12);this.budget=0;
    if(this.request(local.toArray(),budget)){
      this.job.normal=normal?.clone()??direction.clone().negate();
      this.job.point=point.clone().addScaledVector(this.job.normal,.035);
    }
  }
  constrainWalker(previous,proposed){
    this.grounded=false;if(!this.ready||previous.distanceTo(this.position)>6&&proposed.distanceTo(this.position)>6)return {point:proposed,hit:false};
    const a=this.toLocal(previous),b=this.toLocal(proposed),result=this.collision.sweep(a,b);
    result.grounded ||= b.y<=a.y+1e-5&&this.collision.groundedAt(result.point);
    this.grounded=result.grounded;
    return {...result,point:this.toWorld(result.point)};
  }
  constrainEVA(previous,proposed){
    if(!this.ready)return {point:proposed,hit:false};
    const a=this.toLocal(previous),b=this.toLocal(proposed),lift=new THREE.Vector3(0,.35,0);
    if(new THREE.Line3(a,b).closestPointToPoint(new THREE.Vector3(),true,new THREE.Vector3()).length()>3)return {point:proposed,hit:false};
    const result=this.collision.sweep(a.add(lift),b.add(lift),{radius:.35,height:.7});result.point.sub(lift);
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
  get state(){return {resourceWeights:this.resourceWeights?[...this.resourceWeights]:null,resourceVersion:this.resourceVersion,ready:this.ready,pending:this.pending,revision:this.snapshot.revision,position:this.position.toArray(),pack:[...this.store.state.pack],ship:[...this.store.state.ship],saved:this.store.saved,error:this.error||this.store.warning,triangles:this.mesh?.geometry.attributes.position.count/3||0,meshMs:this.meshMs,publishMs:this.publishMs};}
  dispose(){this.disposed=true;this.worker.terminate();this.mesh?.geometry.dispose();this.material.dispose();this.scene.remove(this.group);}
}
