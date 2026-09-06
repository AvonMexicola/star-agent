import { generatePyrePatch } from './pyre-terrain.js';
import { MIASMA_TERRAIN, bakeMiasmaMaps } from './miasma-world.js';
self.onmessage=({data})=>{
  try {
    if(data.type==='maps'){
      const maps=bakeMiasmaMaps();self.postMessage({id:data.id,type:'maps',...maps},[maps.data.buffer,maps.color.buffer,maps.normal.buffer]);return;
    }
    const patch=generatePyrePatch(data,MIASMA_TERRAIN);
    self.postMessage({id:data.id,type:'patch',...patch},[patch.positions.buffer,patch.normals.buffer,patch.directions.buffer,patch.points.buffer,patch.colors.buffer,patch.data.buffer,patch.indices.buffer,...(patch.field?[patch.field.color.buffer,patch.field.normal.buffer]:[])]);
  }catch(error){self.postMessage({id:data.id,type:data.type,error:String(error)});}
};
