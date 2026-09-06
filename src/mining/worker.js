import { carve, meshVolume, encodeDensity } from './volume.js';
import { RockCollision } from './collision.js';
self.onmessage=({data})=>{
  try{
    const start=performance.now(),result=data.point?carve(data.field,data.point,data.budget,.48,data.resourceWeights):{field:data.field,removed:0,yieldVolume:[0,0,0]};
    if(!result){self.postMessage({id:data.id,empty:true});return;}
    const mesh=meshVolume(result.field,data.resourceWeights),collision=new RockCollision(mesh.positions).pack(),encodedField=encodeDensity(result.field);
    self.postMessage({id:data.id,...result,...mesh,collision,encodedField,meshMs:performance.now()-start},[result.field.buffer,mesh.positions.buffer,mesh.normals.buffer,mesh.colors.buffer,collision.nodes.buffer,collision.indices.buffer]);
  }catch(error){self.postMessage({id:data.id,error:error.message});}
};
