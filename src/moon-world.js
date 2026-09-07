import { rockFormationHeight } from './rock-formations.js';
import { Vector3 } from 'three';

// A quarter-scale lunar radius with a compressed, fixed orbit for this prototype.
// Positions stay in planet-centred metres. Rendering and contact share this terrain.
export const MOON_RADIUS = 434_350;
export const MOON_DISTANCE = 24_000_000;
export const MOON_POSITION = Object.freeze(new Vector3(-.1, 0, -1).normalize().multiplyScalar(MOON_DISTANCE).toArray());
export const MOON_MAX_HEIGHT = 4_000;
export const MOON_GRAVITY = 1.62;
export const MOON_GENERATOR_VERSION = 3;
export const MOON_LANDING_DIRECTION = Object.freeze(new Vector3(.45,.22,.87).normalize().toArray());
export const MOON_NAME = 'Selene';

// A separate deterministic seed keeps the moon stable across planet seeds.
let seed = 0x53454c45;
const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
export const CRATERS = Object.freeze(Array.from({length: 96}, () => {
  const y = random() * 2 - 1, angle = random() * Math.PI * 2, r = Math.sqrt(1 - y*y);
  const radius = .012 + random() ** 2 * .13;
  return Object.freeze({ direction: Object.freeze([r*Math.cos(angle), y, r*Math.sin(angle)]), radius, depth: radius * MOON_RADIUS * .035 });
}));
const smooth = (a,b,x) => {const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
const hash = (x,y,z) => {let h=Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(z,2147483647);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;};
function noise(x,y,z) {
  const a=Math.floor(x),b=Math.floor(y),c=Math.floor(z);
  const u=smooth(0,1,x-a),v=smooth(0,1,y-b),w=smooth(0,1,z-c);
  let sum=0;
  for(let i=0;i<2;i++)for(let j=0;j<2;j++)for(let k=0;k<2;k++)sum+=hash(a+i,b+j,c+k)*(i?u:1-u)*(j?v:1-v)*(k?w:1-w);
  return sum;
}

/** Direction-based material and relief avoid texture seams at poles/longitude. */
export function moonSurface(x,y,z) {
  const broad=noise(x*3.7+11,y*3.7-4,z*3.7+7);
  const detail=noise(x*24+7,y*24+3,z*24-6);
  const maria=1-smooth(.33,.50,broad);
  const hills=noise(x*850+13,y*850-9,z*850+3),gravel=noise(x*12000+6,y*12000-2,z*12000+8);
  let height=(broad-.5)*1800+(detail-.5)*130+(hills-.5)*12+(gravel-.5)*.16, fresh=0;
  for(const crater of CRATERS){
    const dot=x*crater.direction[0]+y*crater.direction[1]+z*crater.direction[2];
    if(dot<1-crater.radius*crater.radius*.98)continue;
    const r=Math.sqrt(Math.max(0,2-2*dot))/crater.radius;
    const bowl=-crater.depth*(1-smooth(.15,.94,r));
    const rim=crater.depth*.36*Math.exp(-(((r-.98)/.12)**2));
    height+=bowl+rim;
    fresh+=Math.exp(-(((r-1.03)/.20)**2))*.055;
  }
  const rocks=rockFormationHeight(x,y,z,MOON_RADIUS,0x53454c45);
  height+=rocks;
  return {height,rockRelief:rocks,albedo:Math.max(.065,Math.min(.27,.19-maria*.085+(detail-.5)*.04+fresh-smooth(.3,3,rocks)*.035))};
}

export function moonOffset(position) { return position.clone().sub(new Vector3(...MOON_POSITION)); }
export function moonAltitude(position) { return moonOffset(position).length()-MOON_RADIUS; }
export function moonApproach() {
  // Near side, with a gibbous sunlit face and enough clearance to frame the disk.
  const normal=new Vector3(.45,.22,.87).normalize();
  return new Vector3(...MOON_POSITION).addScaledVector(normal,MOON_RADIUS*3.4);
}

/** Swept contact against the actual heightfield, including crossings whose two
 * endpoints are outside the moon. Work is restricted to its bounding sphere. */
export function constrainMoonStep(previous,proposed,clearance=3.2) {
  const center=new Vector3(...MOON_POSITION),start=previous.clone().sub(center),delta=proposed.clone().sub(previous);
  const length=delta.length(),bound=MOON_RADIUS+MOON_MAX_HEIGHT+clearance;
  const distanceAt=t=>{
    const local=start.clone().addScaledVector(delta,t),r=local.length();
    if(r<1)return -MOON_RADIUS;
    local.divideScalar(r);return r-MOON_RADIUS-moonSurface(local.x,local.y,local.z).height-clearance;
  };
  const contact=t=>{
    const d=start.clone().addScaledVector(delta,t);if(d.lengthSq()<1)d.set(0,0,1);d.normalize();
    return {point:d.clone().multiplyScalar(MOON_RADIUS+moonSurface(d.x,d.y,d.z).height+clearance).add(center),hit:true,t};
  };
  if(start.length()<bound&&distanceAt(0)<=0)return contact(0);
  if(length===0)return {point:proposed,hit:false};
  const ray=delta.clone().divideScalar(length),b=start.dot(ray),c=start.lengthSq()-bound*bound,disc=b*b-c;
  if(disc<0)return {point:proposed,hit:false};
  const root=Math.sqrt(disc),entry=Math.max(0,(-b-root)/length),exit=Math.min(1,(-b+root)/length);
  if(exit<entry||exit<0||entry>1)return {point:proposed,hit:false};
  // A conservative slope allowance covers overlapping crater rims and gravel.
  // If the work budget is exhausted on a grazing ray, stop at the checked point
  // rather than allow the unexamined remainder to tunnel through the terrain.
  let t=entry,last=t;
  for(let i=0;i<4096&&t<=exit;i++){
    const height=distanceAt(t);
    if(height<=.002){
      let lo=last,hi=t;
      for(let j=0;j<24;j++){const mid=(lo+hi)/2;if(distanceAt(mid)>0)lo=mid;else hi=mid;}
      return contact(hi);
    }
    if(t===exit)break;
    last=t;t=Math.min(exit,t+Math.min(250,height/20)/length);
  }
  if(t<exit)return {point:previous.clone().addScaledVector(delta,t),hit:false,limited:true};
  return {point:proposed,hit:false};
}
