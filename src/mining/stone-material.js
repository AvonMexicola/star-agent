import * as THREE from 'three';
import {acquireRockTextures,releaseRockTextures} from '../rock-material.js';

/** Metre-scaled local projection, shared by instanced stones and their cut faces.
 * The full object/instance frame carries normal relief into view space; terrain's
 * world-aligned projection cannot be reused on these individually rotated rocks. */
export function createStoneMaterial(){
  const maps=acquireRockTextures();
  const material=new THREE.MeshStandardMaterial({color:new THREE.Color(.32,.35,.32),roughness:.92,metalness:0,side:THREE.DoubleSide});
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,{stoneAlbedo:maps.albedo,stoneNormal:maps.normal,stoneRoughness:maps.roughness,stoneMapsReady:maps.ready});
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\nvarying vec3 vStonePoint;varying vec3 vStoneNormal;varying mat3 vStoneFrame;')
      .replace('#include <begin_vertex>',`#include <begin_vertex>
        vStonePoint=position;vStoneNormal=normal;vStoneFrame=mat3(modelViewMatrix);
        #ifdef USE_INSTANCING
          vStoneFrame=vStoneFrame*mat3(instanceMatrix);
        #endif`);
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>',`#include <common>
        varying vec3 vStonePoint;varying vec3 vStoneNormal;varying mat3 vStoneFrame;
        uniform sampler2D stoneAlbedo;uniform sampler2D stoneNormal;uniform sampler2D stoneRoughness;uniform float stoneMapsReady;
        vec3 stoneWeights;vec3 stoneP;
        vec3 stoneTri(sampler2D tex,vec3 p,vec3 w){return texture2D(tex,p.yz).rgb*w.x+texture2D(tex,p.zx).rgb*w.y+texture2D(tex,p.xy).rgb*w.z;}`)
      .replace('#include <color_fragment>',`#include <color_fragment>
        stoneP=vStonePoint/.85;
        stoneWeights=pow(abs(normalize(vStoneNormal)),vec3(4));stoneWeights/=max(dot(stoneWeights,vec3(1)),.001);
        vec3 stoneColour=stoneTri(stoneAlbedo,stoneP,stoneWeights);
        // Restrained charcoal / olive-grey weathering, rather than a white blob.
        // A complete procedural finish survives a failed optional texture load.
        float grain=.86+.14*sin(dot(vStonePoint,vec3(11,17,23)))*sin(vStonePoint.z*19.0);
        diffuseColor.rgb*=mix(vec3(grain),stoneColour*1.8,stoneMapsReady);`)
      .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
        roughnessFactor=mix(.92,clamp(stoneTri(stoneRoughness,stoneP,stoneWeights).r,.72,.99),stoneMapsReady);`)
      .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
        if(stoneMapsReady>.5){
          vec3 nx=texture2D(stoneNormal,stoneP.yz).xyz*2.0-1.0;
          vec3 ny=texture2D(stoneNormal,stoneP.zx).xyz*2.0-1.0;
          vec3 nz=texture2D(stoneNormal,stoneP.xy).xyz*2.0-1.0;
          vec3 gradient=vec3(0,nx.x,nx.y)/max(nx.z,.4)*stoneWeights.x
            +vec3(ny.y,0,ny.x)/max(ny.z,.4)*stoneWeights.y+vec3(nz.x,nz.y,0)/max(nz.z,.4)*stoneWeights.z;
          vec3 n=normalize(vStoneNormal);gradient-=n*dot(gradient,n);
          float detail=1.0-smoothstep(25.0,100.0,length(vViewPosition));
          normal=normalize(vStoneFrame*normalize(n+gradient*.48*detail))*faceDirection;
        }`);
  };
  material.customProgramCacheKey=()=> 'aeon-stone-pbr-v1';
  let disposed=false;
  material.addEventListener('dispose',()=>{if(!disposed){disposed=true;releaseRockTextures(maps);}});
  return material;
}

export function addStoneFade(material,camera,level){
  const previous=material.onBeforeCompile,key=material.customProgramCacheKey();
  material.onBeforeCompile=(shader,renderer)=>{
    previous.call(material,shader,renderer);shader.uniforms.stoneCamera=camera;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform vec3 stoneCamera;varying float vStoneDistance;')
      .replace('#include <begin_vertex>',`#include <begin_vertex>\nvStoneDistance=length(instanceMatrix[3].xyz-stoneCamera);`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vStoneDistance;')
      .replace('#include <alphatest_fragment>',`#include <alphatest_fragment>
        float dither=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));
        float nearWeight=1.0-smoothstep(45.0,65.0,vStoneDistance);
        ${level===0?'if(dither>nearWeight)discard;':level===1?'if(dither<=nearWeight||dither>1.0-smoothstep(220.0,280.0,vStoneDistance))discard;':'if(dither>1.0-smoothstep(220.0,280.0,vStoneDistance))discard;'}`);
  };
  material.customProgramCacheKey=()=>`${key}-stone-lod-${level}`;
}
