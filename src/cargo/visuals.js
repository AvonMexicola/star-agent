import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CARGO_GRIDS,SBU_METRES,crateBounds } from './grid.js';
const loader=new GLTFLoader(),templates=new Map(),batches=new Map(),labels=new Map();
const load=path=>{if(!templates.has(path))templates.set(path,loader.loadAsync(path).then(g=>g.scene));return templates.get(path);};
export async function cargoAsset(sbu){return (await load(`/models/cargo/${sbu}-sbu.glb`)).clone(true);}
export async function terminalAsset(){return (await load('/models/cargo/trade-terminal.glb')).clone(true);}
async function crateBatches(size){
  if(!batches.has(size))batches.set(size,load(`/models/cargo/${String(size).replace('-lod','')}-sbu${String(size).endsWith('-lod')?'-lod':''}.glb`).then(root=>{
    root.updateMatrixWorld(true);const groups=new Map();root.traverse(o=>{if(!o.isMesh)return;const key=o.material.name;if(!groups.has(key))groups.set(key,{material:o.material,geometries:[]});groups.get(key).geometries.push(o.geometry.clone().applyMatrix4(o.matrixWorld));});
    return [...groups.values()].map(g=>{const geometry=mergeGeometries(g.geometries);g.geometries.forEach(x=>x.dispose());return {geometry,material:g.material};});
  }));return batches.get(size);
}
function labelMaterial(c){
  const key=`${c.sbu}:${c.resource}`;if(labels.has(key))return labels.get(key);
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;const ctx=canvas.getContext('2d');ctx.fillStyle='#15221e';ctx.fillRect(0,0,256,64);ctx.fillStyle='#b6efd1';ctx.font='bold 24px sans-serif';ctx.fillText(`${c.sbu} SBU`,12,27);ctx.font='16px sans-serif';ctx.fillText(c.resource,12,51);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const m=new THREE.MeshBasicMaterial({map:texture,toneMapped:false});labels.set(key,m);return m;
}
export function createCargoVisual(){
  const root=new THREE.Group();root.name='Physical SBU cargo';let key='',generation=0,disposed=false;
  const lineMaterial=new THREE.LineBasicMaterial({color:0xb6efd1,transparent:true,opacity:.55}),labelGeometry=new THREE.PlaneGeometry(.30,.075);
  function clear(){for(const c of [...root.children]){if(c.isLineSegments)c.geometry.dispose();if(c.isInstancedMesh)c.dispose();root.remove(c);}}
  return {root,
    update(hull,crates,eye=new THREE.Vector3()){
      const detailed=new Set((crates.length>32?[...crates].sort((a,b)=>{const ca=crateBounds(hull,a),cb=crateBounds(hull,b);return eye.distanceToSquared(new THREE.Vector3(...ca.min))-eye.distanceToSquared(new THREE.Vector3(...cb.min));}).slice(0,24):crates).map(c=>c.id));
      const next=JSON.stringify([hull,crates,[...detailed]]);if(key===next)return;key=next;const rev=++generation;clear();
      for(const g of CARGO_GRIDS[hull]??[]){const points=[];for(let x=0;x<=g.cells[0];x++)points.push(g.min[0]+x*SBU_METRES,g.min[1]+.006,g.min[2],g.min[0]+x*SBU_METRES,g.min[1]+.006,g.min[2]+g.cells[2]*SBU_METRES);for(let z=0;z<=g.cells[2];z++)points.push(g.min[0],g.min[1]+.006,g.min[2]+z*SBU_METRES,g.min[0]+g.cells[0]*SBU_METRES,g.min[1]+.006,g.min[2]+z*SBU_METRES);const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));root.add(new THREE.LineSegments(geo,lineMaterial));}
      for(const size of new Set(crates.map(c=>`${c.sbu}${detailed.has(c.id)?'':'-lod'}`))){const same=crates.filter(c=>`${c.sbu}${detailed.has(c.id)?'':'-lod'}`===size);
        crateBatches(size).then(parts=>{if(disposed||rev!==generation)return;for(const part of parts){const mesh=new THREE.InstancedMesh(part.geometry,part.material,same.length);mesh.name=`${size} SBU freight`;mesh.castShadow=true;mesh.receiveShadow=true;same.forEach((c,i)=>{const b=crateBounds(hull,c);mesh.setMatrixAt(i,new THREE.Matrix4().makeTranslation((b.min[0]+b.max[0])/2,b.min[1]+.01,(b.min[2]+b.max[2])/2));});mesh.computeBoundingSphere();root.add(mesh);}}).catch(error=>{root.userData.error=error.message;});
      }
      for(const key of new Set(crates.map(c=>`${c.sbu}:${c.resource}`))){const same=crates.filter(c=>`${c.sbu}:${c.resource}`===key),mesh=new THREE.InstancedMesh(labelGeometry,labelMaterial(same[0]),same.length*2);same.forEach((c,i)=>{const b=crateBounds(hull,c);const y=b.min[1]+(b.max[1]-b.min[1])*.35;mesh.setMatrixAt(i*2,new THREE.Matrix4().makeRotationY(Math.PI).setPosition((b.min[0]+b.max[0])/2,y,b.min[2]-.002));mesh.setMatrixAt(i*2+1,new THREE.Matrix4().makeRotationY(-Math.PI/2).setPosition(b.min[0]+.016,y,(b.min[2]+b.max[2])/2));});mesh.computeBoundingSphere();root.add(mesh);}
    },dispose(){disposed=true;clear();lineMaterial.dispose();labelGeometry.dispose();root.removeFromParent();},
  };
}
