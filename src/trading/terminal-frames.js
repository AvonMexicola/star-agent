import {Vector3,Quaternion} from 'three';
import {AEON_STATION_TERMINALS,stationTerminalPoint} from './station-terminals.js';
import {materializeBase} from './base-site.js';
import {terminalIdentity} from './terminal-identity.js';
const up=new Vector3(0,1,0),flip=new Quaternion().setFromAxisAngle(up,Math.PI);
export const TERMINAL_SCREEN={width:1.32,height:.825,offset:[0,1.96,-.56]};

/** Display-only transform; authored console footprint and interaction stay put. */
export function terminalPieceFrame(claim,piece){
  const yaw=new Quaternion().setFromAxisAngle(up,piece.rotation??0),q=new Quaternion(...claim.quaternion);
  return {position:new Vector3(...TERMINAL_SCREEN.offset).applyQuaternion(yaw).add(new Vector3(...piece.position)).applyQuaternion(q).add(new Vector3(...claim.origin)),quaternion:q.multiply(yaw).multiply(flip)};
}
export function terminalFrames({snapshot,settlements,station,baseActive,localClaims=[],claimPowered=()=>true}){
  const result=[],add=(id,frame)=>result.push({id,...terminalIdentity(snapshot,id,{powered:(snapshot.terminals?.some(t=>t.id===id)?baseActive?.(snapshot.terminals.find(t=>t.id===id)):true)??true}),...frame});
  // Active claims follow the existing offline/online settlement visibility owner.
  for(const claim of settlements?.claims??[]){const layout=settlements.layouts.find(s=>s.claim.id===claim.id);if(layout)add(layout.id,terminalPieceFrame(claim,layout.terminalPiece));}
  for(const t of snapshot.terminals??[]){
    if(t.base){const claim=materializeBase(t),piece=claim.pieces.find(p=>p.id===t.base.terminalPiece);if(piece)add(t.id,terminalPieceFrame(claim,piece));}
    else if(t.origin)add(t.id,terminalPieceFrame({origin:t.position,quaternion:t.quaternion},{position:[0,0,0],rotation:Math.PI}));
  }
  for(const claim of localClaims){
    if(snapshot.terminals?.some(t=>t.base?.claim.id===claim.id))continue;
    for(const piece of claim.pieces.filter(p=>p.type==='terminal'))result.push({id:`local-terminal-${piece.id}`,name:claim.name,role:'Storage and trade services',network:'Base terminal',status:claimPowered(claim)?'Ready to connect':'Power offline',available:claimPowered(claim),...terminalPieceFrame(claim,piece)});
  }
  for(const t of AEON_STATION_TERMINALS){
    const frame=t.frame==='hub'?station?.hub:station?.pods?.find(p=>p.id===t.hangarId),point=frame&&stationTerminalPoint(station,t.id);if(!point)continue;
    const quaternion=(frame.quaternion??frame.frame?.quaternion)?.clone();if(!quaternion)continue;
    // Berth consoles face into the bay (-Z); hub directory faces point +Z.
    if(t.frame==='hangar')quaternion.multiply(flip);
    point.add(new Vector3(0,0,.12).applyQuaternion(quaternion));
    add(t.id,{position:point,quaternion,flush:true});
  }
  return result;
}
