// One bounded, editable rock. Negative density is solid; coordinates are rock-local metres.
export const ROCK_VERSION=1, CELLS=32, STEP=.125, SIDE=CELLS+1, HALF=CELLS*STEP/2;
export const ROCK_ID='selene-crescent-ore-01';
export const index=(x,y,z)=>x+SIDE*(y+SIDE*z);
export const coord=i=>i*STEP-HALF;
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function rockField(x,y,z){
  const shape=Math.pow((x/1.65)**4+(y/1.55)**4+(z/1.48)**4,.25)-1;
  const cut=Math.max((x*.65+y*.7+z*.22)-1.33,(-x*.55+y*.6-z*.55)-1.43);
  const grain=Math.sin(x*4.1+z*2.3)*Math.sin(y*3.3-z*1.7)*.065+Math.sin(x*11+y*7+z*5)*.015;
  return Math.max(shape*1.4,cut)+grain;
}
// Stable, normalized per-rock weights select discrete mineral layers. The same
// classifier below is embedded in the material shader, so a visible vein is the
// resource that carving credits; rewards are never split by a uniform fraction.
export const RESOURCE_VEIN_VERSION=1;
export const VEIN_PROFILE=Object.freeze({linear:Object.freeze([.73,.41,.57]),warp:.13,frequency:Object.freeze([2.3,1.7,-1.9])});
export const MINERALS=Object.freeze(['Basalt','Copper ore','Ice']);
export const MINERAL_COLORS=Object.freeze([[.055,.072,.09],[.42,.18,.045],[.26,.54,.66]].map(Object.freeze));
export function normalizeResourceWeights(weights){
  if(weights==null)return null;
  if(weights.length!==3||!Array.from(weights).every(n=>Number.isFinite(n)&&n>=0))throw new RangeError('Expected three finite nonnegative resource weights');
  const sum=weights[0]+weights[1]+weights[2];
  if(!Number.isFinite(sum)||sum<=0)throw new RangeError('Resource weights must have a positive total');
  return Object.freeze(Array.from(weights,n=>n/sum));
}
export function veinPhase(x,y,z){
  const a=VEIN_PROFILE.linear,b=VEIN_PROFILE.frequency;
  const phase=x*a[0]+y*a[1]+z*a[2]+VEIN_PROFILE.warp*Math.sin(x*b[0]+y*b[1]+z*b[2]);
  return phase-Math.floor(phase);
}
function classifyMineral(x,y,z,weights){
  if(weights){const phase=veinPhase(x,y,z);return phase<weights[0]?0:phase<weights[0]+weights[1]?1:2;}
  const vein=x*.7+y*.32+Math.sin(z*2.8)*.19;
  if(Math.abs(vein)<.22)return 1;
  if(Math.abs(z*.65-y*.3+Math.sin(x*3)*.12-.58)<.15)return 2;
  return 0;
}
export function mineral(x,y,z,resourceWeights=null){return classifyMineral(x,y,z,normalizeResourceWeights(resourceWeights));}
function colorWithProfile(x,y,z,weights){
  const type=classifyMineral(x,y,z,weights),grain=.76+.24*Math.sin(x*31+y*17+z*23)**2;
  return MINERAL_COLORS[type].map(v=>v*grain);
}
export function rockColor(x,y,z,resourceWeights=null){return colorWithProfile(x,y,z,normalizeResourceWeights(resourceWeights));}
const glFloat=n=>Number.isInteger(n)?`${n}.0`:String(n);
const glVec=values=>`vec3(${values.map(glFloat).join(',')})`;
// Constants are generated from VEIN_PROFILE, shared with the CPU field above.
export const MINERAL_GLSL=`
float rockMineral(vec3 p,vec3 weights,bool weighted){
  if(weighted){
    float phase=fract(dot(p,${glVec(VEIN_PROFILE.linear)})+${glFloat(VEIN_PROFILE.warp)}*sin(dot(p,${glVec(VEIN_PROFILE.frequency)})));
    return phase<weights.x?0.0:phase<weights.x+weights.y?1.0:2.0;
  }
  if(abs(p.x*.7+p.y*.32+sin(p.z*2.8)*.19)<.22)return 1.0;
  if(abs(p.z*.65-p.y*.3+sin(p.x*3.0)*.12-.58)<.15)return 2.0;
  return 0.0;
}
vec3 rockMineralColor(float kind){return kind<.5?${glVec(MINERAL_COLORS[0])}:kind<1.5?${glVec(MINERAL_COLORS[1])}:${glVec(MINERAL_COLORS[2])};}
`;
export function createDensity(fieldFunction=rockField){
  const field=new Float32Array(SIDE**3);
  for(let z=0;z<SIDE;z++)for(let y=0;y<SIDE;y++)for(let x=0;x<SIDE;x++)field[index(x,y,z)]=fieldFunction(coord(x),coord(y),coord(z));
  return field;
}
const fill=v=>clamp(.5-v/STEP,0,1);
/** Approximate removed volume by a fixed nodal occupancy quadrature. It is stable
 * across frame rates/replay, and only newly removed solid earns material. */
