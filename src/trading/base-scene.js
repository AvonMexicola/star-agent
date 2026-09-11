import { Group,Vector3 } from 'three';
import { createBuildVisual,disposeBuildVisual,setDoorOpen } from '../build/visuals.js';
import { baseGeometry,materializeBase } from './base-site.js';
/** Immutable commissioned layouts, streamed near the player. Local bases already
 * use BuildSystem's renderer. All shared collision uses that same implementation. */
export function createBaseScene(scene,nav,getTerminals){
  const models=new Map();let disposed=false;
  function nearby(point=nav.position){return getTerminals().filter(t=>t.base?.shared&&t.base.claim.pieces.length&&new Vector3(...t.base.claim.origin).distanceTo(point)<20000);}
  const geometries=()=>nearby().map(t=>baseGeometry(materializeBase(t),nav));
  return {
    update(origin){
      if(!scene)return;const alive=new Set();
      for(const t of nearby()){
        alive.add(t.id);const claim=materializeBase(t);let entry=models.get(t.id);
        if(!entry){const root=new Group();root.name=claim.name;entry={root,alive:true};models.set(t.id,entry);scene.add(root);
          for(const p of claim.pieces)createBuildVisual(p).then(model=>{if(disposed||!entry.alive){disposeBuildVisual(model);return;}model.position.fromArray(p.position);model.rotation.y=p.rotation;setDoorOpen(model,Number(p.doorOpen));root.add(model);}).catch(e=>{root.userData.error=e.message;console.error('Shared base asset failed to load',e);});
        }
        entry.root.position.fromArray(claim.origin).sub(origin);entry.root.quaternion.fromArray(claim.quaternion);
      }
      for(const [id,entry]of models)if(!alive.has(id)){entry.alive=false;for(const child of [...entry.root.children])disposeBuildVisual(child);entry.root.removeFromParent();models.delete(id);}
    },
    constrain(a,b){let point=b,hit=false,grounded=false;for(const g of geometries()){const r=g.constrainWalker(a,point);point=r.point;hit||=r.hit;grounded||=r.grounded;}return {point,hit,grounded};},
    landingSurface(pose){for(const g of geometries()){const hit=g.landingSurface(pose);if(hit)return hit;}return null;},
    raycast(start,direction,range,envelope){let nearest=null;for(const g of geometries()){const hit=g.raycast(start,direction,range,envelope);if(hit&&(!nearest||hit.distance<nearest.distance))nearest=hit;}return nearest;},
    dispose(){disposed=true;for(const entry of models.values()){entry.alive=false;for(const child of [...entry.root.children])disposeBuildVisual(child);entry.root.removeFromParent();}models.clear();},
  };
}
