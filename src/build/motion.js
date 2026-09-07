export const DOOR_SECONDS = .5;
export const MAX_SERVICE_LIGHTS = 4;
const clamp = value => Math.max(0,Math.min(1,value));
export const smooth = value => {const t=clamp(value);return t*t*(3-2*t);};
export const buildOpacity = distance => 1-smooth((distance-500)/100);
export const serviceLightFade = distance => 1-smooth((distance-18)/10);
export const nightFactor = sunDot => Number.isFinite(sunDot)?1-smooth((sunDot+.08)/.26):0;
/** Live motion never enters the saved piece registry. Existing saves start at
 * their target endpoint; interrupted closing pauses before touching an entrant. */
export class DoorMotion {
  constructor(duration=DOOR_SECONDS){this.duration=duration;this.doors=new Map();}
  ensure(id,open){let state=this.doors.get(id);if(!state){const endpoint=Number(Boolean(open));state={fraction:endpoint,target:endpoint,from:endpoint,elapsed:this.duration,blocked:false};this.doors.set(id,state);}return state;}
  fraction(id,open){return this.doors.get(id)?.fraction??Number(Boolean(open));}
  update(id,open,dt,canClose=()=>true){
    const state=this.ensure(id,open),target=Number(Boolean(open));
    if(state.target!==target){state.target=target;state.from=state.fraction;state.elapsed=0;}
    const elapsed=Math.min(this.duration,state.elapsed+Math.max(0,Number.isFinite(dt)?dt:0));
    const next=state.from+(target-state.from)*smooth(elapsed/this.duration);
    state.blocked=next<state.fraction&&!canClose(state.fraction,next);
    if(!state.blocked){state.elapsed=elapsed;state.fraction=next;}
    return state.fraction;
  }
}
export function nearestServiceLights(candidates){return candidates.filter(c=>c.distance<28).sort((a,b)=>a.distance-b.distance||a.id.localeCompare(b.id)).slice(0,MAX_SERVICE_LIGHTS);}
