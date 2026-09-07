export const GEAR_FLIGHT = Object.freeze({speed:35, seconds:1.8});
export function gearStep(progress,deployed,dt){
  return Math.max(0,Math.min(1,progress+(deployed?1:-1)*Math.max(0,dt)/GEAR_FLIGHT.seconds));
}
export function gearPrompt(nav,controller=false){
  if(nav.mode!=='flight'||!nav.powered||nav.autoland||nav.stationLift||nav.travel||nav.openingActive)return '';
  if(!nav.gearDeployed&&nav.gearProgress>0)return 'GEAR RETRACTING · MANEUVERING SPEED';
  if(!nav.gearDeployed)return '';
  return `MANEUVERING · ${GEAR_FLIGHT.speed} m/s MAX · RETRACT LANDING GEAR: ${controller?'LB+RB + D-PAD ↓':'PRESS G'}`;
}
