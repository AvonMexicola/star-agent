import { toInertial, fromInertial, planetRotation, rotationFrameAt } from '../src/planet-rotation.js';
/** Peer contact in authoritative world doubles. Existing Navigation still owns
 * terrain/station collision; these hulls come from its canonical flight bounds. */
import * as THREE from 'three';
import {SHIP_LAYOUT} from '../src/boarding.js';
import {shipPose,playerUp} from './combat.js';

export const RAM_SAFE_SPEED = 3; // metres/second of closing motion
const EPS = 1e-7, SKIN = .002;
const AXES = [new THREE.Vector3(1,0,0),new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1)];
const healthy = p => p.health > 0 && p.shipHealth > 0;
const lerpPose = (a,b,t) => ({position:a.position.clone().lerp(b.position,t),rotation:a.rotation.clone().slerp(b.rotation,t),bounds:a.bounds});
const radiusOf = bounds => Math.hypot(...bounds.min.map((v,i)=>Math.max(Math.abs(v),Math.abs(bounds.max[i]))));
function closeSweep(a0,a1,b0,b1,radius) {
  const offset=b0.clone().sub(a0),delta=b1.clone().sub(b0).sub(a1.clone().sub(a0));
  const t=delta.lengthSq()>EPS?THREE.MathUtils.clamp(-offset.dot(delta)/delta.lengthSq(),0,1):0;
  return offset.addScaledVector(delta,t).lengthSq()<=radius*radius;
}

function box(pose,padding = 0) {
  const min = new THREE.Vector3().fromArray(pose.bounds.min), max = new THREE.Vector3().fromArray(pose.bounds.max);
  return {center:min.clone().add(max).multiplyScalar(.5).applyQuaternion(pose.rotation).add(pose.position),
    half:max.sub(min).multiplyScalar(.5).addScalar(padding),axes:AXES.map(axis => axis.clone().applyQuaternion(pose.rotation))};
}
const projection = (shape,axis) => shape.axes.reduce((sum,a,i) => sum+Math.abs(a.dot(axis))*shape.half.getComponent(i),0);

/** Continuous SAT for two translated OBBs with a fixed attitude. */
export function sweptBoxes(a0,a1,b0,b1,padding = 0) {
  const a = box(a0,padding), b = box(b0,padding), aa = box(a1,padding), bb = box(b1,padding);
  const offset = b.center.clone().sub(a.center), delta = aa.center.clone().sub(a.center).sub(bb.center.clone().sub(b.center));
  const axes = [...a.axes,...b.axes,...a.axes.flatMap(x => b.axes.map(y => x.clone().cross(y)))];
  let enter = 0, exit = 1, normal = null, overlapping = true, shallow = Infinity;
  for (const raw of axes) {
    if (raw.lengthSq()<EPS*EPS) continue;
    const axis = raw.clone().normalize(), extent = projection(a,axis)+projection(b,axis);
    const separation = offset.dot(axis), speed = delta.dot(axis), penetration = extent-Math.abs(separation);
    if (penetration < 0) overlapping = false;
    if (penetration < shallow) { shallow = penetration; if (enter === 0) normal = axis.clone().multiplyScalar(separation < 0 ? -1 : 1); }
    if (Math.abs(speed) < EPS) { if (Math.abs(separation)>extent) return null; continue; }
    let near = (separation-extent)/speed, far = (separation+extent)/speed;
    if (near>far) [near,far] = [far,near];
    if (near>enter) { enter=near; normal=axis.clone().multiplyScalar(separation-speed*near < 0 ? -1 : 1); }
    exit=Math.min(exit,far);
    if (enter>exit || exit<0 || enter>1) return null;
  }
  return {time:Math.max(0,enter),normal:normal ?? new THREE.Vector3(1,0,0),initialOverlap:overlapping};
}

