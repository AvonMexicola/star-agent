// CPU world positions use IEEE-754 doubles (JavaScript Number), measured in metres.
export const RADIUS = 6_371_000 / 4;
export const ATMOSPHERE_HEIGHT = 70_000;
export const SUN_DISTANCE = 25_000_000_000;
// Photospheric radius of the star. Seen from Aeon it subtends 2×asin(R/D) ≈ 1.10°, about twice Sol from Earth.
export const SUN_RADIUS = 240_000_000;
export const SUN_ANGULAR_RADIUS = Math.asin(SUN_RADIUS / SUN_DISTANCE);
export const SUN_DIRECTION = [.9,.35,.12].map(v=>v/Math.hypot(.9,.35,.12));
import { SEED } from './generation.js';
export { SEED } from './generation.js';
export const MAX_LEVEL = 17;
export const GRID = 16;

export function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
export function smoothstep(a, b, x) { const t = clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); }
export function hash(x, y, z) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 2147483647) ^ SEED;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
export function noise(x, y, z) {
  const ix=Math.floor(x), iy=Math.floor(y), iz=Math.floor(z);
  let fx=x-ix, fy=y-iy, fz=z-iz;
  fx=fx*fx*(3-2*fx); fy=fy*fy*(3-2*fy); fz=fz*fz*(3-2*fz);
  const a=hash(ix,iy,iz), b=hash(ix+1,iy,iz), c=hash(ix,iy+1,iz), d=hash(ix+1,iy+1,iz);
  const e=hash(ix,iy,iz+1), f=hash(ix+1,iy,iz+1), g=hash(ix,iy+1,iz+1), h=hash(ix+1,iy+1,iz+1);
  return ((a+(b-a)*fx)*(1-fy)+(c+(d-c)*fx)*fy)*(1-fz)+((e+(f-e)*fx)*(1-fy)+(g+(h-g)*fx)*fy)*fz;
}
export function fbm(x,y,z,octaves=5) {
  let sum=0, amp=.5, norm=0;
  for(let i=0;i<octaves;i++){sum+=amp*noise(x,y,z);norm+=amp;x=x*2.03+17.1;y=y*2.03+9.2;z=z*2.03-13.7;amp*=.5;}
  return sum/norm;
}
// The sole height/biome/material source, shared by navigation and workers.
import { terrainHeight, moisture, biomeAt, surfaceColor, slopeAt } from './terrain-v2.js';
export { terrainHeight, moisture, biomeAt, surfaceColor } from './terrain-v2.js';
export function cubeDirection(face,u,v) {
  let x,y,z;
  if(face===0){x=1;y=v;z=-u;}else if(face===1){x=-1;y=v;z=u;}
  else if(face===2){x=u;y=1;z=-v;}else if(face===3){x=u;y=-1;z=v;}
  else if(face===4){x=u;y=v;z=1;}else{x=-u;y=v;z=-1;}
  const inv=1/Math.hypot(x,y,z);return [x*inv,y*inv,z*inv];
}
export function latLonDirection(lat,lon){const a=lat*Math.PI/180,b=lon*Math.PI/180;return [Math.cos(a)*Math.sin(b),Math.sin(a),Math.cos(a)*Math.cos(b)];}

