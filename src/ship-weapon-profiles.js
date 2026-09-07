import {WEAPONS} from './effects/weapons.js';

export const SHIP_WEAPON_SIZES=Object.freeze({nomad:1,kestrel:2,atlas:3,'atlas-mark-ii':3});
const DAMAGE={pulse:24,laser:48,void:100};
const SIZES=[null,
  {damage:1,interval:1,speed:1,range:1600,effect:1,pitch:1},
  {damage:1.75,interval:1.18,speed:1.11,range:1900,effect:1.4,pitch:.86},
  {damage:3,interval:1.4,speed:1.22,range:2200,effect:1.9,pitch:.72},
];
export const SHIP_WEAPON_PROFILES=Object.freeze(Object.fromEntries(
  [1,2,3].flatMap(size=>Object.entries(WEAPONS).map(([type,base])=>{
    const scale=SIZES[size],id=type+'-s'+size;
    return [id,Object.freeze({...base,id,type,size,label:base.label+' / S'+size,
      damage:DAMAGE[type]*scale.damage,interval:base.interval*scale.interval,
      speed:base.speed*scale.speed,range:scale.range,power:base.power*scale.effect,
      effectScale:scale.effect,soundPitch:scale.pitch})];
  }))
));
export function shipWeaponProfile(type='pulse',size=1){
  const profile=SHIP_WEAPON_PROFILES[type+'-s'+size];
  if(!profile)throw new RangeError('Unknown ship weapon: '+type+' / S'+size);
  return profile;
}
