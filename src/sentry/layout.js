import {ROVER_LAYOUT} from '../rover-layout.js';

export const SENTRY_LAYOUT=Object.freeze({...ROVER_LAYOUT,
  id:'burrow-sentry',name:'Burrow Sentry S-04',hull:180,
  // Includes the aft steps, all yaw/pitch poses and front tyre steering. The
  // unchanged cabin remains below 2.5 m; only the moving turret reaches 4.0 m.
  bounds:{min:[-1.72,0,-2.01],max:[1.30,4.02,2.62]},
  turret:{yaw:[0,2.82,1.36],pitch:[0,.20,0],pitchMin:-.25,pitchMax:.95,
    muzzle:[[-.215,0,-.941],[.215,0,-.941]],sight:[0,.08,-.595],
    range:400,damage:18,interval:.20,chargeSeconds:24,rechargeSeconds:12,turnRate:1.25},
  seats:{
    pilot:{door:'CabinDoor',eye:ROVER_LAYOUT.cabin.pilotEye,ground:ROVER_LAYOUT.cabin.entryGround,
      route:ROVER_LAYOUT.cabin.entryRoute,feet:[0,.46,-.67]},
    gunner:{door:'GunnerDoor',eye:[0,2.30,1.36],ground:[0,1.75,3.3],
      route:[[0,1.97,2.64],[0,2.23,2.41],[0,2.30,2.19],[-.45,2.36,1.98],[-.45,2.35,1.63],[0,2.30,1.36]],feet:[0,1.09,1.51]},
  },
});