export function carve(field,point,budget,radiusLimit=.48,resourceWeights=null){
  const weights=normalizeResourceWeights(resourceWeights);
  if(!point?.every(Number.isFinite)||!Number.isFinite(budget)||budget<=0)return null;
  const nodes=[];
  const bounds=point.map(v=>[clamp(Math.floor((v-radiusLimit+HALF)/STEP),0,CELLS),clamp(Math.ceil((v+radiusLimit+HALF)/STEP),0,CELLS)]);
  for(let z=bounds[2][0];z<=bounds[2][1];z++)for(let y=bounds[1][0];y<=bounds[1][1];y++)for(let x=bounds[0][0];x<=bounds[0][1];x++){
    const p=[coord(x),coord(y),coord(z)],d=Math.hypot(...p.map((v,i)=>v-point[i]));
    if(d<=radiusLimit+STEP)nodes.push({i:index(x,y,z),d,p,weight:STEP**3*(x===0||x===CELLS?.5:1)*(y===0||y===CELLS?.5:1)*(z===0||z===CELLS?.5:1)});
  }
  const amount=r=>nodes.reduce((sum,n)=>sum+(fill(field[n.i])-fill(Math.max(field[n.i],r-n.d)))*n.weight,0);
  let lo=0,hi=radiusLimit;
  for(let j=0;j<16;j++){const mid=(lo+hi)/2;if(amount(mid)>budget)hi=mid;else lo=mid;}
  const removed=amount(lo);if(removed<1e-8)return null;
  const next=field.slice(),yieldVolume=[0,0,0];
  for(const n of nodes){next[n.i]=Math.max(field[n.i],lo-n.d);yieldVolume[classifyMineral(...n.p,weights)]+=(fill(field[n.i])-fill(next[n.i]))*n.weight;}
  return {field:next,removed:yieldVolume.reduce((a,b)=>a+b,0),yieldVolume};
}

// Consistent six-tetrahedron split avoids ambiguous cube faces in this first
// fixed-resolution rock. All cells share diagonals; no mixed-resolution seams.
const corners=[[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]];
const tets=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]];
const edges=[[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];
export function meshVolume(field,resourceWeights=null){
  const weights=normalizeResourceWeights(resourceWeights);
  const positions=[],normals=[],colors=[];
  const gradient=new Float32Array(field.length*3);
  for(let z=0;z<SIDE;z++)for(let y=0;y<SIDE;y++)for(let x=0;x<SIDE;x++){
    const i=index(x,y,z)*3;
    gradient[i]=field[index(Math.min(CELLS,x+1),y,z)]-field[index(Math.max(0,x-1),y,z)];
    gradient[i+1]=field[index(x,Math.min(CELLS,y+1),z)]-field[index(x,Math.max(0,y-1),z)];
    gradient[i+2]=field[index(x,y,Math.min(CELLS,z+1))]-field[index(x,y,Math.max(0,z-1))];
  }
  for(let z=0;z<CELLS;z++)for(let y=0;y<CELLS;y++)for(let x=0;x<CELLS;x++){
    const ids=corners.map(c=>index(x+c[0],y+c[1],z+c[2]));
    if(ids.every(i=>field[i]>=0)||ids.every(i=>field[i]<0))continue;
    const points=corners.map(c=>[coord(x+c[0]),coord(y+c[1]),coord(z+c[2])]);
    for(const tet of tets){
      const vertices=[];
      for(const [a,b] of edges){const ca=tet[a],cb=tet[b],ia=ids[ca],ib=ids[cb],va=field[ia],vb=field[ib];if((va<0)===(vb<0))continue;
        const t=va/(va-vb),p=points[ca].map((v,j)=>v+(points[cb][j]-v)*t),n=[0,1,2].map(j=>gradient[ia*3+j]+(gradient[ib*3+j]-gradient[ia*3+j])*t),l=Math.hypot(...n)||1;
        vertices.push({p,n:n.map(v=>v/l)});
      }
      if(vertices.length<3)continue;
      const center=[0,1,2].map(j=>vertices.reduce((s,v)=>s+v.p[j],0)/vertices.length),normal=vertices[0].n;
      const u=vertices[0].p.map((v,j)=>v-center[j]);
      const v=[normal[1]*u[2]-normal[2]*u[1],normal[2]*u[0]-normal[0]*u[2],normal[0]*u[1]-normal[1]*u[0]];
      for(const p of vertices){const q=p.p.map((a,j)=>a-center[j]);p.angle=Math.atan2(q.reduce((s,a,j)=>s+a*v[j],0),q.reduce((s,a,j)=>s+a*u[j],0));}
      vertices.sort((a,b)=>a.angle-b.angle);
      for(let j=1;j<vertices.length-1;j++)for(const vertex of [vertices[0],vertices[j],vertices[j+1]]){positions.push(...vertex.p);normals.push(...vertex.n);colors.push(...colorWithProfile(...vertex.p,weights));}
    }
  }
  return {positions:new Float32Array(positions),normals:new Float32Array(normals),colors:new Float32Array(colors)};
}

/** Compact exact float snapshot, prepared off the render thread. */
export function encodeDensity(field){
  const bytes=new Uint8Array(field.length*4),view=new DataView(bytes.buffer);
  for(let i=0;i<field.length;i++)view.setFloat32(i*4,field[i],true);
  let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(binary);
}
export function decodeDensity(encoded){
  const binary=atob(encoded);if(binary.length!==SIDE**3*4)throw Error('Invalid density snapshot');
  const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0)),view=new DataView(bytes.buffer),field=new Float32Array(SIDE**3);
  for(let i=0;i<field.length;i++)field[i]=view.getFloat32(i*4,true);return field;
}
