import { generatePatch } from './world.js';
import { setPlanetSeed } from './generation.js';
self.onmessage=({data})=>{
  try {
    setPlanetSeed(data.seed);
    const patch=generatePatch(data);
    self.postMessage({id:data.id,...patch},[patch.positions.buffer,patch.normals.buffer,patch.colors.buffer,patch.directions.buffer,patch.waterPositions.buffer,patch.heights.buffer,patch.indices.buffer,...(patch.field?[patch.field.color.buffer,patch.field.normal.buffer]:[])]);
  } catch(error){self.postMessage({id:data.id,error:String(error)});}
};
