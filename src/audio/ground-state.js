import { terrainHeight, biomeAt } from '../world.js';
import { slopeAt } from '../terrain-v2.js';
import { shipFloorAt } from '../boarding.js';
import { footstepSurface } from './footsteps.js';

export function walkingAudioState(nav,active=true){
  const local=nav.toShipLocal?.();
  const floor=local?(nav.freighter?nav.freighter.floorAt(local):shipFloorAt(local.x,local.z,nav.doorProgress>.98)):null;
  const aboard=floor!==null&&floor!==undefined&&Math.abs(local.y-floor-(nav.layout?.eyeHeight??1.7))<1+Math.max(0,nav.jumpHeight??0);
  const metal=Boolean(aboard||nav.dockedAtStation);
  const position=aboard?local:nav.position;
  const up=aboard?[0,1,0]:nav.dockedAtStation?nav.station.up.toArray():nav.normal.toArray();
  return {position:position.toArray(),up,frame:aboard?`ship:${nav.shipId??'nomad'}`:`world:${nav.body.id}`,
    grounded:nav.jumpHeight<.02||(Boolean(nav.surfaceObstacles?.grounded)&&nav.jumpVelocity<=0),
    active:active&&nav.mode==='walk'&&!nav.roverOccupied&&!nav.openingActive&&nav.enabled&&nav.focused,
    running:nav.boost&&!aboard,metal};
}
export function walkingSurface(nav,metal){
  if(metal)return 'metal';
  if(nav.body.id!=='aeon')return 'rock';
  if(nav.surfaceObstacles?.grounded)return 'rock';
  const n=nav.normal,height=terrainHeight(n.x,n.y,n.z);
  return footstepSurface({body:nav.body.id,height,latitude:n.y,slope:slopeAt(n.x,n.y,n.z,height),biome:biomeAt(n.x,n.y,n.z,height)});
}
