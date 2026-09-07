import {Vector3,Quaternion,Matrix4} from 'three';
import {MOON_RADIUS,MOON_POSITION,MOON_MAX_HEIGHT,MOON_LANDING_DIRECTION,LANDING_FRAME,RESOURCE_PROVINCES,moonResources} from '../moon-world.js';
import {bodySurfacePoint,bodySurfaceNormal,bodyAltitude,SELENE} from '../celestial.js';

// This version owns cell positions, occupancy and shape seeds. Changes to those
// rules require a new version; saved density fields retain their original IDs.
export const SURFACE_DEPOSIT_VERSION=1;
export const SURFACE_DEPOSIT_SPACING=180;
export const SURFACE_DEPOSIT_RANGE=400;
export const SURFACE_DEPOSIT_WORKERS=3;
export const SURFACE_DEPOSIT_ROWS=Math.round(Math.PI*MOON_RADIUS/SURFACE_DEPOSIT_SPACING);
const STEP=Math.PI/SURFACE_DEPOSIT_ROWS,TAU=Math.PI*2,center=new Vector3(...MOON_POSITION);
const hash=(row,column,salt)=>{let h=Math.imul(row+1,374761393)^Math.imul(column+1,668265263)^Math.imul(salt+1,1274126177);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;};
const latitude=row=>-Math.PI/2+(row+.5)*STEP;
export const surfaceDepositColumns=row=>Math.max(3,Math.round(TAU*MOON_RADIUS*Math.cos(latitude(row))/SURFACE_DEPOSIT_SPACING));
const exclusions=[new Vector3(...MOON_LANDING_DIRECTION).addScaledVector(new Vector3(...LANDING_FRAME.east),-19/MOON_RADIUS).addScaledVector(new Vector3(...LANDING_FRAME.north),8/MOON_RADIUS).normalize(),...RESOURCE_PROVINCES.map(p=>new Vector3(...p.direction))];

export function surfaceDepositCell(position){
  const d=position.clone().sub(center).normalize(),row=Math.max(0,Math.min(SURFACE_DEPOSIT_ROWS-1,Math.floor((Math.asin(Math.max(-1,Math.min(1,d.y)))+Math.PI/2)/STEP)));
  const columns=surfaceDepositColumns(row),longitude=(Math.atan2(d.z,d.x)+TAU)%TAU;
  return [row,Math.min(columns-1,Math.floor(longitude/TAU*columns))];
}

/** Every mineral-rich cell contains an outcrop. Basalt cells are sparser. The
 * longitude count shrinks towards the poles, so deposits never pile up there. */
export function surfaceDepositDescriptor(row,column){
  if(!Number.isInteger(row)||row<0||row>=SURFACE_DEPOSIT_ROWS||!Number.isInteger(column))return null;
  const columns=surfaceDepositColumns(row);column=((column%columns)+columns)%columns;
  const lat=-Math.PI/2+(row+.25+hash(row,column,0)*.5)*STEP,lon=(column+.25+hash(row,column,1)*.5)/columns*TAU;
  const direction=new Vector3(Math.cos(lat)*Math.cos(lon),Math.sin(lat),Math.cos(lat)*Math.sin(lon));
  if(exclusions.some(d=>d.distanceToSquared(direction)*MOON_RADIUS**2<80**2))return null;
  const resources=moonResources(...direction.toArray());
  if(Math.max(resources.weights[1],resources.weights[2])<.45&&hash(row,column,2)>.4)return null;
  const ground=bodySurfacePoint(direction,SELENE),up=bodySurfaceNormal(ground,SELENE);
  // Embed the base in the actual terrain normal, including sloped crater walls.
  const position=ground.addScaledVector(up,.65),right=new Vector3().crossVectors(Math.abs(up.y)<.9?new Vector3(0,1,0):new Vector3(1,0,0),up).normalize();
  const quaternion=new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(right,up,right.clone().cross(up).normalize()));
  quaternion.multiply(new Quaternion().setFromAxisAngle(new Vector3(0,1,0),hash(row,column,3)*TAU));
  const id=`selene-deposit-v${SURFACE_DEPOSIT_VERSION}-${row}-${column}`;
  // Sample at the final anchor, the exact same direction MineableRock uses.
  const anchorDirection=position.clone().sub(center).normalize().toArray(),profile=moonResources(...anchorDirection);
  return {id,key:id,rockId:id,row,column,position,direction:anchorDirection,quaternion,resourceWeights:profile.weights,dominant:profile.dominant,province:profile.province,name:`${profile.dominant[0].toUpperCase()+profile.dominant.slice(1)} outcrop`,variant:Math.floor(hash(row,column,4)*6),mineable:true,regional:true};
}

/** A bounded spherical-cap query, with no global population or seam state.
 * Callers cache its result while moving within one cell. Positions stay doubles. */
export function nearbySurfaceDeposits(position,radius=SURFACE_DEPOSIT_RANGE){
  if(!Number.isFinite(radius)||radius<=0||radius>1000)throw RangeError('Surface deposit query radius must be between 0 and 1000 metres');
  const relative=position.clone().sub(center),length=relative.length();
  if(length<MOON_RADIUS-20000||length>MOON_RADIUS+MOON_MAX_HEIGHT+1000||Math.abs(bodyAltitude(position,SELENE))>1000)return [];
  const d=relative.divideScalar(length),lat=Math.asin(Math.max(-1,Math.min(1,d.y))),lon=(Math.atan2(d.z,d.x)+TAU)%TAU;
  // The extra cell covers jitter and lets streaming reuse this list anywhere
  // inside the current cell. Only actual world distances pass the final filter.
  const angle=(radius+SURFACE_DEPOSIT_SPACING)/MOON_RADIUS;
  const first=Math.max(0,Math.floor((lat-angle+Math.PI/2)/STEP)),last=Math.min(SURFACE_DEPOSIT_ROWS-1,Math.floor((lat+angle+Math.PI/2)/STEP)),result=[];
  for(let row=first;row<=last;row++){
    const rowLat=latitude(row),columns=surfaceDepositColumns(row),denominator=Math.cos(lat)*Math.cos(rowLat);
    const ratio=denominator<1e-12?-1:(Math.cos(angle)-Math.sin(lat)*Math.sin(rowLat))/denominator;
    if(ratio>1)continue;
    const reach=ratio<=-1?columns:Math.ceil(Math.acos(Math.max(-1,ratio))/TAU*columns)+1,mid=Math.floor(lon/TAU*columns),seen=new Set();
    for(let offset=-Math.min(reach,columns);offset<=Math.min(reach,columns);offset++){
      const column=((mid+offset)%columns+columns)%columns;if(seen.has(column))continue;seen.add(column);
      const descriptor=surfaceDepositDescriptor(row,column);
      if(descriptor&&descriptor.position.distanceTo(position)<=radius)result.push(descriptor);
    }
  }
  return result.sort((a,b)=>a.position.distanceToSquared(position)-b.position.distanceToSquared(position)||a.id.localeCompare(b.id));
}
