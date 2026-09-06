import {Vector3,Quaternion} from 'three';
import {MOON_RADIUS,MOON_POSITION,MOON_LANDING_DIRECTION,LANDING_FRAME} from './moon-world.js';

export const RING_WIDTH=20000,RING_THICKNESS=2000,RING_RADIUS=MOON_RADIUS*2.08;
export const ANGULAR_CELLS=8192,RADIAL_CELLS=20,VERTICAL_CELLS=4,ROCKS_PER_CELL=32;
export const RING_POPULATION=ANGULAR_CELLS*RADIAL_CELLS*VERTICAL_CELLS*ROCKS_PER_CELL;
export const RING_NORMAL=Object.freeze(new Vector3(...MOON_LANDING_DIRECTION).multiplyScalar(.34).addScaledVector(new Vector3(...LANDING_FRAME.north),.9).addScaledVector(new Vector3(...LANDING_FRAME.east),.25).normalize().toArray());
export const RING_ROTATION=new Quaternion().setFromUnitVectors(new Vector3(0,0,1),new Vector3(...RING_NORMAL));
const inverse=RING_ROTATION.clone().invert(),TAU=Math.PI*2;
export const ASTEROID_FAMILIES=Object.freeze(['Angular basalt','Copper breccia','Ice aggregate','Layered shale','Pitted basalt','Fractured outcrop']);
export function randomFor(seed){let n=seed>>>0;n=Math.imul(n^(n>>>16),0x7feb352d);n=Math.imul(n^(n>>>15),0x846ca68b);n=(n^(n>>>16))>>>0;return ()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
export function cellId(a,r,z){return (((a%ANGULAR_CELLS+ANGULAR_CELLS)%ANGULAR_CELLS)*RADIAL_CELLS+r)*VERTICAL_CELLS+z;}
export function asteroidDescriptor(id){
  if(!Number.isSafeInteger(id)||id<0||id>=RING_POPULATION)throw RangeError('Asteroid id outside ring');
  const slot=id%ROCKS_PER_CELL,cell=Math.floor(id/ROCKS_PER_CELL),z=cell%VERTICAL_CELLS,r=Math.floor(cell/VERTICAL_CELLS)%RADIAL_CELLS,a=Math.floor(cell/(VERTICAL_CELLS*RADIAL_CELLS));
  const random=randomFor(id^0x6a09e667),angle=(a+random())/ANGULAR_CELLS*TAU;
  const radius=RING_RADIUS-RING_WIDTH/2+(r+random())*1000;
  const height=-RING_THICKNESS/2+(z+random())*500;
  const position=new Vector3(Math.cos(angle)*radius,Math.sin(angle)*radius,height).applyQuaternion(RING_ROTATION);
  const family=Math.floor(random()*ASTEROID_FAMILIES.length),size=slot%8===0?12+random()**3*125:1;
  return {id,key:`selene-ring-v1-${id}`,position:position.toArray(),size,family,name:ASTEROID_FAMILIES[family],rotation:[random()*TAU,random()*TAU,random()*TAU],scale:[1,1,1],ice:family===2,mineable:size===1};
}
export function ringRock(index){return asteroidDescriptor((Math.imul(index,104729)>>>0)%RING_POPULATION);}
export function ringCellAt(world){
  const p=world.clone().sub(new Vector3(...MOON_POSITION)).applyQuaternion(inverse),angle=(Math.atan2(p.y,p.x)+TAU)%TAU;
  return [Math.floor(angle/TAU*ANGULAR_CELLS),Math.floor((Math.hypot(p.x,p.y)-RING_RADIUS+RING_WIDTH/2)/1000),Math.floor((p.z+RING_THICKNESS/2)/500)];
}
export function nearbyAsteroids(world,reach=1){
  const [a,r,z]=ringCellAt(world),result=[];
  if(r< -reach||r>=RADIAL_CELLS+reach||z< -reach||z>=VERTICAL_CELLS+reach)return result;
  for(let da=-reach;da<=reach;da++)for(let dr=-reach;dr<=reach;dr++)for(let dz=-reach;dz<=reach;dz++){
    if(r+dr<0||r+dr>=RADIAL_CELLS||z+dz<0||z+dz>=VERTICAL_CELLS)continue;
    const base=cellId(a+da,r+dr,z+dz)*ROCKS_PER_CELL;
    for(let i=0;i<ROCKS_PER_CELL;i++)result.push(asteroidDescriptor(base+i));
  }
  return result;
}

/** Parametric segment intervals inside the padded finite annular belt. */
export function ringPathIntervals(previous,proposed,padding=300){
  const center=new Vector3(...MOON_POSITION),a=previous.clone().sub(center).applyQuaternion(inverse),b=proposed.clone().sub(center).applyQuaternion(inverse),d=b.sub(a);
  let lo=0,hi=1;
  const half=RING_THICKNESS/2+padding;
  if(Math.abs(d.z)<1e-12){if(Math.abs(a.z)>half)return [];}
  else{const t=[(-half-a.z)/d.z,(half-a.z)/d.z].sort((x,y)=>x-y);lo=Math.max(lo,t[0]);hi=Math.min(hi,t[1]);}
  const circle=radius=>{
    const aa=d.x*d.x+d.y*d.y,bb=a.x*d.x+a.y*d.y,cc=a.x*a.x+a.y*a.y-radius*radius;
    if(aa<1e-12)return cc<=0?[-Infinity,Infinity]:null;
    const det=bb*bb-aa*cc;if(det<0)return null;const root=Math.sqrt(det);return [(-bb-root)/aa,(-bb+root)/aa];
  };
  const outer=circle(RING_RADIUS+RING_WIDTH/2+padding);if(!outer)return [];
  lo=Math.max(lo,outer[0]);hi=Math.min(hi,outer[1]);if(lo>hi)return [];
  const inner=circle(RING_RADIUS-RING_WIDTH/2-padding);
  if(!inner||inner[1]<=lo||inner[0]>=hi)return [[lo,hi]];
  return [[lo,Math.min(hi,inner[0])],[Math.max(lo,inner[1]),hi]].filter(([a,b])=>b>a);
}

// A continuous shape shared by the low-resolution rock silhouettes and editable
// density grids. All six families stay within the 4 m mining domain.
export function asteroidField(x,y,z,family=0){
  const length=Math.hypot(x,y,z),grain=.08*Math.sin(x*5+z*2)*Math.sin(y*4-z*3);
  if(family===0)return Math.max(Math.abs(x)*.86+Math.abs(y)*.19,Math.abs(y)*.94+Math.abs(z)*.18,Math.abs(z)*.91+Math.abs(x)*.22)-1.2+grain;
  if(family===1)return Math.max(length-1.45,(x+y*.5+z*.2)-1.03,(-x+y*.4-z*.7)-1.15)+grain;
  if(family===2)return Math.min(Math.hypot(x+.45,y,z)-1.05,Math.hypot(x-.45,y-.15,z+.2)-1.12)+grain*.4;
  if(family===3)return Math.hypot(x*.85,y*1.55,z*.9)-1.3+grain+Math.sin(y*18)*.045;
  if(family===4)return Math.max(length-1.43,-(Math.hypot(x-.3,y-1.24,z-.35)-.68),-(Math.hypot(x+1.1,y+.3,z-.6)-.5))+grain;
  return Math.max(length-1.5,Math.abs(x*.5-y*.7+z*.4)-.98)+grain*1.5;
}
