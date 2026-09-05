import { Vector3 } from 'three';

// A quarter-scale lunar radius with a compressed, fixed orbit for this prototype.
// Positions stay in planet-centred metres; this body is a flyby destination.
export const MOON_RADIUS = 434_350;
export const MOON_DISTANCE = 24_000_000;
export const MOON_POSITION = Object.freeze(new Vector3(-.1, 0, -1).normalize().multiplyScalar(MOON_DISTANCE).toArray());
export const MOON_CLEARANCE = 4_000;
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
  let height=(broad-.5)*1800+(detail-.5)*130, fresh=0;
  for(const crater of CRATERS){
    const dot=x*crater.direction[0]+y*crater.direction[1]+z*crater.direction[2];
    if(dot<1-crater.radius*crater.radius*.98)continue;
    const r=Math.sqrt(Math.max(0,2-2*dot))/crater.radius;
    const bowl=-crater.depth*(1-smooth(.15,.94,r));
    const rim=crater.depth*.36*Math.exp(-(((r-.98)/.12)**2));
    height+=bowl+rim;
    fresh+=Math.exp(-(((r-1.03)/.20)**2))*.055;
  }
  return {height,albedo:Math.max(.065,Math.min(.27,.19-maria*.085+(detail-.5)*.04+fresh))};
}

export function moonOffset(position) { return position.clone().sub(new Vector3(...MOON_POSITION)); }
export function moonAltitude(position) { return moonOffset(position).length()-MOON_RADIUS; }
export function moonApproach() {
  // Near side, with a gibbous sunlit face and enough clearance to frame the disk.
  const normal=new Vector3(.45,.22,.87).normalize();
  return new Vector3(...MOON_POSITION).addScaledVector(normal,MOON_RADIUS*3.4);
}

/** Earliest segment contact with the explicitly non-landable flyby perimeter.
 * A swept test catches a fast crossing even when both endpoints are outside. */
export function constrainMoonStep(previous,proposed) {
  const center=new Vector3(...MOON_POSITION),radius=MOON_RADIUS+MOON_CLEARANCE;
  const start=previous.clone().sub(center),delta=proposed.clone().sub(previous);
  if(start.lengthSq()<radius*radius){
    if(start.lengthSq()<1e-12)start.set(0,0,1);
    return {point:start.setLength(radius).add(center),hit:true};
  }
  const a=delta.lengthSq(),b=start.dot(delta),c=start.lengthSq()-radius*radius;
  if(a===0||b>=0)return {point:proposed,hit:false};
  const discriminant=b*b-a*c;
  if(discriminant<0)return {point:proposed,hit:false};
  // Stable near-entry root; the alternative subtracts nearly equal large values.
  const t=c/(-b+Math.sqrt(discriminant));
  if(t<0||t>1)return {point:proposed,hit:false};
  return {point:start.addScaledVector(delta,t).setLength(radius+.01).add(center),hit:true};
}
