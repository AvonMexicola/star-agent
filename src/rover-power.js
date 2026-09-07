import { ROVER_LAYOUT } from './rover-layout.js';
/** Runtime seconds, not frame counts. A depleted cutter needs trigger release. */
export function createRoverPower(layout=ROVER_LAYOUT){
  const state={charge:1,active:false,depleted:false,cutSeconds:0};
  return {state,step(dt,{trigger=false,allowed=true}={}){
    dt=Number.isFinite(dt)?Math.max(0,Math.min(dt,.25)):0;
    if(!trigger)state.depleted=false;
    state.active=Boolean(trigger&&allowed&&!state.depleted&&state.charge>0);
    if(state.active){const used=Math.min(dt,state.charge*layout.mining.continuousSeconds);state.charge=Math.max(0,state.charge-used/layout.mining.continuousSeconds);state.cutSeconds+=used;if(state.charge<1e-10){state.charge=0;state.depleted=true;state.active=false;}}
    else if(allowed&&!trigger)state.charge=Math.min(1,state.charge+dt/layout.mining.rechargeSeconds);
    return state;
  }};
}
