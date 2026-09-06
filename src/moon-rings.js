import * as THREE from 'three';
import { MOON_RADIUS, MOON_POSITION } from './moon-world.js';
import { SUN_DIRECTION } from './world.js';
import { RING_WIDTH,RING_THICKNESS,RING_RADIUS,RING_ROTATION,RING_NORMAL,RING_POPULATION,ASTEROID_FAMILIES,ringRock,nearbyAsteroids,ringCellAt,asteroidField } from './ring-world.js';
export {RING_NORMAL,ringRock};
export const RING_INNER=(RING_RADIUS-RING_WIDTH/2)/MOON_RADIUS,RING_OUTER=(RING_RADIUS+RING_WIDTH/2)/MOON_RADIUS;
export function ringDensity(radius){const x=(radius*MOON_RADIUS-RING_RADIUS)/(RING_WIDTH/2);return Math.max(0,1-x*x)*(.65+.25*Math.sin(x*35)**2)*(1-.8*Math.exp(-(((x-.2)/.025)**2)));}
export function asteroidGeometry(family,detail=1){
  const geometry=new THREE.IcosahedronGeometry(1,detail),p=geometry.attributes.position;
  for(let i=0;i<p.count;i++){
    const v=new THREE.Vector3().fromBufferAttribute(p,i).normalize();let lo=0,hi=1.95;
    for(let step=0;step<15;step++){const m=(lo+hi)/2;if(asteroidField(v.x*m,v.y*m,v.z*m,family)<0)lo=m;else hi=m;}
    p.setXYZ(i,v.x*lo,v.y*lo,v.z*lo);
  }
  geometry.computeVertexNormals();geometry.computeBoundingSphere();return geometry;
}
const COLORS=[0x59616b,0x986548,0xb7d7df,0x77716a,0x35383d,0x797e85];
export class MoonRings {
  constructor(scene,count=3072){
    this.scene=scene;this.center=new THREE.Vector3(...MOON_POSITION);this.hiddenIds=new Set();this.local=[];this.cellKey='';this.transform=new THREE.Object3D();
    this.descriptors=Array.from({length:count},(_,i)=>ringRock(i));
    this.rockOrigin={value:new THREE.Vector3()};
    this.rockMaterial=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.85,metalness:.14,envMapIntensity:.2});
    this.rockMaterial.onBeforeCompile=shader=>{
      shader.uniforms.ringOrigin=this.rockOrigin;
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform vec3 ringOrigin;varying vec3 vRockMoon;varying vec3 vRockLocal;')
        .replace('#include <begin_vertex>',`#include <begin_vertex>\nvRockLocal=position;vRockMoon=((modelMatrix*instanceMatrix*vec4(transformed,1.0)).xyz+ringOrigin)/${MOON_RADIUS.toFixed(1)};`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vRockMoon;varying vec3 vRockLocal;')
        .replace('#include <color_fragment>',`#include <color_fragment>
          float grain=sin(vRockLocal.x*31.0+sin(vRockLocal.z*19.0))*sin(vRockLocal.y*27.0+vRockLocal.z*13.0);
          float fade=1.0-smoothstep(.03,.2,length(fwidth(vRockLocal)));
          diffuseColor.rgb*=1.0+grain*.23*fade;`)
        .replace('#include <opaque_fragment>',`vec3 rs=normalize(vec3(${SUN_DIRECTION.join(',')}));
          float along=dot(vRockMoon,rs),miss=length(vRockMoon-along*rs);
          outgoingLight*=along<0.0?.04+.96*smoothstep(.99,1.025,miss):1.0;
          #include <opaque_fragment>`);
    };
    this.rockMaterial.customProgramCacheKey=()=> 'selene-populated-rings-v2';
    this.far=this.makeBatches(count,1);this.near=this.makeBatches(4000,2);this.rocks=this.far[0];
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
          float alpha=dust*.22*smoothstep(1700.0,16000.0,length(vView));if(alpha<.002)discard;
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
  }
  makeBatches(capacity,detail){return ASTEROID_FAMILIES.map((name,family)=>{
    const mesh=new THREE.InstancedMesh(asteroidGeometry(family,detail),this.rockMaterial,capacity);mesh.name=`${name} ring LOD ${detail}`;mesh.frustumCulled=false;mesh.count=0;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.scene.add(mesh);return mesh;
  });}
  publish(descriptors,batches,origin,excludeNear=false){
    const counts=[0,0,0,0,0,0],t=this.transform;
    for(const rock of descriptors){
      if(this.hiddenIds.has(rock.id)||excludeNear&&this.localIds?.has(rock.id))continue;
      const mesh=batches[rock.family],i=counts[rock.family]++;if(i>=mesh.instanceMatrix.count){counts[rock.family]--;continue;}
      t.position.fromArray(rock.position).add(this.center).sub(origin);t.rotation.set(...rock.rotation);t.scale.setScalar(rock.size);t.updateMatrix();mesh.setMatrixAt(i,t.matrix);mesh.setColorAt(i,new THREE.Color(COLORS[rock.family]));
    }
    batches.forEach((mesh,i)=>{mesh.count=counts[i];mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;});
  }
  update(origin){
    this.band.position.copy(this.center).sub(origin);this.rockOrigin.value.copy(origin).sub(this.center);
    const key=ringCellAt(origin).join(':');
    if(key!==this.cellKey){this.cellKey=key;this.local=nearbyAsteroids(origin,2);this.localIds=new Set(this.local.map(r=>r.id));}
    this.publish(this.descriptors,this.far,origin,true);this.publish(this.local,this.near,origin);
  }
  get state(){return {population:RING_POPULATION,width:RING_WIDTH,thickness:RING_THICKNESS,families:ASTEROID_FAMILIES.length,nearby:this.local.length,rendered:this.far.concat(this.near).reduce((s,m)=>s+m.count,0),promoted:this.hiddenIds.size};}
  dispose(){this.scene.remove(this.band);this.band.children[0].geometry.dispose();this.material.dispose();for(const mesh of [...this.far,...this.near]){this.scene.remove(mesh);mesh.geometry.dispose();}this.rockMaterial.dispose();}
}