const BOX_EDGES=Array.from({length:8},(_,i)=>[0,1,2].filter(axis=>!(i&(1<<axis))).map(axis=>[i,i|(1<<axis)])).flat();
function corners(shape){return Array.from({length:8},(_,i)=>shape.axes.reduce((p,axis,k)=>p.addScaledVector(axis,shape.half.getComponent(k)*(i&(1<<k)?1:-1)),shape.center.clone()));}
function closestOnBox(shape,point){
  const local=point.clone().sub(shape.center),result=shape.center.clone();
  shape.axes.forEach((axis,i)=>result.addScaledVector(axis,THREE.MathUtils.clamp(local.dot(axis),-shape.half.getComponent(i),shape.half.getComponent(i))));
  return result;
}
function closestSegments(a,b,c,d){
  const u=b.clone().sub(a),v=d.clone().sub(c),w=a.clone().sub(c);
  const aa=u.lengthSq(),bb=u.dot(v),cc=v.lengthSq(),dd=u.dot(w),ee=v.dot(w);
  let s=0,t=0;
  if(aa<EPS*EPS)t=cc<EPS*EPS?0:THREE.MathUtils.clamp(ee/cc,0,1);
  else if(cc<EPS*EPS)s=THREE.MathUtils.clamp(-dd/aa,0,1);
  else{
    const denominator=aa*cc-bb*bb;
    s=denominator>EPS*EPS?THREE.MathUtils.clamp((bb*ee-cc*dd)/denominator,0,1):0;
    t=(bb*s+ee)/cc;
    if(t<0){t=0;s=THREE.MathUtils.clamp(-dd/aa,0,1);}
    else if(t>1){t=1;s=THREE.MathUtils.clamp((bb-dd)/aa,0,1);}
  }
  return [a.clone().addScaledVector(u,s),c.clone().addScaledVector(v,t)];
}
function segmentInBox(start,end,shape){
  const offset=start.clone().sub(shape.center),delta=end.clone().sub(start);let lo=0,hi=1;
  for(let i=0;i<3;i++){
    const position=offset.dot(shape.axes[i]),speed=delta.dot(shape.axes[i]),half=shape.half.getComponent(i);
    if(Math.abs(speed)<EPS){if(Math.abs(position)>half)return [];continue;}
    let enter=(-half-position)/speed,exit=(half-position)/speed;if(enter>exit)[enter,exit]=[exit,enter];
    lo=Math.max(lo,enter);hi=Math.min(hi,exit);if(lo>hi)return [];
  }
  return [start.clone().addScaledVector(delta,lo),start.clone().addScaledVector(delta,hi)];
}

/** Exact convex-box separation: closest features are vertex/face or edge/edge.
 * Subtract a world origin before producing corners; contact offsets remain
 * small world-oriented doubles even at stellar coordinates. */
export function boxSeparation(aPose,bPose,padding=0){
  const offset=bPose.position.clone().sub(aPose.position);
  const localA={...aPose,position:new THREE.Vector3()},localB={...bPose,position:offset};
  const a=box(localA,padding),b=box(localB,padding);
  const av=corners(a),bv=corners(b);let best=Infinity,pointA,pointB;
  const overlap=sweptBoxes(localA,localA,localB,localB,padding);
  if(overlap?.initialOverlap){
    // Intersecting slabs can have only edge/face crossings: neither contained
    // vertices nor touching edge pairs. SAT owns overlap; clipped edges supply
    // a point in the shared convex volume for both contact velocity offsets.
    const intersection=[];
    for(const [lo,hi] of BOX_EDGES){intersection.push(...segmentInBox(av[lo],av[hi],b),...segmentInBox(bv[lo],bv[hi],a));}
    const contact=intersection.reduce((sum,point)=>sum.add(point),new THREE.Vector3()).divideScalar(intersection.length||1);
    return {distance:0,normal:overlap.normal,offsetA:contact,offsetB:contact.clone().sub(offset)};
  }
  const keep=(p,q)=>{const distance=p.distanceToSquared(q);if(distance<best){best=distance;pointA=p;pointB=q;}};
  for(const p of av)keep(p,closestOnBox(b,p));
  for(const q of bv)keep(closestOnBox(a,q),q);
  for(const [a0,a1] of BOX_EDGES)for(const [b0,b1] of BOX_EDGES)keep(...closestSegments(av[a0],av[a1],bv[b0],bv[b1]));
  const normal=pointB.clone().sub(pointA);
  if(normal.lengthSq()>EPS*EPS)normal.normalize();
  else normal.copy(sweptBoxes(aPose,aPose,bPose,bPose,padding)?.normal??b.center.clone().sub(a.center).normalize());
  return {distance:Math.sqrt(best),normal,offsetA:pointA,offsetB:pointB.clone().sub(offset)};
}

