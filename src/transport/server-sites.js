import {createSettlements} from '../settlements/system.js';
import {createBuildObstacles} from '../build/obstacles.js';

/** Per-player collision context, same authored content as the client. Public
 * settlement geometry stays outside player saves and building permissions. */
export function attachTransportSites(nav){
  const sites=createSettlements({scene:null,nav,render:false,enabled:()=>true});
  nav.surfaceObstacles=createBuildObstacles(nav.surfaceObstacles??{grounded:false,constrainWalker:(_a,b)=>({point:b,hit:false,grounded:false}),constrainEVA:(_a,b)=>({point:b,hit:false}),constrainFlight:(_a,b)=>({point:b,hit:false})},sites);
  return sites;
}
