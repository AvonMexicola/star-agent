import * as THREE from 'three';
import { MOON_RADIUS, MOON_POSITION, MOON_GENERATOR_VERSION } from './moon-world.js';
import { RADIUS, SUN_DISTANCE, SUN_DIRECTION } from './world.js';
import { MoonTerrain } from './moon-terrain.js';
import { MoonRings } from './moon-rings.js';
import { MoonIce } from './moon-ice.js';
import { acquireTerrainMaps, terrainMapShader, terrainMapUniforms } from './terrain-maps.js';
import { OrbitalSurface, orbitalShader } from './orbital-surface.js';

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
    this.terrainMaps=acquireTerrainMaps();
    this.orbitalSurface=new OrbitalSurface('selene');
    this.material.onBeforeCompile=shader=>{
      shader.uniforms.moonGrain={value:this.grain};
      shader.uniforms.orbitalNormal=this.orbitalSurface.normal;
      shader.uniforms.moonAlbedo=this.orbitalSurface.color;
      shader.uniforms.moonAlbedoReady=this.orbitalSurface.ready;
      Object.assign(shader.uniforms,terrainMapUniforms(this.terrainMaps));
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 moonDirection;attribute vec3 moonPoint;attribute vec2 moonSurfaceData;varying vec3 vMoonNormal;varying vec3 vMoonDirection;varying vec3 vMoonPoint;varying vec2 vMoonSurface;')
        .replace('#include <begin_vertex>','#include <begin_vertex>\nvMoonNormal=normal;vMoonDirection=moonDirection;vMoonPoint=moonPoint;vMoonSurface=moonSurfaceData;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>\n${terrainMapShader}\n${orbitalShader}\nuniform sampler2D moonAlbedo;uniform float moonAlbedoReady;uniform sampler2D moonGrain;varying vec3 vMoonNormal;varying vec3 vMoonDirection;varying vec3 vMoonPoint;varying vec2 vMoonSurface;`)
        .replace('#include <color_fragment>',`#include <color_fragment>
          vec3 geologyColor=diffuseColor.rgb;
          vec3 md=normalize(vMoonDirection),mn=normalize(vMoonNormal);
          float range=length(vViewPosition);
          float orbitalFade=smoothstep(12000.0,60000.0,range)*moonAlbedoReady;
          #ifdef USE_NORMALMAP_OBJECTSPACE
            mn=normalize(texture2D(normalMap,vNormalMapUv).xyz*2.0-1.0);
            orbitalFade=smoothstep(70000.0,160000.0,range)*moonAlbedoReady;
          #endif
          geologyColor=mix(geologyColor,texture2D(moonAlbedo,bodyUV(md)).rgb*diffuse,orbitalFade);
          diffuseColor.rgb=geologyColor;
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
          diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.58,.68,.82),smoothstep(.25,.7,slope)*.6);
          vec3 mappedGradient=vec3(0.0);
          float mappedRoughness=.97;
          float mappedFade=1.0-smoothstep(2500.0,14000.0,length(vViewPosition));
          // Regional mineral fields are body anchored; crater and ejecta colour
          // still comes from moonSurface, shared with collision and destinations.
          if(terrainMapsReady>.5) {
            float deposit=dot(terrainColor(md*1696.6796875,mw,1.0),vec3(.2126,.7152,.0722));
            float regionalFade=1.0-smoothstep(30000.0,90000.0,range);
            geologyColor*=mix(1.0,.8+smoothstep(.025,.3,deposit)*.38,regionalFade);
            diffuseColor.rgb=geologyColor;
          }
          if (terrainMapsReady>.5 && mappedFade>.001) {
            vec3 broad=mix(terrainColor(vMoonPoint/64.0,mw,1.0),terrainColor(vMoonPoint/256.0,mw,1.0),.65);
            float deposit=dot(broad,vec3(.2126,.7152,.0722));
            float rock=smoothstep(.025,.24,slope);
            rock=max(rock,smoothstep(.13,.31,deposit)*.48);
            TerrainSample surface=terrainMix(terrainSample(vMoonPoint/4.0,mw,0.0),terrainSample(vMoonPoint/16.0,mw,1.0),rock);
            // Retain the canonical blue ice, copper ejecta and dark basalt masks.
            // Earth soil supplies granular relief only, not terrestrial brown colour.
            float luminance=dot(surface.color,vec3(.2126,.7152,.0722));
            float reliefColor=mix(.56,1.5,smoothstep(.018,.30,luminance));
            float deposits=mix(.5,1.65,smoothstep(.025,.27,deposit));
            vec3 mapped=geologyColor*reliefColor*deposits;
            mapped*=mix(1.0,strata,rock);
            float frost=clamp(vMoonSurface.y,0.0,1.0);
            mapped=mix(mapped,geologyColor*(.91+reliefColor*.12),frost*.7);
            diffuseColor.rgb=mix(geologyColor,mapped,mappedFade);
            mappedGradient=surface.gradient*mix(.9,.28,frost);
            mappedRoughness=mix(clamp(surface.roughness,.78,1.0),.34,frost*frost);
          }`)
        .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=terrainMapsReady>.5?mix(.97,mappedRoughness,mappedFade):mix(.97,.52,vMoonSurface.y*smoothstep(.5,.75,grain));')
        .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
          vec3 q0=dFdx(-vViewPosition),q1=dFdy(-vViewPosition);
          vec3 r1=cross(q1,normal),r2=cross(normal,q0);
          float det=dot(q0,r1);
          float relief=grain*.025*detailFade;
          vec3 grad=sign(det)*(dFdx(relief)*r1+dFdy(relief)*r2);
          if(terrainMapsReady>.5) normal=terrainNormalAt(normal,mappedGradient,mappedFade*(1.0-smoothstep(100.0,1200.0,length(vViewPosition))));
          else normal=normalize(max(abs(det),1e-10)*normal-grad);`);
      shader.fragmentShader=shader.fragmentShader.replace('vec3 q0=dFdx(-vViewPosition)', 'normal=normalize(mix(normal,orbitalViewNormal(md),orbitalFade));\nvec3 q0=dFdx(-vViewPosition)');
    };
    this.material.customProgramCacheKey=()=> 'selene-terrain-orbital-v2';
    this.terrain=new MoonTerrain(scene,this.material);
    this.rings=new MoonRings(scene);this.ice=new MoonIce(scene);
    this.sun=new THREE.Vector3(...SUN_DIRECTION).multiplyScalar(SUN_DISTANCE);
  }
  update(worldPosition,origin,elapsed=0,outside=true) {
    if(worldPosition.distanceTo(this.worldPosition)<MOON_RADIUS*12)this.orbitalSurface.start();
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
  get effects(){return {orbitalResolution:this.orbitalSurface.resolution,settled:this.terrain.waitingCount===0,ringAsteroids:this.rings.descriptors.length,terrainBuilds:this.terrain.buildsLastFrame,iceParticles:this.ice.points.visible?this.ice.descriptors.length:0,generatorVersion:MOON_GENERATOR_VERSION};}
  dispose(){this.orbitalSurface.dispose();this.rings.dispose();this.ice.dispose();this.terrain.dispose();this.grain.dispose();this.terrainMaps.dispose();this.material.dispose();}
}