function angularSweep(a0,a1,b0,b1,padding = 0) {
  if(!closeSweep(a0.position,a1.position,b0.position,b1.position,radiusOf(a0.bounds)+radiusOf(b0.bounds)+padding*2))return null;
  const angleA=a0.rotation.angleTo(a1.rotation),angleB=b0.rotation.angleTo(b1.rotation);
  const initialOverlap=Boolean(sweptBoxes(a0,a0,b0,b0,padding)?.initialOverlap);
  if(angleA<EPS&&angleB<EPS){
    const hit=sweptBoxes(a0,a1,b0,b1,padding);if(!hit)return null;
    return {...boxSeparation(lerpPose(a0,a1,hit.time),lerpPose(b0,b1,hit.time),padding),...hit,initialOverlap};
  }
  // Distance is Lipschitz-bounded by relative translation plus the travel of
  // each hull's furthest corner. Advance against actual geometry, never an
  // inflated midpoint that can turn a new contact into a spawn overlap.
  const speed=a1.position.clone().sub(a0.position).sub(b1.position.clone().sub(b0.position)).length()+radiusOf(a0.bounds)*angleA+radiusOf(b0.bounds)*angleB;
  let time=0;
  for(let i=0;i<128;i++){
    const hit=boxSeparation(lerpPose(a0,a1,time),lerpPose(b0,b1,time),padding);
    if(hit.distance<1e-5)return {...hit,time,initialOverlap};
    if(speed<EPS)return null;
    time+=hit.distance/speed;
    if(time>1+EPS)return null;time=Math.min(1,time);
  }
  return null;
}

/** Exact segment/AABB distance: split the segment at slab crossings, then
 * minimize the quadratic on each fixed outside/inside interval. */
export function segmentBoxDistance(a,b,bounds) {
  const direction=b.clone().sub(a), cuts=[0,1];
  for(let axis=0;axis<3;axis++) if(Math.abs(direction.getComponent(axis))>EPS) for(const plane of [bounds.min[axis],bounds.max[axis]]) {
    const t=(plane-a.getComponent(axis))/direction.getComponent(axis);
    if(t>0&&t<1)cuts.push(t);
  }
  cuts.sort((x,y)=>x-y);
  let best=Infinity,bestPoint=null,bestBox=null;
  const consider=t=>{
    const p=a.clone().addScaledVector(direction,t), q=p.clone().clamp(new THREE.Vector3().fromArray(bounds.min),new THREE.Vector3().fromArray(bounds.max));
    const d=p.distanceToSquared(q);if(d<best){best=d;bestPoint=p;bestBox=q;}
  };
  for(let i=0;i<cuts.length-1;i++) {
    const lo=cuts[i],hi=cuts[i+1],mid=(lo+hi)/2;let aa=0,bb=0;
    for(let axis=0;axis<3;axis++) {
      const start=a.getComponent(axis),slope=direction.getComponent(axis),v=start+slope*mid;
      const plane=v<bounds.min[axis]?bounds.min[axis]:v>bounds.max[axis]?bounds.max[axis]:null;
      if(plane!==null){aa+=slope*slope;bb+=(start-plane)*slope;}
    }
    consider(lo);consider(hi);if(aa>EPS)consider(THREE.MathUtils.clamp(-bb/aa,lo,hi));
  }
  return {distance:Math.sqrt(best),point:bestPoint,boxPoint:bestBox};
}

