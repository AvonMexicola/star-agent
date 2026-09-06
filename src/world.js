// CPU world positions use IEEE-754 doubles (JavaScript Number), measured in metres.
export const RADIUS = 6_371_000 / 4;
export const ATMOSPHERE_HEIGHT = 70_000;
export const SUN_DISTANCE = 25_000_000_000;
// Photospheric radius of the star. Seen from Aeon it subtends 2×asin(R/D) ≈ 1.10°, about twice Sol from Earth.
export const SUN_RADIUS = 240_000_000;
export const SUN_ANGULAR_RADIUS = Math.asin(SUN_RADIUS / SUN_DISTANCE);
export const SUN_DIRECTION = [.9,.35,.12].map(v=>v/Math.hypot(.9,.35,.12));
import { SEED } from './generation.js';
import { validateTerrainGrid } from './terrain-resolution.js';
import { generatePatchSurface } from './patch-surface-data.js';
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

export function generatePatch({face,level,ix,iy,grid=GRID,parentGrid=grid,surfaceDetail=false}) {
  validateTerrainGrid(grid);validateTerrainGrid(parentGrid);
  const size=2/2**level,u0=-1+ix*size,v0=-1+iy*size;
  const center=cubeDirection(face,u0+size/2,v0+size/2).map(v=>v*RADIUS);
  const count=(grid+1)**2+4*(grid+1);
  const positions=new Float32Array(count*3),normals=new Float32Array(count*3),colors=new Float32Array(count*3);
  const directions=new Float32Array(count*3),waterPositions=new Float32Array(count*3);
  const heights=new Float32Array(count);
  function sample(u,v,sampleLevel,sampleGrid) {
    const d=cubeDirection(face,u,v),h=terrainHeight(...d);
    const step=Math.max(.4,Math.min(200,(2/2**sampleLevel)*RADIUS/sampleGrid*.5));
    let tx=d[2],ty=0,tz=-d[0];let len=Math.hypot(tx,tz);
    if(len<.01){tx=1;tz=0;len=1;}tx/=len;tz/=len;
    const bx=d[1]*tz,by=d[2]*tx-d[0]*tz,bz=-d[1]*tx;
    const eps=step/RADIUS;
    const heightOffset=(ax,ay,az)=>{const nx=d[0]+ax*eps,ny=d[1]+ay*eps,nz=d[2]+az*eps,l=Math.hypot(nx,ny,nz);return terrainHeight(nx/l,ny/l,nz/l);};
    const normalDetail=smoothstep(2,7,sampleLevel);
    const dhT=(heightOffset(tx,ty,tz)-heightOffset(-tx,-ty,-tz))/(2*step)*normalDetail;
    const dhB=(heightOffset(bx,by,bz)-heightOffset(-bx,-by,-bz))/(2*step)*normalDetail;
    const color=surfaceColor(...d,h,Math.atan(Math.hypot(dhT,dhB)));
    const nx=d[0]-tx*dhT-bx*dhB,ny=d[1]-ty*dhT-by*dhB,nz=d[2]-tz*dhT-bz*dhB;
    const nl=Math.hypot(nx,ny,nz);
    return {d,h,color,normal:[nx/nl,ny/nl,nz/nl]};
  }
  function write(index,u,v,skirt=0) {
    const {d,h,color,normal}=sample(u,v,level,grid),k=index*3;
    for(let a=0;a<3;a++){positions[k+a]=d[a]*(RADIUS+h-skirt)-center[a];directions[k+a]=d[a];waterPositions[k+a]=d[a]*(RADIUS-skirt)-center[a];}
    heights[index]=h;normals.set(normal,k);colors.set(color,k);
  }
  for(let j=0;j<=grid;j++)for(let i=0;i<=grid;i++)write(j*(grid+1)+i,u0+size*i/grid,v0+size*j/grid);
  const indices=[];
  for(let j=0;j<grid;j++)for(let i=0;i<grid;i++){const a=j*(grid+1)+i,b=a+1,c=a+grid+1,d=c+1;indices.push(a,b,c,b,d,c);}
  const edges=[Array.from({length:grid+1},(_,i)=>i),Array.from({length:grid+1},(_,j)=>j*(grid+1)+grid),Array.from({length:grid+1},(_,i)=>grid*(grid+1)+grid-i),Array.from({length:grid+1},(_,j)=>(grid-j)*(grid+1))];
  let next=(grid+1)**2;
  const depth=Math.max(4,size*RADIUS*.045);
  for(const edge of edges){const start=next;for(const src of edge){const i=src%(grid+1),j=Math.floor(src/(grid+1));write(next++,u0+size*i/grid,v0+size*j/grid,depth);}for(let i=0;i<grid;i++)indices.push(edge[i],start+i,edge[i+1],edge[i+1],start+i,start+i+1);}
  // Child vertices start on the actual parent triangles (including its b–c
  // diagonal), not a bilinear height field. Reconstruct the parent's stored local
  // Float32 vertices in doubles before converting to this child's local frame.
  const parentPositions=positions.slice(),parentWaterPositions=waterPositions.slice();
  const parentNormals=normals.slice(),parentColors=colors.slice(),parentHeights=heights.slice();
  if(level>0){
    const parentSize=size*2,pu0=-1+Math.floor(ix/2)*parentSize,pv0=-1+Math.floor(iy/2)*parentSize;
    const parentCenter=cubeDirection(face,pu0+parentSize/2,pv0+parentSize/2).map(v=>v*RADIUS);
    const cache=new Map();
    const parentVertex=(i,j)=>{
      const key=j*(parentGrid+1)+i;
      if(!cache.has(key)){
        const q=sample(pu0+parentSize*i/parentGrid,pv0+parentSize*j/parentGrid,level-1,parentGrid);
        q.position=q.d.map((d,a)=>Math.fround(d*(RADIUS+q.h)-parentCenter[a])+parentCenter[a]-center[a]);
        q.water=q.d.map((d,a)=>Math.fround(d*RADIUS-parentCenter[a])+parentCenter[a]-center[a]);
        q.normal=q.normal.map(Math.fround);q.color=q.color.map(Math.fround);q.h=Math.fround(q.h);
        cache.set(key,q);
      }
      return cache.get(key);
    };
    for(let j=0;j<=grid;j++)for(let i=0;i<=grid;i++){
      const px=(ix%2)*parentGrid/2+i*parentGrid/(2*grid),py=(iy%2)*parentGrid/2+j*parentGrid/(2*grid);
      const x=Math.min(parentGrid-1,Math.floor(px)),y=Math.min(parentGrid-1,Math.floor(py)),fx=px-x,fy=py-y;
      const terms=fx+fy<=1?[[x,y,1-fx-fy],[x+1,y,fx],[x,y+1,fy]]:[[x+1,y,1-fy],[x+1,y+1,fx+fy-1],[x,y+1,1-fx]];
      const vertex=j*(grid+1)+i,k=vertex*3;
      parentHeights[vertex]=0;
      for(let a=0;a<3;a++){parentPositions[k+a]=0;parentWaterPositions[k+a]=0;parentNormals[k+a]=0;parentColors[k+a]=0;}
      // Accumulate in doubles so rounding happens only after interpolation.
      const qs=terms.map(([x,y,w])=>[parentVertex(x,y),w]);
      parentHeights[vertex]=qs.reduce((sum,[q,w])=>sum+q.h*w,0);
      for(let a=0;a<3;a++){
        parentPositions[k+a]=qs.reduce((sum,[q,w])=>sum+q.position[a]*w,0);
        parentWaterPositions[k+a]=qs.reduce((sum,[q,w])=>sum+q.water[a]*w,0);
        parentNormals[k+a]=qs.reduce((sum,[q,w])=>sum+q.normal[a]*w,0);
        parentColors[k+a]=qs.reduce((sum,[q,w])=>sum+q.color[a]*w,0);
      }
    }
    let skirt=(grid+1)**2;
    for(const edge of edges)for(const src of edge){
      for(let a=0;a<3;a++){
        parentPositions[skirt*3+a]=parentPositions[src*3+a]-directions[src*3+a]*depth;
        parentWaterPositions[skirt*3+a]=parentWaterPositions[src*3+a]-directions[src*3+a]*depth;
        parentNormals[skirt*3+a]=parentNormals[src*3+a];parentColors[skirt*3+a]=parentColors[src*3+a];
      }
      parentHeights[skirt]=parentHeights[src];skirt++;
    }
  }
  const field=surfaceDetail?generatePatchSurface({face,level,ix,iy,radius:RADIUS,directionAt:cubeDirection,sample:(...d)=>({height:terrainHeight(...d)}),colorAt:surfaceColor}):null;
  return {center,positions,normals,colors,directions,waterPositions,heights,parentPositions,parentWaterPositions,parentNormals,parentColors,parentHeights,indices:new Uint16Array(indices),field};
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
