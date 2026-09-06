import { MineralFragments } from './mineral-fragments.js';
import * as THREE from 'three';
import { PyreTerrain } from './pyre-terrain.js';
import { MIASMA_RADIUS, MIASMA_POSITION, MIASMA_TERRAIN } from './miasma-world.js';

// Unit-direction weather shared by clouds and surface shadowing. No world-sized
// floats: terrain detail uses the quadtree's patch-local coordinates.
const weather = `
  float mh(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
  float mn(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
    return mix(mix(mix(mh(i),mh(i+vec3(1,0,0)),f.x),mix(mh(i+vec3(0,1,0)),mh(i+vec3(1,1,0)),f.x),f.y),
      mix(mix(mh(i+vec3(0,0,1)),mh(i+vec3(1,0,1)),f.x),mix(mh(i+vec3(0,1,1)),mh(i+vec3(1,1,1)),f.x),f.y),f.z);}
  float mf(vec3 p){return mn(p)*.57+mn(p*2.03+17.0)*.28+mn(p*4.13-9.0)*.15;}
  float mCloud(vec3 d,float time){
    float angle=time*.0018+d.y*3.0+mf(d*3.0)*1.8;
    d.xz=mat2(cos(angle),-sin(angle),sin(angle),cos(angle))*d.xz;
    vec3 p=d*9.0+vec3(mf(d*5.0),mf(d*5.0+19.0),mf(d*5.0-7.0))*3.0;
    float belts=sin(d.y*24.0+mf(d*8.0)*8.0)*.075;
    return smoothstep(.38,.67,mf(p)+belts);
  }
`;
const mapTexture=(pixels,width,height,space=THREE.NoColorSpace)=>{
  const map=new THREE.DataTexture(pixels,width,height);map.colorSpace=space;map.wrapS=THREE.RepeatWrapping;
  map.minFilter=THREE.LinearMipmapLinearFilter;map.magFilter=THREE.LinearFilter;map.generateMipmaps=true;map.needsUpdate=true;return map;
};
export class Miasma {
  constructor(scene) {
    this.scene=scene;this.worldPosition=new THREE.Vector3(...MIASMA_POSITION);
    this.group=new THREE.Group();this.group.name='Miasma';scene.add(this.group);
    this.fragments=new MineralFragments(this.group);
    this.time={value:0};this.mapsReady={value:0};
    this.color={value:mapTexture(new Uint8Array([140,140,50,255]),1,1,THREE.SRGBColorSpace)};
    this.normal={value:mapTexture(new Uint8Array([128,128,255,255]),1,1)};
    this.material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.9,metalness:0,side:THREE.DoubleSide,envMapIntensity:.05});
    this.material.onBeforeCompile=shader=>{
      Object.assign(shader.uniforms,{mTime:this.time,mColor:this.color,mNormal:this.normal,mMaps:this.mapsReady});
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 pyreDirection;attribute vec3 pyrePoint;varying vec3 mDirection;varying vec3 mPoint;')
        .replace('#include <begin_vertex>','#include <begin_vertex>\nmDirection=pyreDirection;mPoint=pyrePoint;');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
        uniform float mTime;uniform float mMaps;uniform sampler2D mColor;uniform sampler2D mNormal;
        // Wrap longitudinal derivatives before mip selection at the equirectangular seam.
        vec4 mOrbit(sampler2D tex,vec2 uv){vec2 dx=dFdx(uv),dy=dFdy(uv);dx.x-=floor(dx.x+.5);dy.x-=floor(dy.x+.5);return textureGrad(tex,uv,dx,dy);}
        varying vec3 mDirection;varying vec3 mPoint;float mRelief;float mFar;vec3 mOrbitalNormal;${weather}`)
        .replace('#include <color_fragment>',`#include <color_fragment>
          vec3 d=normalize(mDirection);float range=length(vViewPosition);
          vec2 uv=vec2(atan(d.x,d.z)/6.2831853+.5,asin(clamp(d.y,-1.0,1.0))/3.14159265+.5);
          mFar=smoothstep(30000.0,100000.0,range)*mMaps;
          diffuseColor.rgb=mix(diffuseColor.rgb,mOrbit(mColor,uv).rgb,mFar);
          mOrbitalNormal=normalize(mOrbit(mNormal,uv).xyz*2.0-1.0);
          float detail=1.0-smoothstep(100.0,2400.0,range);
          float grains=mn(mPoint*3.0),plates=mf(mPoint*.14),cracks=1.0-smoothstep(.015,.07,abs(plates-.48));
          diffuseColor.rgb*=mix(1.0,.73+plates*.45+grains*.22-cracks*.3,detail);
          diffuseColor.rgb*=1.0-mCloud(d,mTime)*.18;
          mRelief=(grains*.02+plates*.16-cracks*.04)*detail;`)
        .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
          vec3 q0=dFdx(-vViewPosition),q1=dFdy(-vViewPosition),r1=cross(q1,normal),r2=cross(normal,q0);
          float det=dot(q0,r1);normal=normalize(max(abs(det),1e-10)*normal-sign(det)*(dFdx(mRelief)*r1+dFdy(mRelief)*r2));
          normal=normalize(mix(normal,mat3(viewMatrix)*mOrbitalNormal,mFar));`);
    };
    this.material.customProgramCacheKey=()=> 'miasma-surface-v1';
    this.terrain=new PyreTerrain(this.group,this.material,{body:MIASMA_TERRAIN,workers:2,workerFactory:()=>new Worker(new URL('./miasma.worker.js',import.meta.url),{type:'module'}),onMaps:data=>{
      this.color.value.dispose();this.normal.value.dispose();
      this.color.value=mapTexture(data.color,data.width,data.height,THREE.SRGBColorSpace);this.normal.value=mapTexture(data.normal,data.width,data.height);this.mapsReady.value=1;
    }});
    this.cloudMaterial=new THREE.MeshStandardMaterial({color:0xd4d391,roughness:1,transparent:true,depthWrite:false,side:THREE.DoubleSide,envMapIntensity:0});
    this.cloudMaterial.onBeforeCompile=shader=>{
      shader.uniforms.mTime=this.time;
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 mDirection;')
        .replace('#include <begin_vertex>','#include <begin_vertex>\nmDirection=normalize(position);');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>\nuniform float mTime;varying vec3 mDirection;${weather}`)
        .replace('#include <color_fragment>',`#include <color_fragment>
          float cover=mCloud(normalize(mDirection),mTime);
          diffuseColor.rgb=mix(vec3(.12,.19,.055),vec3(.72,.68,.32),cover);
          diffuseColor.a=cover*.78;if(diffuseColor.a<.025)discard;`);
    };
    this.cloudMaterial.customProgramCacheKey=()=> 'miasma-weather-v1';
    this.clouds=new THREE.Mesh(new THREE.SphereGeometry(1,128,80),this.cloudMaterial);
    this.clouds.name='Miasma sulphur aerosol clouds';this.clouds.scale.setScalar(MIASMA_RADIUS+8500);this.group.add(this.clouds);
  }
  update(position,origin,elapsed,shipPosition=null) {
    this.distance=position.distanceTo(this.worldPosition);this.group.visible=this.distance<3e8;this.time.value=elapsed;
    if(!this.group.visible)return;
    this.terrain.update(position,origin);this.fragments.update(position,origin,this.terrain.altitude,shipPosition);this.clouds.position.copy(this.worldPosition).sub(origin);
  }
  get ready(){return this.terrain.ready&&this.mapsReady.value===1;}
  get state(){return {position:this.worldPosition.toArray(),radius:MIASMA_RADIUS,distance:this.distance,visible:this.group.visible,ready:this.ready,mapsReady:this.mapsReady.value===1,patches:this.terrain.visibleCount,lod:this.terrain.maxLevel,pending:this.terrain.pending,morphing:this.terrain.morphing,error:this.terrain.error,fragments:this.fragments.count,surfaceAltitude:this.terrain.altitude,weatherTime:this.time.value};}
  dispose(){this.fragments.dispose();this.terrain.dispose();this.color.value.dispose();this.normal.value.dispose();this.clouds.geometry.dispose();this.cloudMaterial.dispose();this.material.dispose();this.scene.remove(this.group);}
}