function capsuleSegment(suit) {
  const r=SHIP_LAYOUT.capsuleRadius,h=SHIP_LAYOUT.eyeHeight;
  return [suit.position.clone().addScaledVector(suit.up,-h+r),suit.position.clone().addScaledVector(suit.up,.2-r)];
}

/** Conservative advancement using a true rounded suit capsule, not a large
 * character box. Its Lipschitz bound includes the hull's angular motion. */
export function sweptSuit(h0,h1,s0,s1) {
  if(!closeSweep(h0.position,h1.position,s0.position,s1.position,radiusOf(h0.bounds)+SHIP_LAYOUT.eyeHeight+.2))return null;
  const relative=h1.position.clone().sub(h0.position).sub(s1.position.clone().sub(s0.position));
  const angle=h0.rotation.angleTo(h1.rotation), upAngle=s0.up.angleTo(s1.up);
  const speed=relative.length()+radiusOf(h0.bounds)*angle+SHIP_LAYOUT.eyeHeight*upAngle;
  let time=0,initialOverlap=false;
  for(let i=0;i<128;i++) {
    const hull=lerpPose(h0,h1,time),inverse=hull.rotation.clone().invert();
    const suit={position:s0.position.clone().lerp(s1.position,time),up:s0.up.clone().lerp(s1.up,time).normalize()};
    const [a,b]=capsuleSegment(suit).map(point=>point.sub(hull.position).applyQuaternion(inverse));
    const result=segmentBoxDistance(a,b,hull.bounds),gap=result.distance-SHIP_LAYOUT.capsuleRadius;
    if(i===0)initialOverlap=gap<=0;
    if(gap<1e-5) {
      let normal=result.point.clone().sub(result.boxPoint).applyQuaternion(hull.rotation);
      if(normal.lengthSq()<EPS)normal.copy(suit.position).sub(hull.position);
      if(normal.lengthSq()<EPS)normal.set(1,0,0);
      normal.normalize();
      const offsetA=result.boxPoint.clone().applyQuaternion(hull.rotation);
      const offsetB=result.point.clone().applyQuaternion(hull.rotation).add(hull.position.clone().sub(suit.position)).addScaledVector(normal,-SHIP_LAYOUT.capsuleRadius);
      return {time,normal,initialOverlap,offsetA,offsetB};
    }
    if(speed<EPS)return null;
    time+=gap/speed;
    if(time>1+EPS)return null;time=Math.min(1,time);
  }
  return null;
}

function occupant(hull,suit) {
  const inverse=hull.rotation.clone().invert(),r=SHIP_LAYOUT.capsuleRadius;
  return capsuleSegment(suit).every(point=>{
    point.sub(hull.position).applyQuaternion(inverse);
    return [0,1,2].every(axis=>point.getComponent(axis)>=hull.bounds.min[axis]-r&&point.getComponent(axis)<=hull.bounds.max[axis]+r);
  });
}

export function capturePeerMotion(players) {
  const result=new Map();
  for(const p of players.values()) if(healthy(p)) {
    const hull=shipPose(p),suit=['walk','eva'].includes(p.nav.mode)&&!p.nav.stationHubTransit?{position:p.nav.position.clone(),up:playerUp(p.nav)}:null;
    // shipPose is also used by immediate raycasts and exposes the live attitude.
    // Motion history must own its quaternion across the next Navigation step.
    if(hull)hull.rotation=hull.rotation.clone();
    if(p.nav.rotationClock){
      const frame=p.nav.rotationFrame,time=p.nav.rotationTime,rotation=planetRotation(frame,time);
      if(hull){toInertial(hull.position,hull.frame,time,hull.position);hull.rotation.premultiply(planetRotation(hull.frame,time));}
      if(suit){toInertial(suit.position,frame,time,suit.position);suit.up.applyQuaternion(rotation);}
    }
    result.set(p.id,{player:p,life:p.nav,hull,suit});
  }
  return result;
}

