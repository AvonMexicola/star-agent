import {FACTIONS} from '../factions/catalog.js';
/** Separate solo markets: ordinary settlements and their public map stay four. */
export const PIRATE_MARKET=Object.freeze({id:'pirate-hush',body:'selene',faction:'crimson',operator:FACTIONS.crimson.name,name:'Hush Exchange',role:'Unlicensed salvage',secret:true,
  activity:'A concealed salvage exchange. Land outside the red perimeter, follow the amber service lamps and isolate the tower before trading.',
  exports:['metal-stock','conductor'],
  stock:{basalt:96,copper:192,ice:24,aggregate:32,'metal-stock':720,conductor:640},
  targets:{basalt:512,copper:768,ice:640,aggregate:256,'metal-stock':720,conductor:640},
  uses:{basalt:'Replacement ceramic protection.',copper:'Salvaged electronics processing.',ice:'Water for the concealed habitat.',aggregate:'Repairs to the service approach.'}});
export const PERIMETER=Object.freeze({warning:300,engage:180,disengage:220,warningSeconds:5,telegraphSeconds:1.2,burstShots:3,shotInterval:.75,restSeconds:5,damage:18,towerScale:.35,towerHeight:9});
export const PIRATE_MARKETS=Object.freeze([PIRATE_MARKET,Object.freeze({
  id:'pirate-veil',body:'miasma',faction:'crimson',operator:FACTIONS.crimson.name,name:'Veil Exchange',role:'Concealed copper salvage',secret:true,
  activity:'A Crimson Pact vacuum-rated habitat on Miasma. Land on the outer apron, isolate the tower on foot, then use the interlocked airlock to enter the exchange.',
  exports:['copper','metal-stock'],stock:{basalt:128,copper:1440,ice:64,aggregate:96,'metal-stock':512,conductor:384},
  targets:{basalt:256,copper:1440,ice:768,aggregate:512,'metal-stock':512,conductor:640},
  uses:{basalt:'Ceramic protection for sealed equipment.',ice:'Clean water for the enclosed habitat.',aggregate:'Repairs to raised access foundations.',conductor:'Corrosion-resistant replacement wiring.'},
})]);
export const pirateMarketById=id=>PIRATE_MARKETS.find(site=>site.id===id);
