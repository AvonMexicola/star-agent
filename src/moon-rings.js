import * as THREE from 'three';
import { MOON_RADIUS, MOON_POSITION } from './moon-world.js';
import { SUN_DIRECTION } from './world.js';
import {createAsteroidGeometry,legacyAsteroidGeometry} from './asteroid-geometry.js';
import {createAsteroidMaterial} from './asteroid-material.js';
import {RingIce} from './ring-ice.js';
import { RockCollision } from './mining/collision.js';
import { RING_WIDTH,RING_THICKNESS,RING_RADIUS,RING_ROTATION,RING_NORMAL,RING_POPULATION,ASTEROID_FAMILIES,ringRock,nearbyAsteroids,ringCellAt } from './ring-world.js';
export {RING_NORMAL,ringRock};
export const RING_INNER=(RING_RADIUS-RING_WIDTH/2)/MOON_RADIUS,RING_OUTER=(RING_RADIUS+RING_WIDTH/2)/MOON_RADIUS;
export function ringDensity(radius){const x=(radius*MOON_RADIUS-RING_RADIUS)/(RING_WIDTH/2);return Math.max(0,1-x*x)*(.65+.25*Math.sin(x*35)**2)*(1-.8*Math.exp(-(((x-.2)/.025)**2)));}
export {legacyAsteroidGeometry as asteroidGeometry} from './asteroid-geometry.js';
export const RING_VIEW_DISTANCE=80000, RING_NEAR_DISTANCE=4000, RING_MID_DISTANCE=16000;
const smooth=(a,b,x)=>{const t=THREE.MathUtils.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
export function asteroidLOD(distance){
  if(distance>=RING_VIEW_DISTANCE)return [];
  if(distance<=3200)return [{level:0,fade:1}];
  if(distance<4800){const near=1-smooth(3200,4800,distance);return [{level:0,fade:near},{level:1,fade:-(1-near)}];}
  if(distance<=14000)return [{level:1,fade:1}];
  if(distance<18000){const mid=1-smooth(14000,18000,distance);return [{level:1,fade:mid},{level:2,fade:-(1-mid)}];}
  return [{level:2,fade:1-smooth(64000,80000,distance)}];
}
const COLORS=[0x777d83,0x81736a,0xa2afb6,0x807f7a,0x585e65,0x828489];
export class MoonRings {
  constructor(scene,count=RING_POPULATION){
    this.scene=scene;this.center=new THREE.Vector3(...MOON_POSITION);this.hiddenIds=new Set();this.local=[];this.cellKey='';this.shapeColliders=new Map();this.transform=new THREE.Object3D();
    this.descriptors=Array.from({length:Math.min(count,RING_POPULATION)},(_,i)=>ringRock(i));this.legacyDescriptors=[];this.visibleIds=[];
    this.rockOrigin={value:new THREE.Vector3()};
    this.rockMaterial=createAsteroidMaterial({originUniform:this.rockOrigin,sunDirection:SUN_DIRECTION,moonRadius:MOON_RADIUS});
    const compile=this.rockMaterial.onBeforeCompile;
    this.rockMaterial.onBeforeCompile=shader=>{
      compile(shader);
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float instanceFade;varying float vRockFade;').replace('#include <begin_vertex>','#include <begin_vertex>\nvRockFade=instanceFade;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vRockFade;').replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
        float rockDither=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));
        if(vRockFade<0.0?rockDither<1.0+vRockFade:rockDither>vRockFade)discard;`);
    };
    this.rockMaterial.customProgramCacheKey=()=> 'selene-geological-ring-lod-v3';
    this.near=this.makeBatches(1024,8,2);this.mid=this.makeBatches(1024,3,1);this.far=this.makeBatches(1024,1,0);this.rocks=this.far[0];
    this.material=new THREE.ShaderMaterial({side:THREE.DoubleSide,transparent:true,depthWrite:false,uniforms:{sun:{value:new THREE.Vector3(...SUN_DIRECTION)},normal:{value:new THREE.Vector3(...RING_NORMAL)}},
      vertexShader:`#include <common>
        #include <logdepthbuf_pars_vertex>
        varying vec3 vLunar;varying vec3 vView;
        void main(){vLunar=(modelMatrix*vec4(position,0.0)).xyz;vView=(modelViewMatrix*vec4(position,1)).xyz;gl_Position=projectionMatrix*vec4(vView,1);
        #include <logdepthbuf_vertex>
        }`,
      fragmentShader:`#include <common>
        #include <logdepthbuf_pars_fragment>
        uniform vec3 sun;uniform vec3 normal;varying vec3 vLunar;varying vec3 vView;
        void main(){float height=dot(vLunar,normal),r=length(vLunar-height*normal);float x=(r-${RING_RADIUS.toFixed(1)})/10000.0;
          float dust=clamp(1.0-x*x,0.0,1.0)*(.65+.25*pow(sin(x*35.0),2.0));
          dust*=1.0-.8*exp(-pow((x-.2)/.025,2.0));
          float alpha=dust*.035*smoothstep(20000.0,120000.0,length(vView));if(alpha<.002)discard;
          vec3 p=vLunar/${MOON_RADIUS.toFixed(1)};float along=dot(p,sun),miss=length(p-sun*along);
          float light=along<0.0?smoothstep(.99,1.025,miss):1.0;
          vec3 color=mix(vec3(.31,.26,.22),vec3(.68,.81,.86),.5+.5*sin(x*8.0));
          gl_FragColor=vec4(color*(.06+light*(.3+.9*abs(dot(normal,sun)))),alpha);
          #include <logdepthbuf_fragment>
        }`});
    // Several depth slices represent unresolved grains from orbit; nearby cells
    // replace this aggregate with actual geometry, not millions of scene nodes.
    this.band=new THREE.Group();this.band.name='Selene 20 km asteroid ring';
    const geometry=new THREE.RingGeometry(RING_INNER*MOON_RADIUS,RING_OUTER*MOON_RADIUS,768,4);
    for(let i=0;i<5;i++){const slice=new THREE.Mesh(geometry,this.material);slice.quaternion.copy(RING_ROTATION);slice.position.fromArray(RING_NORMAL).multiplyScalar((i/4-.5)*RING_THICKNESS);slice.frustumCulled=false;this.band.add(slice);}
    scene.add(this.band);
    this.ice=new RingIce(scene);
  }
  makeBatches(capacity,detail,smallDetail){
    return Array.from({length:30},(_,index)=>{
      const small=index<6,family=small?index:Math.floor((index-6)/4),variant=small?0:(index-6)%4;
      const geometry=small?legacyAsteroidGeometry(family,smallDetail):createAsteroidGeometry(family,detail,variant);
      geometry.setAttribute('instanceFade',new THREE.InstancedBufferAttribute(new Float32Array(capacity).fill(1),1).setUsage(THREE.DynamicDrawUsage));
      const mesh=new THREE.InstancedMesh(geometry,this.rockMaterial,capacity);mesh.name=`${ASTEROID_FAMILIES[family]} ${small?'small':`variant ${variant}`} LOD ${detail}`;mesh.frustumCulled=false;mesh.count=0;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.scene.add(mesh);return mesh;
    });
  }
  geometryIndex(rock){return rock.mineable?rock.family:6+rock.family*4+(rock.variant??0);}
  publish(descriptors,batches,origin,excludeNear=false){
    const counts=Array(batches.length).fill(0),t=this.transform;for(const mesh of batches)mesh.userData.ids=[];
    for(const entry of descriptors){
      const rock=entry.rock??entry;
      if(this.hiddenIds.has(rock.id)||excludeNear&&this.localIds?.has(rock.id))continue;
      const index=this.geometryIndex(rock),mesh=batches[index],i=counts[index]++;if(i>=mesh.instanceMatrix.count){counts[index]--;continue;}
      mesh.userData.ids.push(rock.id);
      t.position.fromArray(rock.position).add(this.center).sub(origin);t.rotation.set(...rock.rotation);t.scale.setScalar(rock.size);t.updateMatrix();mesh.setMatrixAt(i,t.matrix);
      const tint=1+((Math.abs(rock.id)*.61803398875)%1-.5)*.22;mesh.setColorAt(i,new THREE.Color(COLORS[rock.family]).multiplyScalar(tint));mesh.geometry.attributes.instanceFade.setX(i,entry.fade??1);
    }
    batches.forEach((mesh,i)=>{mesh.count=counts[i];mesh.instanceMatrix.needsUpdate=true;mesh.geometry.attributes.instanceFade.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;});
  }
  descriptorFrame(rock){
    const rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(...rock.rotation));
    return {position:new THREE.Vector3(...rock.position).add(this.center),rotation,inverse:rotation.clone().invert()};
  }
  /** Exact triangles of the visible near LOD, not its oversized broad-phase sphere. */
  raycastDescriptor(rock,origin,direction,range=8){
    const frame=this.descriptorFrame(rock),scale=rock.size,geometry=this.near[this.geometryIndex(rock)].geometry;
    const a=origin.clone().sub(frame.position).applyQuaternion(frame.inverse).divideScalar(scale);
    const d=direction.clone().applyQuaternion(frame.inverse).normalize(),ray=new THREE.Ray(a,d);
    const radius=geometry.boundingSphere.radius;
    if(a.distanceTo(geometry.boundingSphere.center)>range/scale+radius||ray.distanceSqToPoint(geometry.boundingSphere.center)>radius*radius)return null;
    const p=geometry.attributes.position,v=[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()],point=new THREE.Vector3();
    let distance=range/scale,nearest=null,normal=null;
    for(let i=0;i<p.count;i+=3){
      for(let j=0;j<3;j++)v[j].fromBufferAttribute(p,i+j);
      if(!ray.intersectTriangle(v[0],v[1],v[2],true,point))continue;
      const next=a.distanceTo(point);if(next>distance)continue;
      distance=next;nearest=point.clone();normal=v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0])).normalize();
    }
    if(!nearest)return null;
    return {descriptor:rock,distance:distance*scale,point:nearest.multiplyScalar(scale).applyQuaternion(frame.rotation).add(frame.position),normal:normal.applyQuaternion(frame.rotation)};
  }
  raycast(origin,direction,range=8,{exclude=null,includeHidden=false}={}){
    let nearest=null;
    for(const rock of this.local){
      if(exclude?.has(rock.id)||!includeHidden&&this.hiddenIds.has(rock.id))continue;
      const center=new THREE.Vector3(...rock.position).add(this.center);
      if(center.distanceTo(origin)>range+rock.size*1.95)continue;
      const hit=this.raycastDescriptor(rock,origin,direction,nearest?.distance??range);
      if(hit)nearest=hit;
    }
    return nearest;
  }
  constrainDescriptor(rock,previous,proposed,radius){
    const frame=this.descriptorFrame(rock),scale=rock.size;
    const a=previous.clone().sub(frame.position).applyQuaternion(frame.inverse).divideScalar(scale),b=proposed.clone().sub(frame.position).applyQuaternion(frame.inverse).divideScalar(scale);
    const geometryIndex=this.geometryIndex(rock),geometry=this.near[geometryIndex].geometry;
    const reach=geometry.boundingSphere.radius+radius/scale;
    if(new THREE.Line3(a,b).closestPointToPoint(new THREE.Vector3(),true,new THREE.Vector3()).length()>reach)return {point:proposed,hit:false};
    if(!this.shapeColliders.has(geometryIndex))this.shapeColliders.set(geometryIndex,new RockCollision(geometry.attributes.position.array));
    const r=radius/scale,lift=new THREE.Vector3(0,r,0),result=this.shapeColliders.get(geometryIndex).sweep(a.add(lift),b.add(lift),{radius:r,height:r*2});
    return {...result,point:result.point.sub(lift).multiplyScalar(scale).applyQuaternion(frame.rotation).add(frame.position)};
  }
  update(origin,elapsed){
    this.ice.update(origin,elapsed);
    this.band.position.copy(this.center).sub(origin);this.rockOrigin.value.copy(origin).sub(this.center);
    const key=ringCellAt(origin).join(':');
    if(key!==this.cellKey){this.cellKey=key;this.local=nearbyAsteroids(origin,2);this.localIds=new Set(this.local.map(r=>r.id));}
    const ox=origin.x-this.center.x,oy=origin.y-this.center.y,oz=origin.z-this.center.z;
    for(const legacy of this.legacyDescriptors)if(!this.localIds.has(legacy.id)&&Math.hypot(legacy.position[0]-ox,legacy.position[1]-oy,legacy.position[2]-oz)<9000){this.local.push(legacy);this.localIds.add(legacy.id);}
    const lists=[[],[],[]],visible=new Set(),seen=new Set();
    for(const rock of [...this.descriptors,...this.local,...this.legacyDescriptors]){
      if(seen.has(rock.id)||this.hiddenIds.has(rock.id))continue;seen.add(rock.id);
      const p=rock.position,dx=p[0]-ox,dy=p[1]-oy,dz=p[2]-oz,d2=dx*dx+dy*dy+dz*dz;
      if(d2>=RING_VIEW_DISTANCE*RING_VIEW_DISTANCE)continue;
      visible.add(rock.id);for(const lod of asteroidLOD(Math.sqrt(d2)))lists[lod.level].push({rock,fade:lod.fade});
    }
    this.publish(lists[0],this.near,origin);this.publish(lists[1],this.mid,origin);this.publish(lists[2],this.far,origin);this.visibleIds=[...visible];
  }
  get state(){
    const count=list=>list.reduce((n,m)=>n+m.count,0),renderedNear=count(this.near),renderedMid=count(this.mid),renderedFar=count(this.far);
    return {population:RING_POPULATION,width:RING_WIDTH,thickness:RING_THICKNESS,outerDiameter:2*(RING_RADIUS+RING_WIDTH/2),families:ASTEROID_FAMILIES.length,variants:24,nearby:this.local.length,rendered:renderedNear+renderedMid+renderedFar,renderedNear,renderedMid,renderedFar,promoted:this.hiddenIds.size,visibleIds:this.visibleIds,viewDistance:RING_VIEW_DISTANCE,nearDistance:RING_NEAR_DISTANCE,midDistance:RING_MID_DISTANCE,ice:this.ice.state};
  }
  dispose(){this.ice.dispose();this.scene.remove(this.band);this.band.children[0].geometry.dispose();this.material.dispose();for(const mesh of [...this.far,...this.mid,...this.near]){this.scene.remove(mesh);mesh.geometry.dispose();}this.rockMaterial.dispose();}
}
