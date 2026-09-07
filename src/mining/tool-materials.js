import * as THREE from 'three';

// Packed tile: worn paint, brushed grain and roughness. Triplanar sampling keeps
// the Blender kit's separate panels/grips readable without stretching their UVs.
export function createToolTexture(){
  const size=128,data=new Uint8Array(size*size*4);
  const hash=(x,y)=>{let n=Math.imul(x+13,374761393)^Math.imul(y+41,668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;};
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const grit=hash(x,y),scratch=hash(x,Math.floor(y/32))>.977&&grit>.25;
    data.set([scratch?55:Math.round(180+grit*75),Math.round(80+hash(x,0)*130),Math.round(145+grit*70),255],(x+y*size)*4);
  }
  const t=new THREE.DataTexture(data,size,size);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.needsUpdate=true;return t;
}
export function textureMiningTool(root){
  if(root.userData.disposeMiningTexture)return root.userData.disposeMiningTexture;
  const texture=createToolTexture(),materials=new Map();
  root.traverse(node=>{if(!node.isMesh)return;
    const prepare=source=>{
      if(materials.has(source))return materials.get(source);
      const material=source.clone();materials.set(source,material);
      if(['Mint','Amber','Glass'].includes(material.name))return material;
      if(material.name==='White'){material.color.setRGB(.30,.37,.39);material.roughness=.68;}
      if(material.name==='Metal'){material.color.setRGB(.28,.32,.34);material.metalness=.65;material.roughness=.48;}
      const rubber=material.name==='Rubber';
      material.onBeforeCompile=shader=>{
        shader.uniforms.toolWear={value:texture};
        shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vToolPoint;varying vec3 vToolNormal;')
          .replace('#include <begin_vertex>','#include <begin_vertex>\nvToolPoint=position;vToolNormal=normal;');
        shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D toolWear;varying vec3 vToolPoint;varying vec3 vToolNormal;')
          .replace('#include <color_fragment>',`#include <color_fragment>
            vec3 weights=pow(abs(normalize(vToolNormal)),vec3(4.0));weights/=max(dot(weights,vec3(1)),.001);
            vec3 p=vToolPoint*8.0;
            vec3 wear=texture2D(toolWear,p.yz).rgb*weights.x+texture2D(toolWear,p.zx).rgb*weights.y+texture2D(toolWear,p.xy).rgb*weights.z;
            diffuseColor.rgb*=.55+wear.r*.50;
            ${rubber?'diffuseColor.rgb*=.65+.35*smoothstep(-.3,.3,sin(vToolPoint.x*280.0));':''}
            ${material.name==='White'?'float stripe=step(.5,fract((vToolPoint.x+vToolPoint.y)*28.0));float label=step(.04,vToolPoint.y)*step(vToolPoint.y,.085);diffuseColor.rgb=mix(diffuseColor.rgb,mix(vec3(.035),vec3(.9,.43,.045),stripe),label);':''}`)
          .replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor*(.75+wear.b*.5),.25,1.0);')
          .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
            vec3 q0=dFdx(-vViewPosition),q1=dFdy(-vViewPosition),r0=cross(q1,normal),r1=cross(normal,q0);
            float det=dot(q0,r0),relief=wear.g*.00035;
            if(abs(det)>1e-12)normal=normalize(abs(det)*normal-sign(det)*(dFdx(relief)*r0+dFdy(relief)*r1));`);
      };
      material.customProgramCacheKey=()=>`mining-wear-v1-${material.name}`;material.userData.toolTexture=texture;return material;
    };
    node.material=Array.isArray(node.material)?node.material.map(prepare):prepare(node.material);
  });
  root.userData.texturedMiningTool=true;
  let disposed=false;
  const dispose=()=>{if(disposed)return;disposed=true;texture.dispose();for(const material of materials.values())material.dispose();};
  // Instance materials/texture are owned here; shared GLTF geometry is untouched.
  root.userData.disposeMiningTexture=dispose;
  return dispose;
}
