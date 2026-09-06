import { TextureLoader, RepeatWrapping, SRGBColorSpace } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { getPieceDefinition } from './definitions.js';
const loader=new GLTFLoader(), templates=new Map();
let finish;
function concreteFinish() {
  return finish??=Promise.all(['albedo','bump'].map(role=>new TextureLoader().loadAsync(`/models/base/concrete-${role}.webp`))).then(([map,bumpMap])=>{
    for(const texture of [map,bumpMap]) {texture.wrapS=texture.wrapT=RepeatWrapping;texture.anisotropy=4;}
    map.colorSpace=SRGBColorSpace;return {map,bumpMap};
  }).catch(error=>{finish=null;throw error;});
}
export async function createBuildVisual(piece) {
  const def=getPieceDefinition(piece);
  if(!def) throw new Error('Unknown building piece');
  if(!templates.has(def.id)) {
    const pending=Promise.all([loader.loadAsync(`/models/base/${def.id}.glb`),concreteFinish()]).then(([g,finish])=>{
      g.scene.traverse(o=>{ if(o.isMesh) {o.castShadow=!o.material.transparent;o.receiveShadow=true;if(o.material.name==='MineralConcrete') {Object.assign(o.material,finish,{bumpScale:.018});o.material.color.setRGB(1,1,1);o.material.needsUpdate=true;}} });
      return g.scene;
    }).catch(error=>{templates.delete(def.id);throw error;});
    templates.set(def.id,pending);
  }
  const root=(await templates.get(def.id)).clone(true);
  root.userData.pieceType=def.id;
  setDoorOpen(root,Number(piece?.doorOpen??0));
  return root;
}
export function setDoorOpen(root,fraction) {
  const distance=Math.max(0,Math.min(1,fraction))*.8;
  const left=root.getObjectByName('DoorLeafLeft'),right=root.getObjectByName('DoorLeafRight');
  if(left)left.position.x=-distance;
  if(right)right.position.x=distance;
}
