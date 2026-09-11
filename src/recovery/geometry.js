import {Vector3,Quaternion,Box3,Ray} from 'three';
import {FreighterSystems} from '../freighter-layout.js';
const v=a=>new Vector3(...a);
export function disabledAtlasSystems(){
  const systems=new FreighterSystems();systems.reset({gearProgress:0});
  for(const ramp of systems.ramps){systems.setRampOpenAngle(ramp.id,0);ramp.angle=ramp.target=0;ramp.tipAngle=0;ramp.moving=false;}
  systems.applyTransforms();return systems;
}
export function wreckParts(systems){
  return [...systems.evaParts,...systems.ramps.map(r=>({min:[-r.width/2,r.pivot[1]-.22,Math.min(r.pivot[2],r.pivot[2]+r.outward*r.length)],max:[r.width/2,r.pivot[1],Math.max(r.pivot[2],r.pivot[2]+r.outward*r.length)]}))];
}
/** Ray or full oriented-envelope sweep against the canonical open hull. */
export function wreckRaycast(start,direction,range,pose,parts,envelope=null){
  const inverse=pose.quaternion.clone().invert(),a=start.clone().sub(pose.position).applyQuaternion(inverse),d=direction.clone().applyQuaternion(inverse);
  const expansion=new Box3(v([0,0,0]),v([0,0,0]));
  if(envelope){expansion.makeEmpty();const q=inverse.clone().multiply(envelope.orientation??new Quaternion());for(let i=0;i<8;i++)expansion.expandByPoint(new Vector3(...envelope.min.map((n,k)=>i&(1<<k)?envelope.max[k]:n)).applyQuaternion(q));}
  const ray=new Ray(a,d);let best=null;
  for(const part of parts){const box=new Box3(v(part.min).sub(expansion.max),v(part.max).sub(expansion.min)),point=box.containsPoint(a)?a.clone():ray.intersectBox(box,new Vector3());if(!point)continue;const distance=point.distanceTo(a);if(distance>range||best&&distance>=best.distance)continue;
    const normal=d.clone().negate();best={distance,point:point.clone().applyQuaternion(pose.quaternion).add(pose.position),normal:normal.applyQuaternion(pose.quaternion)};
  }
  return best;
}
