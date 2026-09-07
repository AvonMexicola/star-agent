import {PIECES,STOREY} from './definitions.js';
import {rectangle,transformPolygon,contains} from './polygons.js';
export const MAX_ROOF_SPAN=2;
const near=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1])<.04;
export const isPanel=p=>['foundation','floor'].includes(PIECES[p.type]?.category)&&PIECES[p.type].shape!=='ramp';
export const footprint=p=>transformPolygon(PIECES[p.type].polygon??rectangle(...PIECES[p.type].footprint),p);
export function panelEdges(p){
 if(!isPanel(p))return [];
 const vertices=footprint(p),edges=vertices.map((a,i)=>({a,b:vertices[(i+1)%vertices.length],y:p.position[1]}));
 // Arc chords are for collision only; the two radius edges receive full walls.
 return edges.filter(e=>Math.hypot(e.b[0]-e.a[0],e.b[1]-e.a[1])>=3.99);
}
export const sameEdge=(a,b)=>near(a.a,b.a)&&near(a.b,b.b)||near(a.a,b.b)&&near(a.b,b.a);
export const adjacentPanels=(a,b)=>Math.abs(a.position[1]-b.position[1])<.03&&panelEdges(a).some(e=>panelEdges(b).some(f=>sameEdge(e,f)));
export const matchingQuarter=(a,b)=>PIECES[a.type]?.shape==='quarter'&&PIECES[b.type]?.shape==='quarter'&&Math.hypot(a.position[0]-b.position[0],a.position[2]-b.position[2])<.03&&Math.cos((a.rotation??0)-(b.rotation??0))>.9999;
export function wallEdge(w){const width=PIECES[w.type].footprint[0],points=transformPolygon(PIECES[w.type].shape==='quarter'?[[2,-2],[-2,2]]:[[-width/2,0],[width/2,0]],w);return {a:points[0],b:points[1]};}
export function wallOnPanel(w,p,top=false){if(!isPanel(p)||Math.abs(w.position[1]+(top?PIECES[w.type].height:0)-p.position[1])>.03)return false;if(PIECES[w.type].shape==='quarter')return matchingQuarter(w,p);const edge=wallEdge(w);return panelEdges(p).some(e=>{
 if(top&&Math.hypot(e.b[0]-e.a[0],e.b[1]-e.a[1])<PIECES[w.type].footprint[0]-.01){const dx=edge.b[0]-edge.a[0],dz=edge.b[1]-edge.a[1],length=Math.hypot(dx,dz);return [e.a,e.b].every(v=>Math.abs((v[0]-edge.a[0])*dz-(v[1]-edge.a[1])*dx)/length<.03&&((v[0]-edge.a[0])*dx+(v[1]-edge.a[1])*dz)/length>=-.03&&((v[0]-edge.a[0])*dx+(v[1]-edge.a[1])*dz)/length<=length+.03);}
 // Larger pad edges can carry several ordinary wall modules.
 const dx=e.b[0]-e.a[0],dz=e.b[1]-e.a[1],length=Math.hypot(dx,dz);
 return [edge.a,edge.b].every(v=>Math.abs((v[0]-e.a[0])*dz-(v[1]-e.a[1])*dx)/length<.03&&((v[0]-e.a[0])*dx+(v[1]-e.a[1])*dz)/length>=-.03&&((v[0]-e.a[0])*dx+(v[1]-e.a[1])*dz)/length<=length+.03);
 });}
