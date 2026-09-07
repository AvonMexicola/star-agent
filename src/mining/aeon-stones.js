import {Vector3,Quaternion} from 'three';
import {SEED,RADIUS,hash,terrainHeight,biomeAt} from '../world.js';
import {AEON,bodyAt,bodyAltitude,bodySurfaceNormal} from '../celestial.js';
import {asteroidField} from '../ring-world.js';
import {forestTilesAround,buildForestTile,FOREST_RECORD_STRIDE} from '../forest-distribution.js';

export const AEON_STONE_SPACING=32,AEON_STONE_RANGE=280;
export const AEON_STONE_ROWS=Math.round(Math.PI*RADIUS/AEON_STONE_SPACING);
export const AEON_STONE_SCALES=Object.freeze([.4,.58,.78,1,.7,.88]);
const TAU=Math.PI*2,step=Math.PI/AEON_STONE_ROWS,up=new Vector3(0,1,0);
const latitude=row=>-Math.PI/2+(row+.5)*step;
export const aeonStoneColumns=row=>Math.max(3,Math.round(TAU*RADIUS*Math.cos(latitude(row))/AEON_STONE_SPACING));
const forestTiles=new Map();let forestSeed=null;
function overlapsTrunk(direction,reach){
  if(forestSeed!==SEED){forestTiles.clear();forestSeed=SEED;}
  for(const tile of forestTilesAround(direction,reach)){
    let records=forestTiles.get(tile.key);
    if(!records){records=buildForestTile(tile).records;forestTiles.set(tile.key,records);if(forestTiles.size>64)forestTiles.delete(forestTiles.keys().next().value);}
    for(let i=0;i<records.length;i+=FOREST_RECORD_STRIDE){
      const distance=Math.hypot(records[i]-direction.x,records[i+1]-direction.y,records[i+2]-direction.z)*RADIUS;
      if(distance<reach)return true;
    }
  }
  return false;
}

export function aeonStoneField(x,y,z,variant){
  const scale=AEON_STONE_SCALES[variant];
  return asteroidField(x/scale,y/scale,z/scale,variant)*scale;
}

/** Stable seeded cells, independent of the viewer and of mining stream order.
 * The scale lives inside the density field, so cuts and mass remain in metres. */
export function aeonStoneDescriptor(row,column){
  if(!Number.isInteger(row)||row<0||row>=AEON_STONE_ROWS||!Number.isInteger(column))return null;
  const columns=aeonStoneColumns(row);column=((column%columns)+columns)%columns;
  if(hash(column,row,3011)>.52)return null;
  const lat=-Math.PI/2+(row+.15+hash(column,row,3012)*.7)*step,lon=(column+.15+hash(column,row,3013)*.7)/columns*TAU;
  const direction=new Vector3(Math.cos(lat)*Math.cos(lon),Math.sin(lat),Math.cos(lat)*Math.sin(lon));
  const height=terrainHeight(...direction.toArray());
  if(height<2||biomeAt(...direction.toArray(),height)==='POLAR ICE')return null;
  const ground=direction.clone().multiplyScalar(RADIUS+height),normal=bodySurfaceNormal(ground,AEON);
  // Avoid precarious cliff faces; embed the bottom, not the whole boulder.
  if(normal.dot(direction)<.8)return null;
  const variant=Math.min(5,Math.floor(hash(column,row,3014)*6));
  // Share the real seeded tree records, including their terrain exclusions.
  // Do not wrap a new boulder around an existing trunk or move a saved tree.
  if(overlapsTrunk(direction,AEON_STONE_SCALES[variant]*1.95+1))return null;
  const position=ground.addScaledVector(normal,AEON_STONE_SCALES[variant]*.46);
  const quaternion=new Quaternion().setFromUnitVectors(up,normal).multiply(new Quaternion().setFromAxisAngle(up,hash(column,row,3015)*TAU));
  const id=`aeon-stone-v1-${SEED}-${row}-${column}`;
  return {id,key:id,rockId:id,row,column,position,quaternion,direction:direction.toArray(),bodyId:'aeon',variant,
    resourceWeights:[1,0,0],dominant:'basalt',province:'loose-stone',name:'Basalt stone · concrete feedstock',mineable:true,regional:true,looseStone:true};
}

export function nearbyAeonStones(position,radius=AEON_STONE_RANGE+48){
  if(!Number.isFinite(radius)||radius<=0||radius>600)throw RangeError('Stone query radius must be between 0 and 600 metres');
  if(bodyAt(position).id!=='aeon'||Math.abs(bodyAltitude(position,AEON))>400)return [];
  const d=position.clone().normalize(),lat=Math.asin(Math.max(-1,Math.min(1,d.y))),lon=(Math.atan2(d.z,d.x)+TAU)%TAU;
  const angle=(radius+AEON_STONE_SPACING)/RADIUS,first=Math.max(0,Math.floor((lat-angle+Math.PI/2)/step)),last=Math.min(AEON_STONE_ROWS-1,Math.floor((lat+angle+Math.PI/2)/step)),result=[];
  for(let row=first;row<=last;row++){
    const rowLat=latitude(row),columns=aeonStoneColumns(row),denom=Math.cos(lat)*Math.cos(rowLat);
    const ratio=denom<1e-12?-1:(Math.cos(angle)-Math.sin(lat)*Math.sin(rowLat))/denom;
    if(ratio>1)continue;
    const reach=ratio<=-1?columns:Math.ceil(Math.acos(Math.max(-1,ratio))/TAU*columns)+1,mid=Math.floor(lon/TAU*columns),seen=new Set();
    for(let offset=-Math.min(reach,columns);offset<=Math.min(reach,columns);offset++){
      const column=((mid+offset)%columns+columns)%columns;if(seen.has(column))continue;seen.add(column);
      const descriptor=aeonStoneDescriptor(row,column);
      if(descriptor&&descriptor.position.distanceTo(position)<=radius)result.push(descriptor);
    }
  }
  return result.sort((a,b)=>a.position.distanceToSquared(position)-b.position.distanceToSquared(position)||a.id.localeCompare(b.id));
}
