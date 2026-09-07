import * as THREE from 'three';
import {acquireRockTextures,releaseRockTextures} from './rock-material.js';

export function createLandmarkMaterial(){
  const maps=acquireRockTextures();
  const material=new THREE.MeshStandardMaterial({color:new THREE.Color(.42,.32,.23),vertexColors:true,roughness:.94,metalness:0});
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,{landmarkAlbedo:maps.albedo,landmarkNormal:maps.normal,landmarkRoughness:maps.roughness,landmarkMapsReady:maps.ready});
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vLandmarkPoint,vLandmarkNormal; varying mat3 vLandmarkFrame;')
      .replace('#include <begin_vertex>',`#include <begin_vertex>
        vLandmarkPoint=position*length(instanceMatrix[0].xyz);vLandmarkNormal=normal;vLandmarkFrame=mat3(modelViewMatrix)*mat3(instanceMatrix);`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
      varying vec3 vLandmarkPoint,vLandmarkNormal; varying mat3 vLandmarkFrame;
      uniform sampler2D landmarkAlbedo,landmarkNormal,landmarkRoughness;uniform float landmarkMapsReady;
      vec3 landmarkWeights,landmarkP;
      vec3 landmarkTri(sampler2D tex,vec3 p,vec3 w){return texture2D(tex,p.yz).rgb*w.x+texture2D(tex,p.zx).rgb*w.y+texture2D(tex,p.xy).rgb*w.z;}`)
      .replace('#include <color_fragment>',`#include <color_fragment>
        landmarkP=vLandmarkPoint/3.0;
        landmarkWeights=pow(abs(normalize(vLandmarkNormal)),vec3(4.0));landmarkWeights/=max(dot(landmarkWeights,vec3(1.0)),.001);
        vec3 fine=landmarkTri(landmarkAlbedo,landmarkP,landmarkWeights);
        vec3 broad=landmarkTri(landmarkAlbedo,vLandmarkPoint/27.0,landmarkWeights);
        float close=1.0-smoothstep(90.0,420.0,length(vViewPosition));
        vec3 stone=mix(broad,mix(broad,fine,.58),close)*1.9;
        float grain=.89+.11*sin(dot(vLandmarkPoint,vec3(1.1,.8,1.7)));
        diffuseColor.rgb*=mix(vec3(grain),stone,landmarkMapsReady);
        // Irregular mineral bands and long rain streaks at landscape scale.
        float layer=.5+.5*sin(vLandmarkPoint.y*.27+sin(vLandmarkPoint.x*.055+vLandmarkPoint.z*.037)*1.3);
        float streak=.5+.5*sin(vLandmarkPoint.x*.43+vLandmarkPoint.z*.38+sin(vLandmarkPoint.y*.016));
        diffuseColor.rgb*=mix(vec3(.77,.79,.77),vec3(1.12,1.04,.91),smoothstep(.2,.8,layer))*(.90+.10*streak);`)
      .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
        roughnessFactor=mix(.94,clamp(landmarkTri(landmarkRoughness,landmarkP,landmarkWeights).r,.8,.99),landmarkMapsReady);`)
      .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
        if(landmarkMapsReady>.5){
          vec3 nx=texture2D(landmarkNormal,landmarkP.yz).xyz*2.0-1.0,ny=texture2D(landmarkNormal,landmarkP.zx).xyz*2.0-1.0,nz=texture2D(landmarkNormal,landmarkP.xy).xyz*2.0-1.0;
          vec3 gradient=vec3(0,nx.x,nx.y)/max(nx.z,.4)*landmarkWeights.x+vec3(ny.y,0,ny.x)/max(ny.z,.4)*landmarkWeights.y+vec3(nz.x,nz.y,0)/max(nz.z,.4)*landmarkWeights.z;
          vec3 n=normalize(vLandmarkNormal);gradient-=n*dot(gradient,n);
          normal=normalize(vLandmarkFrame*normalize(n+gradient*.55*(1.0-smoothstep(90.0,300.0,length(vViewPosition)))));
        }`);
  };
  material.customProgramCacheKey=()=> 'aeon-landmark-pbr-v1';
  let disposed=false;material.addEventListener('dispose',()=>{if(!disposed){disposed=true;releaseRockTextures(maps);}});
  return material;
}

/** Complementary coverage also applies to shadow depth. Positive distance is
 * measured from each stable instance centre, never a large world-space float. */
export function addLandmarkFade(material,level){
  const previous=material.onBeforeCompile,key=material.customProgramCacheKey();
  material.onBeforeCompile=(shader,renderer)=>{
    previous.call(material,shader,renderer);
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying float vLandmarkDistance;')
      .replace('#include <begin_vertex>','#include <begin_vertex>\nvLandmarkDistance=length(instanceMatrix[3].xyz);');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vLandmarkDistance;')
      .replace('#include <alphatest_fragment>',`#include <alphatest_fragment>
        float dither=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));
        float nearWeight=1.0-smoothstep(420.0,580.0,vLandmarkDistance);
        float midWeight=1.0-smoothstep(1500.0,1950.0,vLandmarkDistance);
        ${level===0?'if(dither>nearWeight)discard;':level===1?'if(dither<=nearWeight||dither>midWeight)discard;':level===2?'if(dither<=midWeight)discard;':''}
        if(dither>1.0-smoothstep(9000.0,10000.0,vLandmarkDistance))discard;`);
  };
  material.customProgramCacheKey=()=>`${key}-landmark-lod-${level}`;
}