export function wallOnWall(upper,lower){
 if(PIECES[lower.type]?.category!=='wall'||Math.abs(lower.position[1]+PIECES[lower.type].height-upper.position[1])>.03)return false;
 if(PIECES[upper.type].shape==='quarter'||PIECES[lower.type].shape==='quarter')return matchingQuarter(upper,lower);
 return sameEdge(wallEdge(upper),wallEdge(lower));
}
export function supportedPieces(pieces){
 const support=new Map(pieces.filter(p=>PIECES[p.type]?.category==='foundation').map(p=>[p.id,0]));let changed=true;
 while(changed){changed=false;for(const p of pieces){const def=PIECES[p.type];if(def.category==='foundation')continue;let level=Infinity;
  if(def.category==='wall'&&pieces.some(a=>support.has(a.id)&&(wallOnPanel(p,a)||wallOnWall(p,a))))level=0;
  else if(def.category==='floor'){
   if(pieces.some(a=>support.has(a.id)&&PIECES[a.type]?.category==='wall'&&wallOnPanel(a,p,true)))level=0;
   for(const a of pieces)if(PIECES[a.type]?.category==='floor'&&support.has(a.id)&&adjacentPanels(a,p))level=Math.min(level,support.get(a.id)+1);
  }else if(def.category==='stairs'&&pieces.some(a=>support.has(a.id)&&isPanel(a)&&!['triangle','quarter'].includes(PIECES[a.type].shape)&&Math.abs(a.position[1]-p.position[1])<.03&&footprint({type:'stairs',...p}).every(([x,z])=>contains(footprint(a),x,z))))level=0;
  if(level<=MAX_ROOF_SPAN&&level<(support.get(p.id)??Infinity)){support.set(p.id,level);changed=true;}
 }}return support;
}
export function structuralReason(p,pieces){const category=PIECES[p.type].category;if(!['wall','floor','stairs'].includes(category))return null;const candidate={...p,id:'candidate'},support=supportedPieces([...pieces,candidate]);if(support.has(candidate.id))return null;return category==='wall'?'A matching supported floor edge is required.':category==='floor'?'Roof needs one supported wall or a roof edge within two panels of a wall.':'Place stairs on a supported square floor.';}
/** Align full-length edges across their common seam; never round angled grids. */
export function attachedPanels(type,other,y=other.position[1]){
 const seed={type,position:[0,y,0],rotation:0},result=[];
 for(const edge of panelEdges(other))for(const own of panelEdges(seed)){
  if(Math.abs(Math.hypot(edge.b[0]-edge.a[0],edge.b[1]-edge.a[1])-Math.hypot(own.b[0]-own.a[0],own.b[1]-own.a[1]))>.03)continue;
  const rotation=Math.atan2(own.b[1]-own.a[1],own.b[0]-own.a[0])-Math.atan2(edge.a[1]-edge.b[1],edge.a[0]-edge.b[0]);
  const rotated=transformPolygon([own.a],{rotation,position:[0,0,0]})[0];result.push({position:[edge.b[0]-rotated[0],y,edge.b[1]-rotated[1]],rotation});
 }return result;
}
export function wallCandidates(type,panels,flip=0){const def=PIECES[type];if(def.shape==='quarter')return panels.filter(p=>PIECES[p.type].shape==='quarter').map(p=>({position:[...p.position],rotation:p.rotation??0}));return panels.flatMap(p=>panelEdges(p).flatMap(e=>{const dx=e.b[0]-e.a[0],dz=e.b[1]-e.a[1],length=Math.hypot(dx,dz),width=def.footprint[0],count=Math.floor((length+.01)/width);return Array.from({length:count},(_,i)=>{const t=(i+.5)*width/length;return {position:[e.a[0]+dx*t,p.position[1],e.a[1]+dz*t],rotation:-Math.atan2(dz,dx)+flip*Math.PI};});}));}

/** Roof candidates on either side of a wall, including 4 m bays over wide doors. */
export function roofCandidates(type,walls){
 const result=[],seed=pieceAt(type,[0,0,0]);
 for(const wall of walls){const height=wall.position[1]+PIECES[wall.type].height;
  if(PIECES[wall.type].shape==='quarter'){if(PIECES[type].shape==='quarter')result.push({position:[wall.position[0],height,wall.position[2]],rotation:wall.rotation??0});continue;}
  const edge=wallEdge(wall),dx=edge.b[0]-edge.a[0],dz=edge.b[1]-edge.a[1],length=Math.hypot(dx,dz);
  for(const own of panelEdges(seed)){const width=Math.hypot(own.b[0]-own.a[0],own.b[1]-own.a[1]);for(let i=0;i<Math.floor((length+.01)/width);i++)for(const reverse of [false,true]){
   const a=[edge.a[0]+dx*i*width/length,edge.a[1]+dz*i*width/length],b=[edge.a[0]+dx*(i+1)*width/length,edge.a[1]+dz*(i+1)*width/length],from=reverse?b:a,to=reverse?a:b;
   const rotation=Math.atan2(own.b[1]-own.a[1],own.b[0]-own.a[0])-Math.atan2(to[1]-from[1],to[0]-from[0]),rotated=transformPolygon([own.a],{rotation,position:[0,0,0]})[0];result.push({position:[from[0]-rotated[0],height,from[1]-rotated[1]],rotation});
  }}
 }return result;
}
function pieceAt(type,position){return {type,position,rotation:0};}
