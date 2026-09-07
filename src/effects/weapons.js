export const WEAPONS=Object.freeze({
  pulse:Object.freeze({label:'Cobalt pulse',kind:'pulse',color:0x55beff,interval:.14,speed:450,power:1}),
  laser:Object.freeze({label:'Solar lance',kind:'laser',color:0xff782d,interval:.45,speed:Infinity,power:1.1}),
  void:Object.freeze({label:'Singularity',kind:'void',color:0xc16aff,interval:.85,speed:110,power:1.7}),
});
export const WEAPON_COLORS=Object.freeze({cobalt:0x55beff,crimson:0xff3455,solar:0xff922d,viridian:0x46ffad,violet:0xc16aff});
export function weaponProfile(id){return WEAPONS[id]??WEAPONS.pulse;}
