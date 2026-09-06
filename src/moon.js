import * as THREE from 'three';
import { MOON_RADIUS, MOON_POSITION, MOON_GENERATOR_VERSION } from './moon-world.js';
import { RADIUS, SUN_DISTANCE, SUN_DIRECTION } from './world.js';
import { MoonTerrain } from './moon-terrain.js';
import { MoonRings } from './moon-rings.js';
import { MoonIce } from './moon-ice.js';

// Periodic fractured stone: one tile spans four metres. Packed channels retain
// cracks, granular relief and mineral variation through triplanar mipmapping.
function rockTexture(){
  const size=256,data=new Uint8Array(size*size*4),cells=12;
  const hash=(x,y,salt)=>{let n=Math.imul((x+cells)%cells,374761393)^Math.imul((y+cells)%cells,668265263)^salt;n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;};
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const u=x/size*cells,v=y/size*cells,ix=Math.floor(u),iy=Math.floor(v);let first=9,second=9;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      const cx=ix+dx,cy=iy+dy,d=Math.hypot(cx+hash(cx,cy,71)-u,cy+hash(cx,cy,191)-v);
      if(d<first){second=first;first=d;}else if(d<second)second=d;
    }
    const crack=THREE.MathUtils.smoothstep(second-first,.015,.11);
    const grain=((Math.imul((x+y*size)^73471,1597334677)>>>8)&255)/255;
    data.set([Math.round(255*crack),Math.round(255*(crack*.7+grain*.3)),Math.round(255*(.5+.5*Math.cos(first*3))),255],(y*size+x)*4);
  }
  const texture=new THREE.DataTexture(data,size,size);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=true;texture.anisotropy=8;texture.needsUpdate=true;return texture;
}

export class Moon {
  constructor(scene) {
    this.scene=scene;this.worldPosition=new THREE.Vector3(...MOON_POSITION);
    this.material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0,envMapIntensity:0,side:THREE.DoubleSide});
    this.grain=rockTexture();
    this.material.onBeforeCompile=shader=>{
      shader.uniforms.moonGrain={value:this.grain};
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 moonDirection;attribute vec3 moonPoint;attribute vec2 moonSurfaceData;varying vec3 vMoonNormal;varying vec3 vMoonDirection;varying vec3 vMoonPoint;varying vec2 vMoonSurface;')
        .replace('#include <begin_vertex>','#include <begin_vertex>\nvMoonNormal=normal;vMoonDirection=moonDirection;vMoonPoint=moonPoint;vMoonSurface=moonSurfaceData;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D moonGrain;varying vec3 vMoonNormal;varying vec3 vMoonDirection;varying vec3 vMoonPoint;varying vec2 vMoonSurface;')
        .replace('#include <color_fragment>',`#include <color_fragment>
          vec3 md=normalize(vMoonDirection),mn=normalize(vMoonNormal);
          vec3 mw=pow(abs(mn),vec3(4.0));mw/=dot(mw,vec3(1.0));
          vec3 detail=texture2D(moonGrain,vMoonPoint.yz/4.0).rgb*mw.x+texture2D(moonGrain,vMoonPoint.xz/4.0).rgb*mw.y+texture2D(moonGrain,vMoonPoint.xy/4.0).rgb*mw.z;
          float grain=detail.g;
          float detailFade=1.0-smoothstep(120.0,1800.0,length(vViewPosition));
          float slope=1.0-max(0.0,dot(mn,md));
          // Broad exposed strata remain visible on distant cliffs. Derivatives
          // suppress subpixel bands, avoiding shimmer during flight.
          float phase=vMoonSurface.x*.018;
          float strata=1.0-.23*(.5+.5*sin(phase))*(1.0-smoothstep(.3,2.0,fwidth(phase)));
          diffuseColor.rgb*=mix(1.0,strata,smoothstep(.05,.35,slope));
          diffuseColor.rgb*=mix(1.0,.36+detail.r*.59+detail.b*.28,detailFade);
          diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.58,.68,.82),smoothstep(.25,.7,slope)*.6);`)
        .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(.97,.52,vMoonSurface.y*smoothstep(.5,.75,grain));')
        .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
          vec3 q0=dFdx(-vViewPosition),q1=dFdy(-vViewPosition);
          vec3 r1=cross(q1,normal),r2=cross(normal,q0);
          float det=dot(q0,r1);
          float relief=grain*.025*detailFade;
          vec3 grad=sign(det)*(dFdx(relief)*r1+dFdy(relief)*r2);
          normal=normalize(max(abs(det),1e-10)*normal-grad);`);
    };
    this.material.customProgramCacheKey=()=> 'selene-terrain-v4';
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
  get effects(){return {ringAsteroids:this.rings.descriptors.length,terrainBuilds:this.terrain.buildsLastFrame,iceParticles:this.ice.points.visible?this.ice.descriptors.length:0,generatorVersion:MOON_GENERATOR_VERSION};}
  dispose(){this.rings.dispose();this.ice.dispose();this.terrain.dispose();this.grain.dispose();this.material.dispose();}
}
