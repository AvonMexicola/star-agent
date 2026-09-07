import {Matrix4,Quaternion,Vector3} from 'three';
import {BODIES} from '../celestial.js';
import {PYRE_EPOCH,pyreFrameAt} from '../pyre-world.js';

const vector=(value,n)=>Array.isArray(value)&&value.length===n&&value.every(Number.isFinite);
const validQuaternion=value=>vector(value,4)&&Math.abs(Math.hypot(...value)-1)<1e-5;
function frameFor(bodyId,epoch){
 const body=BODIES.find(body=>body.id===bodyId);if(!body)throw Error('Unknown anchored body.');
 if(bodyId!=='pyre')return {body,center:new Vector3(...body.center),rotation:new Quaternion()};
 if(!Number.isFinite(epoch)||epoch<0)throw Error('A known Pyre epoch is required.');
 const frame=pyreFrameAt(epoch),rotation=new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(new Vector3(...frame.x),new Vector3(...frame.y),new Vector3(...frame.z)));
 return {body,center:new Vector3(...frame.position),rotation};
}
export function validClaimAnchor(claim){
 const a=claim?.anchor,body=BODIES.find(body=>body.id===claim?.body);
 return Boolean(body&&a?.version===1&&a.body===claim.body&&vector(a.origin,3)&&validQuaternion(a.quaternion)
  &&Math.hypot(...a.origin)>=body.radius-20000&&Math.hypot(...a.origin)<=body.radius+50000);
}
/** Store the claim's immutable body-fixed frame. Local piece transforms already
 * live in this claim frame and require no changes when the planet moves. */
export function withClaimAnchor(claim,{epoch=PYRE_EPOCH}={}){
 if(!vector(claim?.origin,3)||!validQuaternion(claim?.quaternion))throw Error('Invalid claim frame.');
 const {center,rotation}=frameFor(claim.body,epoch),inverse=rotation.clone().invert();
 const anchored={...claim,anchor:{version:1,body:claim.body,
  origin:new Vector3(...claim.origin).sub(center).applyQuaternion(inverse).toArray(),
  quaternion:claim.body==='pyre'?inverse.multiply(new Quaternion(...claim.quaternion)).normalize().toArray():[...claim.quaternion]}};
 if(!validClaimAnchor(anchored))throw Error('Claim anchor is outside its body.');
 return anchored;
}
/** One-time load materialization, before BuildSystem validates current frames.
 * No disk writes and no input mutations. Unknown historical Pyre coordinates
 * cannot safely be interpreted using today's orbital position. */
export function restoreBuildAnchors(build,{epoch=PYRE_EPOCH,legacyPyreEpoch}={}){
 if(build===undefined)return {ok:true,build};
 if(!build||!Array.isArray(build.claims))return {ok:false,build,message:'Invalid base anchor registry. Original save retained.'};
 try{
  const claims=build.claims.map(claim=>{
   let anchored=claim;
   if(claim.anchor===undefined){
    const originalEpoch=claim.epoch??legacyPyreEpoch;
    if(claim.body==='pyre'&&!Number.isFinite(originalEpoch))throw Error('Old Pyre base has no known orbital epoch. Original save retained.');
    anchored=withClaimAnchor(claim,{epoch:claim.body==='pyre'?originalEpoch:epoch});
   }
   if(!validClaimAnchor(anchored))throw Error('Invalid body-fixed base anchor. Original save retained.');
   const {center,rotation}=frameFor(anchored.body,epoch),a=anchored.anchor;
   return {...anchored,
    origin:new Vector3(...a.origin).applyQuaternion(rotation).add(center).toArray(),
    quaternion:anchored.body==='pyre'?rotation.multiply(new Quaternion(...a.quaternion)).normalize().toArray():[...a.quaternion]};
  });
  return {ok:true,build:{...build,claims}};
 }catch(error){return {ok:false,build,message:error.message};}
}
