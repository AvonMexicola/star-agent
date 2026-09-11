// Version 6 adds base stock reservations and streamed shared-base layouts.
// Version 5 retains the version 4 tractor ledger and adds the full-size Atlas
// ramp/crew-lift snapshot, the authored station/bay collision profile, passenger
// hub/defense state and finite markets in the same durable cargo ledger.
// Version 7 adds shared canonical settlements and owner-private sealed freight.
// Version 9 adds rotating body-fixed charts and the shared planetary clock.
// Version 10 adds server-owned Sentry poses, physical seats and turret authority.
// Version 11 adds curved travel plans and the standalone starter cargo tractor.
// Requires a paired server/browser refresh; no persistence schema change.
export const MULTIPLAYER_VERSION=11;
export const WORLD_SEED=7291;
export const MAX_PLAYERS=20;
export const SUIT_COLORS=Object.freeze(['#ff724f','#52d6ff','#ffd45b','#8ce06c','#bd8cff','#ff80bd','#45dcc6','#eee9dd','#688bff','#c99d69','#ecaaa5','#a7b8ff','#d0e77d','#db7b43','#65ab7d','#edc6ec','#41a9a5','#b9c6d5','#976bc1','#e9d2a1']);
export const INPUT_AXES=Object.freeze(['forward','strafe','vertical','yaw','pitch','roll']);
export function cleanInput(value={}){
  if(!value||typeof value!=='object'||Array.isArray(value))value={};
  const result={};for(const key of INPUT_AXES)result[key]=Number.isFinite(value[key])?Math.max(-1,Math.min(1,value[key])):0;
  for(const key of ['boost','brake','jump','fire','vehicleReady'])result[key]=value[key]===true;
  result.mouseYaw=Number.isFinite(value.mouseYaw)?Math.max(-.5,Math.min(.5,value.mouseYaw)):0;
  result.mousePitch=Number.isFinite(value.mousePitch)?Math.max(-.5,Math.min(.5,value.mousePitch)):0;
  return result;
}
export const WEAPON_RULES=Object.freeze({
  'rifle-laser':Object.freeze({ammo:'carbine-charge',damage:25,range:250,interval:.18}),
  'sidearm-pistol':Object.freeze({ammo:'sidearm-charge',damage:15,range:100,interval:.3}),
});
