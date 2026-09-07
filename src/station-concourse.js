import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { stationFinishPalette } from './station-finish-palette.js';
import { createStationShopGraphics } from './station-shop-graphics.js';

/** Room architecture is baked into local-metre material batches. The authored
 * shop kit supplies the furniture, stock and human-scale storefronts. */
export function createConcourse({sign}) {
  const group=new THREE.Group();group.name='Central concourse';
  const p=stationFinishPalette(),batches=new Map();
  const material=(name,key,metalness,roughness)=>{const m=new THREE.MeshStandardMaterial({color:p[key],metalness,roughness});m.name=name;return m;};
  const ivory=material('FinishIvory','ivory',.12,.7),steel=material('FinishSteel','steel',.65,.4);
  const dark=material('FinishDark','dark',.3,.7),deck=material('FinishDeck','deck',.15,.85),petrol=material('FinishPetrol','petrol',.2,.65);
  const glow=new THREE.MeshStandardMaterial({color:p.mint,emissive:p.mint,emissiveIntensity:.8,roughness:.5});
  const glass=new THREE.MeshStandardMaterial({color:p.cool,transparent:true,opacity:.045,metalness:0,roughness:.18,side:THREE.DoubleSide,depthWrite:false});
  glass.userData.unweathered=true;
  function box(size,position,mat=ivory,detail=false,radius=.025){
    const key=mat.uuid+detail;
    if(!batches.has(key))batches.set(key,{mat,detail,parts:[]});
    const geometry=radius?new RoundedBoxGeometry(...size,1,Math.min(radius,Math.min(...size)*.2)):new THREE.BoxGeometry(...size);
    geometry.deleteAttribute('uv');geometry.translate(...position);batches.get(key).parts.push(geometry);
  }
  box([44,.5,38],[0,-8.25,0],deck,false,0);
  // Full-height windows and a glazed central roof preserve the station panorama.
  box([17,.2,38],[0,1.42,0],glass,false,0);
  for(const side of [-1,1]){
    box([13.5,.45,38],[side*15.25,1.55,0],dark);
    box([.4,1.0,38],[side*22,-7.5,0],petrol);
    box([.12,8.3,38],[side*22,-2.85,0],glass,false,0);
    box([.55,.12,38],[side*21.85,-6.95,0],steel);
    for(const z of [-18,-9,0,9,18]){
      box([.45,9.5,.45],[side*21.8,-3.25,z],ivory);
      box([.65,.7,.65],[side*21.8,-7.65,z],steel);
    }
    // Mount the display wash beneath the enclosed shop ceiling and its beams.
    box([11.7,.10,.22],[side*14,-4.70,-1],steel);
    box([.3,.11,1.8],[side*15,-4.81,-1],dark);
    box([.23,.015,1.65],[side*15,-4.871,-1],glow,true,0);
    // Flush expansion joints, recessed guidance and perimeter skirting.
    box([.07,.008,33],[side*3.7,-7.992,-1],steel,true,0);
    box([.025,.009,18],[side*3.57,-7.99,1],glow,true,0);
    for(let z=-16;z<=16;z+=2)box([7.15,.004,.025],[0,-7.995,z],dark,true,0);
    for(let z=-17;z<=17;z+=2)box([3,.007,1.96],[side*5.4,-7.994,z],petrol,true,0);
  }
  for(const z of [-19,19]){
    box([44,9.5,.5],[0,-3.25,z],dark);
    for(const x of [-18,-12,-6,0,6,12,18]){
      box([5.8,3.6,.14],[x,-5.85,z-Math.sign(z)*.31],ivory);
      box([5.8,.26,.18],[x,-7.72,z-Math.sign(z)*.32],steel);
      box([5.75,2.3,.12],[x,-2.8,z-Math.sign(z)*.3],petrol);
    }
  }
  for(const z of [-18,-9,0,9,18]){
    box([43.8,.36,.45],[0,1.1,z],ivory);
    box([17.2,.18,.65],[0,.83,z],steel);
    for(const side of [-1,1]){
      box([.22,.18,7.7],[side*8.65,.78,z<18?z+4.3:z-4.3],steel);
      box([3.8,.025,.09],[side*5.8,.90,z],glow,true,0);
    }
  }
  // A recessed directory and arrival portal give the far end a destination.
  box([10,.22,.55],[0,-4.32,-18.38],steel);
  box([9.8,2.1,.12],[0,-5.5,-18.42],petrol);
  sign(group,'AEON',[0,-2.65,-18.31],10,1.5,0);
  sign(group,'ORBITAL TRANSIT / DECK 04',[0,-4.85,-18.33],8,.7,0);
  sign(group,'ARMORY  ←     /     SHIP COMPONENTS  →',[0,-5.75,-18.32],8,.35,0);
  sign(group,'CENTRAL CONCOURSE   /   DECK 04',[0,-6.55,-18.32],6,.3,0);
  sign(group,'BERTH TRANSIT   /   01 — 20',[0,-3.65,14.08],6,.5);
  for(const {mat,detail,parts} of batches.values()){
    const merged=mergeGeometries(parts,false);parts.forEach(g=>g.dispose());
    const mesh=new THREE.Mesh(merged,mat);mesh.name=detail?'HubDetail_'+mat.name:'HubStructure_'+mat.name;
    mesh.castShadow=!detail&&!mat.transparent;mesh.receiveShadow=!mat.transparent;group.add(mesh);
  }
  const lights=[];
  for(const z of [-10,8]){
    const light=new THREE.PointLight(p.ivory,500,30,2);light.position.set(0,-2.8,z);group.add(light);lights.push(light);
  }
  // Recessed shop lighting casts contact shadows on the counter and stock.
  // Only this occupied hub activates these two small maps; twenty bays do not
  // acquire twenty copies of these lights.
  for(const side of [-1,1]){
    const light=new THREE.SpotLight(p.ivory,280,21,1.45,.3,2);
    light.position.set(side*15,-4.91,-1);light.target.position.set(side*16.2,-8,-1);
    light.castShadow=true;light.shadow.mapSize.set(1024,1024);light.shadow.camera.near=.1;
    light.shadow.camera.far=22;light.shadow.bias=-.001;light.shadow.normalBias=.04;
    group.add(light,light.target);lights.push(light);
  }
  return {group,lights,staticBoxes:[],interiorBox:new THREE.Box3(new THREE.Vector3(-22,-8,-19),new THREE.Vector3(22,1.5,19))};
}

