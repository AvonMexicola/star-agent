import * as THREE from 'three';
import {acquireRockTextures,releaseRockTextures} from './rock-material.js';

// All procedural coordinates are local metres plus a stable instance phase.
// Medium relief remains readable on a cliff; the scanned grain resolves near it.
const surface = /* glsl */`
  varying vec3 vLandmarkPoint,vLandmarkNormal,vLandmarkSeed;
  varying mat3 vLandmarkFrame;
  uniform sampler2D landmarkAlbedo,landmarkNormal,landmarkRoughness;
  uniform float landmarkMapsReady;
  vec3 landmarkWeights,landmarkP,landmarkFineP;
  float landmarkFine,landmarkCrack,landmarkWeather,landmarkHeight;

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
  vec3 landmarkReliefNormal(vec3 n,float height){
    // Surface-gradient bump, using metre derivatives so strength does not grow
    // with screen resolution or camera distance. Geometry/collision stay intact.
    vec3 dx=dFdx(-vViewPosition),dy=dFdy(-vViewPosition);
    vec3 r1=cross(dy,n),r2=cross(n,dx);
    float det=dot(dx,r1);
    vec3 gradient=(dFdx(height)*r1+dFdy(height)*r2)*sign(det)/max(abs(det),1e-8);
    gradient/=max(1.0,length(gradient)/1.4);
    return normalize(n-gradient);
  }
`;

export function createLandmarkMaterial(){
  const maps=acquireRockTextures();
  const material=new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.9,metalness:0});
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,{landmarkAlbedo:maps.albedo,landmarkNormal:maps.normal,landmarkRoughness:maps.roughness,landmarkMapsReady:maps.ready});
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
        vec3 warp=vec3(landmarkNoise(p*.031),landmarkNoise(p*.023+19.0),landmarkNoise(p*.037+37.0))*6.0;
        vec3 geology=p+warp;
        float strata=landmarkNoise(geology*vec3(.034,.32,.034))*.68
                    +landmarkNoise(geology*vec3(.065,.79,.065))*.32;
        landmarkWeather=landmarkNoise(p*.025+43.0);
        float mottling=landmarkNoise(geology*.24);
        float joint=abs(landmarkNoise(geology*vec3(.31,.18,.31))-.5);
        float antialias=max(fwidth(joint)*1.1,.001);
        // Short, interrupted joints; broad contour lines read as painted loops
        // on a giant face. Most fracture detail comes from the scanned stone.
        landmarkCrack=(1.0-smoothstep(.006-antialias,.018+antialias,joint))
                     *smoothstep(.42,.64,landmarkWeather)*smoothstep(.38,.65,mottling);
        float edge=(1.0-smoothstep(.015,.042+antialias,joint))*(1.0-landmarkCrack)*landmarkWeather;
        float distanceToFace=length(vViewPosition);
        landmarkFine=1.0-smoothstep(35.0,160.0,distanceToFace);
        landmarkP=p/8.5;landmarkFineP=(p+vec3(31.7,11.3,53.1))/1.1;
        vec3 plates=landmarkTri(landmarkAlbedo,landmarkP);
        vec3 grain=landmarkTri(landmarkAlbedo,landmarkFineP);
        // Retain the scanned fracture contrast instead of averaging it into a
        // stretched colour wash. Fine grain modulates it only near the surface.
        vec3 stone=pow(max(plates,vec3(.001)),vec3(1.16))*2.9;
        stone*=mix(vec3(1),clamp(grain*3.0,vec3(.62),vec3(1.4)),landmarkFine*.48);
        vec3 mineral=mix(vec3(.50,.55,.56),vec3(.73,.56,.39),vLandmarkSeed.x);
        float oxide=smoothstep(.46,.77,landmarkWeather)*smoothstep(.3,.62,strata);
        mineral=mix(mineral,vec3(.64,.39,.21),oxide*.56);
        float silicate=smoothstep(.61,.82,landmarkWeather+strata*.14);
        mineral=mix(mineral,vec3(.77,.73,.62),silicate*.6);
        float upper=smoothstep(.12,.76,geometricNormal.y);
        mineral=mix(mineral,vec3(.60,.58,.44),upper*smoothstep(.34,.68,mottling)*.32);
        float shelter=1.0-smoothstep(-.45,.05,geometricNormal.y);
        float weathering=(.64+.77*strata)*(.83+.29*mottling)*(1.0-landmarkCrack*.28);
        weathering*=1.0+edge*.08;
        weathering*=1.0-shelter*.16;
        diffuseColor.rgb*=mix(vec3(.49),stone,landmarkMapsReady)*mineral*weathering;
        landmarkHeight=(strata-.5)*.50+(mottling-.5)*.22-landmarkCrack*.08;
        landmarkHeight*=1.0-smoothstep(450.0,1500.0,distanceToFace);`)
      .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
        float scannedRoughness=landmarkTri(landmarkRoughness,landmarkP).r;
        roughnessFactor=mix(.9,clamp(scannedRoughness*.88+.08,.73,.98),landmarkMapsReady);
        roughnessFactor=mix(roughnessFactor,.97,clamp(landmarkCrack+landmarkWeather*.3,0.0,1.0));`)
      .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
        vec3 n=normalize(vLandmarkNormal);
        if(landmarkMapsReady>.5){
          vec3 gradient=landmarkGradient(landmarkP)*.95+landmarkGradient(landmarkFineP)*landmarkFine*.36;
          gradient-=n*dot(gradient,n);
          n=normalize(n+gradient*(1.0-smoothstep(400.0,1500.0,length(vViewPosition))));
        }
        normal=normalize(vLandmarkFrame*n);
        normal=landmarkReliefNormal(normal,landmarkHeight);`);
  };
  material.customProgramCacheKey=()=> 'aeon-landmark-pbr-v2';
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
        ${material.isMeshDepthMaterial?'if(dither>1.0-smoothstep(220.0,300.0,vLandmarkDistance))discard;':''}
        if(dither>1.0-smoothstep(9000.0,10000.0,vLandmarkDistance))discard;`);
  };
  material.customProgramCacheKey=()=>`${key}-landmark-lod-${level}`;
}
