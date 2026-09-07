import {Vector3,Quaternion,Matrix4} from 'three';
import {BODIES} from '../celestial.js';
import {SUN_POSITION} from '../stellar-world.js';
import {pyreFrameAt} from '../pyre-world.js';
import {getWorldBoxes} from './collision.js';
import {rayPrism} from './polygons.js';
export function powerEnvironment(claim,at=Date.now()){
 const body=BODIES.find(b=>b.id===claim.body);let center=new Vector3(...body.center),rotation=new Quaternion();
 if(claim.body==='pyre'){const f=pyreFrameAt(at);center.fromArray(f.position);rotation.setFromRotationMatrix(new Matrix4().makeBasis(new Vector3(...f.x),new Vector3(...f.y),new Vector3(...f.z)));}
 const anchor=claim.anchor,origin=anchor?new Vector3(...anchor.origin).applyQuaternion(rotation).add(center):new Vector3(...claim.origin),frame=anchor?rotation.clone().multiply(new Quaternion(...anchor.quaternion)):new Quaternion(...claim.quaternion);
 const direction=new Vector3(...SUN_POSITION).sub(origin).normalize().applyQuaternion(frame.invert());
 const radial=origin.clone().sub(center).normalize(),sun=new Vector3(...SUN_POSITION).sub(origin).normalize(),daylight=radial.dot(sun)>0;
 return {solar(piece){if(!daylight||direction.y<=0)return 0;const start=new Vector3(piece.position[0],piece.position[1]+1.2,piece.position[2]);
   if(claim.pieces.some(other=>other.id!==piece.id&&getWorldBoxes(other,other.doorOpen).some(box=>{const hit=rayPrism(start,direction,box);return hit!==null&&hit>.01&&hit<200;})))return 0;
   return direction.y;
  },wind(){if(body.airless||body.star)return 0;const phase=(anchor?.origin[0]??claim.origin[0])*.0001;return .35+.2*Math.sin(at/3600000*.2+phase);}};
}
