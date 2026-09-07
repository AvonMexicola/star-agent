import {PIECES} from './definitions.js';
import {footprint} from './structure.js';
import {contains} from './polygons.js';
export const mountHeight=(floor,mount)=>floor.position[1]+(mount==='ceiling'?Math.min(...PIECES[floor.type].colliders.map(b=>b.min[1])):.006);
export function mountedOn(piece,floor){
 const mount=PIECES[piece.type]?.mount;
 return Boolean(mount&&PIECES[floor.type]?.category==='floor'&&Math.abs(piece.position[1]-mountHeight(floor,mount))<.003&&footprint(piece).every(([x,z])=>contains(footprint(floor),x,z,.003)));
}
export function mountReason(piece,pieces){const mount=PIECES[piece.type]?.mount;return !mount||pieces.some(p=>mountedOn(piece,p))?null:mount==='ceiling'?'Aim underneath a supported ceiling.':'Place this roof tile on a matching structural ceiling.';}
