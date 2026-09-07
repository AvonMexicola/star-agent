import {Vector3,Quaternion} from 'three';
import {RADIUS,SEED,hash,terrainSample,biomeAt,findDestinations} from './world.js';
import {LANDMARK_FAMILIES,LANDMARK_VARIANTS,landmarkOccupies} from './landmark-geometry.js';

export const LANDMARK_GENERATOR_VERSION=1;
// Population revision 2 thins the v1 field without relocating retained rocks.
// Renderer, vegetation workers and authoritative collision use this same gate.
export const LANDMARK_POPULATION_REVISION=2;
export const LANDMARK_CELL_CHANCE=.026;
export const LANDMARK_SPACING=320,LANDMARK_RANGE=10000,LANDMARK_BOUND=150;
export const LANDMARK_ROWS=Math.round(Math.PI*RADIUS/LANDMARK_SPACING);
const TAU=Math.PI*2,step=Math.PI/LANDMARK_ROWS,up=new Vector3(0,1,0),cache=new Map();let cachedSeed,arrivals=[];
const latitude=row=>-Math.PI/2+(row+.5)*step;
export const landmarkColumns=row=>Math.max(3,Math.round(TAU*RADIUS*Math.cos(latitude(row))/LANDMARK_SPACING));
const wrap=(n,period)=>(n%period+period)%period;

/** Rare bedrock: 80% fewer candidates than the original .13 cell gate.
 * IDs and frame are invariant under camera movement, query order and LOD. */
export function landmarkDescriptor(row,column){
  if(!Number.isInteger(row)||row<0||row>=LANDMARK_ROWS||!Number.isInteger(column))return null;
  if(cachedSeed!==SEED){cache.clear();cachedSeed=SEED;arrivals=Object.values(findDestinations()).map(d=>new Vector3(...d));}
  const columns=landmarkColumns(row);column=wrap(column,columns);const key=`${row}/${column}`;
  if(cache.has(key))return cache.get(key);
  let descriptor=null;
  if(hash(column,row,70311)<LANDMARK_CELL_CHANCE){
    const lat=-Math.PI/2+(row+.3+hash(column,row,70312)*.4)*step,lon=(column+.3+hash(column,row,70313)*.4)/columns*TAU;
    const direction=new Vector3(Math.cos(lat)*Math.cos(lon),Math.sin(lat),Math.cos(lat)*Math.sin(lon));
    // Standard biome arrivals must remain clear for every supported world seed.
    if(arrivals.some(d=>direction.distanceTo(d)*RADIUS<180)){cache.set(key,null);return null;}
    const sample=terrainSample(...direction.toArray()),variant=Math.floor(hash(column,row,70314)*LANDMARK_VARIANTS),scale=.72+hash(column,row,70315)*.55;
    if(sample.height>18&&biomeAt(...direction.toArray(),sample.height)!=='POLAR ICE'){
      const quaternion=new Quaternion().setFromUnitVectors(up,direction).multiply(new Quaternion().setFromAxisAngle(up,TAU*hash(column,row,70316)));
      const footprint=100*scale,right=new Vector3(1,0,0).applyQuaternion(quaternion),forward=new Vector3(0,0,1).applyQuaternion(quaternion);
      let low=sample.height,high=sample.height;
      for(let i=0;i<8;i++){
        const theta=i/8*TAU,d=direction.clone().addScaledVector(right,Math.cos(theta)*footprint/RADIUS).addScaledVector(forward,Math.sin(theta)*footprint/RADIUS).normalize();
        const h=terrainSample(...d.toArray()).height;low=Math.min(low,h);high=Math.max(high,h);
      }
      // Deep foundations on a shared, moderately sloped surface. No floating
      // bases at cliffs or submerged coastal blocks; no change to the floor.
      if(low>8&&high-low<28){
        const id=`aeon-landmark-v${LANDMARK_GENERATOR_VERSION}-${SEED}-${row}-${column}`;
        descriptor={id,row,column,direction,position:direction.clone().multiplyScalar(RADIUS+low),quaternion,scale,variant,
          footprint,bound:LANDMARK_BOUND,name:LANDMARK_FAMILIES[variant%6],bodyId:'aeon',mineable:false};
      }
    }
  }
  cache.set(key,descriptor);if(cache.size>8192)cache.delete(cache.keys().next().value);
  return descriptor;
}

