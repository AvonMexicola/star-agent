import {Quaternion,Vector3} from 'three';

const X=new Vector3(1,0,0),TAU=2*Math.PI;
// Per-instance transforms; materials and geometry remain in the equipment cache.
const heads=new WeakMap();
export function updateCutterHead(root,dt,mining,visible=true) {
  if(!root)return null;
  let state=heads.get(root);
  if(!state){
    const rotor=root.getObjectByName('CutterRotor');
    if(!rotor)return null; // Older/fallback models have no moving cartridge.
    state={rotor,base:rotor.quaternion.clone(),turn:new Quaternion(),speed:0,angle:0};
    heads.set(root,state);
  }
  const step=Number.isFinite(dt)?Math.max(0,Math.min(dt,.1)):0;
  const target=mining&&visible?8:0,acceleration=target?24:10;
  const previous=state.speed;
  state.speed+=Math.sign(target-state.speed)*Math.min(Math.abs(target-state.speed),acceleration*step);
  if(!visible)state.speed=0;
  state.angle=(state.angle+(previous+state.speed)*.5*step)%TAU;
  state.rotor.quaternion.copy(state.base).multiply(state.turn.setFromAxisAngle(X,state.angle));
  return {angle:state.angle,speed:state.speed,tier:1,mount:'K17-M30'};
}
