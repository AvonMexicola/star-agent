import * as THREE from 'three';

/** Each patch owns its maps and material; Three refreshes sampler bindings when
 * material IDs change, while every patch reuses the same compiled program. */
export function patchSurfaceMaterial(base,field) {
  const texture=(data,colorSpace)=>{
    const map=new THREE.DataTexture(data,field.width,field.width);
    map.colorSpace=colorSpace;map.minFilter=THREE.LinearMipmapLinearFilter;map.magFilter=THREE.LinearFilter;
    map.generateMipmaps=true;map.needsUpdate=true;return map;
  };
  const material=base.clone();
  material.color=base.color;
  material.onBeforeCompile=base.onBeforeCompile;material.customProgramCacheKey=base.customProgramCacheKey;
  material.vertexColors=false;
  material.map=texture(field.color,THREE.SRGBColorSpace);
  material.normalMap=texture(field.normal,THREE.NoColorSpace);
  material.normalMapType=THREE.ObjectSpaceNormalMap;
  material.addEventListener('dispose',()=>{material.map.dispose();material.normalMap.dispose();});
  return material;
}

export function patchSurfaceUV(grid,width) {
  const count=(grid+1)**2+4*(grid+1),uv=new Float32Array(count*2);
  const write=(index,x,y)=>{uv[index*2]=(.5+x/grid*(width-1))/width;uv[index*2+1]=(.5+y/grid*(width-1))/width;};
  for(let y=0;y<=grid;y++)for(let x=0;x<=grid;x++)write(y*(grid+1)+x,x,y);
  let index=(grid+1)**2;
  for(let i=0;i<=grid;i++)write(index++,i,0);
  for(let i=0;i<=grid;i++)write(index++,grid,i);
  for(let i=0;i<=grid;i++)write(index++,grid-i,grid);
  for(let i=0;i<=grid;i++)write(index++,0,grid-i);
  return uv;
}
