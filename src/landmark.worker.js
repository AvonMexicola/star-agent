import {createLandmarkGeometry} from './landmark-geometry.js';
self.onmessage=({data:{variant}})=>{
  for(const lod of [2,1,0]){
    const geometry=createLandmarkGeometry(variant,lod),positions=geometry.attributes.position.array,normals=geometry.attributes.normal.array,colors=geometry.attributes.color.array;
    self.postMessage({variant,lod,positions,normals,colors},[positions.buffer,normals.buffer,colors.buffer]);geometry.dispose();
  }
};
