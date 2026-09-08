import {rectangle,contains} from './polygons.js';
import {adjustableFoundation,foundationDepth,cliffColliders} from './foundations.js';
/** Canonical kit dimensions in metres, Y up; origins are support-surface level. */
export const GRID = 4;
export const STOREY = 3;
export const STAIR_STEPS = 12;
const box = (min, max, kind = 'solid') => ({ min, max, kind });
const panel = (min, max) => box(min, max);
export const TRIANGLE=[[-2,-Math.sqrt(3)*2/3],[2,-Math.sqrt(3)*2/3],[0,Math.sqrt(3)*4/3]];
export const ARC_SEGMENTS=24;
export const QUARTER=[[-2,-2],...Array.from({length:ARC_SEGMENTS+1},(_,i)=>[-2+4*Math.cos(i*Math.PI/2/ARC_SEGMENTS),-2+4*Math.sin(i*Math.PI/2/ARC_SEGMENTS)])];
const prism=(polygon,low,high,kind='solid')=>({...box([Math.min(...polygon.map(p=>p[0])),low,Math.min(...polygon.map(p=>p[1]))],[Math.max(...polygon.map(p=>p[0])),high,Math.max(...polygon.map(p=>p[1]))],kind),polygon});
const slab=(id,label,shape,polygon,depth,cost)=>({id,label,category:depth===.6?'foundation':'floor',shape,polygon,cost,footprint:[Math.max(...polygon.map(p=>p[0]))-Math.min(...polygon.map(p=>p[0])),Math.max(...polygon.map(p=>p[1]))-Math.min(...polygon.map(p=>p[1]))],height:depth,colliders:[prism(polygon,-depth,0)],support:true});
const curved=(window)=>Array.from({length:ARC_SEGMENTS},(_,i)=>{
 const a=i*Math.PI/2/ARC_SEGMENTS,b=(i+1)*Math.PI/2/ARC_SEGMENTS;
 const poly=(inner,outer)=>[[outer*Math.cos(a)-2,outer*Math.sin(a)-2],[outer*Math.cos(b)-2,outer*Math.sin(b)-2],[inner*Math.cos(b)-2,inner*Math.sin(b)-2],[inner*Math.cos(a)-2,inner*Math.sin(a)-2]];
 return window&&i>1&&i<ARC_SEGMENTS-2?[prism(poly(3.85,4.15),0,1),prism(poly(3.85,4.15),2.4,3),prism(poly(3.97,4.03),1,2.4,'glass')]:[prism(poly(3.85,4.15),0,3)];
}).flat();
const padSlab=(id,label,width,length,cost,size)=>{const d=slab(id,label,'pad',rectangle(width,length),.6,cost);d.padSize=size;for(const x of [-width/2+.7,width/2-.7])for(const z of [-length/2+.7,length/2-.7])d.colliders.push(box([x-.3,-8,z-.3],[x+.3,-.6,z+.3]));return d;};
export const ROOF_HEIGHT=.6;
export const roofProfile=(shape,x,z)=>{const rounded=v=>Math.sqrt(Math.max(0,1-(Math.max(0,v-(2-ROOF_HEIGHT))/ROOF_HEIGHT)**2));return ROOF_HEIGHT*(shape==='edge'||shape==='corner'?rounded(z):1)*(shape==='corner'?rounded(x):1);};
const roofCuts=[-2,2-ROOF_HEIGHT,...Array.from({length:6},(_,i)=>2-ROOF_HEIGHT+ROOF_HEIGHT*Math.sin((i+1)*Math.PI/12))];
const roofTile=(id,label,shape='flat',polygon=rectangle(4,4))=>({id,label,category:'utility',mount:'roof',support:true,roofShape:shape,shape,polygon,footprint:[Math.max(...polygon.map(p=>p[0]))-Math.min(...polygon.map(p=>p[0])),Math.max(...polygon.map(p=>p[1]))-Math.min(...polygon.map(p=>p[1]))],height:ROOF_HEIGHT,cost:{concrete:4,'metal-stock':1},colliders:shape==='edge'||shape==='corner'?roofCuts.slice(0,-1).flatMap((z0,z)=>{const xs=shape==='corner'?roofCuts:[-2,2];return xs.slice(0,-1).map((x0,x)=>box([x0,0,z0],[xs[x+1],Math.max(.012,roofProfile(shape,x0,z0)),roofCuts[z+1]]));}):[prism(polygon,0,ROOF_HEIGHT)]});
export const PIECES = Object.freeze({
  foundation: { id:'foundation', label:'Concrete foundation', category:'foundation', cost:{concrete:12}, footprint:[4,4], height:.6, colliders:[panel([-2,-.6,-2],[2,0,2])], support:true },
  'foundation-strut': {id:'foundation-strut',label:'Cliff foundation · 45° braces',category:'foundation',cost:{concrete:12,'metal-stock':8},footprint:[4,4],height:.6,colliders:[panel([-2,-.6,-2],[2,0,2])],support:true},
  floor: { id:'floor', label:'Floor / flat roof', category:'floor', cost:{concrete:8,'metal-stock':1}, footprint:[4,4], height:.18, colliders:[panel([-2,-.18,-2],[2,0,2])], support:true },
  wall: { id:'wall', label:'Concrete wall', category:'wall', cost:{concrete:8}, footprint:[4,.3], height:3, colliders:[panel([-2,0,-.15],[2,3,.15])] },
  doorway: { id:'doorway', label:'Manual doorway', category:'wall', cost:{concrete:4,'metal-stock':3}, footprint:[4,.3], height:3, colliders:[panel([-2,0,-.15],[-.75,3,.15]),panel([.75,0,-.15],[2,3,.15]),panel([-.75,2.25,-.15],[.75,3,.15])], door:[{...box([-.74,0,-.09],[0,2.24,.09],'door'),travel:-.8},{...box([0,0,-.09],[.74,2.24,.09],'door'),travel:.8}] },
  window: { id:'window', label:'Glazed wall', category:'wall', cost:{concrete:4,glass:2,'metal-stock':1}, footprint:[4,.3], height:3, colliders:[panel([-2,0,-.15],[-1.2,3,.15]),panel([1.2,0,-.15],[2,3,.15]),panel([-1.2,0,-.15],[1.2,1,.15]),panel([-1.2,2.4,-.15],[1.2,3,.15]),box([-1.2,1,-.03],[1.2,2.4,.03],'glass')] },
  stairs: { id:'stairs', label:'Straight staircase', category:'stairs', cost:{concrete:12,'metal-stock':3}, footprint:[2,4], height:3, support:true, colliders:Array.from({length:STAIR_STEPS},(_,i)=>panel([-1,0,2-(i+1)*4/STAIR_STEPS],[1,(i+1)*3/STAIR_STEPS,2-i*4/STAIR_STEPS])) },
  'foundation-triangle':slab('foundation-triangle','Triangle foundation','triangle',TRIANGLE,.6,{concrete:6}),
  'floor-triangle':slab('floor-triangle','Triangle floor / roof','triangle',TRIANGLE,.18,{concrete:4,'metal-stock':1}),
  'foundation-quarter':slab('foundation-quarter','Quarter-circle foundation','quarter',QUARTER,.6,{concrete:10}),
  'floor-quarter':slab('floor-quarter','Quarter-circle floor / roof','quarter',QUARTER,.18,{concrete:7,'metal-stock':1}),
  'wall-quarter':{id:'wall-quarter',label:'Quarter-circle wall',category:'wall',shape:'quarter',cost:{concrete:12},footprint:[4.3,4.3],height:3,colliders:curved(false)},
  'window-quarter':{id:'window-quarter',label:'Quarter-circle glazed wall',category:'wall',shape:'quarter',cost:{concrete:6,glass:4,'metal-stock':2},footprint:[4.3,4.3],height:3,colliders:curved(true)},
  'foundation-ramp':{id:'foundation-ramp',label:'Approach ramp',category:'foundation',shape:'ramp',cost:{concrete:10,'metal-stock':2},footprint:[4,4],height:.6,support:true,colliders:Array.from({length:32},(_,i)=>box([-2,-.6,2-(i+1)/8],[2,-.6+(i+1)*.6/32,2-i/8]))},
  'foundation-pad-small':padSlab('foundation-pad-small','Small pad foundation · Nomad',16,16,{concrete:192,'metal-stock':16},'S'),
  'foundation-pad-medium':padSlab('foundation-pad-medium','Medium pad foundation',32,40,{concrete:960,'metal-stock':80},'M'),
  'foundation-pad-large':padSlab('foundation-pad-large','Large pad foundation · Atlas',48,72,{concrete:2592,'metal-stock':216},'L'),
  rack:{id:'rack',label:'Storage rack',category:'utility',cost:{'metal-stock':10},footprint:[2.4,1],height:2.4,storageBoxes:8,colliders:[box([-1.2,0,-.5],[1.2,2.4,.5])]},
  terminal:{id:'terminal',label:'Storage & trade terminal',category:'utility',cost:{'metal-stock':5,conductor:3,glass:2},footprint:[1.4,.8],height:1.5,colliders:[box([-.7,0,-.4],[.7,1.5,.4])]},
  'hangar-door':{id:'hangar-door',label:'Nomad hangar door',category:'wall',cost:{concrete:48,'metal-stock':32,conductor:4},footprint:[16,.6],height:6,colliders:[box([-8,0,-.3],[-7.3,6,.3]),box([7.3,0,-.3],[8,6,.3]),box([-7.3,5.4,-.3],[7.3,6,.3])],door:[{...box([-7.29,0,-.12],[7.29,5.39,.12],'door'),collapse:.96}]},
  'ceiling-light':{id:'ceiling-light',label:'Ceiling light · 50 W',category:'utility',mount:'ceiling',light:true,cost:{'metal-stock':1,conductor:.5,glass:.5},footprint:[.8,.8],height:.12,colliders:[box([-.4,-.12,-.4],[.4,0,.4])]},
  'roof-flat':roofTile('roof-flat','Flat roof tile'),
  'roof-edge':roofTile('roof-edge','Rounded roof edge','edge'),
  'roof-corner':roofTile('roof-corner','Rounded roof corner','corner'),
  'roof-triangle':roofTile('roof-triangle','Triangle roof tile','triangle',TRIANGLE),
  'roof-quarter':roofTile('roof-quarter','Quarter-circle roof tile','quarter',QUARTER),
  'solar-array':{id:'solar-array',label:'Solar array · 2.5 kW',category:'utility',cost:{'metal-stock':8,conductor:6,glass:8},footprint:[3.6,2.4],height:1.2,colliders:[box([-1.8,0,-1.2],[1.8,1.2,1.2])]},
  'wind-turbine':{id:'wind-turbine',label:'Wind turbine · 3 kW',category:'utility',cost:{concrete:8,'metal-stock':16,conductor:4},footprint:[3,3],height:6,colliders:[box([-1.5,0,-1.5],[1.5,6,1.5])]},
  battery:{id:'battery',label:'Battery bank · 12 kWh',category:'utility',cost:{'metal-stock':10,conductor:8,glass:2},footprint:[1.6,1],height:1.8,colliders:[box([-.8,0,-.5],[.8,1.8,.5])]},
  'uranium-generator':{id:'uranium-generator',label:'Uranium generator · 4 kW',category:'utility',cost:{concrete:20,'metal-stock':20,conductor:8},footprint:[2,2],height:2.4,colliders:[box([-1,0,-1],[1,2.4,1])]},
  'helium-generator':{id:'helium-generator',label:'Helium-3 generator · 12 kW',category:'utility',cost:{concrete:24,'metal-stock':32,conductor:16,glass:8},footprint:[3,2],height:2.4,colliders:[box([-1.5,0,-1],[1.5,2.4,1])]},
  mainframe: { id:'mainframe', label:'Base mainframe', category:'utility', cost:{'metal-stock':5,conductor:3,glass:2}, footprint:[1.1,.7], height:1.8, colliders:[panel([-.55,0,-.35],[.55,1.8,.35])] },
  crate: { id:'crate', label:'Storage crate', category:'utility', cost:{'metal-stock':3}, footprint:[1.2,.8], height:.75, colliders:[panel([-.6,0,-.4],[.6,.75,.4])] },
});
export const PIECE_IDS = Object.freeze(Object.keys(PIECES));
export function getPieceDefinition(piece) { return PIECES[typeof piece === 'string' ? piece : piece.type ?? piece.pieceId ?? piece.kind ?? piece.id]; }
export function getLocalColliders(piece, doorOpen = false) {
  const def = getPieceDefinition(piece);
  if (!def) return [];
  const boxes = def.colliders.map(b=>({...b,min:[...b.min],max:[...b.max]}));
  if(def.id==='foundation-strut')boxes.push(...cliffColliders(typeof piece==='string'?{type:piece}:piece));
  else if(adjustableFoundation(def.id))for(const b of boxes)b.min[1]=-foundationDepth(piece);
  if (def.id === 'stairs') {
    for (const side of [-1, 1]) {
      // Twelve narrow segments follow the authored sloping handrail. They are
      // collision guards, never walking supports or a second elevated floor.
      for (let i = 0; i < 24; i++) {
        const y0 = 1.22 + i * 2.76 / 24, y1 = 1.22 + (i + 1) * 2.76 / 24;
        const z0 = 1.84 - i * 3.7 / 24, z1 = 1.84 - (i + 1) * 3.7 / 24;
        boxes.push({ min: [side * .96 - .025, y0 - .025, z1 - .025], max: [side * .96 + .025, y1 + .025, z0 + .025], kind: 'rail', support: false });
      }
      for (const i of [0, 4, 8, 11]) {
        const y = (i + 1) * .25, z = 2 - (i + .5) / 3;
        boxes.push({ min: [side * .96 - .021, y, z - .021], max: [side * .96 + .021, y + .96, z + .021], kind: 'rail', support: false });
      }
    }
  }
  if (def.door) {
    const fraction = Math.max(0,Math.min(1,Number(doorOpen)));
    // Opposed pocket leaves retract within the 4 m wall module.
    for(const leaf of def.door) {
      if(leaf.collapse){boxes.push({min:[leaf.min[0],leaf.min[1]+fraction*leaf.collapse*(leaf.max[1]-leaf.min[1]),leaf.min[2]],max:[...leaf.max],kind:'door'});continue;}
      const shift=fraction*leaf.travel;
      boxes.push({min:leaf.min.map((v,i)=>v+(i===0?shift:0)),max:leaf.max.map((v,i)=>v+(i===0?shift:0)),kind:'door'});
    }
  }
  return boxes;
}
export function sampleLocalSupport(piece, x, z) {
  const def=getPieceDefinition(piece);
  if (!def?.support) return null;
  let height=null;
  for (const b of def.colliders) if(x>=b.min[0] && x<=b.max[0] && z>=b.min[2] && z<=b.max[2] && (!b.polygon||contains(b.polygon,x,z))) height=Math.max(height??-Infinity,b.max[1]);
  return height;
}
/** Conservative measured export envelopes, including hardware, in local metres. */
export const AUTHORED_BOUNDS = Object.freeze({
  ...Object.fromEntries(Object.values(PIECES).map(d=>[d.id,{min:[Math.min(...d.colliders.map(b=>b.min[0]))-.09,Math.min(...d.colliders.map(b=>b.min[1]))-.012,Math.min(...d.colliders.map(b=>b.min[2]))-.09],max:[Math.max(...d.colliders.map(b=>b.max[0]))+.09,Math.max(...d.colliders.map(b=>b.max[1]))+.012,Math.max(...d.colliders.map(b=>b.max[2]))+.09]}])),
  foundation: {min:[-2,-.601,-2],max:[2,.002,2]},
  'foundation-strut':{min:[-2,-3.701,-2],max:[2,.002,2]},
  floor: {min:[-2,-.181,-2],max:[2,.002,2]},
  wall: {min:[-2,0,-.164],max:[2,3,.164]},
  doorway: {min:[-2,0,-.226],max:[2,3,.164]},
  window: {min:[-2,0,-.164],max:[2,3,.164]},
  stairs: {min:[-1,0,-2],max:[1,4.006,2]},
  mainframe: {min:[-.551,0,-.398],max:[.551,1.8,.351]},
  crate: {min:[-.601,0,-.453],max:[.601,.75,.401]},
});
