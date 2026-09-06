import * as THREE from 'three';
import { assetCollisionBoxes } from './station-concourse.js';
import { stationFinishPalette } from './station-finish-palette.js';

export function createPressureElevator(parent,z,floor=-8){
  const group=new THREE.Group();group.name='ElevatorDoor';group.position.set(0,floor,z);parent.add(group);
  const p=stationFinishPalette(),material=new THREE.MeshStandardMaterial({color:p.steel,metalness:.65,roughness:.4});
  const leaves=[-1,1].map(side=>{const leaf=new THREE.Group();leaf.position.set(side*1.04,1.55,0);group.add(leaf);leaf.add(new THREE.Mesh(new THREE.BoxGeometry(2.04,3.1,.13),material));return leaf;});
  return {group,leaves,z,floor,open:false,progress:0,staticBoxes:[]};
}

export function attachPressureElevator(lift,asset,{sign,materials}){
  const model=asset.scene.clone(true);
  const leaves=['ElevatorLeafLeft','ElevatorLeafRight'].map(name=>model.getObjectByName(name));
  if(leaves.some(leaf=>!leaf))throw new Error('Passenger elevator is missing independently moving leaves.');
  model.traverse(mesh=>{if(mesh.isMesh){mesh.material.name=mesh.material.name.replace(/^Concourse/,'Finish');mesh.castShadow=true;mesh.receiveShadow=true;}});
  materials?.apply(model);
  lift.group.clear();lift.group.add(model);lift.leaves=leaves;
  lift.staticBoxes=assetCollisionBoxes(model,new THREE.Vector3(0,lift.floor,lift.z));
  const header=model.getObjectByName('ElevatorHeader'),call=model.getObjectByName('ElevatorCallScreen'),inside=model.getObjectByName('ElevatorCabinScreen');
  if(header)sign(header,'AEON  /  PASSENGER TRANSIT',[0,0,0],3.5,.17);
  if(call)sign(call,'F\nCALL',[0,0,0],.14,.22);
  if(inside)sign(inside,'F / DESTINATIONS',[0,0,0],.25,.38,-Math.PI/2);
}
