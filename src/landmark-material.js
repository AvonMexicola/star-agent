import * as THREE from 'three';
import {acquireRockTextures,releaseRockTextures} from './rock-material.js';

// All procedural coordinates are local metres plus a stable instance phase.
// Quiet mineral variation with one scanned stone scale; relief is a close detail.
const surface = /* glsl */`
  varying vec3 vLandmarkPoint,vLandmarkNormal,vLandmarkSeed;
  varying mat3 vLandmarkFrame;
  uniform sampler2D landmarkAlbedo,landmarkNormal;
  uniform float landmarkMapsReady;
  vec3 landmarkWeights,landmarkP;
  float landmarkWeather,landmarkRelief;

  float landmarkHash(vec3 p){
    p=fract(p*.1031);p+=dot(p,p.yzx+33.33);
    return fract((p.x+p.y)*p.z);
  }
  float landmarkNoise(vec3 p){
    vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
    return mix(mix(mix(landmarkHash(i),landmarkHash(i+vec3(1,0,0)),f.x),
                   mix(landmarkHash(i+vec3(0,1,0)),landmarkHash(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(landmarkHash(i+vec3(0,0,1)),landmarkHash(i+vec3(1,0,1)),f.x),
                   mix(landmarkHash(i+vec3(0,1,1)),landmarkHash(i+vec3(1,1,1)),f.x),f.y),f.z);
  }
  vec3 landmarkTri(sampler2D tex,vec3 p){
    return texture2D(tex,p.yz).rgb*landmarkWeights.x
         + texture2D(tex,p.zx).rgb*landmarkWeights.y
         + texture2D(tex,p.xy).rgb*landmarkWeights.z;
  }
  vec3 landmarkGradient(vec3 p){
    vec3 x=texture2D(landmarkNormal,p.yz).xyz*2.0-1.0;
    vec3 y=texture2D(landmarkNormal,p.zx).xyz*2.0-1.0;
    vec3 z=texture2D(landmarkNormal,p.xy).xyz*2.0-1.0;
    return vec3(0,x.x,x.y)/max(x.z,.4)*landmarkWeights.x
         + vec3(y.y,0,y.x)/max(y.z,.4)*landmarkWeights.y
         + vec3(z.x,z.y,0)/max(z.z,.4)*landmarkWeights.z;
  }
`;

export function createLandmarkMaterial(){
  const maps=acquireRockTextures();
  const material=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.9,metalness:0});
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,{landmarkAlbedo:maps.albedo,landmarkNormal:maps.normal,landmarkMapsReady:maps.ready});
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vLandmarkPoint,vLandmarkNormal,vLandmarkSeed; varying mat3 vLandmarkFrame;')
      .replace('#include <begin_vertex>',`#include <begin_vertex>
        vLandmarkPoint=position*length(instanceMatrix[0].xyz);
        vLandmarkNormal=normal;vLandmarkFrame=mat3(modelViewMatrix)*mat3(instanceMatrix);
        // Rotation and scale are seeded and identical at every LOD. Translation
        // changes when the camera rebases and must never seed the surface.
        vLandmarkSeed=fract(vec3(dot(instanceMatrix[0].xyz,vec3(13.37,7.17,23.31)),
          dot(instanceMatrix[1].xyz,vec3(8.71,19.13,3.79)),
          dot(instanceMatrix[2].xyz,vec3(17.53,5.37,11.19))));`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>\n${surface}`)
      .replace('#include <color_fragment>',`#include <color_fragment>
        vec3 geometricNormal=normalize(vLandmarkNormal);
        landmarkWeights=pow(abs(geometricNormal),vec3(4.0));
        landmarkWeights/=max(dot(landmarkWeights,vec3(1.0)),.001);
        vec3 p=vLandmarkPoint+vLandmarkSeed*173.0;
        landmarkWeather=landmarkNoise(p*.025+43.0);
        float strata=landmarkNoise(p*vec3(.028,.18,.028)+landmarkWeather*1.4);
        float distanceToFace=length(vViewPosition);
        landmarkRelief=1.0-smoothstep(140.0,650.0,distanceToFace);
        landmarkP=p/8.5;
        vec3 plates=landmarkTri(landmarkAlbedo,landmarkP);
        // The scan supplies the fractures. Keep gentle broad mineral changes,
        // without synthetic fissures or a second grain/normal texture layer.
        vec3 stone=mix(vec3(.78),clamp(plates*2.7,vec3(.30),vec3(1.45)),.70);
        vec3 mineral=mix(vec3(.56,.58,.56),vec3(.66,.59,.49),vLandmarkSeed.x);
        float oxide=smoothstep(.46,.77,landmarkWeather)*smoothstep(.3,.62,strata);
        mineral=mix(mineral,vec3(.64,.49,.34),oxide*.18);
        float upper=smoothstep(.12,.76,geometricNormal.y);
        mineral=mix(mineral,vec3(.60,.59,.50),upper*landmarkWeather*.13);
        float shelter=1.0-smoothstep(-.45,.05,geometricNormal.y);
        float weathering=(.91+.16*strata)*(1.0-shelter*.08);
        diffuseColor.rgb*=mix(vec3(.49),stone,landmarkMapsReady)*mineral*weathering;`)
      .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
        roughnessFactor=.89+landmarkWeather*.07;`)
      .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
        vec3 n=normalize(vLandmarkNormal);
        // Skip the three normal-map reads entirely once their relief has faded.
        if(landmarkMapsReady>.5&&landmarkRelief>0.0){
          vec3 gradient=landmarkGradient(landmarkP)*.48;
          gradient-=n*dot(gradient,n);
          n=normalize(n+gradient*landmarkRelief);
        }
        normal=normalize(vLandmarkFrame*n);`);
  };
  material.customProgramCacheKey=()=> 'aeon-landmark-pbr-v3';
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
      .replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
        float dither=fract(52.9829189*fract(dot(gl_FragCoord.xy,vec2(.06711056,.00583715))));
        float nearWeight=1.0-smoothstep(420.0,580.0,vLandmarkDistance);
        float midWeight=1.0-smoothstep(1500.0,1950.0,vLandmarkDistance);
        ${level===0?'if(dither>nearWeight)discard;':level===1?'if(dither<=nearWeight||dither>midWeight)discard;':level===2?'if(dither<=midWeight)discard;':''}
        ${material.isMeshDepthMaterial?'if(dither>1.0-smoothstep(220.0,300.0,vLandmarkDistance))discard;':''}
        if(dither>1.0-smoothstep(9000.0,10000.0,vLandmarkDistance))discard;`);
  };
  material.customProgramCacheKey=()=>`${key}-landmark-lod-${level}`;
}
