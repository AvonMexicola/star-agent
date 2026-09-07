import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {StationComplex} from '../src/station-complex.js';
import {RING_SPEED} from '../src/station-architecture.js';
import {constrainStationSweep} from '../src/station-collision.js';
import {Navigation} from '../src/navigation.js';
import {setPlanetSeed} from '../src/generation.js';
import {WORLD_SEED} from '../src/multiplayer/protocol.js';
import {stationPhysicsAt} from '../src/station-physics.js';

// Only this dedicated Node process installs inert browser event registration.
// Network clients never receive a writable navigation object on the server.
export function installHeadlessEvents(){
  globalThis.document??={hidden:false,addEventListener(){},querySelector(){return null;},body:{classList:{toggle(){}}}};
  globalThis.window??={addEventListener(){}};
}
export async function createWorld(){
  setPlanetSeed(WORLD_SEED);
  const bytes=await readFile(new URL('../public/models/station.glb',import.meta.url));
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  // Sign canvases and optional finish textures are render-only. The same hull,
  // spine, rotating rings, hangar deck and lift collision geometry run here.
  const savedDocument=globalThis.document;delete globalThis.document;
  const scene=new THREE.Scene();let station;
  try{station=new StationComplex(scene,{gltf,lod:{scene:new THREE.Group()},finish:false});await station.readyPromise;}
  finally{if(savedDocument)globalThis.document=savedDocument;installHeadlessEvents();}
  const pods=station.pods;for(const pod of pods)pod.beginOpening();
  return {pods,center:station.centre,scene,station,
    createNavigation(slot,notify){
      const n=new Navigation({addEventListener(){}},notify),pod=pods[slot];
      n.station=pod;n.startStation();
      n.gamepad.connected=true;n.gamepad.armed=true;return n;
    },
    adapter(player){
      const select=()=>{
        const grid=['walk','eva'].includes(player.nav.mode)?stationPhysicsAt(station,player.nav.position):null;
        station.activeIndex=(grid?.frame.id??player.hangarId??player.spawnPod)-1;
        station.parkedPod=(player.hangarId??player.spawnPod)-1;station.location='hangar';
      };
      return new Proxy({}, {get(_target,key){
        select();
        if(key==='canDock')return (...args)=>{select();return Boolean(player.hangarId&&station.activeIndex===player.hangarId-1&&station.doorsOpen>.98&&station.canDock(...args));};
        if(key==='openDoors'||key==='closeDoors')return ()=>{};
        // Concourse travel requires its own authoritative transit protocol.
        if(key==='interactionAt')return ()=>null;
        const value=station[key];return typeof value==='function'?(...args)=>{select();return value.apply(station,args);}:value;
      }});
    },
    doors(progress,dt=0){
      for(const pod of pods)pod.setOpeningProgress(progress[pod.id]??0);
      station.exterior.rings.forEach((ring,i)=>ring.rotation.x=(ring.rotation.x+dt*RING_SPEED*(i===0?1:-1))%(Math.PI*2));
    },
    // Combat additionally sees the station spine/hub/rings, using exactly the
    // same small local BVHs as physical flight. Pod doors are tested by combat.
    occludes(origin,direction,range){
      const start=station.hub.toLocal(origin,new THREE.Vector3());
      const end=station.hub.toLocal(origin.clone().addScaledVector(direction,range),new THREE.Vector3());
      const min=new THREE.Vector3(-.004,-.004,-.004),max=min.clone().negate();let distance=Infinity;
      for(const tree of [station.spineColliders,station.hub.colliders]){const r=constrainStationSweep(tree,[],start,end,min,max);if(r.hit)distance=Math.min(distance,start.distanceTo(r.point));}
      station.exterior.rings.forEach((ring,i)=>{
        const q=ring.quaternion.clone().invert(),a=start.clone().sub(ring.position).applyQuaternion(q),b=end.clone().sub(ring.position).applyQuaternion(q);
        const r=constrainStationSweep(station.ringColliders[i],[],a,b,min,max);if(r.hit)distance=Math.min(distance,a.distanceTo(r.point));
      });return Number.isFinite(distance)?distance:null;
    },
  };
}
