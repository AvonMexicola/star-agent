import { Vector3 } from 'three';

// Path vectors also cross the authoritative server's JSON/structured-clone boundary.
const vector = p => p?.isVector3 ? p.clone() : Array.isArray(p) ? new Vector3(...p) : new Vector3(p.x,p.y,p.z);
const frozen = p => Object.freeze(p.clone());
const clamp = x => Math.max(-1, Math.min(1, x));
const line = (start, end) => Object.freeze({kind:'line',start:frozen(start),end:frozen(end),
  direction:frozen(end.clone().sub(start).normalize()),distance:start.distanceTo(end)});

export function sampleRoute(path, distance) {
  let remaining = Math.max(0, distance);
  for (let i=0;i<path.length;i++) {
    const part=path[i];
    if (remaining>part.distance && i<path.length-1) { remaining-=part.distance; continue; }
    const d=Math.min(part.distance,remaining);
    if (part.kind==='line') return {position:vector(part.start).addScaledVector(part.direction,d),direction:vector(part.direction)};
    const radial=vector(part.radial).applyAxisAngle(part.axis,d/part.radius);
    return {position:vector(part.center).addScaledVector(radial,part.radius),direction:vector(part.axis).cross(radial)};
  }
  throw new TypeError('A nonempty travel path is required.');
}

/** Exact minimum distance over a line or circular arc; no frame-size sampling. */
export function routePartClearance(part, center) {
  const c=vector(center);
  if (part.kind==='line') {
    const distance=Math.max(0,Math.min(part.distance,c.sub(part.start).dot(part.direction)));
    return vector(part.start).addScaledVector(part.direction,distance).distanceTo(vector(center));
  }
  const relative=c.clone().sub(part.center),tangent=vector(part.axis).cross(part.radial);
  let angle=Math.atan2(relative.dot(tangent),relative.dot(part.radial));
  if (angle<0) angle+=Math.PI*2;
  const at=theta=>vector(part.center).addScaledVector(vector(part.radial).applyAxisAngle(part.axis,theta),part.radius).distanceTo(c);
  return Math.min(at(0),at(part.angle),angle<=part.angle?at(angle):Infinity);
}

/** Tangent legs and a circular limb arc. World shells must be disjoint.
 * A start/end inside a shell gets a radial departure/approach corridor; callers
 * validate these endpoints against the canonical terrain before planning. */
export function createAvoidanceRoute(start, end, worlds, obstacles=[]) {
  const from=vector(start),to=vector(end),prefix=[],suffix=[];
  for (const world of worlds) {
    const center=vector(world.center),radius=world.radius+1;
    if (from.distanceTo(center)<radius) {
      const outer=from.clone().sub(center).normalize().multiplyScalar(radius).add(center);
      prefix.push({...line(from,outer),corridor:world.id});from.copy(outer);
    }
    if (to.distanceTo(center)<radius) {
      const outer=to.clone().sub(center).normalize().multiplyScalar(radius).add(center);
      suffix.unshift({...line(outer,to),corridor:world.id});to.copy(outer);
    }
  }
  let splits=0;
  function connect(a,b) {
    const direct=line(a,b);
    const blocked=worlds.filter(w=>routePartClearance(direct,w.center)<w.radius-.001)
      .sort((x,y)=>a.distanceTo(vector(x.center))-a.distanceTo(vector(y.center)))[0];
    if (!blocked) return [direct];
    if (++splits>32) throw new Error('No clear route around these worlds.');
    const center=vector(blocked.center),radius=blocked.radius+1;
    const u=a.clone().sub(center),v=b.clone().sub(center),da=u.length(),db=v.length();
    if (da<radius-.001||db<radius-.001) throw new Error(`Move clear of ${blocked.name} before engaging.`);
    u.normalize();v.normalize();
    const theta=Math.acos(clamp(u.dot(v))),axis=u.clone().cross(v);
    if (axis.lengthSq()<1e-16) {
      const basis=Math.abs(u.x)<.8?new Vector3(1,0,0):new Vector3(0,1,0);
      axis.crossVectors(u,basis);
    }
    axis.normalize();
    const alpha=Math.acos(clamp(radius/da)),beta=Math.acos(clamp(radius/db));
    const angle=Math.max(0,theta-alpha-beta),radial=u.clone().applyAxisAngle(axis,alpha);
    const entry=center.clone().addScaledVector(radial,radius);
    const exit=center.clone().addScaledVector(radial.clone().applyAxisAngle(axis,angle),radius);
    const arc=Object.freeze({kind:'arc',center:frozen(center),radius,radial:frozen(radial),axis:frozen(axis),angle,distance:radius*angle,body:blocked.id});
    return [...connect(a,entry),arc,...connect(exit,b)];
  }
  const path=[...prefix,...connect(from,to),...suffix].filter(part=>part.distance>1e-6);
  for (const part of path) for (const hazard of [...worlds,...obstacles]) {
    if (part.corridor && part.corridor===hazard.id) continue;
    if (routePartClearance(part,hazard.center)<hazard.radius-.001)
      throw new Error(`Route blocked by ${hazard.name}. Move to a clear approach.`);
  }
  return Object.freeze(path.map(Object.freeze));
}
