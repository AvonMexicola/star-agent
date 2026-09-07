import {validBuild,LOCAL_OWNER} from './state.js';
import {PIECES} from './definitions.js';
import {isPanel,footprint} from './structure.js';
import {contains} from './polygons.js';
import {powerCapacity} from './power.js';
export const pieceContainer=(claim,piece)=>piece.type==='mainframe'?`build-core-${claim.id.split('-').at(-1)}`:`build-crate-${piece.id.split('-').at(-1)}`;
/** Single-piece removal; never cascade-delete dependent structures or stored cargo. */
export function planRemoval(build,storage,claimId,pieceId){
 const claim=build.claims.find(c=>c.id===claimId),piece=claim?.pieces.find(p=>p.id===pieceId);
 if(!piece||claim.owner!==LOCAL_OWNER)return {ok:false,message:'Aim at one of your building pieces.'};
 if(piece.type==='mainframe'&&claim.pieces.length>1)return {ok:false,message:'Remove the other pieces before removing the mainframe.'};
 const container=['mainframe','crate','rack'].includes(piece.type)?pieceContainer(claim,piece):null;
 if(container&&Object.values(storage[container]?.items??{}).some(n=>n>0))return {ok:false,message:'Empty this storage before removing it.'};
 const pieces=claim.pieces.filter(p=>p.id!==piece.id);
 if(isPanel(piece)&&pieces.some(p=>PIECES[p.type].category==='utility'&&Math.abs(p.position[1]-piece.position[1])<.03&&footprint(p).some(([x,z])=>contains(footprint(piece),x,z,.005)&&!pieces.some(a=>isPanel(a)&&Math.abs(a.position[1]-p.position[1])<.03&&contains(footprint(a),x,z,.005)))))return {ok:false,message:'Remove the equipment resting on this floor first.'};
 const nextClaim={...claim,pieces};if(claim.power)nextClaim.power={...claim.power,charge:Math.min(claim.power.charge,powerCapacity(nextClaim))};
 const next={...build,claims:piece.type==='mainframe'?build.claims.filter(c=>c.id!==claim.id):build.claims.map(c=>c.id===claim.id?nextClaim:c)};
 if(!validBuild(next))return {ok:false,message:'This piece supports other structures. Remove them first.'};
 return {ok:true,build:next,container,message:`${PIECES[piece.type].label} removed. No material refund.`};
}