export function generatePatch({face,level,ix,iy}) {
  const size=2/2**level,u0=-1+ix*size,v0=-1+iy*size;
  const center=cubeDirection(face,u0+size/2,v0+size/2).map(v=>v*RADIUS);
  const count=(GRID+1)**2+4*(GRID+1);
  const positions=new Float32Array(count*3),normals=new Float32Array(count*3),colors=new Float32Array(count*3);
  const directions=new Float32Array(count*3),waterPositions=new Float32Array(count*3);
  const heights=new Float32Array(count);
  const step=Math.max(.4,Math.min(200,size*RADIUS/GRID*.5));
  function write(index,u,v,skirt=0) {
    const d=cubeDirection(face,u,v),h=terrainHeight(...d),r=RADIUS+h-skirt;
    const k=index*3;
    for(let a=0;a<3;a++){positions[k+a]=d[a]*r-center[a];directions[k+a]=d[a];waterPositions[k+a]=d[a]*(RADIUS-skirt)-center[a];}
    heights[index]=h;
    // Tangent-space finite differences remain stable at metre-scale resolution.
    let tx=d[2],ty=0,tz=-d[0];let len=Math.hypot(tx,tz);
    if(len<.01){tx=1;tz=0;len=1;}tx/=len;tz/=len;
    const bx=d[1]*tz,by=d[2]*tx-d[0]*tz,bz=-d[1]*tx;
    const eps=step/RADIUS;
    const heightOffset=(ax,ay,az)=>{const nx=d[0]+ax*eps,ny=d[1]+ay*eps,nz=d[2]+az*eps,l=Math.hypot(nx,ny,nz);return terrainHeight(nx/l,ny/l,nz/l);};
    const normalDetail=smoothstep(2,7,level);
    const dhT=(heightOffset(tx,ty,tz)-heightOffset(-tx,-ty,-tz))/(2*step)*normalDetail;
    const dhB=(heightOffset(bx,by,bz)-heightOffset(-bx,-by,-bz))/(2*step)*normalDetail;
    colors.set(surfaceColor(...d,h,Math.atan(Math.hypot(dhT,dhB))),k);
    const nx=d[0]-tx*dhT-bx*dhB,ny=d[1]-ty*dhT-by*dhB,nz=d[2]-tz*dhT-bz*dhB;
    const nl=Math.hypot(nx,ny,nz);normals.set([nx/nl,ny/nl,nz/nl],k);
  }
  for(let j=0;j<=GRID;j++)for(let i=0;i<=GRID;i++)write(j*(GRID+1)+i,u0+size*i/GRID,v0+size*j/GRID);
  const indices=[];
  for(let j=0;j<GRID;j++)for(let i=0;i<GRID;i++){const a=j*(GRID+1)+i,b=a+1,c=a+GRID+1,d=c+1;indices.push(a,b,c,b,d,c);}
  const edges=[Array.from({length:GRID+1},(_,i)=>i),Array.from({length:GRID+1},(_,j)=>j*(GRID+1)+GRID),Array.from({length:GRID+1},(_,i)=>GRID*(GRID+1)+GRID-i),Array.from({length:GRID+1},(_,j)=>(GRID-j)*(GRID+1))];
  let next=(GRID+1)**2;
  const depth=Math.max(4,size*RADIUS*.045);
  for(const edge of edges){const start=next;for(const src of edge){const i=src%(GRID+1),j=Math.floor(src/(GRID+1));write(next++,u0+size*i/GRID,v0+size*j/GRID,depth);}for(let i=0;i<GRID;i++)indices.push(edge[i],start+i,edge[i+1],edge[i+1],start+i,start+i+1);}
  return {center,positions,normals,colors,directions,waterPositions,heights,indices:new Uint16Array(indices)};
}

export function findDestinations() {
  // Deterministic search: every shortcut leads to the actual procedural biome.
  const result={};let coastScore=Infinity,forestScore=Infinity,mountainScore=Infinity;
  for(let lat=-48;lat<=65;lat+=1.4)for(let lon=-85;lon<=85;lon+=1.4){
    const d=latLonDirection(lat,lon),h=terrainHeight(...d),m=moisture(...d);
    // Prefer the lit hemisphere near the initial orbital view.
    const bias=Math.abs(lat-19)*.3+Math.abs(lon-22)*.14;
    if(h>20&&h<180){const score=Math.abs(h-55)+bias;if(score<coastScore){coastScore=score;result.coast=d;}}
    if(h>150&&h<1500&&m>.5){const light=d.reduce((sum,value,axis)=>sum+value*SUN_DIRECTION[axis],0);const score=Math.abs(h-450)*.06+bias+Math.max(0,.65-light)*130+slopeAt(...d,h)*120;if(score<forestScore){forestScore=score;result.forest=d;}}
    if(h>2600&&h<4200){const score=Math.abs(h-3300)*.015+bias;if(score<mountainScore){mountainScore=score;result.mountain=d;}}
  }
  result.polar=latLonDirection(77,30);
  return result;
}

// Public terrain source for the second body; lunar rendering and contact must agree.
export { MOON_RADIUS, MOON_POSITION, MOON_GRAVITY, MOON_LANDING_DIRECTION, moonSurface } from './moon-world.js';
