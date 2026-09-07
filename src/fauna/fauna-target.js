import * as THREE from 'three';

/** Conservative footprint for movement; attack rays remain unexpanded. */
export function faunaMovementBounds(entity,size,eyeHeight=.65){
  return {radius:Math.hypot(size.width/2,size.length/2),envelope:{
    min:[-size.width/2,-eyeHeight,-size.length/2],
    max:[size.width/2,size.height-eyeHeight,size.length/2],orientation:faunaOrientation(entity),
  }};
}

/** Metre-scale math is performed after subtracting the double-precision anchor. */
export function faunaOrientation(entity){
  const up=new THREE.Vector3(...entity.normal).normalize();
  const reference=Math.abs(up.y)>.9?new THREE.Vector3(1,0,0):new THREE.Vector3(0,1,0);
  const right=new THREE.Vector3().crossVectors(reference,up).normalize();
  const back=new THREE.Vector3().crossVectors(right,up).normalize();
  if(entity.forward){back.fromArray(entity.forward).negate().projectOnPlane(up).normalize();right.crossVectors(up,back).normalize();}
  const q=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,back));
  return entity.forward?q:q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),entity.heading??0));
}

/** A torso hurt volume, independent of render LOD and animation skin uploads. */
export function raycastFauna(entities,start,direction,range,dimensions){
  let hit=null;
  for(const entity of entities){
    if(entity.health<=0)continue;
    const size=dimensions[entity.species];if(!size)continue;
    const q=faunaOrientation(entity),inverse=q.clone().invert();
    const center=new THREE.Vector3(...entity.position);
    const local=start.clone().sub(center).applyQuaternion(inverse);
    local.y-=size.height*.5;
    const radii=new THREE.Vector3(size.width*.43,size.height*.49,size.length*.43);
    const p=local.clone().divide(radii),d=direction.clone().applyQuaternion(inverse).divide(radii);
    const a=d.dot(d),b=p.dot(d),c=p.dot(p)-1,disc=b*b-a*c;
    if(a<=0||disc<0)continue;
    const near=(-b-Math.sqrt(disc))/a,far=(-b+Math.sqrt(disc))/a;
    const distance=near>=0?near:far;if(distance<0||distance>range||distance>=(hit?.distance??Infinity))continue;
    const normal=local.addScaledVector(direction.clone().applyQuaternion(inverse),distance).divide(radii).divide(radii).normalize().applyQuaternion(q);
    hit={kind:'fauna',id:entity.id,species:entity.species,distance,point:start.clone().addScaledVector(direction,distance),normal};
  }
  return hit;
}

/** Parked hull blocker shares Navigation's physical ship bounds. */
export function parkedShipHit(nav,start,direction,range,padding=0){
  if(!nav.shipPosition||!nav.layout?.flightBounds)return null;
  const inverse=nav.shipOrientation.clone().invert();
  const ray=new THREE.Ray(start.clone().sub(nav.shipPosition).applyQuaternion(inverse),direction.clone().applyQuaternion(inverse));
  const box=new THREE.Box3(new THREE.Vector3(...nav.layout.flightBounds.min),new THREE.Vector3(...nav.layout.flightBounds.max)).expandByScalar(padding);
  const point=box.containsPoint(ray.origin)?ray.origin.clone():ray.intersectBox(box,new THREE.Vector3());
  if(!point)return null;
  const distance=point.distanceTo(ray.origin);if(distance>range)return null;
  const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3()).multiplyScalar(.5),n=point.clone().sub(center).divide(size);
  const axis=['x','y','z'].sort((a,b)=>Math.abs(n[b])-Math.abs(n[a]))[0],normal=new THREE.Vector3();normal[axis]=Math.sign(n[axis]);normal.applyQuaternion(nav.shipOrientation);
  return {distance,point:point.applyQuaternion(nav.shipOrientation).add(nav.shipPosition),normal};
}
