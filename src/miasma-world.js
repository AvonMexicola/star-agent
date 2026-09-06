import { rockFormationHeight } from './rock-formations.js';
import { Vector3 } from 'three';
import { PYRE_POSITION, pyreFrame, pyreArrivalDirection } from './pyre-world.js';
import { resourceProfile, resourceColor } from './resource-profile.js';
import { constrainTerrainStep } from './terrain-contact.js';
import { bakeSurfaceMaps } from './surface-maps.js';

export const MIASMA_RADIUS = 340_000;
export const MIASMA_ORBIT_RADIUS = 6_400_000;
export const MIASMA_MAX_HEIGHT = 6500;
export const MIASMA_ARRIVAL_ALTITUDE = 650_000;
export const MIASMA_GENERATOR_VERSION = 2;
// A frozen inclined satellite orbit, clear of the Aeon approach corridor. The
// moon sits above the dark limb in the authored Pyre arrival composition.
const north = new Vector3(...pyreFrame().y), towardAeon = new Vector3(...pyreArrivalDirection());
const right = new Vector3().crossVectors(towardAeon.clone().negate(), north).normalize();
export const MIASMA_POSITION = Object.freeze(new Vector3(...PYRE_POSITION)
  .addScaledVector(right, MIASMA_ORBIT_RADIUS * .58)
  .addScaledVector(north, MIASMA_ORBIT_RADIUS * .25)
  .addScaledVector(towardAeon, -MIASMA_ORBIT_RADIUS * Math.sqrt(1 - .58 ** 2 - .25 ** 2)).toArray());
export const MIASMA_ATMOSPHERE = Object.freeze({
  height: 18_000, planeHeight: 6500, seaLevelDensity: .065, scaleHeight: 2800, mieScaleHeight: 1400,
  betaR: Object.freeze([3.0e-6, 4.2e-6, 1.2e-6]), betaM: Object.freeze([8e-6, 10e-6, 2.8e-6]), g: .68, gain: 8,
});
export const MIASMA_LIGHTING = Object.freeze({ sky: 0xbfc883, ground: 0x373c20, ambientNight: .018, ambientDay: .2, environment: .04 });
export const MIASMA_RESOURCE_IDS = Object.freeze(['sulphur', 'silicate', 'copper']);
const PALETTE = Object.freeze({ sulphur: [.62, .51, .13], silicate: [.18, .21, .12], copper: [.026, .12, .095] });
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const hash = (x,y,z) => { let n=Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(z,1442695041)^0x4d494153; n=Math.imul(n^(n>>>13),1274126177); return ((n^(n>>>16))>>>0)/4294967295; };
function noise(x,y,z) {
  const a=Math.floor(x),b=Math.floor(y),c=Math.floor(z),u=smooth(0,1,x-a),v=smooth(0,1,y-b),w=smooth(0,1,z-c);
  const mix=(a,b,t)=>a+(b-a)*t;
  return mix(mix(mix(hash(a,b,c),hash(a+1,b,c),u),mix(hash(a,b+1,c),hash(a+1,b+1,c),u),v),mix(mix(hash(a,b,c+1),hash(a+1,b,c+1),u),mix(hash(a,b+1,c+1),hash(a+1,b+1,c+1),u),v),w);
}
function fbm(x,y,z,n=4) {
  let sum=0,weight=.55,total=0;
  for(let i=0;i<n;i++){sum+=weight*noise(x,y,z);total+=weight;weight*=.5;[x,y,z]=[y*1.73+z*.9+13,z*1.79-x*.8+7,x*1.81+y*.85-11];}
  return sum/total;
}
const direction = (lat,lon) => {const a=lat*Math.PI/180,b=lon*Math.PI/180;return Object.freeze([Math.cos(a)*Math.sin(b),Math.sin(a),Math.cos(a)*Math.cos(b)]);};
export const MIASMA_SITES = Object.freeze([
  Object.freeze({name:'VITRIOL BASIN', direction:direction(18,-65), radius:.37, depth:2100}),
  Object.freeze({name:'THE PALE EYE', direction:direction(-24,28), radius:.24, depth:1700}),
  Object.freeze({name:'VERDIGRIS SEA', direction:direction(42,126), radius:.43, depth:2400}),
  Object.freeze({name:'BRIMSTONE CROWN', direction:direction(-43,-142), radius:.2, depth:1300}),
]);
/** One deterministic floor and mineral field, from orbital maps to walking contact.
 * The "seas" are mineral deposits: no separate liquid/collision plane. */
export function miasmaSurface(x,y,z) {
  const warp=fbm(x*3+9,y*3-4,z*3+2,3),a=x*4+warp*2,b=y*4+warp,c=z*4-warp;
  const continent=fbm(a,b,c),ridge=1-Math.abs(fbm(x*23+warp,y*23,z*23-warp)*2-1);
  const fracture=1-smooth(.009,.042,Math.abs(fbm(x*55,y*55,z*55,3)-.5));
  let height=250+continent*2100+ridge**6*1100,basin=0,rim=0,region='SULPHUR UPLANDS';
  for(const site of MIASMA_SITES){
    const distance=Math.sqrt(Math.max(0,2-2*(x*site.direction[0]+y*site.direction[1]+z*site.direction[2])));
    const r=distance/site.radius+(fbm(x*31+5,y*31,z*31,3)-.5)*.16;
    const bowl=1-smooth(.66,1.04,r),edge=Math.exp(-(((r-1.04)/.105)**2));
    height-=site.depth*bowl; height+=site.depth*.35*edge;
    if(bowl>.2)region=site.name;
    basin=Math.max(basin,bowl);rim=Math.max(rim,edge);
  }
  height+= (fbm(x*160,y*160,z*160,3)-.5)*150-fracture*70+(noise(x*2200,y*2200,z*2200)-.5)*3;
  const rocks=rockFormationHeight(x,y,z,MIASMA_RADIUS,0x4d494153);
  height+=rocks;
  const sulphur=clamp(.24+continent*.75+rim*.3-basin*.75),copper=basin*.92;
  const resources=resourceProfile(MIASMA_RESOURCE_IDS,[sulphur,Math.max(.06,1-sulphur-copper),copper],region);
  const color=resourceColor(resources,PALETTE).map(v=>v*(.8+continent*.3)*(1-fracture*.24)*(1-smooth(.3,3,rocks)*.34));
  return {height,color,resources,region,activity:0,fresh:basin,sulphur,oxide:0};
}
export const MIASMA_TERRAIN = Object.freeze({name:'Miasma',radius:MIASMA_RADIUS,position:MIASMA_POSITION,maxHeight:MIASMA_MAX_HEIGHT,orbitLevel:4,sample:miasmaSurface});
export function miasmaArrivalDirection() {return new Vector3(...PYRE_POSITION).sub(new Vector3(...MIASMA_POSITION)).normalize().toArray();}
export function constrainMiasmaStep(previous,proposed,clearance=3.2) {return constrainTerrainStep(previous,proposed,MIASMA_TERRAIN,clearance);}
export function bakeMiasmaMaps(width=1024,height=512) {return bakeSurfaceMaps(miasmaSurface,MIASMA_RADIUS,width,height);}