function stopHull(entry,after,time) {
  const n=entry.player.nav,a=entry.hull,b=after.hull;
  const travel=a.position.distanceTo(b.position)+radiusOf(a.bounds)*a.rotation.angleTo(b.rotation),safe=Math.max(0,time-SKIN/Math.max(SKIN,travel));
  const pose=lerpPose(a,b,safe);
  if(n.rotationClock){
    const seconds=n.rotationTime;
    if(n.shipPosition){
      const local=n.inertialPosition.sub(b.position).applyQuaternion(b.rotation.clone().invert());
      const look=b.rotation.clone().invert().multiply(n.inertialOrientation);
      const eye=local.applyQuaternion(pose.rotation).add(pose.position),eyeFrame=rotationFrameAt(eye);
      const movingCabin=n.cabinFlight&&!n.spaceParked;
      // An occupied moving hull shares the eye's chart even if its root lies
      // across the boundary. A parked hull keeps its own chart; an outside suit
      // does not become its passenger just because cabinFlight remains set.
      const shipFrame=movingCabin?eyeFrame:rotationFrameAt(pose.position);
      fromInertial(pose.position,shipFrame,seconds,n.shipPosition);
      n.shipOrientation.copy(planetRotation(shipFrame,seconds).invert()).multiply(pose.rotation);n.shipVelocity.set(0,0,0);
      if(movingCabin||n.insideShip){
        fromInertial(eye,eyeFrame,seconds,n.position);
        n.orientation.copy(planetRotation(eyeFrame,seconds).invert()).multiply(pose.rotation).multiply(look);n.velocity.set(0,0,0);
      }
    }else{
      const eye=pose.position.clone().add(new THREE.Vector3(...n.layout.seatEye).applyQuaternion(pose.rotation));
      const eyeFrame=rotationFrameAt(eye);fromInertial(eye,eyeFrame,seconds,n.position);
      n.orientation.copy(planetRotation(eyeFrame,seconds).invert()).multiply(pose.rotation);n.velocity.set(0,0,0);
    }
    n.angularVelocity?.set(0,0,0);n.shipAngularVelocity?.set(0,0,0);n.travel=null;
    return;
  }
  if(n.shipPosition) {
    const inverse=b.rotation.clone().invert(),local=n.position.clone().sub(b.position).applyQuaternion(inverse),orientation=inverse.clone().multiply(n.orientation);
    n.shipPosition.copy(pose.position);n.shipOrientation.copy(pose.rotation);n.shipVelocity.set(0,0,0);
    if(n.cabinFlight){n.position.copy(local).applyQuaternion(pose.rotation).add(pose.position);n.orientation.copy(pose.rotation).multiply(orientation).normalize();n.velocity.set(0,0,0);}
  } else {
    n.orientation.copy(pose.rotation);
    n.position.copy(pose.position).add(new THREE.Vector3().fromArray(n.layout.seatEye).applyQuaternion(pose.rotation));
    n.velocity.set(0,0,0);
  }
  n.angularVelocity?.set(0,0,0);n.shipAngularVelocity?.set(0,0,0);n.travel=null;
}

function angularVelocity(before,after,dt){
  const delta=after.clone().multiply(before.clone().invert()).normalize();
  if(delta.w<0)delta.set(-delta.x,-delta.y,-delta.z,-delta.w);
  const axis=new THREE.Vector3(delta.x,delta.y,delta.z),length=axis.length();
  return length<EPS?axis.set(0,0,0):axis.multiplyScalar(2*Math.atan2(length,delta.w)/(length*dt));
}
function contactVelocity(before,after,offset,dt,suit=false){
  const rotation=suit?angularVelocity(new THREE.Quaternion(),new THREE.Quaternion().setFromUnitVectors(before.up,after.up),dt):angularVelocity(before.rotation,after.rotation,dt);
  return after.position.clone().sub(before.position).divideScalar(dt).add(rotation.cross(offset));
}
const moved=(a,b)=>a.position.distanceToSquared(b.position)>EPS*EPS||a.rotation.angleTo(b.rotation)>EPS;