export function assetCollisionBoxes(root,offset=new THREE.Vector3()){
  const data=root.userData.collisionBoxes;
  const boxes=typeof data==='string'?JSON.parse(data):data??[];
  return boxes.map(({min,max})=>new THREE.Box3(new THREE.Vector3(...min).add(offset),new THREE.Vector3(...max).add(offset)));
}

export function attachConcourse(hub,asset,{sign,materials,shopGraphics}){
  const props=asset.scene.clone(true);
  // Reuse the station's physical surface maps on the authored material batches.
  props.traverse(mesh=>{if(mesh.isMesh){mesh.material.name=mesh.material.name.replace(/^Concourse/,'Finish');mesh.castShadow=true;mesh.receiveShadow=true;}});
  materials?.apply(props);
  hub.staticBoxes=assetCollisionBoxes(props);hub.group.add(props);hub.props=props;
  for(const [name,heading,rows] of [
    ['DirectoryNorth','NORTH BERTHS','01   02   03   04   05\n06   07   08   09   10'],
    ['DirectorySouth','SOUTH BERTHS','11   12   13   14   15\n16   17   18   19   20'],
  ]){
    const anchor=props.getObjectByName(name);
    if(anchor)sign(anchor,`AEON / DECK 04\n${heading}\n${rows}\nELEVATOR BEHIND YOU`,[0,0,0],.56,1.58,0);
  }
  for(const [side,id,title] of [[-1,'Armory','WATCHKEEP / ARMORY'],[1,'Components','KESTREL / SHIP COMPONENTS']]){
    const anchor=props.getObjectByName(id+'Sign');
    if(anchor)sign(anchor,title,[0,0,0],7.05,.29,-side*Math.PI/2);
    const screen=props.getObjectByName(id+'Screen');
    if(screen)sign(screen,'F / BROWSE STOCK',[0,0,0],.43,.24,-side*Math.PI/2);
  }
  if(shopGraphics)hub.group.add(createStationShopGraphics(props,shopGraphics));
}
