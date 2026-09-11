import layout from '../assets/gannet/layout.json' with {type:'json'};
import collision from '../assets/gannet/collision.json' with {type:'json'};
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
/** Canonical authored metres, +Y up, -Z forward. */
export const GANNET_LAYOUT = freeze({...layout,flightParts:collision.parts.map(part=>({
  min:[...part.min],max:part.max.map((n,i)=>n+(i===1&&part.node.startsWith('Gear_')?layout.gear.travel:0)),
}))});
export const GANNET_LIFT = GANNET_LAYOUT.lift;
export const GANNET_VESTIBULE = GANNET_LAYOUT.vestibule;

export function gannetMechanismPose({gearProgress = 1, hatchProgress = 0, liftY = GANNET_LIFT.high} = {}) {
  const finite = (value, low, high) => {
    if (!Number.isFinite(value)) throw new TypeError('Gannet mechanism pose must be finite');
    return Math.max(low, Math.min(high, value));
  };
  const gear = finite(gearProgress, 0, 1), hatch = finite(hatchProgress, 0, 1), h = GANNET_LAYOUT.hatch;
  const depth = Math.min(1, hatch / .16), rise = Math.max(0, (hatch - .16) / .84);
  return {
    gearOffset:(1 - gear) * GANNET_LAYOUT.gear.travel,
    liftY:finite(liftY, GANNET_LIFT.low, GANNET_LIFT.high),
    slats:Array.from({length:h.slats}, (_, i) => {
      const closed = h.bottom + h.slatHeight * (i + .5);
      return {node:`HatchSlat_${i + 1}`, y:closed + (h.openBottom + h.slatHeight / 2 - closed) * rise, z:h.closedZ - i * h.trackSpacing * depth};
    }),
  };
}

/** Actual applied mesh AABBs before material batching, translated by the same
 * rig pose as the visible assembly. These are conservative solid-part bounds;
 * walking support remains the explicit deck/lift contract. */
export function gannetCollisionParts(pose = {}) {
  const p=gannetMechanismPose(pose),slats=new Map(p.slats.map(s=>[s.node,s]));
  return collision.parts.map(part=>{
    let dy=0,dz=0;
    if(part.node.startsWith('Gear_'))dy=p.gearOffset;
    else if(part.node===layout.lift.node)dy=p.liftY-layout.lift.high;
    else if(slats.has(part.node)){
      const index=Number(part.node.split('_').at(-1))-1;
      dy=slats.get(part.node).y-(layout.hatch.bottom+layout.hatch.slatHeight*(index+.5));
      dz=slats.get(part.node).z-layout.hatch.closedZ;
    }
    return {name:part.name,node:part.node,min:part.min.map((n,i)=>n+(i===1?dy:i===2?dz:0)),max:part.max.map((n,i)=>n+(i===1?dy:i===2?dz:0))};
  });
}
