/** Enriched feedstock gameplay yields, not raw isotope abundance estimates. */
export function miningFuelProfile(rockId,bodyId,space=false){
 if(space)return null;
 if(bodyId==='selene')return {item:'helium-3-regolith',fraction:.005,label:'Helium-3-bearing regolith'};
 let hash=2166136261;for(const c of rockId)hash=Math.imul(hash^c.charCodeAt(0),16777619);
 if(bodyId==='pyre'&&(hash>>>0)%8===0)return {item:'uranium-ore',fraction:.08,label:'Uranium-bearing outcrop'};
 return null;
}
