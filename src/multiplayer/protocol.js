export const MULTIPLAYER_VERSION=4;
export const WORLD_SEED=7291;
export const MAX_PLAYERS=10;
export const SUIT_COLORS=Object.freeze(['#ff724f','#52d6ff','#ffd45b','#8ce06c','#bd8cff','#ff80bd','#45dcc6','#eee9dd','#688bff','#c99d69']);
export const INPUT_AXES=Object.freeze(['forward','strafe','vertical','yaw','pitch','roll']);
export function cleanInput(value={}){
  if(!value||typeof value!=='object'||Array.isArray(value))value={};
  const result={};for(const key of INPUT_AXES)result[key]=Number.isFinite(value[key])?Math.max(-1,Math.min(1,value[key])):0;
  for(const key of ['boost','brake','jump','fire'])result[key]=value[key]===true;
  result.mouseYaw=Number.isFinite(value.mouseYaw)?Math.max(-.5,Math.min(.5,value.mouseYaw)):0;
  result.mousePitch=Number.isFinite(value.mousePitch)?Math.max(-.5,Math.min(.5,value.mousePitch)):0;
  return result;
}
export const WEAPON_RULES=Object.freeze({
  'rifle-laser':Object.freeze({ammo:'carbine-charge',damage:25,range:250,interval:.18}),
  'sidearm-pistol':Object.freeze({ammo:'sidearm-charge',damage:15,range:100,interval:.3}),
});
