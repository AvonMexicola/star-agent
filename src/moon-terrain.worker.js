import { generateMoonPatch } from './moon-patch.js';

self.onmessage=({data})=>{
  try{
    const patch=generateMoonPatch(data);
    const transfer=[patch.positions,patch.normals,patch.directions,patch.points,patch.colors,patch.surface,patch.rockReliefs,patch.indices];
    if(patch.field)transfer.push(patch.field.color,patch.field.normal);
    self.postMessage({id:data.id,...patch},transfer.map(array=>array.buffer));
  }catch(error){self.postMessage({id:data.id,error:String(error)});}
};
