import { carve, meshVolume } from './volume.js';
self.onmessage=({data})=>{
  try{
    const start=performance.now(),result=data.point?carve(data.field,data.point,data.budget):{field:data.field,removed:0,yieldVolume:[0,0,0]};
    if(!result){self.postMessage({id:data.id,empty:true});return;}
    const mesh=meshVolume(result.field);
    self.postMessage({id:data.id,...result,...mesh,meshMs:performance.now()-start},[result.field.buffer,mesh.positions.buffer,mesh.normals.buffer,mesh.colors.buffer]);
  }catch(error){self.postMessage({id:data.id,error:error.message});}
};
