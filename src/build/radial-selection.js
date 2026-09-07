/** Clockwise from up. Keep the spatial layout stable as new recipes are added. */
export const BUILD_WHEEL_ORDER=Object.freeze(['foundation','wall','doorway','window','floor','stairs','crate','mainframe']);
export const RADIAL_DEADZONE=.35;
const TAU=2*Math.PI,STEP=TAU/BUILD_WHEEL_ORDER.length;
export function radialSelection(x,y,previous=null){
  if(!Number.isFinite(x)||!Number.isFinite(y)||Math.hypot(x,y)<RADIAL_DEADZONE)return null;
  const angle=(Math.atan2(x,-y)+TAU)%TAU;
  if(Number.isInteger(previous)&&previous>=0&&previous<BUILD_WHEEL_ORDER.length){
    const delta=Math.abs(((angle-previous*STEP+Math.PI+TAU)%TAU)-Math.PI);
    if(delta<=STEP/2+.08)return previous; // hysteresis at slice boundaries
  }
  return Math.round(angle/STEP)%BUILD_WHEEL_ORDER.length;
}
