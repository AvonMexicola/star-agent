import { PlanetRotationClock } from '../src/planet-rotation.js';
import {readFile} from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {StationComplex} from '../src/station-complex.js';
import {PLAYABLE_STATION_OPTIONS} from '../src/station-fleet-hangar.js';
import {RING_SPEED,elevatorBoxes} from '../src/station-architecture.js';
import {assetCollisionBoxes} from '../src/station-concourse.js';
import {constrainStationSweep} from '../src/station-collision.js';
import {Navigation} from '../src/navigation.js';
import {setPlanetSeed} from '../src/generation.js';
import {WORLD_SEED} from '../src/multiplayer/protocol.js';
import {stationPhysicsAt} from '../src/station-physics.js';
import {LandmarkRocks,createLandmarkObstacles} from '../src/landmark-rocks.js';
import {StationDefense} from '../src/station-security.js';

const openStep=(_previous,point)=>({point,hit:false,grounded:false});
const noSurfaceObjects={grounded:false,constrainWalker:openStep,constrainEVA:openStep,constrainFlight:openStep};

// Only this dedicated Node process installs inert browser event registration.
// Network clients never receive a writable navigation object on the server.
export function installHeadlessEvents(){
  globalThis.document??={hidden:false,addEventListener(){},querySelector(){return null;},body:{classList:{toggle(){}}}};
  globalThis.window??={addEventListener(){}};
}
export async function createWorld(){
  const rotationClock=new PlanetRotationClock();
  setPlanetSeed(WORLD_SEED);
  const load=async name=>{
    const bytes=await readFile(new URL(`../public/models/${name}.glb`,import.meta.url)),loader=new GLTFLoader();
    // Collision keeps the exact geometry/rig; image decoding belongs to the
    // browser. A texture placeholder prevents Node from requiring canvas APIs.
    loader.register(parser=>{parser.loadTextureImage=async index=>{const texture=new THREE.Texture();parser.associations.set(texture,{textures:index});return texture;};return {name:'AuthoritativeGeometry'};});
    return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  };
  const [gltf,concourse,elevator,exteriorGltf,defenseGltf]=await Promise.all(['station','station-concourse','station-elevator','station-exterior','station-defense'].map(load));
  // Sign canvases and optional finish textures are render-only. The same hull,
  // spine, rotating rings, hangar deck and lift collision geometry run here.
  const savedDocument=globalThis.document;delete globalThis.document;
  const scene=new THREE.Scene();let station;
  try{station=new StationComplex(scene,{...PLAYABLE_STATION_OPTIONS,exteriorRefresh:false,gltf,exteriorGltf,lod:{scene:new THREE.Group()},finish:false});await station.readyPromise;}
  finally{if(savedDocument)globalThis.document=savedDocument;installHeadlessEvents();}
  if(station.exteriorStatus==='legacy')throw new Error('Authoritative station exterior failed: '+station.exteriorError);
  // Collision is mandatory even without render-only finishes. These are the
  // same authored furniture/cabin boxes used by the browser's finish attachment.
  station.hub.staticBoxes=assetCollisionBoxes(concourse.scene);
  for(const frame of [...station.pods,station.hub])frame.lift.staticBoxes=assetCollisionBoxes(elevator.scene,new THREE.Vector3(0,frame.lift.floor,frame.lift.z));
  if(!station.hub.staticBoxes.length||!station.hub.lift.staticBoxes.length)throw new Error('Station passenger collision assets are empty.');
  const defense=new StationDefense(scene,station,{gltf:defenseGltf,render:false});await defense.readyPromise;
  const landmarks=new LandmarkRocks(scene,{render:false});
  const pods=station.pods;for(const pod of pods)pod.beginOpening();
  return {pods,center:station.centre,scene,station,defense,rotationClock,
    createNavigation(slot,notify){
      const n=new Navigation({addEventListener(){}},notify),pod=pods[slot];n.rotationClock=rotationClock;
      n.surfaceObstacles=createLandmarkObstacles(noSurfaceObjects,landmarks,n);
      n.station=pod;n.startStation();
      n.gamepad.connected=true;n.gamepad.armed=true;return n;
    },
    adapter(player){
      const select=()=>{
        const grid=['walk','eva'].includes(player.nav.mode)?stationPhysicsAt(station,player.nav.position):null;
        station.activeIndex=(grid?.frame.id??player.hangarId??player.spawnPod)-1;
        station.parkedPod=(player.hangarId??player.spawnPod)-1;station.location=grid?.id==='station:hub'?'hub':'hangar';
      };
      return new Proxy({}, {get(_target,key){
        select();
        if(key==='canDock')return (...args)=>{select();return Boolean(player.hangarId&&station.activeIndex===player.hangarId-1&&station.doorsOpen>.98&&station.canDock(...args));};
        if(key==='openDoors'||key==='closeDoors')return ()=>{};
        // Passenger actions are handled by the room's station-hub service.
        if(key==='interactionAt')return ()=>null;
        const value=station[key];return typeof value==='function'?(...args)=>{select();return value.apply(station,args);}:value;
      }});
    },
    doors(progress,dt=0){
      rotationClock.tick();
      defense.update(dt);
      for(const pod of pods)pod.setOpeningProgress(progress[pod.id]??0);
      station.exterior.rings.forEach((ring,i)=>ring.rotation.x=(ring.rotation.x+dt*RING_SPEED*(i===0?1:-1))%(Math.PI*2));
    },
    // Combat additionally sees the station spine/hub/rings, using exactly the
    // same small local BVHs as physical flight. Pod doors are tested by combat.
    occludes(origin,direction,range){
      const start=station.hub.toLocal(origin,new THREE.Vector3());
      const end=station.hub.toLocal(origin.clone().addScaledVector(direction,range),new THREE.Vector3());
      const min=new THREE.Vector3(-.004,-.004,-.004),max=min.clone().negate();let distance=Infinity;
      for(const [tree,boxes] of [[station.spineColliders,[]],[station.hub.colliders,[...station.hub.staticBoxes,...station.hub.lift.staticBoxes,...elevatorBoxes(station.hub.lift)]]]){const r=constrainStationSweep(tree,boxes,start,end,min,max);if(r.hit)distance=Math.min(distance,start.distanceTo(r.point));}
      for(const pod of pods){
        const a=pod.toLocal(origin,new THREE.Vector3()),b=pod.toLocal(origin.clone().addScaledVector(direction,range),new THREE.Vector3());
        const r=constrainStationSweep(null,[...pod.lift.staticBoxes,...elevatorBoxes(pod.lift)],a,b,min,max);if(r.hit)distance=Math.min(distance,a.distanceTo(r.point));
      }
      station.exterior.rings.forEach((ring,i)=>{
        const q=ring.quaternion.clone().invert(),a=start.clone().sub(ring.position).applyQuaternion(q),b=end.clone().sub(ring.position).applyQuaternion(q);
        const r=constrainStationSweep(station.ringColliders[i],[],a,b,min,max);if(r.hit)distance=Math.min(distance,a.distanceTo(r.point));
      });const rock=landmarks.raycast(origin,direction,range);if(rock)distance=Math.min(distance,rock.distance);
      const turret=defense.raycast(origin,direction,range);if(turret!==null)distance=Math.min(distance,turret);
      return Number.isFinite(distance)?distance:null;
    },
  };
}
