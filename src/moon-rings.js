import * as THREE from 'three';
import { MOON_RADIUS, MOON_POSITION, MOON_LANDING_DIRECTION } from './moon-world.js';
import { SUN_DIRECTION } from './world.js';

// A tilted debris belt, in lunar-radius units. One band draw plus instanced rocks.
export const RING_INNER=1.65,RING_OUTER=2.85;
const landing=new THREE.Vector3(...MOON_LANDING_DIRECTION);
const east=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),landing).normalize();
const north=new THREE.Vector3().crossVectors(landing,east).normalize();
export const RING_NORMAL=Object.freeze(landing.clone().multiplyScalar(.34).addScaledVector(north,.9).addScaledVector(east,.25).normalize().toArray());
const rotation=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(...RING_NORMAL));
const TAU=Math.PI*2;
export function ringDensity(radius){
  const band=(center,width)=>Math.exp(-(((radius-center)/width)**2));
  const base=.62*band(1.79,.085)+.88*band(2.08,.13)+.65*band(2.39,.105)+.36*band(2.69,.07);
  return base*(1-.92*band(2.22,.022))*(1-.9*band(1.92,.018));
}
export function ringRock(index){
  let state=(Math.imul(index+1,747796405)+2891336453)>>>0;
  const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
  const band=index%4,center=[1.79,2.08,2.39,2.69][band],radius=center+(random()-.5)*[.16,.23,.19,.12][band];
  const angle=random()*TAU,thickness=(random()-.5)*1700;
  const position=new THREE.Vector3(Math.cos(angle)*radius*MOON_RADIUS,Math.sin(angle)*radius*MOON_RADIUS,thickness).applyQuaternion(rotation);
  const size=90+random()**3*1950;
  return {position:position.toArray(),size,scale:[.6+random(),.55+random(),.65+random()],rotation:[random()*TAU,random()*TAU,random()*TAU],ice:random()>.70};
}

