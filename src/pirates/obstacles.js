/** Read the existing excavation/stone colliders without changing mining aim or
 * the player's last grounded contact. NPCs use the same standing capsule. */
export function createPirateNaturalObstacles(mining){
 const rocks=()=>[mining.ground,mining.surfaceRock,...mining.regionalRocks.values(),mining.fieldCache].filter(Boolean);
 return {
  raycast(start,direction,range){
   const exclude=new Set([...mining.regionalRocks].filter(([,r])=>r.ready).map(([id])=>id));
   return [mining.readyRaycast(start,direction,range),mining.fieldCache.raycast(start,direction,range),mining.stones.raycast(start,direction,range,exclude),mining.landmarks?.raycast(start,direction,range)]
    .filter(Boolean).sort((a,b)=>a.distance-b.distance)[0]??null;
  },
  canWalk(start,end){
   const contacts=[...rocks(),mining.landmarks].filter(Boolean).map(object=>[object,object.grounded]);
   try{
    const rock=mining.constrainWalker(start,end);
    const landmark=mining.landmarks?.constrain(start,rock.point,{radius:.3,height:1.85});
    return !(rock.hit||landmark?.hit);
   }finally{for(const [object,grounded] of contacts)object.grounded=grounded;}
  },
 };
}
