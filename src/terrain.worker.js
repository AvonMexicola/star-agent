import { generatePatch } from './world.js';
import { setPlanetSeed } from './generation.js';
self.onmessage=({data})=>{
  try {
    setPlanetSeed(data.seed);
    const patch=generatePatch(data);
    self.postMessage({id:data.id,...patch},[patch.positions.buffer,patch.normals.buffer,patch.colors.buffer,patch.directions.buffer,patch.waterPositions.buffer,patch.heights.buffer,patch.parentPositions.buffer,patch.parentWaterPositions.buffer,patch.parentNormals.buffer,patch.parentColors.buffer,patch.parentHeights.buffer,patch.indices.buffer]);
  } catch(error){self.postMessage({id:data.id,error:String(error)});}
};
