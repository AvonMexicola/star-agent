/** Canonical kit dimensions in metres, Y up; origins are support-surface level. */
export const GRID = 4;
export const STOREY = 3;
export const STAIR_STEPS = 12;
const box = (min, max, kind = 'solid') => ({ min, max, kind });
const panel = (min, max) => box(min, max);
export const PIECES = Object.freeze({
  foundation: { id:'foundation', label:'Concrete foundation', category:'foundation', cost:{concrete:12}, footprint:[4,4], height:.6, colliders:[panel([-2,-.6,-2],[2,0,2])], support:true },
  floor: { id:'floor', label:'Floor / flat roof', category:'floor', cost:{concrete:8,'metal-stock':1}, footprint:[4,4], height:.18, colliders:[panel([-2,-.18,-2],[2,0,2])], support:true },
  wall: { id:'wall', label:'Concrete wall', category:'wall', cost:{concrete:8}, footprint:[4,.3], height:3, colliders:[panel([-2,0,-.15],[2,3,.15])] },
  doorway: { id:'doorway', label:'Manual doorway', category:'wall', cost:{concrete:4,'metal-stock':3}, footprint:[4,.3], height:3, colliders:[panel([-2,0,-.15],[-.75,3,.15]),panel([.75,0,-.15],[2,3,.15]),panel([-.75,2.25,-.15],[.75,3,.15])], door:[{...box([-.74,0,-.09],[0,2.24,.09],'door'),travel:-.8},{...box([0,0,-.09],[.74,2.24,.09],'door'),travel:.8}] },
  window: { id:'window', label:'Glazed wall', category:'wall', cost:{concrete:4,glass:2,'metal-stock':1}, footprint:[4,.3], height:3, colliders:[panel([-2,0,-.15],[-1.2,3,.15]),panel([1.2,0,-.15],[2,3,.15]),panel([-1.2,0,-.15],[1.2,1,.15]),panel([-1.2,2.4,-.15],[1.2,3,.15]),box([-1.2,1,-.03],[1.2,2.4,.03],'glass')] },
  stairs: { id:'stairs', label:'Straight staircase', category:'stairs', cost:{concrete:12,'metal-stock':3}, footprint:[2,4], height:3, support:true, colliders:Array.from({length:STAIR_STEPS},(_,i)=>panel([-1,0,2-(i+1)*4/STAIR_STEPS],[1,(i+1)*3/STAIR_STEPS,2-i*4/STAIR_STEPS])) },
  mainframe: { id:'mainframe', label:'Base mainframe', category:'utility', cost:{'metal-stock':5,conductor:3,glass:2}, footprint:[1.1,.7], height:1.8, colliders:[panel([-.55,0,-.35],[.55,1.8,.35])] },
  crate: { id:'crate', label:'Storage crate', category:'utility', cost:{'metal-stock':3}, footprint:[1.2,.8], height:.75, colliders:[panel([-.6,0,-.4],[.6,.75,.4])] },
});
export const PIECE_IDS = Object.freeze(Object.keys(PIECES));
export function getPieceDefinition(piece) { return PIECES[typeof piece === 'string' ? piece : piece.type ?? piece.pieceId ?? piece.kind ?? piece.id]; }
export function getLocalColliders(piece, doorOpen = false) {
  const def = getPieceDefinition(piece);
  if (!def) return [];
  const boxes = def.colliders.map(b=>({min:[...b.min],max:[...b.max],kind:b.kind}));
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
  for (const b of def.colliders) if(x>=b.min[0] && x<=b.max[0] && z>=b.min[2] && z<=b.max[2]) height=Math.max(height??-Infinity,b.max[1]);
  return height;
}
/** Conservative measured export envelopes, including hardware, in local metres. */
export const AUTHORED_BOUNDS = Object.freeze({
  foundation: {min:[-2,-.601,-2],max:[2,.002,2]},
  floor: {min:[-2,-.181,-2],max:[2,.002,2]},
  wall: {min:[-2,0,-.164],max:[2,3,.164]},
  doorway: {min:[-2,0,-.226],max:[2,3,.164]},
  window: {min:[-2,0,-.164],max:[2,3,.164]},
  stairs: {min:[-1,0,-2],max:[1,4.006,2]},
  mainframe: {min:[-.551,0,-.398],max:[.551,1.8,.351]},
  crate: {min:[-.601,0,-.453],max:[.601,.75,.401]},
});