export class MoonRings {
  constructor(scene,count=1800){
    this.scene=scene;this.center=new THREE.Vector3(...MOON_POSITION);
    this.material=new THREE.ShaderMaterial({side:THREE.DoubleSide,transparent:true,depthWrite:false,uniforms:{sunDirection:{value:new THREE.Vector3(...SUN_DIRECTION)},ringNormal:{value:new THREE.Vector3(...RING_NORMAL)}},
      vertexShader:`#include <common>
        #include <logdepthbuf_pars_vertex>
        varying vec3 vLunar;varying vec3 vRingView;
        void main(){vLunar=(modelMatrix*vec4(position,0.0)).xyz/${MOON_RADIUS.toFixed(1)};
          vRingView=(modelViewMatrix*vec4(position,1.0)).xyz;
          gl_Position=projectionMatrix*vec4(vRingView,1.0);
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader:`#include <common>
        #include <logdepthbuf_pars_fragment>
        uniform vec3 sunDirection;uniform vec3 ringNormal;varying vec3 vLunar;varying vec3 vRingView;
        float band(float r,float center,float width){return exp(-pow((r-center)/width,2.0));}
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        void main(){float r=length(vLunar);
          float density=.62*band(r,1.79,.085)+.88*band(r,2.08,.13)+.65*band(r,2.39,.105)+.36*band(r,2.69,.07);
          density*=1.0-.92*band(r,2.22,.022);density*=1.0-.9*band(r,1.92,.018);
          float footprint=fwidth(r);
          float striation=.82+.10*sin(r*870.0)*exp(-footprint*870.0)+.05*sin(r*2170.0)*exp(-footprint*2170.0)+.03*sin(r*5120.0)*exp(-footprint*5120.0);
          float grain=mix(.89,.78+.22*hash(floor(vLunar.xy*23000.0)),1.0-smoothstep(.000015,.0001,footprint));
          float opacity=clamp(density*striation*grain,0.0,.94)*smoothstep(20000.0,80000.0,length(vRingView));
          if(opacity<.006)discard;
          float along=dot(vLunar,sunDirection),miss=length(vLunar-sunDirection*along);
          float sunlight=along<0.0?smoothstep(.99,1.025,miss):1.0;
          vec3 dust=mix(vec3(.28,.23,.18),vec3(.64,.75,.83),smoothstep(-.2,.75,sin(r*18.0)));
          float incidence=.24+.76*abs(dot(ringNormal,sunDirection));
          gl_FragColor=vec4(dust*(.045+sunlight*incidence*1.7),opacity);
          #include <logdepthbuf_fragment>
        }`});
    this.band=new THREE.Mesh(new THREE.RingGeometry(RING_INNER*MOON_RADIUS,RING_OUTER*MOON_RADIUS,512,6),this.material);
    this.band.quaternion.copy(rotation);this.band.name='Selene ice and dust ring bands';this.band.frustumCulled=false;scene.add(this.band);
    const geometry=new THREE.IcosahedronGeometry(1,1),positions=geometry.attributes.position;
    for(let i=0;i<positions.count;i++){
      const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i),scale=.83+.17*Math.sin(x*9+y*5)*Math.cos(z*7-x*3);
      positions.setXYZ(i,x*scale,y*scale,z*scale);
    }
    geometry.computeVertexNormals();
    this.rockMaterial=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.85,metalness:.12,envMapIntensity:0});
    this.rockOrigin={value:new THREE.Vector3()};
    this.rockMaterial.onBeforeCompile=shader=>{
      shader.uniforms.ringOrigin=this.rockOrigin;
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform vec3 ringOrigin;varying vec3 vRockMoon;varying vec3 vRockLocal;')
        .replace('#include <begin_vertex>','#include <begin_vertex>\nvRockLocal=position;vRockMoon=((modelMatrix*instanceMatrix*vec4(transformed,1.0)).xyz+ringOrigin)/434350.0;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
          varying vec3 vRockMoon;varying vec3 vRockLocal;
          float rockHash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
          float rockNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
            return mix(mix(mix(rockHash(i),rockHash(i+vec3(1,0,0)),f.x),mix(rockHash(i+vec3(0,1,0)),rockHash(i+vec3(1,1,0)),f.x),f.y),
              mix(mix(rockHash(i+vec3(0,0,1)),rockHash(i+vec3(1,0,1)),f.x),mix(rockHash(i+vec3(0,1,1)),rockHash(i+vec3(1,1,1)),f.x),f.y),f.z);}`)
        .replace('#include <color_fragment>',`#include <color_fragment>
          float detail=1.0-smoothstep(.01,.15,length(fwidth(vRockLocal)));
          float flakes=.5;if(detail>.01)flakes=.55*rockNoise(vRockLocal*8.0)+.30*rockNoise(vRockLocal*24.0)+.15*rockNoise(vRockLocal*75.0);
          diffuseColor.rgb*=mix(1.0,.60+flakes*.8,detail);`)
        .replace('#include <opaque_fragment>',`vec3 rs=normalize(vec3(${SUN_DIRECTION.join(',')}));
          float along=dot(vRockMoon,rs),miss=length(vRockMoon-along*rs);
          float light=along<0.0?smoothstep(.99,1.025,miss):1.0;
          outgoingLight*=.04+.96*light;
          #include <opaque_fragment>`);
    };
    this.rockMaterial.customProgramCacheKey=()=> 'selene-ring-rocks-v1';
    this.rocks=new THREE.InstancedMesh(geometry,this.rockMaterial,count);this.rocks.name='Selene ring asteroids';this.rocks.frustumCulled=false;
    this.rocks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.descriptors=Array.from({length:count},(_,i)=>ringRock(i));
    for(let i=0;i<count;i++)this.rocks.setColorAt(i,new THREE.Color(this.descriptors[i].ice?0x9ba8ae:i%3===0?0x72645a:0x50545c));
    this.rocks.instanceColor.needsUpdate=true;scene.add(this.rocks);this.transform=new THREE.Object3D();
  }
  update(origin,elapsed=0){
    this.band.position.copy(this.center).sub(origin);this.rockOrigin.value.copy(origin).sub(this.center);
    for(let i=0;i<this.descriptors.length;i++){
      const rock=this.descriptors[i],t=this.transform;
      // Subtract the double camera origin before each float instance transform.
      t.position.fromArray(rock.position).add(this.center).sub(origin);
      t.rotation.set(rock.rotation[0],rock.rotation[1]+elapsed*.001,rock.rotation[2]);
      t.scale.fromArray(rock.scale).multiplyScalar(rock.size);t.updateMatrix();this.rocks.setMatrixAt(i,t.matrix);
    }
    this.rocks.instanceMatrix.needsUpdate=true;
  }
  dispose(){for(const mesh of [this.band,this.rocks]){this.scene.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();}}
}
