import * as THREE from 'three';
import { MOON_RADIUS, MOON_POSITION, moonSurface } from './moon-world.js';
import { SUN_DIRECTION } from './world.js';

const CELL=16,RANGE=4;
const hash=(x,y,z,s=0)=>{let h=Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(z,2147483647)^s;h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;};
// Absolute lunar cells retain their particles across camera rebases and movement.
export function iceCell(x,y,z){return {position:[(x+hash(x,y,z,11))*CELL,(y+hash(x,y,z,73))*CELL,(z+hash(x,y,z,149))*CELL],phase:hash(x,y,z,237)*Math.PI*2};}
export class MoonIce {
  constructor(scene){
    this.scene=scene;this.key='';this.anchor=new THREE.Vector3();this.descriptors=[];
    this.material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.CustomBlending,blendSrc:THREE.SrcAlphaFactor,blendDst:THREE.OneFactor,blendSrcAlpha:THREE.ZeroFactor,blendDstAlpha:THREE.OneFactor,uniforms:{time:{value:0},sunlight:{value:0},up:{value:new THREE.Vector3()},viewportHeight:{value:800}},
      vertexShader:`#include <common>
        #include <logdepthbuf_pars_vertex>
        attribute float phase;uniform float time;uniform vec3 up;uniform float viewportHeight;
        varying float vGlint;varying float vFade;
        void main(){vec3 p=position+up*sin(time*.75+phase)*.18;
          vec4 view=modelViewMatrix*vec4(p,1.0);float distance=length(view.xyz);
          vGlint=pow(max(0.0,sin(time*(.65+fract(phase)*.9)+phase*7.0)),22.0);
          vFade=(1.0-smoothstep(35.0,57.0,distance))*smoothstep(.7,2.5,distance);
          gl_PointSize=clamp(viewportHeight*(.013+vGlint*.035)/max(1.0,-view.z),1.0,8.0);
          gl_Position=projectionMatrix*view;
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader:`#include <common>
        #include <logdepthbuf_pars_fragment>
        uniform float sunlight;varying float vGlint;varying float vFade;
        void main(){vec2 p=gl_PointCoord-.5;float r=length(p);
          float core=exp(-r*r*40.0);float rays=exp(-min(abs(p.x),abs(p.y))*50.0)*(1.0-smoothstep(.1,.5,r));
          float light=(core*.16+vGlint*(core*3.5+rays*1.5))*vFade*sunlight;
          if(r>.5||light<.08)discard;
          gl_FragColor=vec4(mix(vec3(.35,.55,.75),vec3(1.0,.93,.80),vGlint)*light,1.0);
          #include <logdepthbuf_fragment>
        }`});
    this.geometry=new THREE.BufferGeometry();this.points=new THREE.Points(this.geometry,this.material);this.points.name='Sunlit lofted lunar ice';this.points.frustumCulled=false;this.points.visible=false;scene.add(this.points);
  }
  rebuild(local){
    const cell=local.toArray().map(v=>Math.floor(v/CELL));this.key=cell.join('/');this.anchor.copy(local);this.descriptors=[];
    for(let x=-RANGE;x<=RANGE;x++)for(let y=-RANGE;y<=RANGE;y++)for(let z=-RANGE;z<=RANGE;z++){
      const particle=iceCell(cell[0]+x,cell[1]+y,cell[2]+z),point=new THREE.Vector3(...particle.position),radius=point.length(),d=point.clone().divideScalar(radius);
      const height=radius-MOON_RADIUS-moonSurface(d.x,d.y,d.z).height;
      if(height>.6&&height<48)this.descriptors.push(particle);
    }
    const positions=new Float32Array(this.descriptors.length*3),phases=new Float32Array(this.descriptors.length);
    for(let i=0;i<this.descriptors.length;i++){
      const p=this.descriptors[i];positions.set(new THREE.Vector3(...p.position).sub(this.anchor).toArray(),i*3);phases[i]=p.phase;
    }
    this.geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));this.geometry.setAttribute('phase',new THREE.BufferAttribute(phases,1));
  }
  update(worldPosition,origin,elapsed,enabled=true){
    const local=worldPosition.clone().sub(new THREE.Vector3(...MOON_POSITION)),radius=local.length(),up=local.clone().normalize();
    const altitude=radius-MOON_RADIUS-moonSurface(up.x,up.y,up.z).height;
    this.points.visible=enabled&&altitude<100&&altitude>=0;
    if(!this.points.visible)return;
    const key=local.toArray().map(v=>Math.floor(v/CELL)).join('/');if(key!==this.key)this.rebuild(local);
    this.points.position.copy(this.anchor).add(new THREE.Vector3(...MOON_POSITION)).sub(origin);
    const u=this.material.uniforms;u.time.value=elapsed;u.up.value.copy(up);u.sunlight.value=THREE.MathUtils.smoothstep(up.dot(new THREE.Vector3(...SUN_DIRECTION)),0,.3);
    u.viewportHeight.value=globalThis.innerHeight||800;
  }
  dispose(){this.scene.remove(this.points);this.geometry.dispose();this.material.dispose();}
}
