import {PIECES} from './definitions.js';
/** Four paid, individually removable approach ramps around the unchanged flat deck. */
export function padApproaches(pad,firstId=0){
 const def=PIECES[pad.type];if(!def?.padSize)return [];
 const [w,l]=def.footprint,c=Math.cos(pad.rotation),s=Math.sin(pad.rotation);
 return [[0,l/2+2,0],[w/2+2,0,Math.PI/2],[0,-l/2-2,Math.PI],[-w/2-2,0,-Math.PI/2]].map(([x,z,turn],i)=>({id:`build-piece-${firstId+i}`,type:'foundation-ramp',position:[pad.position[0]+c*x+s*z,pad.position[1],pad.position[2]-s*x+c*z],rotation:pad.rotation+turn,doorOpen:false}));
}
/** Inset fixtures leave the four central approach mouths clear. */
export function padLightPositions(width,length){
 const lights=[];
 for(const sign of [-1,1]){
  for(let x=-width/2+1;x<=width/2-1;x+=Math.max(3,(width-2)/Math.ceil((width-2)/4)))if(Math.abs(x)>2.4)lights.push([x,.009,sign*(length/2-.45)]);
  for(let z=-length/2+1;z<=length/2-1;z+=Math.max(3,(length-2)/Math.ceil((length-2)/4)))if(Math.abs(z)>2.4)lights.push([sign*(width/2-.45),.009,z]);
 }
 return lights;
}
