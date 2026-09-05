import * as THREE from 'three';
import { MOON_RADIUS, MOON_POSITION, moonSurface } from './moon-world.js';
import { RADIUS, SUN_DISTANCE, SUN_DIRECTION } from './world.js';
import { MoonTerrain } from './moon-terrain.js';
import { MoonRings } from './moon-rings.js';
import { MoonIce } from './moon-ice.js';

function textures(width=1024,height=512) {
  const color=new Uint8Array(width*height*4);
  for(let row=0;row<height;row++){
    const theta=(1-row/(height-1))*Math.PI,sin=Math.sin(theta),y=Math.cos(theta);
    for(let col=0;col<width;col++){
      const phi=col/width*Math.PI*2,x=-Math.cos(phi)*sin,z=Math.sin(phi)*sin;
      const sample=moonSurface(x,y,z),i=(row*width+col)*4;
      const shade=Math.round(sample.albedo*255);
      color.set([Math.round(shade*(.92-sample.frost*.05)),Math.round(shade*(.94+sample.frost*.05)),Math.round(shade*(.99+sample.frost*.10)),255],i);
    }
  }
  const make=data=>{const texture=new THREE.DataTexture(data,width,height);texture.wrapS=THREE.RepeatWrapping;
    texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;return texture;};
  return {color:make(color)};
}

export class Moon {
  constructor(scene) {
    this.scene=scene;this.worldPosition=new THREE.Vector3(...MOON_POSITION);
    const maps=textures();this.maps=maps;
    this.material=new THREE.MeshStandardMaterial({map:maps.color,roughness:1,metalness:0,envMapIntensity:0,side:THREE.DoubleSide});
    const grit=new Uint8Array(128*128*4);
    for(let i=0;i<128*128;i++){const n=((Math.imul(i^73471,1597334677)>>>8)&255);grit.set([n,n,n,255],i*4);}
    this.grain=new THREE.DataTexture(grit,128,128);this.grain.wrapS=this.grain.wrapT=THREE.RepeatWrapping;
    this.grain.minFilter=THREE.LinearMipmapLinearFilter;this.grain.magFilter=THREE.LinearFilter;this.grain.generateMipmaps=true;this.grain.needsUpdate=true;
    this.material.onBeforeCompile=shader=>{
      shader.uniforms.moonGrain={value:this.grain};
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 moonDirection;attribute vec3 moonPoint;attribute vec2 moonSurfaceData;varying vec3 vMoonDirection;varying vec3 vMoonPoint;varying vec2 vMoonSurface;')
        .replace('#include <begin_vertex>','#include <begin_vertex>\nvMoonDirection=moonDirection;vMoonPoint=moonPoint;vMoonSurface=moonSurfaceData;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D moonGrain;varying vec3 vMoonDirection;varying vec3 vMoonPoint;varying vec2 vMoonSurface;')
        .replace('#include <map_fragment>',`vec3 md=normalize(vMoonDirection);
          vec2 muv=vec2(atan(md.z,-md.x)/6.28318530718,asin(clamp(md.y,-1.0,1.0))/3.14159265359+.5);
          diffuseColor*=texture2D(map,muv);
          vec3 mw=pow(abs(md),vec3(4.0));mw/=dot(mw,vec3(1.0));
          float grain=texture2D(moonGrain,vMoonPoint.yz*.5).r*mw.x+texture2D(moonGrain,vMoonPoint.xz*.5).r*mw.y+texture2D(moonGrain,vMoonPoint.xy*.5).r*mw.z;
          float detailFade=1.0-smoothstep(100.0,1200.0,length(vViewPosition));
          float strata=.86+.14*sin(vMoonSurface.x*.12+grain*.7);
          float chips=smoothstep(.35,.7,grain);
          diffuseColor.rgb*=mix(1.0,(.70+chips*.5)*strata,detailFade);
          diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.92,1.12,1.3),vMoonSurface.y*.35);`)
        .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(.97,.52,vMoonSurface.y*smoothstep(.5,.75,grain));')
        .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
          vec3 q0=dFdx(-vViewPosition),q1=dFdy(-vViewPosition);
          vec3 r1=cross(q1,normal),r2=cross(normal,q0);
          float det=dot(q0,r1);
          float relief=grain*.0035*detailFade;
          vec3 grad=sign(det)*(dFdx(relief)*r1+dFdy(relief)*r2);
          normal=normalize(max(abs(det),1e-10)*normal-grad);`);
    };
    this.material.customProgramCacheKey=()=> 'selene-terrain-v3';
    this.terrain=new MoonTerrain(scene,this.material);
    this.rings=new MoonRings(scene);this.ice=new MoonIce(scene);
    this.sun=new THREE.Vector3(...SUN_DIRECTION).multiplyScalar(SUN_DISTANCE);
  }
  update(worldPosition,origin,elapsed=0,outside=true) {
    this.rings.update(origin,elapsed);this.ice.update(worldPosition,origin,elapsed,outside);
    this.terrain.update(worldPosition,origin);
    // Eclipse the moon when Aeon blocks its direct sunlight. The small ambient
    // component keeps the disk readable without giving it a self-lit texture.
    const toSun=this.sun.clone().sub(this.worldPosition).normalize(),along=-this.worldPosition.dot(toSun);
    const miss=this.worldPosition.clone().addScaledVector(toSun,Math.max(0,along)).length();
    const visibility=along>0?THREE.MathUtils.smoothstep(miss,RADIUS-MOON_RADIUS,RADIUS+MOON_RADIUS):1;
    this.material.color.setScalar(.035+.965*visibility);
  }
  get ready(){return this.terrain.ready;}
  get effects(){return {ringAsteroids:this.rings.descriptors.length,iceParticles:this.ice.points.visible?this.ice.descriptors.length:0,generatorVersion:3};}
  dispose(){this.rings.dispose();this.ice.dispose();this.terrain.dispose();this.grain.dispose();this.material.dispose();this.maps.color.dispose();}
}
