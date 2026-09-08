/** A separate solo market: ordinary settlements and their public map stay four. */
export const PIRATE_MARKET=Object.freeze({id:'pirate-hush',body:'selene',name:'Hush Exchange',role:'Unlicensed salvage',secret:true,
  activity:'A concealed salvage exchange. Land outside the red perimeter, follow the amber service lamps and isolate the tower before trading.',
  exports:['metal-stock','conductor'],
  stock:{basalt:96,copper:192,ice:24,aggregate:32,'metal-stock':720,conductor:640},
  targets:{basalt:512,copper:768,ice:640,aggregate:256,'metal-stock':720,conductor:640},
  uses:{basalt:'Replacement ceramic protection.',copper:'Salvaged electronics processing.',ice:'Water for the concealed habitat.',aggregate:'Repairs to the service approach.'}});
export const PERIMETER=Object.freeze({warning:300,engage:180,disengage:220,warningSeconds:5,telegraphSeconds:1.2,burstShots:3,shotInterval:.75,restSeconds:5,damage:18,minAltitude:8,towerScale:.35,towerHeight:9});
