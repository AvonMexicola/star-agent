import {miningFuelProfile} from './power-fuels.js';
import {Vector3,Quaternion,Matrix4} from 'three';
import {bodyAt,bodySurfacePoint,bodySurfaceNormal,bodyAltitude} from '../celestial.js';
import {toPyreBody,fromPyreBody} from '../pyre-world.js';
const bodyDirection=(direction,body)=>body.id==='pyre'?new Vector3(...toPyreBody(...direction.toArray())):direction;
const worldDirection=(direction,body)=>body.id==='pyre'?new Vector3(...fromPyreBody(...direction.toArray())):direction;
// Stable body-local spherical cells. Aeon is frequent; Pyre requires longer surveys.
const TAU=Math.PI*2;
const spacingFor=body=>body.id==='pyre'?300:120;
const stepFor=body=>Math.PI/Math.round(Math.PI*body.radius/spacingFor(body));
const layout=body=>({rows:Math.round(Math.PI*body.radius/spacingFor(body)),step:stepFor(body),spacing:spacingFor(body),center:new Vector3(...body.center)});
const hash=(row,column,salt)=>{let h=Math.imul(row+1,374761393)^Math.imul(column+1,668265263)^Math.imul(salt+1,1274126177);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;};
const latitude=(body,row)=>-Math.PI/2+(row+.5)*stepFor(body);
const columnsFor=(body,row)=>Math.max(3,Math.round(TAU*body.radius*Math.cos(latitude(body,row))/spacingFor(body)));


export function constructionDepositCell(position,body=bodyAt(position)){
  const {rows,step,spacing,center}=layout(body);
  const d=bodyDirection(position.clone().sub(center).normalize(),body),row=Math.max(0,Math.min(rows-1,Math.floor((Math.asin(Math.max(-1,Math.min(1,d.y)))+Math.PI/2)/step)));
  const columns=columnsFor(body,row),longitude=(Math.atan2(d.z,d.x)+TAU)%TAU;
  return [row,Math.min(columns-1,Math.floor(longitude/TAU*columns))];
}

/** Each dry-land cell contains finite common feedstock. The
 * longitude count shrinks towards the poles, so deposits never pile up there. */
export function constructionDepositDescriptor(body,row,column){
  if(body.id!=='aeon'&&body.id!=='pyre')return null;
  const {rows,step,spacing,center}=layout(body);
  if(!Number.isInteger(row)||row<0||row>=rows||!Number.isInteger(column))return null;
  const columns=columnsFor(body,row);column=((column%columns)+columns)%columns;
  const lat=-Math.PI/2+(row+.25+hash(row,column,0)*.5)*step,lon=(column+.25+hash(row,column,1)*.5)/columns*TAU;
  const direction=worldDirection(new Vector3(Math.cos(lat)*Math.cos(lon),Math.sin(lat),Math.cos(lat)*Math.sin(lon)),body);

  if(body.id==='aeon'&&body.height(...direction.toArray())<2)return null;
  const ground=bodySurfacePoint(direction,body),up=bodySurfaceNormal(ground,body);
  // Embed the base in the actual terrain normal, including sloped crater walls.
  const position=ground.addScaledVector(up,.65),localUp=bodyDirection(up.clone(),body);
  const right=worldDirection(new Vector3().crossVectors(Math.abs(localUp.y)<.9?new Vector3(0,1,0):new Vector3(1,0,0),localUp).normalize(),body);
  const quaternion=new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(right,up,right.clone().cross(up).normalize()));
  quaternion.multiply(new Quaternion().setFromAxisAngle(new Vector3(0,1,0),hash(row,column,3)*TAU));
  const id=`${body.id}-construction-v1-${row}-${column}`;
  // Sample at the final anchor, the exact same direction MineableRock uses.
  const anchorDirection=position.clone().sub(center).normalize().toArray(),profile={weights:hash(row,column,2)<.2?[.4,.6,0]:[.96,.04,0],dominant:hash(row,column,2)<.2?'copper':'basalt',province:'construction'};
  return {id,key:id,rockId:id,row,column,position,direction:anchorDirection,quaternion,resourceWeights:profile.weights,dominant:profile.dominant,province:profile.province,bodyId:body.id,name:miningFuelProfile(id,body.id)?.label??`${profile.dominant==='copper'?'Common copper':'Construction mineral'} outcrop`,variant:Math.floor(hash(row,column,4)*6),mineable:true,regional:true};
}

/** A bounded spherical-cap query, with no global population or seam state.
 * Callers cache its result while moving within one cell. Positions stay doubles. */
export function nearbyConstructionDeposits(position,radius=400){
  const body=bodyAt(position);
  if(body.id!=='aeon'&&body.id!=='pyre')return [];
  const {rows,step,spacing,center}=layout(body);
  if(!Number.isFinite(radius)||radius<=0||radius>1000)throw RangeError('Surface deposit query radius must be between 0 and 1000 metres');
  const relative=position.clone().sub(center),length=relative.length();
  if(length<body.radius-20000||length>body.radius+50000||Math.abs(bodyAltitude(position,body))>1000)return [];
  const d=bodyDirection(relative.divideScalar(length),body),lat=Math.asin(Math.max(-1,Math.min(1,d.y))),lon=(Math.atan2(d.z,d.x)+TAU)%TAU;
  // The extra cell covers jitter and lets streaming reuse this list anywhere
  // inside the current cell. Only actual world distances pass the final filter.
  const angle=(radius+spacing)/body.radius;
  const first=Math.max(0,Math.floor((lat-angle+Math.PI/2)/step)),last=Math.min(rows-1,Math.floor((lat+angle+Math.PI/2)/step)),result=[];
  for(let row=first;row<=last;row++){
    const rowLat=latitude(body,row),columns=columnsFor(body,row),denominator=Math.cos(lat)*Math.cos(rowLat);
    const ratio=denominator<1e-12?-1:(Math.cos(angle)-Math.sin(lat)*Math.sin(rowLat))/denominator;
    if(ratio>1)continue;
    const reach=ratio<=-1?columns:Math.ceil(Math.acos(Math.max(-1,ratio))/TAU*columns)+1,mid=Math.floor(lon/TAU*columns),seen=new Set();
    for(let offset=-Math.min(reach,columns);offset<=Math.min(reach,columns);offset++){
      const column=((mid+offset)%columns+columns)%columns;if(seen.has(column))continue;seen.add(column);
      const descriptor=constructionDepositDescriptor(body,row,column);
      if(descriptor&&descriptor.position.distanceTo(position)<=radius)result.push(descriptor);
    }
  }
  return result.sort((a,b)=>a.position.distanceToSquared(position)-b.position.distanceToSquared(position)||a.id.localeCompare(b.id));
}
