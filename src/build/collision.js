import { getLocalColliders, sampleLocalSupport, getPieceDefinition, AUTHORED_BOUNDS } from './definitions.js';
export { getLocalColliders, sampleLocalSupport };
// A site tangent plane and curved planetary support can differ by micrometres.
// One millimetre absorbs that numerical discrepancy without granting tall steps.
const SUPPORT_EPSILON = .001;
/** Placement rotations are radians around local Y. Coordinates stay JS doubles. */
export function toPieceLocal(point, placement) {
  const p=placement.position??[placement.x??0,placement.y??0,placement.z??0];
  const angle=placement.rotation??0, c=Math.cos(angle),s=Math.sin(angle);
  const x=(point.x??point[0])-p[0],z=(point.z??point[2])-p[2];
  return [c*x-s*z,(point.y??point[1])-p[1],s*x+c*z];
}
export function getWorldBoxes(placement, doorOpen=placement.doorOpen??false) {
  const p=placement.position??[placement.x??0,placement.y??0,placement.z??0];
  const c=Math.cos(placement.rotation??0),s=Math.sin(placement.rotation??0);
  return getLocalColliders(placement,doorOpen).map(b=>{
    const pts=[];
    for(const x of [b.min[0],b.max[0]]) for(const z of [b.min[2],b.max[2]]) pts.push([p[0]+c*x+s*z,p[2]-s*x+c*z]);
    return {min:[Math.min(...pts.map(v=>v[0])),p[1]+b.min[1],Math.min(...pts.map(v=>v[1]))],max:[Math.max(...pts.map(v=>v[0])),p[1]+b.max[1],Math.max(...pts.map(v=>v[1]))],kind:b.kind,support:b.support};
  });
}
export function samplePieceSupport(placement,point) {
  const local=toPieceLocal(point,placement), h=sampleLocalSupport(placement,local[0],local[2]);
  return h===null?null:h+(placement.position?.[1]??placement.y??0);
}
export function capsuleIntersectsBox(feet,radius,height,b) {
  const x=feet.x??feet[0],y=feet.y??feet[1],z=feet.z??feet[2];
  if(y>=b.max[1]-SUPPORT_EPSILON || y+height<=b.min[1]+SUPPORT_EPSILON) return false;
  const dx=Math.max(b.min[0]-x,0,x-b.max[0]),dz=Math.max(b.min[2]-z,0,z-b.max[2]);
  return dx*dx+dz*dz<radius*radius;
}
/** Resolve a walking cylinder against the kit in the site's tangent frame.
 * Eye positions in/returned; caller supplies terrain floor and gravity motion.
 * Substeps prevent crossing a thin wall during a long frame. Axis separation
 * preserves sliding; stepping only accepts support reachable from prior feet.
 */
export function constrainBuildStep(previous, proposed, pieces, options={}) {
  const eyeHeight=options.eyeHeight??1.65,radius=options.radius??.28,height=options.height??1.8,step=options.stepHeight??.3;
  const arr=p=>Array.isArray(p)?[...p]:[p.x,p.y,p.z];
  const start=arr(previous),target=arr(proposed);let pos=[...start],hit=false,grounded=false;
  const boxes=pieces.flatMap(p=>getWorldBoxes(p));
  const count=Math.max(1,Math.ceil(Math.hypot(target[0]-start[0],target[2]-start[2])/.12));
  function supportAt(x,z,maxY,minY) {
    let best=null;
    // Radius-aware tread support avoids snagging a stair riser with the capsule.
    for(const p of pieces) for(const [dx,dz] of [[0,0],[radius,0],[-radius,0],[0,radius],[0,-radius]]) {
      const y=samplePieceSupport(p,[x+dx,0,z+dz]);
      if(y!==null && y<=maxY+SUPPORT_EPSILON && y>=minY-SUPPORT_EPSILON) best=Math.max(best??-Infinity,y);
    }
    return best;
  }
  const blocked=(p)=>boxes.some(b=>capsuleIntersectsBox([p[0],p[1]-eyeHeight,p[2]],radius,height,b));
  for(let i=0;i<count;i++) {
    const oldFeet=pos[1]-eyeHeight;
    const candidate=[pos[0]+(target[0]-start[0])/count,pos[1]+(target[1]-start[1])/count,pos[2]+(target[2]-start[2])/count];
    const support=supportAt(candidate[0],candidate[2],oldFeet+step,Math.min(oldFeet-step,candidate[1]-eyeHeight));
    if(support!==null && candidate[1]-eyeHeight<=support+step+SUPPORT_EPSILON && target[1]<=start[1]+SUPPORT_EPSILON) {candidate[1]=support+eyeHeight;grounded=true;}
    if(!blocked(candidate)) pos=candidate;
    else {
      hit=true;
      for(const axis of [0,2]) {
        const slide=[...pos];slide[axis]=candidate[axis];slide[1]=candidate[1];
        if(!blocked(slide))pos=slide;
      }
      const vertical=[pos[0],candidate[1],pos[2]];if(!blocked(vertical))pos=vertical;
    }
  }
  return {point:Array.isArray(previous)?pos:{x:pos[0],y:pos[1],z:pos[2]},hit,grounded};
}
export const pieceBoxes=getWorldBoxes;
export const supportAt=samplePieceSupport;

/** Reserve a manual leaf's complete linear travel, including both endpoints. */
export function getPlacementBoxes(placement) {
  const boxes=getWorldBoxes(placement,0);
  if(getPieceDefinition(placement)?.door) {
    const opened=getWorldBoxes(placement,1).filter(b=>b.kind==='door');
    const closed=boxes.filter(b=>b.kind==='door');
    closed.forEach((leaf,index)=>boxes.push({min:leaf.min.map((v,i)=>Math.min(v,opened[index].min[i])),max:leaf.max.map((v,i)=>Math.max(v,opened[index].max[i])),kind:'doorSweep'}));
  }
  return boxes;
}

/** Complete assembly envelope for claim/headroom checks, not a filled collider. */
export function getPlacementBounds(placement) {
  const def=getPieceDefinition(placement),b=AUTHORED_BOUNDS[def?.id];
  if(!b)return null;
  const p=placement.position??[placement.x??0,placement.y??0,placement.z??0];
  const c=Math.cos(placement.rotation??0),s=Math.sin(placement.rotation??0),pts=[];
  for(const x of [b.min[0],b.max[0]])for(const z of [b.min[2],b.max[2]])pts.push([p[0]+c*x+s*z,p[2]-s*x+c*z]);
  return {min:[Math.min(...pts.map(v=>v[0])),p[1]+b.min[1],Math.min(...pts.map(v=>v[1]))],max:[Math.max(...pts.map(v=>v[0])),p[1]+b.max[1],Math.max(...pts.map(v=>v[1]))]};
}
