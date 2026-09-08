import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {mountAccepts} from './weapon-mounts.js';
import {additive} from './effects/particles.js';
import {SHIP_WEAPON_SIZES,shipWeaponProfile} from './ship-weapon-profiles.js';

export const SHIP_WEAPON_KIT_URL='/models/ship-weapons.glb';
export const ATLAS_GUN_MOUNTS=Object.freeze([
  {name:'HP_Atlas_Port',position:[-3.8,9.56,-5],foundation:'Adapter_Atlas_Front'},
  {name:'HP_Atlas_Starboard',position:[3.8,9.56,-5],foundation:'Adapter_Atlas_Front'},
  {name:'HP_Atlas_Aft',position:[0,9.85,7.5],foundation:'Adapter_Atlas_Aft'},
]);
const TYPES=['pulse','laser','void'],FORWARD=new THREE.Vector3(0,0,-1),ZERO=new THREE.Vector3();
const requests=new Map();
export function prepareShipWeaponKit(gltf){
  const variants=new Map();
  for(const size of [1,2,3])for(const type of TYPES){
    const id=type+'-s'+size,root=gltf.scene.getObjectByName('Weapon_'+id);
    const muzzle=root?.getObjectByName('Muzzle_'+id);
    if(!root||!muzzle||root.userData.weaponSize!==size||root.userData.weaponType!==type)
      throw new Error('Incomplete weapon asset: '+id);
    let triangles=0;
    root.traverse(node=>{if(node.isMesh){
      triangles+=(node.geometry.index?.count??node.geometry.attributes.position?.count??0)/3;
      node.castShadow=true;node.receiveShadow=true;
      for(const material of [node.material].flat())material.userData={...material.userData,authoredSurface:true,unweathered:true};
    }});
    const bounds=new THREE.Box3().setFromObject(root);
    if(triangles<1||bounds.isEmpty()||![...bounds.min.toArray(),...bounds.max.toArray(),...muzzle.position.toArray()].every(Number.isFinite))
      throw new Error('Weapon has no valid physical body: '+id);
    variants.set(id,root);
  }
  return {variants,scene:gltf.scene};
}
export function loadShipWeaponKit(url=SHIP_WEAPON_KIT_URL){
  if(!requests.has(url))requests.set(url,new GLTFLoader().loadAsync(url).then(prepareShipWeaponKit).catch(error=>{requests.delete(url);throw error;}));
  return requests.get(url);
}
function socketsFor(ship,shipId){
  let authoredAtlas=false;
  if(shipId==='atlas')ship.traverse(node=>{if(node.userData.role==='weapon-mount')authoredAtlas=true;});
  if(shipId==='atlas'&&!authoredAtlas)for(const spec of ATLAS_GUN_MOUNTS){
    if(ship.getObjectByName(spec.name))continue;
    const node=new THREE.Group();node.name=spec.name;node.position.fromArray(spec.position);
    node.userData={kind:'weapon',size:3,mount:'fixed',foundation:spec.foundation};ship.add(node);
  }
  const sockets=[];
  ship.traverse(node=>{if((node.name.startsWith('HP_')&&node.userData.kind==='weapon')||node.userData.role==='weapon-mount')sockets.push(node);});
  if(sockets.length!==({nomad:2,kestrel:4,atlas:3,'atlas-mark-ii':3}[shipId]))throw new Error('Unexpected weapon sockets on '+shipId);
  return sockets;
}
/** Actual attachment geometry and named muzzle matrices are the source of firing poses. */
export function attachShipWeapons(ship,shipId,kit){
  if(ship.armament?.status==='ready')return ship.armament;
  const size=SHIP_WEAPON_SIZES[shipId];if(!size)throw new Error('Unknown armed ship: '+shipId);
  const sockets=socketsFor(ship,shipId);
  for(const socket of sockets)if(!mountAccepts(socket.userData.size??socket.userData.mountSize,size))throw new Error('Weapon does not fit '+socket.name);
  // Validate every dependency before changing the hull. A partial fitting must
  // never remain visible without its corresponding physical envelopes.
  const plans=sockets.map(socket=>{
    const name=shipId==='nomad'?'Adapter_Nomad':socket.name==='HP_Nose'?'Adapter_Kestrel_Nose':socket.name.startsWith('HP_Wing')?'Adapter_Kestrel_'+socket.name.slice(3):socket.userData.foundation;
    const adapter=name?kit.scene.getObjectByName(name):null;
    if(name&&!adapter)throw new Error('Missing weapon foundation: '+name);
    return {socket,adapter};
  });
  let selected='pulse',cursor=0,shots=0,lastShot=null;
  const flashGeometry=new THREE.ConeGeometry(1,1,8,1,true);
  flashGeometry.rotateX(-Math.PI/2);flashGeometry.translate(0,0,-.5);
  const mounts=plans.map(({socket,adapter})=>{
    const group=new THREE.Group();group.name='Fitted guns / '+socket.name;socket.add(group);
    if(adapter)group.add(adapter.clone(true));
    const weapons=new Map();
    for(const type of TYPES){
      const id=type+'-s'+size,model=kit.variants.get(id).clone(true),profile=shipWeaponProfile(type,size);
      if(socket.name==='HP_Nose')model.position.z-=1.05;
      if(shipId==='nomad')model.position.y+=.015;
      model.visible=type===selected;group.add(model);
      const muzzle=model.getObjectByName('Muzzle_'+id);
      const flash=new THREE.Mesh(flashGeometry,new THREE.MeshBasicMaterial({...additive,color:profile.color,opacity:0,toneMapped:false,side:THREE.DoubleSide}));
      flash.name='Barrel flash';flash.userData.weaponEffect=true;flash.visible=false;
      flash.scale.set(.11*profile.effectScale,.11*profile.effectScale,.55*profile.effectScale);muzzle.add(flash);
      weapons.set(type,{model,muzzle,flash,time:0});
    }
    return {socket,group,weapons};
  });
  function metadata(){ship.userData.hardpoints=mounts.map(({socket})=>({node:socket.name,size,mount:'fixed',installedWeapon:selected+'-s'+size}));
    for(const {socket} of mounts)socket.userData.installedWeapon=selected+'-s'+size;
  }
  function stop(){for(const mount of mounts)for(const item of mount.weapons.values()){item.time=0;item.flash.visible=false;}}
  function muzzle(index,{origin=ZERO,local=false,type=selected}={}){
    const mount=mounts[index%mounts.length],item=mount.weapons.get(type);
    if(!item)throw new Error('Unknown fitted weapon '+type);
    ship.updateWorldMatrix(true,true);
    const matrix=item.muzzle.matrixWorld.clone();
    if(local)matrix.premultiply(ship.matrixWorld.clone().invert());
    return {position:new THREE.Vector3().setFromMatrixPosition(matrix).add(local?ZERO:origin),
      direction:FORWARD.clone().transformDirection(matrix),mount:mount.socket.name,index:index%mounts.length,type,size,profile:shipWeaponProfile(type,size)};
  }
  // Include every selectable body and bracket. Effects never enlarge physical bounds.
  ship.updateWorldMatrix(true,true);
  const inverse=ship.matrixWorld.clone().invert();
  const flightParts=mounts.map(({group,socket})=>{
    const box=new THREE.Box3();
    group.traverse(node=>{if(!node.isMesh||node.userData.weaponEffect)return;
      node.geometry.computeBoundingBox();box.union(node.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(node.matrixWorld)));
    });
    return {name:socket.name+' weapons',min:box.min.toArray(),max:box.max.toArray()};
  });
  const armament={status:'ready',shipId,size,flightParts,
    select(type){shipWeaponProfile(type,size);if(selected===type)return;selected=type;stop();
      for(const mount of mounts)for(const [id,item] of mount.weapons)item.model.visible=id===type;metadata();},
    muzzle,nextMuzzle(options){return muzzle(cursor++%mounts.length,options);},stop,
    fired(pose){const item=mounts[pose.index]?.weapons.get(pose.type);if(!item)return;
      item.time=.09;item.flash.visible=true;item.flash.material.opacity=.9;shots++;
      lastShot={mount:pose.mount,type:pose.type,size,position:pose.position.toArray(),direction:pose.direction.toArray()};},
    update(dt){for(const mount of mounts)for(const item of mount.weapons.values())if(item.time>0){item.time=Math.max(0,item.time-dt);item.flash.visible=item.time>0;item.flash.material.opacity=item.time/.1;}},
    get state(){return {status:'ready',shipId,size,type:selected,shots,lastShot,mounts:ship.userData.hardpoints.map(item=>({...item})),flightParts};},
    dispose(){stop();for(const mount of mounts){mount.group.removeFromParent();for(const item of mount.weapons.values())item.flash.material.dispose();}flashGeometry.dispose();},
  };
  metadata();ship.armament=armament;return armament;
}
export function equipShipWeapons(ship,shipId,{kitPromise=loadShipWeaponKit()}={}){
  const hull=ship.readyPromise??Promise.resolve(ship);
  ship.armament={status:'loading',get state(){return {status:'loading',size:SHIP_WEAPON_SIZES[shipId],mounts:[]};}};
  const kitResult=kitPromise.then(kit=>({kit}),error=>({error}));
  ship.readyPromise=Promise.all([hull,kitResult]).then(([result,{kit,error}])=>{
    try{if(error)throw error;attachShipWeapons(ship,shipId,kit);}
    catch(failure){ship.armament={status:'unavailable',get state(){return {status:'unavailable',error:failure.message,size:SHIP_WEAPON_SIZES[shipId],mounts:[]};}};console.warn('Ship weapons unavailable:',failure);}
    return result;
  });
  return ship;
}
const layouts=new WeakMap();
export function armedShipLayout(layout,armament){
  if(armament?.status!=='ready')return layout;
  if(layouts.has(armament))return layouts.get(armament);
  const box=new THREE.Box3(new THREE.Vector3(...layout.flightBounds.min),new THREE.Vector3(...layout.flightBounds.max));
  for(const part of armament.flightParts)box.union(new THREE.Box3(new THREE.Vector3(...part.min),new THREE.Vector3(...part.max)));
  const result={...layout,flightBounds:{min:box.min.toArray(),max:box.max.toArray()},weaponParts:armament.flightParts,flightParts:[...(layout.flightParts??[layout.flightBounds]),...armament.flightParts]};
  layouts.set(armament,result);return result;
}