export function createRammingResolver() {
  let contacts=new Set(),sequence=0;
  return {
    step(players,before,dt,onImpact) {
      if(!Number.isFinite(dt)||dt<=0)return;
      const after=capturePeerMotion(players),pairs=[],near=new Set(),impacts=[];
      const entries=[...before.values()].filter(a=>a.life===after.get(a.player.id)?.life);
      for(let i=0;i<entries.length;i++)for(let j=i+1;j<entries.length;j++) {
        const a=entries[i],b=entries[j],aa=after.get(a.player.id),bb=after.get(b.player.id);
        if(a.hull&&b.hull) {
          const key=[a.player.id,b.player.id].sort().join(':')+':hulls';
          if(angularSweep(a.hull,aa.hull,b.hull,bb.hull,.15))near.add(key);
          const hit=angularSweep(a.hull,aa.hull,b.hull,bb.hull);
          if(hit)pairs.push({a,b,aa,bb,hit,key,kind:'ship'});
        }
        for(const [h,s,hh,ss] of [[a,b,aa,bb],[b,a,bb,aa]])if(h.hull&&s.suit&&ss.suit&&!occupant(h.hull,s.suit)) {
          const key=`${h.player.id}:${s.player.id}:suit`,hit=sweptSuit(h.hull,hh.hull,s.suit,ss.suit);
          if(hit){near.add(key);pairs.push({a:h,b:s,aa:hh,bb:ss,hit,key,kind:'player'});}
        }
      }
      pairs.sort((a,b)=>a.hit.time-b.hit.time);
      const stopped=new Set();
      for(const {a,b,aa,bb,hit,key,kind} of pairs) {
        if(stopped.has(a.player.id)||kind==='ship'&&stopped.has(b.player.id))continue;
        const va=contactVelocity(a.hull,aa.hull,hit.offsetA,dt);
        const vb=kind==='ship'?contactVelocity(b.hull,bb.hull,hit.offsetB,dt):contactVelocity(b.suit,bb.suit,hit.offsetB,dt,true);
        const closing=va.clone().sub(vb).dot(hit.normal);
        const forwardA=va.dot(hit.normal),forwardB=-vb.dot(hit.normal);
        // Existing occupants/initial overlaps can walk or fly out. A new swept
        // entry owns contact; spawn overlap must not manufacture aggression.
        if(hit.initialOverlap||closing<=EPS)continue;
        if(moved(a.hull,aa.hull)){stopHull(a,aa,hit.time);stopped.add(a.player.id);}
        if(kind==='ship'&&moved(b.hull,bb.hull)){stopHull(b,bb,hit.time);stopped.add(b.player.id);}
        if(contacts.has(key)||closing<=RAM_SAFE_SPEED)continue;
        const damage=Math.min(100,(closing-RAM_SAFE_SPEED)**2*.2);
        if(forwardA>RAM_SAFE_SPEED)impacts.push({id:`ram:${++sequence}`,attacker:a.player,victim:b.player,kind,cause:'ram',damage,
          point:(kind==='ship'?b.hull.position.clone().lerp(bb.hull.position,hit.time):b.suit.position.clone().lerp(bb.suit.position,hit.time)),closingSpeed:closing});
        if(kind==='ship'&&forwardB>RAM_SAFE_SPEED)impacts.push({id:`ram:${++sequence}`,attacker:b.player,victim:a.player,kind:'ship',cause:'ram',damage,
          point:a.hull.position.clone().lerp(aa.hull.position,hit.time),closingSpeed:closing});
      }
      contacts=near;
      // Admit every contact from the same captured motion interval before a
      // callback can publish death or change a participant's live pose. Security
      // validates each submission synchronously, then yields before damage.
      for(const impact of impacts){
        const n=impact.victim.nav;
        if(n.rotationClock)fromInertial(impact.point,impact.kind==='ship'?shipPose(impact.victim)?.frame??null:n.rotationFrame,n.rotationTime,impact.point);
        onImpact(impact);
      }
    },
  };
}
