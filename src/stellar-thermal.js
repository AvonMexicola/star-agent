import { Vector3 } from 'three';
import { SUN_DISTANCE, SUN_RADIUS } from './world.js';
import { SUN_POSITION } from './stellar-world.js';

// Radiative heating in the game's compressed system. Reflective shielding is
// fictional ship equipment, not a claim of human survivability.
export const STELLAR_THERMAL = Object.freeze({
  irradianceAtAeon:1361, absorptivity:.075, emissivity:.85, stefanBoltzmann:5.670374419e-8,
  background:290, warning:1350, damage:1550, critical:1850,
  heatingSeconds:18, coolingSeconds:32, lethalClearance:20_000_000,
});
export function stellarExposure(distance){
  const d=Math.max(SUN_RADIUS,Number.isFinite(distance)?distance:SUN_DISTANCE*10);
  const flux=STELLAR_THERMAL.irradianceAtAeon*(SUN_DISTANCE/d)**2;
  const equilibrium=(STELLAR_THERMAL.background**4+flux*STELLAR_THERMAL.absorptivity/(STELLAR_THERMAL.emissivity*STELLAR_THERMAL.stefanBoltzmann))**.25;
  return {flux,equilibrium,clearance:d-SUN_RADIUS};
}
export function createStellarThermal(){return {temperature:290,hull:100,destroyed:false,reason:null};}
/** Bounded substeps make heating and persistent hull loss stable across frame rates. */
export function stepStellarThermal(state,distance,dt){
  const next={...state};if(next.destroyed)return next;
  const exposure=stellarExposure(distance),time=Number.isFinite(dt)?Math.max(0,dt):0;
  if(distance<=SUN_RADIUS+STELLAR_THERMAL.lethalClearance){return {...next,hull:0,destroyed:true,reason:'Photosphere incursion'};}
  let remaining=time;
  while(remaining>0){
    const step=Math.min(.1,remaining),tau=exposure.equilibrium>next.temperature?STELLAR_THERMAL.heatingSeconds:STELLAR_THERMAL.coolingSeconds;
    next.temperature+=(exposure.equilibrium-next.temperature)*(1-Math.exp(-step/tau));
    const excess=Math.max(0,next.temperature-STELLAR_THERMAL.damage)/250;
    next.hull=Math.max(0,next.hull-step*(excess*2+excess*excess*7));
    remaining-=step;
  }
  if(next.hull<=0){next.destroyed=true;next.reason='Thermal hull failure';}
  return next;
}
/** Detect crossing the lethal shell even if both endpoints are outside it. */
export function stellarIncursion(previous,proposed){
  const center=new Vector3(...SUN_POSITION),a=previous.clone().sub(center),delta=proposed.clone().sub(previous),r=SUN_RADIUS+STELLAR_THERMAL.lethalClearance;
  if(a.lengthSq()<=r*r)return previous.clone();
  const aa=delta.lengthSq();if(!aa)return null;
  const b=a.dot(delta),c=a.lengthSq()-r*r,disc=b*b-aa*c;
  if(disc<0)return null;const t=(-b-Math.sqrt(disc))/aa;
  return t>=0&&t<=1?previous.clone().addScaledVector(delta,t):null;
}
