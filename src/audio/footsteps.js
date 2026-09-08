/** Coarse audible surface follows the world's existing height/biome/slope data.
 * The shoreline band is wet ground; this does not enable wading or swimming. */
export function footstepSurface({metal=false,body='aeon',height=0,latitude=0,slope=0,biome=''}={}) {
  if(metal)return 'metal';
  if(body!=='aeon')return 'rock';
  const lat=Math.abs(latitude),t=Math.min(1,Math.max(0,(lat-.35)/.57));
  const snowline=3300-3600*t*t*(3-2*t);
  if(lat>.86 || (height>snowline&&slope<.85) || biome==='POLAR ICE')return 'snow';
  if(height<.6)return 'water';
  if(slope>.55 || biome==='ALPINE HIGHLANDS')return 'rock';
  if(height<4.6)return 'sand';
  return 'grass';
}

/** Distance-based gait: blocked movement, frame stalls and teleports produce no
 * backlog. Cabin positions are local, so a moving ship cannot walk for you. */
export class FootstepTracker {
  constructor(){this.reset();}
  reset(){this.previous=null;this.frame=null;this.distance=0;this.side=-1;}
  update({position,up=[0,1,0],frame='world',grounded=true,active=true,running=false},dt){
    if(!active||!position?.every(Number.isFinite)||!(dt>0)||dt>.25){this.reset();return null;}
    const previous=this.previous;this.previous=[...position];
    if(!previous||this.frame!==frame){this.frame=frame;this.distance=0;return null;}
    if(!grounded){this.distance=0;return null;}
    const delta=position.map((n,i)=>n-previous[i]),vertical=delta.reduce((sum,n,i)=>sum+n*up[i],0);
    const distance=Math.sqrt(Math.max(0,delta.reduce((sum,n)=>sum+n*n,0)-vertical*vertical));
    if(distance>Math.max(1.5,14*dt)){this.distance=0;return null;}
    if(distance<.015*dt)return null;
    this.distance+=distance;
    const stride=running?1.65:1.35;
    if(this.distance<stride)return null;
    this.distance%=stride;this.side*=-1;
    return {side:this.side,running};
  }
}
