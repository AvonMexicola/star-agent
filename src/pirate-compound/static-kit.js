import {InstancedMesh,Matrix4} from 'three';

const TYPES=new Set(['wall','floor','roof-flat','foundation-ramp']);
/** Readonly repeated kit pieces share draws. Collision remains the original kit.
 * Instance transforms are assembled in each claim's local metre frame. */
export class PirateStaticKit {
 constructor(buildings){this.buildings=buildings;this.batches=new Map();}
 update(){
  for(const [id,entry] of this.batches)if(this.buildings.groups.get(id)!==entry.group){this.remove(entry);this.batches.delete(id);}
  for(const claim of this.buildings.claims){
   if(this.batches.has(claim.id))continue;
   const group=this.buildings.groups.get(claim.id),pieces=claim.pieces.filter(p=>TYPES.has(p.type));
   if(!group||!pieces.every(p=>this.buildings.models.get(p.id)?.ready))continue;
   const bins=new Map();
   for(const piece of pieces)this.buildings.models.get(piece.id).group.traverse(mesh=>{
    if(!mesh.isMesh||!mesh.visible||Array.isArray(mesh.material)||mesh.material.transparent)return;
    const key=[mesh.geometry.uuid,mesh.material.name,mesh.castShadow,mesh.receiveShadow].join('/');
    const bin=bins.get(key)??[];bin.push(mesh);bins.set(key,bin);
   });
   const entry={group,instances:[],originals:[]};
   for(const meshes of bins.values()){
    if(meshes.length<2)continue;
    const first=meshes[0],batch=new InstancedMesh(first.geometry,first.material,meshes.length);
    batch.name=`Hush static ${first.name}`;batch.castShadow=first.castShadow;batch.receiveShadow=first.receiveShadow;
    meshes.forEach((mesh,i)=>{
     const matrix=new Matrix4();let node=mesh;
     while(node!==group){node.updateMatrix();matrix.premultiply(node.matrix);node=node.parent;}
     batch.setMatrixAt(i,matrix);entry.originals.push(mesh);mesh.visible=false;
    });
    batch.instanceMatrix.needsUpdate=true;batch.computeBoundingBox();batch.computeBoundingSphere();group.add(batch);entry.instances.push(batch);
   }
   this.batches.set(claim.id,entry);
  }
 }
 remove(entry){for(const mesh of entry.originals)mesh.visible=true;for(const mesh of entry.instances){mesh.removeFromParent();mesh.dispose();}}
 get state(){return {originalDraws:[...this.batches.values()].reduce((n,e)=>n+e.originals.length,0),instancedDraws:[...this.batches.values()].reduce((n,e)=>n+e.instances.length,0)};}
 dispose(){for(const entry of this.batches.values())this.remove(entry);this.batches.clear();}
}
