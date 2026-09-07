import * as THREE from 'three';
import { bodyAt, bodyAltitude, bodySurfacePoint } from '../celestial.js';
export const POST_COST=500;
export const PAD_HALF=18;
export const PAD_HEIGHT=.25;
/** Centre on canonical terrain. Validate all pad corners/edges, never a second floor. */
export function tradeSite(position,forward){
  const body=bodyAt(position),alt=bodyAltitude(position,body);
  if(!['aeon','selene','pyre','miasma'].includes(body.id)||alt>6||alt<1)throw new Error('Stand on a planetary surface to build a trading pad.');
  const up=position.clone().sub(new THREE.Vector3(...body.center)).normalize(),z=forward.clone().projectOnPlane(up).normalize().negate();
  if(z.lengthSq()<.5)throw new Error('Look across the surface.');
  const x=new THREE.Vector3().crossVectors(up,z).normalize(),rotation=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,up,z));
  // Pad ahead, terminal reachable behind its near edge. Nomad or Atlas fits the36m pad.
  const centre=position.clone().addScaledVector(z,-22),radial=centre.clone().sub(new THREE.Vector3(...body.center)).normalize();
  centre.copy(bodySurfacePoint(radial,body,0));
  let low=Infinity,high=-Infinity;
  for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){
    const p=new THREE.Vector3(i*PAD_HALF,0,j*PAD_HALF).applyQuaternion(rotation).add(centre);
    const h=bodySurfacePoint(p.clone().sub(new THREE.Vector3(...body.center)).normalize(),body,0).sub(centre).dot(up);low=Math.min(low,h);high=Math.max(high,h);
  }
  if(high-low>.65)throw new Error('Find flatter ground for the landing pad (less than 65 cm variation).');
  centre.addScaledVector(up,high+.05);
  const terminal=new THREE.Vector3(0,PAD_HEIGHT,16).applyQuaternion(rotation).add(centre);
  return {body:body.id,origin:centre.toArray(),quaternion:rotation.toArray(),position:terminal.toArray()};
}
export function onTradePad(shipPosition,terminal){
  if(!terminal?.origin||!shipPosition)return false;
  const p=shipPosition.clone().sub(new THREE.Vector3(...terminal.origin)).applyQuaternion(new THREE.Quaternion(...terminal.quaternion).invert());
  return Math.abs(p.x)<=8&&Math.abs(p.z)<=2&&p.y>=-.1&&p.y<1;
}