/** Cheap bounded cell enumeration. Descriptor work can be streamed separately. */
export function landmarkCells(direction,radius){
  if(!Number.isFinite(radius)||radius<0||radius>LANDMARK_RANGE+1024)throw RangeError('Invalid landmark query radius');
  const d=direction.clone().normalize(),lat=Math.asin(Math.max(-1,Math.min(1,d.y))),lon=wrap(Math.atan2(d.z,d.x),TAU);
  const angle=(radius+LANDMARK_SPACING)/RADIUS,first=Math.max(0,Math.floor((lat-angle+Math.PI/2)/step)),last=Math.min(LANDMARK_ROWS-1,Math.floor((lat+angle+Math.PI/2)/step)),result=[];
  for(let row=first;row<=last;row++){
    const rowLat=latitude(row),columns=landmarkColumns(row),denom=Math.cos(lat)*Math.cos(rowLat);
    const ratio=denom<1e-12?-1:(Math.cos(angle)-Math.sin(lat)*Math.sin(rowLat))/denom;if(ratio>1)continue;
    const reach=ratio<=-1?columns:Math.ceil(Math.acos(Math.max(-1,ratio))/TAU*columns)+1,mid=Math.floor(lon/TAU*columns),seen=new Set();
    for(let offset=-Math.min(reach,columns);offset<=Math.min(reach,columns);offset++){
      const column=wrap(mid+offset,columns);if(seen.has(column))continue;seen.add(column);
      const phi=column/columns*TAU,roughDistance=Math.hypot(Math.cos(rowLat)*Math.cos(phi)-d.x,Math.sin(rowLat)-d.y,Math.cos(rowLat)*Math.sin(phi)-d.z)*RADIUS;
      if(roughDistance<radius+LANDMARK_SPACING)result.push({row,column,distance:roughDistance});
    }
  }
  return result.sort((a,b)=>a.distance-b.distance||a.row-b.row||a.column-b.column);
}
export function nearbyLandmarks(position,radius=1000){
  if(Math.abs(position.length()-RADIUS)>20000)return [];
  return landmarkCells(position,radius+LANDMARK_BOUND).map(c=>landmarkDescriptor(c.row,c.column)).filter(d=>d&&d.position.distanceTo(position)<radius+LANDMARK_BOUND);
}

// Plant exclusion is a deterministic footprint, shared by forest workers and
// all grass LODs. It does not depend on whether a landmark has streamed visually.
let exclusionCell='',exclusions=[];
export function landmarkExcludes(x,y,z,margin=0){
  const lat=Math.asin(Math.max(-1,Math.min(1,y))),row=Math.max(0,Math.min(LANDMARK_ROWS-1,Math.floor((lat+Math.PI/2)/step)));
  const col=Math.floor(wrap(Math.atan2(z,x),TAU)/TAU*landmarkColumns(row)),key=`${SEED}/${row}/${col}`;
  if(exclusionCell!==key){
    exclusionCell=key;const phi=(col+.5)/landmarkColumns(row)*TAU,lat=latitude(row);
    const center=new Vector3(Math.cos(lat)*Math.cos(phi),Math.sin(lat),Math.cos(lat)*Math.sin(phi));
    exclusions=landmarkCells(center,LANDMARK_SPACING+LANDMARK_BOUND+32).map(c=>landmarkDescriptor(c.row,c.column)).filter(Boolean);
  }
  let ground;
  return exclusions.some(d=>{
    if(Math.hypot(x-d.direction.x,y-d.direction.y,z-d.direction.z)*RADIUS>=d.footprint+margin)return false;
    ground??=new Vector3(x,y,z).multiplyScalar(RADIUS+terrainSample(x,y,z).height);
    const local=ground.clone().sub(d.position).applyQuaternion(d.quaternion.clone().invert()).divideScalar(d.scale);
    return landmarkOccupies(d.variant,local.x,local.y,local.z,margin/d.scale,Math.max(1,margin*2)/d.scale);
  });
}
