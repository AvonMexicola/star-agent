import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createShipMFDs } from './ship-mfd.js';
import { FREIGHTER_LAYOUT, LIFTS } from './freighter-layout.js';

export function createFreighter(systems, { assetURL = `${import.meta.env.BASE_URL}models/atlas.glb` } = {}) {
  const ship = new THREE.Group(); ship.name = 'Atlas heavy logistics'; ship.userData.layout = FREIGHTER_LAYOUT;
  const fallback = new THREE.Group(); ship.add(fallback);
  const steel = new THREE.MeshStandardMaterial({color:0x465c65,metalness:.5,roughness:.55});
  const warning = new THREE.MeshStandardMaterial({color:0xf3a047,metalness:.3,roughness:.5});
  function box(parent,x,y,z,w,h,d,mat=steel) {
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);mesh.position.set(x,y,z);parent.add(mesh);return mesh;
  }
  // Usable fallback preserves the actual shafts, deck surfaces and physical walls.
  box(fallback,0,3.85,-10,12,.3,4);
  box(fallback,0,3.85,-7,12,.3,2);
  box(fallback,0,3.85,-4.5,7.4,.3,3);
  box(fallback,0,3.85,-1.5,12,.3,3);
  for(const side of [-1,1]) {
    box(fallback,side*5,3.85,5,2,.3,10);
    box(fallback,side*6.12,6.7,1,.24,5.4,18);
    box(fallback,side*4.8,6.85,-7,2.2,.3,2);
    box(fallback,side*3.6,3.85,-4.5,.2,.3,3);
  }
  box(fallback,0,9.35,1,12,.3,18);
  box(fallback,2.8,4.55,-7.5,1,1.1,1.8);
  let lid = new THREE.Group();lid.position.set(3.3,5.1,-7.5);fallback.add(lid);box(lid,-.5,.04,0,1,.08,1.8,warning);
  let liftNodes = LIFTS.map(lift=> {
    const group=new THREE.Group();fallback.add(group);
    box(group,(lift.minX+lift.maxX)/2,-.13,(lift.minZ+lift.maxZ)/2,lift.maxX-lift.minX,.26,lift.maxZ-lift.minZ);
    return group;
  });
  // Safety rails rise whenever the adjacent platform is away or travelling.
  const guards = LIFTS.map(lift=> {
    const group=new THREE.Group();ship.add(group);
    const {minX:a,maxX:b,minZ:c,maxZ:d}=lift;
    for(const x of [a,b])box(group,x,.75,(c+d)/2,.07,.07,d-c,warning);
    for(const z of [c,d])box(group,(a+b)/2,.75,z,b-a,.07,.07,warning);
    for(const x of [a,b])for(const z of [c,d])box(group,x,.4,z,.07,.8,.07,warning);
    return group;
  });
  // Riders are also enclosed while travelling; the landing rails stay behind.
  const riderGuards=guards.map(g=>{const copy=g.clone();ship.add(copy);return copy;});
  const mfds=createShipMFDs();mfds.position.set(0,3,-7.7);ship.add(mfds);
  ship.updateDisplays=(dt,nav,inventory,course)=>mfds.update(dt,nav,inventory,course);
  ship.displayState=()=>mfds.snapshot();
  for(const z of [-10,-5,3,8]) {const light=new THREE.PointLight(0xc4eaf4,35,16,2);light.position.set(0,z===-10?6.6:8.6,z);ship.add(light);}
  let storageOpen=false,storageProgress=0;
  ship.setStorage=open=>{storageOpen=Boolean(open);};
  ship.setDoor=()=>{};
  ship.update=dt=> {
    const step=Math.min(.25,Math.max(0,dt));
    storageProgress=THREE.MathUtils.clamp(storageProgress+(storageOpen?step:-step),0,1);
    lid.rotation.z=-storageProgress*1.35;
    ship.userData.storageOpen=storageOpen;ship.userData.storageProgress=storageProgress;
    systems.lifts.forEach((lift,i)=> {
      liftNodes[i].position.y=lift.y;
      const moving=Math.abs(lift.target-lift.y)>.001;
      guards[i].position.y=4;guards[i].visible=moving||Math.abs(lift.y-4)>.01;
      riderGuards[i].position.y=lift.y;riderGuards[i].visible=moving;
    });
  };
  ship.userData.assetStatus='loading';
  ship.readyPromise=new GLTFLoader().loadAsync(assetURL).then(({scene:model})=> {
    const nodes=LIFTS.map(lift=>model.getObjectByName(lift.node));const cargo=model.getObjectByName('CargoLid');
    if(nodes.some(node=>!node)||!cargo)throw new Error('Atlas asset is missing a lift or cargo lid');
    model.traverse(object=>{if(object.isMesh){object.castShadow=true;object.receiveShadow=true;}});
    ship.add(model);liftNodes=nodes;lid=cargo;fallback.visible=false;ship.userData.assetStatus='ready';ship.update(0);return model;
  }).catch(error=>{ship.userData.assetStatus='fallback';ship.userData.assetError=error.message;console.warn('Atlas asset unavailable; using the physical fallback.',error);return null;});
  ship.update(0);return ship;
}
