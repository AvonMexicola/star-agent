/** Shared upkeep simulation. Energy is kWh, output kW, time UTC milliseconds. */
export const DECAY_MS=72*60*60*1000;
export const POWER_VERSION=1;
export const POWER_PARTS=Object.freeze({
 'solar-array':{output:2.5},'wind-turbine':{output:3},battery:{capacity:12},
 'uranium-generator':{output:4,fuel:'uranium-ore',energyPerKg:240},
 'helium-generator':{output:12,fuel:'helium-3-regolith',energyPerKg:720},
});
export const initialPower=now=>({version:POWER_VERSION,updatedAt:now,health:100,charge:2,fuel:{'uranium-ore':0,'helium-3-regolith':0},unpoweredMs:0});
export function validPower(p){return Boolean(p&&p.version===POWER_VERSION&&Number.isFinite(p.updatedAt)&&p.updatedAt>=0&&Number.isFinite(p.health)&&p.health>=0&&p.health<=100&&Number.isFinite(p.charge)&&p.charge>=0&&p.charge<=12290&&Number.isFinite(p.unpoweredMs)&&p.unpoweredMs>=0&&p.fuel&&['uranium-ore','helium-3-regolith'].every(k=>Number.isFinite(p.fuel[k])&&p.fuel[k]>=0&&p.fuel[k]<=100));}
export function powerCapacity(claim){return 2+claim.pieces.filter(p=>p.type==='battery').length*12;}
export function powerDemand(claim){return .25+claim.pieces.reduce((n,p)=>n+.01+(p.type==='ceiling-light'&&p.lightOn!==false?.05:0)+(p.type==='terminal'?.15:p.type==='hangar-door'?.1:p.landingPad?.04:0),0);}
export function powerRates(claim,environment){
 let renewable=0;const generators=[];
 for(const p of claim.pieces){const def=POWER_PARTS[p.type];if(!def)continue;
  if(p.type==='solar-array')renewable+=def.output*Math.max(0,Math.min(1,environment.solar(p)));
  else if(p.type==='wind-turbine')renewable+=def.output*Math.max(0,Math.min(1,environment.wind(p)));
  else if(def.fuel)generators.push(def);
 }
 return {renewable,generators,demand:powerDemand(claim),capacity:powerCapacity(claim)};
}
/** Integrate a constant-rate interval exactly, including battery depletion within it.
 * Health loss is cumulative; restoring power stops loss but never grants free repair. */
export function powerStep(claim,now,environment,{decayMs=DECAY_MS}={}){
 const p=structuredClone(claim.power??initialPower(now));if(!validPower(p))throw Error('Invalid base power save.');
 if(!Number.isFinite(now)||now<p.updatedAt)return p;
 const hours=(now-p.updatedAt)/3600000,r=powerRates(claim,environment);p.charge=Math.min(p.charge,r.capacity);
 let energy=r.renewable*hours,need=Math.max(0,r.demand*hours+r.capacity-p.charge-energy);
 for(const generator of r.generators){const made=Math.min(generator.output*hours,p.fuel[generator.fuel]*generator.energyPerKg,need);p.fuel[generator.fuel]=Math.max(0,p.fuel[generator.fuel]-made/generator.energyPerKg);energy+=made;need-=made;}
 const shortfall=Math.max(0,r.demand*hours-energy-p.charge),unpoweredHours=r.demand>0?shortfall/r.demand:0;
 p.charge=Math.max(0,Math.min(r.capacity,p.charge+energy-r.demand*hours));
 p.health=Math.max(0,p.health-unpoweredHours*3600000/decayMs*100);p.unpoweredMs+=unpoweredHours*3600000;p.updatedAt=now;return p;
}
export function advancePower(claim,now,environmentAt,options){
 let next={...claim,power:claim.power??initialPower(now)};
 // Ten-minute environmental samples keep offline behavior deterministic and bounded.
 while(next.power.updatedAt<now&&next.power.health>0){const end=Math.min(now,next.power.updatedAt+600000);next={...next,power:powerStep(next,end,environmentAt((next.power.updatedAt+end)/2),options)};}
 return next;
}
export function powerStatus(claim,environment){const p=claim.power,r=powerRates(claim,environment),fuelled=r.generators.reduce((n,g)=>n+(p?.fuel[g.fuel]>0?g.output:0),0)+r.renewable>=r.demand,powered=Boolean(p&&p.health>0&&(p.charge>1e-7||r.renewable>=r.demand||fuelled));return {...r,powered,health:p?.health??100,charge:p?.charge??0,fuel:p?.fuel??{},reserveHours:r.demand>r.renewable?(p?.charge??0)/(r.demand-r.renewable):null};}
