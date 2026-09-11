import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Station, STATION_MODEL_URL, STATION_LOD_URL, stationQuaternion, defaultStationDirection, STATION_ALTITUDE } from './station.js';
import { RADIUS } from './world.js';
import { createStationFinishMaterials } from './station-finish-materials.js';
import { createStationFinishGraphics } from './station-finish-graphics.js';
import { createStationFinishLighting, prepareStationFinishShadows } from './station-finish-lighting.js';
import { attachConcourse } from './station-concourse.js';
import { attachPromenade, promenadeInteraction, addPromenadeShell } from './station-promenade.js';
import { loadCosmicChickenGraphics } from './station-cosmic-chicken.js';
import { loadStationShopGraphics } from './station-shop-graphics.js';
import { createStationShopProps, loadStationShopProps } from './station-shop-props.js';
import { createStationShopkeeper, STATION_SHOPKEEPERS } from './station-shopkeeper.js';
import { attachPressureElevator } from './station-elevator.js';
import { SHIP_LAYOUT } from './boarding.js';
import { buildStationColliders, constrainStationSweep } from './station-collision.js';
import { POD_LAYOUT, RING_SPEED, createExterior, createHub, createElevator, updateElevator, elevatorBoxes, updateElevatorBoxes, sign } from './station-architecture.js';
import { createAuthoredExterior, attachExteriorLod, STATION_EXTERIOR_URL, STATION_EXTERIOR_LOD_URL } from './station-exterior.js';
import { fleetHangarAsset } from './station-fleet-hangar.js';
import {STATION_HUB_FRAME,hubFrameMethods} from './station-hub-policy.js';
import {stationPhysicsAt} from './station-physics.js';

const scratchLocal=new THREE.Vector3();

/** Bake only cloned LOD geometry into the station frame, then merge compatible
 * material/attribute sets. Each moving door stays separate from static parts
 * and from the opposite door, so every berth retains its own animation pose.
 */
function stationLodParts(root){
  root.updateMatrixWorld(true);
  const groups=new Map(),separate=[];
  root.traverse(mesh=>{
    if(!mesh.isMesh)return;
    let parent=mesh,door=-1;
    while(parent){if(parent.name==='HangarDoor_L')door=0;if(parent.name==='HangarDoor_R')door=1;parent=parent.parent;}
    const source=mesh.geometry,attributes=Object.entries(source.attributes).sort(([a],[b])=>a.localeCompare(b));
    // Preserve uncommon authored draw layouts unchanged rather than dropping
    // groups, morph targets, interleaved attributes or partial draw ranges.
    if(Array.isArray(mesh.material)||mesh.isSkinnedMesh||source.isInstancedBufferGeometry||
      Object.keys(source.morphAttributes).length||attributes.some(([,a])=>a.isInterleavedBufferAttribute)||
      source.drawRange.start!==0||Number.isFinite(source.drawRange.count)){
      separate.push({geometry:source.clone(),material:mesh.material,matrix:mesh.matrixWorld.clone(),door,name:mesh.name,sourceCount:1});return;
    }
    const signature=attributes.map(([name,a])=>[name,a.itemSize,a.normalized,a.array.constructor.name,a.gpuType].join(':')).join('|');
    const key=`${door}/${mesh.material.uuid}/${Boolean(source.index)}/${signature}`;
    let group=groups.get(key);
    if(!group){group={geometries:[],material:mesh.material,door,name:mesh.name};groups.set(key,group);}
    group.geometries.push(source.clone().applyMatrix4(mesh.matrixWorld));
  });
  for(const group of groups.values()){
    const geometry=group.geometries.length===1?group.geometries[0]:mergeGeometries(group.geometries,false);
    if(!geometry)throw new Error('Compatible station LOD geometry could not be merged.');
    if(group.geometries.length>1)for(const part of group.geometries)part.dispose();
    separate.push({geometry,material:group.material,matrix:new THREE.Matrix4(),door:group.door,name:group.name,sourceCount:group.geometries.length});
  }
  return separate;
}

/** One asset, twenty independent berths. Positions stay in doubles until rebase(). */
export class StationComplex {
  constructor(scene,options={}){
    this.scene=scene;this.pods=[];this.activeIndex=0;this.parkedPod=0;this.location='hangar';this.ready=false;this.error=null;
    this.largeHangars=options.largeHangars===true;
    this.direction=(options.direction?.clone()??defaultStationDirection()).normalize();
    this.altitude=options.altitude??STATION_ALTITUDE;
    this.baseQuaternion=options.orientation?.clone().normalize()??stationQuaternion(this.direction,new THREE.Quaternion());
    this._up=new THREE.Vector3(0,1,0).applyQuaternion(this.baseQuaternion).normalize();
    this._openingIndex=null;this._openingProgress=0;
    this.centre=this.direction.clone().multiplyScalar(RADIUS+this.altitude);
    this.exterior=createExterior();scene.add(this.exterior.group);
    this.lodGroup=new THREE.Group();this.lodGroup.name='Instanced distant berths';scene.add(this.lodGroup);this.lodBatches=[];
    // Distant stand-in for the promenade annex, owned here rather than injected
    // into either exterior kit: both measure their own assembled geometry.
    this.annexShell=new THREE.Group();this.annexShell.name='Promenade annex shell';scene.add(this.annexShell);
    this.hub=createHub();scene.add(this.hub.group);
    this.hub.quaternion=this.baseQuaternion.clone();this.hub.inverseQuaternion=this.baseQuaternion.clone().invert();this.hub.worldPosition=this.centre.clone();this.hub.ready=true;
    Object.defineProperty(this.hub,'up',{get:()=>this.up});
    for(const name of ['toWorld','toLocal'])this.hub[name]=Station.prototype[name];
    Object.assign(this.hub,hubFrameMethods());
    this.hub.colliders=buildStationColliders(this.hub.group);
    this.hub.lift=createElevator(this.hub.group,14.3);
    Object.assign(this,this.buildExteriorColliders());
    this.syncAnnexShell();
    this.exteriorStatus='legacy';this.exteriorError=null;this.exteriorLodError=null;
    this.finishStatus='loading';this.finishRig=null;
    this.readyPromise=this.load(options);
  }
  /** Reuse whichever hull finish the installed exterior kit is currently using. */
  syncAnnexShell(){
    const source=this.exterior?.hubShell?.getObjectByProperty?.('isMesh',true)?.material
      ??(this.exterior?.hubShell?.isMesh?this.exterior.hubShell.material:null);
    this.annexShell.clear();
    if(source)addPromenadeShell(this.annexShell,source);
  }
  buildExteriorColliders(exterior=this.exterior){
    exterior.lod?.group.removeFromParent();
    const ringColliders=exterior.rings.map(ring=>{
      const x=ring.position.x;ring.position.x=0;
      const tree=buildStationColliders(ring);ring.position.x=x;return tree;
    });
    // Exclude the moving rings from the fixed spine collision tree.
    for(const ring of exterior.rings)ring.removeFromParent();
    let spineColliders;
    try{spineColliders=buildStationColliders(exterior.group);}
    finally{exterior.group.add(...exterior.rings);if(exterior.lod)exterior.group.add(exterior.lod.group);}
    return {ringColliders,spineColliders};
  }
  async loadFinish(loader){
    try{
      const [materials,props,concourse,promenade,elevator,shopGraphics,shopProps,cosmicChicken]=await Promise.all([createStationFinishMaterials(),loader.loadAsync('/models/station-props.glb'),loader.loadAsync('/models/station-concourse.glb'),loader.loadAsync('/models/station-promenade.glb'),loader.loadAsync('/models/station-elevator.glb'),loadStationShopGraphics(),loadStationShopProps(),loadCosmicChickenGraphics()]);
      const graphics=createStationFinishGraphics();
      await graphics.readyPromise;
      const rig=createStationFinishLighting();
      this.finishMaterials=materials;this.finishRig=rig;this.finishStatus='ready';
      return {materials,props,graphics,concourse,promenade,elevator,shopGraphics,shopProps,cosmicChicken};
    }catch(error){this.finishStatus='unavailable';this.finishError=error.message;return null;}
  }
  async load(options){
    try{
      const loader=new GLTFLoader();
      const exterior=options.exteriorGltf??(options.exteriorRefresh?loader.loadAsync(STATION_EXTERIOR_URL).catch(error=>{this.exteriorError=error.message;return null;}):null);
      const exteriorLod=options.exteriorLodGltf??(options.exteriorRefresh?loader.loadAsync(STATION_EXTERIOR_LOD_URL).catch(error=>{this.exteriorLodError=error.message;return null;}):null);
      const [source,sourceLod,finish,authoredExterior,authoredLod]=await Promise.all([options.gltf??loader.loadAsync(STATION_MODEL_URL),options.lod??loader.loadAsync(STATION_LOD_URL).catch(()=>null),(options.finish??!options.gltf)?this.loadFinish(loader):null,exterior,exteriorLod]);
      const gltf=this.largeHangars?fleetHangarAsset(source):source;
      const lod=this.largeHangars&&sourceLod?fleetHangarAsset(sourceLod):sourceLod;
      if(authoredExterior){
        // Construct and validate the replacement before removing the fallback.
        // Readiness remains false until its actual collision is built as well.
        try{
          const next=createAuthoredExterior(authoredExterior,finish?.materials);
          const colliders=this.buildExteriorColliders(next);
          if(authoredLod){
            try{attachExteriorLod(next,authoredLod,finish?.materials);}
            catch(error){this.exteriorLodError=error.message;}
          }
          this.exterior.group.removeFromParent();this.exterior=next;this.scene.add(next.group);
          Object.assign(this,colliders);this.syncAnnexShell();this.exteriorStatus='geometry-review';
        }catch(error){this.exteriorError=error.message;}
      }
      if(finish){gltf.scene.add(finish.props.scene,finish.graphics);finish.materials.apply(gltf.scene);if(lod)finish.materials.apply(lod.scene);}else if(this.finishStatus==='loading')this.finishStatus='disabled';
      if(finish){
        attachConcourse(this.hub,finish.concourse,{sign,materials:finish.materials,shopGraphics:finish.shopGraphics});
        attachPromenade(this.hub,finish.promenade,{sign,materials:finish.materials,cosmicChicken:finish.cosmicChicken});
        this.hub.shopProps=createStationShopProps(finish.shopProps);
        this.hub.group.add(this.hub.shopProps);
        // Collision for the batched furniture comes from authored assembly boxes.
        // Keep the room BVH built before these optional props and moving leaves.
        finish.materials.apply(this.hub.group);
        this.hub.group.traverse(mesh=>{if(mesh.isMesh&&(/Detail|Sign_/.test(mesh.name)||mesh.material.transparent))mesh.castShadow=false;});
        // The finish re-enables casting on every material it replaces; the
        // promenade has no shadow-casting light, so take it back out again.
        this.hub.promenade?.disableShadowCasting();
        attachPressureElevator(this.hub.lift,finish.elevator,{sign,materials:finish.materials});
        // Attach after station materials/shadow batching: both characters keep
        // authored skin/clothing materials and load only on hub entry.
        this.shopkeepers=Object.fromEntries(Object.entries(STATION_SHOPKEEPERS).map(([id,definition])=>{
          const merchant=createStationShopkeeper({definition});this.hub.group.add(merchant.group);return [id,merchant];
        }));
      }
      let colliders;
      for(const spec of POD_LAYOUT){
        const pod=new Station(this.scene,{gltf:{scene:gltf.scene.clone(true),animations:gltf.animations},lodUrl:null,direction:this.direction,orientation:this.baseQuaternion,altitude:this.altitude,offset:spec.offset,yaw:spec.yaw,lodDistance:180,colliders});
        if(finish)prepareStationFinishShadows(pod.model);
        colliders??=pod.colliders;pod.id=spec.id;
        if(lod)pod.attachLod({scene:lod.scene.clone(true)});
        const number=pod.model.getObjectByName('DeckNumber');if(number)number.visible=false;
        pod.lift=createElevator(pod.group,22.3,pod.interiorBox.min.y);
        if(finish)attachPressureElevator(pod.lift,finish.elevator,{sign,materials:finish.materials});
        pod.services=new THREE.Group();pod.group.add(pod.services);
        sign(pod.services,`BERTH ${String(pod.id).padStart(2,'0')} / AEON`,[0,9,-26],18,2);
        sign(pod.services,'CARGO & TRADE\nF / X  ·  TERMINAL',[-12,pod.interiorBox.min.y+1.72,22.69],1.72,1.12);
        sign(pod.services,`BERTH ${String(pod.id).padStart(2,'0')}`,[0,pod.interiorBox.min.y+5.2,22.15],5,.75);
        this.pods.push(pod);
      }
      if(lod){
        for(const part of stationLodParts(lod.scene)){
          const instances=new THREE.InstancedMesh(part.geometry,part.material,this.pods.length);
          instances.name=part.name;instances.frustumCulled=false;this.lodGroup.add(instances);
          this.lodBatches.push({instances,matrix:part.matrix,door:part.door,sourceCount:part.sourceCount,closedX:part.door>=0?this.pods[0].doors[part.door].position.x:0});
        }
      }
      this.ready=true;
      if(this.openingControlled){this.activeIndex=this._openingIndex;this.active.beginOpening();this.active.setOpeningProgress(this._openingProgress);}
      return this;
    }catch(error){this.error=error.message;throw error;}
  }
  get active(){return this.pods[this.activeIndex];}
  get frame(){return this.location==='hub'?this.hub:this.active;}
  get worldPosition(){return this.frame?.worldPosition??this.centre;}
  get quaternion(){return this.frame?.quaternion??this.baseQuaternion;}
  get inverseQuaternion(){return this.frame?.inverseQuaternion??this.baseQuaternion.clone().invert();}
  get up(){return this._up;}
  get interiorBox(){return this.frame?.interiorBox;}
  get padLocal(){return this.active?.padLocal;}
  get padWorldPosition(){return this.active?.padWorldPosition;}
  get padQuaternion(){return this.active?.padQuaternion;}
  get approachWorldPosition(){return this.active?.approachWorldPosition;}
  get doorTriggerWorldPosition(){return this.active?.doorTriggerWorldPosition;}
  get openingZ(){return this.active?.openingZ;}
  get model(){return this.active?.model;}
  get doorsOpen(){return this.active?.doorsOpen??0;}
  get lift(){return this.frame?.lift;}
  toWorld(p,target){return this.frame.toWorld(p,target);}
  toLocal(p,target){return this.frame.toLocal(p,target);}
  deckPoint(p,height){return this.frame?.deckPoint(p,height)??null;}
  deckHeightAt(p){return this.frame?.deckHeightAt(p)??null;}
  canDock(...args){return (!this.multiplayerState||Boolean(this.multiplayerState.hangar&&this.activeIndex===this.multiplayerState.hangar.id-1&&this.doorsOpen>.98))&&this.location==='hangar'&&Boolean(this.active?.canDock(...args));}
  isInsideHangar(p){return Boolean(this.frame?.isInsideHangar(p));}
  transitParams(...args){this.location='hangar';return this.active.transitParams(...args);}
  openDoors(){if(!this.multiplayerState)this.active?.openDoors();}
  closeDoors(){if(!this.multiplayerState)this.active?.closeDoors();}
  get openingControlled(){return this._openingIndex!==null;}
  get openingProgress(){return this._openingProgress;}
  beginOpening(){
    this.location='hangar';this._openingIndex=this.activeIndex;this._openingProgress=0;
    this.active?.beginOpening();return 0;
  }
  setOpeningProgress(progress){
    this._openingProgress=THREE.MathUtils.clamp(Number.isFinite(progress)?progress:0,0,1);
    if(this.openingControlled)this.activeIndex=this._openingIndex;
    this.active?.setOpeningProgress(this._openingProgress);return this._openingProgress;
  }
  endOpening(){
    if(this.openingControlled)this.activeIndex=this._openingIndex;
    const openness=this.active?.endOpening()??0;this._openingIndex=null;return openness;
  }
  setMultiplayerState(state){
    this.multiplayerState=state;
    if(!state){this._defenseState=null;this.defense?.resetSession();for(const pod of this.pods)if(pod.openingControlled)pod.endOpening();return;}
    this._openingIndex=null;
    if(state.defense!==this._defenseState){this._defenseState=state.defense;this.defense?.setState(state.defense);}
    const occupiedFrame=state.hub?.frame??state.physicsFrame;
    this.location=occupiedFrame===STATION_HUB_FRAME?'hub':'hangar';
    const frame=state.frame;
    if(frame?.direction?.length===3&&frame?.orientation?.length===4&&Number.isFinite(frame.altitude)){
      const key=JSON.stringify(frame);
      if(this._multiplayerFrame!==key){
        this._multiplayerFrame=key;this.direction.fromArray(frame.direction).normalize();this.baseQuaternion.fromArray(frame.orientation).normalize();this.altitude=frame.altitude;
        this._up.set(0,1,0).applyQuaternion(this.baseQuaternion);this.centre.copy(this.direction).multiplyScalar(RADIUS+this.altitude);
        this.hub.worldPosition.copy(this.centre);this.hub.quaternion.copy(this.baseQuaternion);this.hub.inverseQuaternion.copy(this.baseQuaternion).invert();
        for(const pod of this.pods){pod.direction.copy(this.direction);pod.direction0.copy(this.direction);pod.altitude=this.altitude;pod.orientationOverride.copy(this.baseQuaternion);pod.updateFrame();}
      }
    }
    if(state.hangar){this.activeIndex=state.hangar.id-1;this.parkedPod=this.activeIndex;}
    const occupied=/^hangar:(\d+)$/.exec(occupiedFrame??'');
    if(occupied&&this.pods[Number(occupied[1])-1])this.activeIndex=Number(occupied[1])-1;
    for(let i=0;i<this.pods.length;i++){
      const pod=this.pods[i];
      if(!pod.openingControlled)pod.beginOpening();
      pod.setOpeningProgress(state.doors?.[i+1]??0);
    }
    for(const pose of state.hub?.elevators??[]){
      const match=/^hangar:(\d+)$/.exec(pose.frame??'');
      const frame=pose.frame===STATION_HUB_FRAME?this.hub:match?this.pods[Number(match[1])-1]:null;
      if(!frame||typeof pose.open!=='boolean'||!Number.isFinite(pose.progress))continue;
      frame.lift.open=pose.open;frame.lift.progress=THREE.MathUtils.clamp(pose.progress,0,1);updateElevator(frame.lift,0);
    }
  }
  update(position,origin,sun,dt){
    if(this.multiplayerState)this.setMultiplayerState(this.multiplayerState);
    if(this.openingControlled){this.activeIndex=this._openingIndex;this.location='hangar';}
    if(this.ready && this.nav?.mode==='flight'&&!this.openingControlled&&!this.nav.openingActive&&!this.multiplayerState?.hangar){
      this.location='hangar';let nearest=Infinity;
      this.pods.forEach((pod,i)=>{const distance=position.distanceToSquared(pod.worldPosition);if(distance<nearest){nearest=distance;this.activeIndex=i;}});
    }
    for(const pod of this.pods){
      // Navigation chooses the occupied berth; the final cinematic/first-person
      // camera origin controls visibility and floating-origin render transforms.
      pod.update(origin,origin,sun,dt);updateElevator(pod.lift,this.multiplayerState?.hub?0:dt);
      pod.lift.group.visible=pod.services.visible=pod.cameraDistance<230;
      if(pod.lodModel)pod.lodModel.visible=false;
    }
    this._lodPoseCache??=new WeakMap();
    this._lodScratch??={matrix:new THREE.Matrix4(),local:new THREE.Matrix4(),unit:new THREE.Vector3(1,1,1)};
    const {matrix,local,unit}=this._lodScratch;
    const poses=this.pods.map(pod=>{
      let pose=this._lodPoseCache.get(pod);
      if(!pose){pose={offset:new THREE.Vector3(Infinity,Infinity,Infinity),yaw:new THREE.Quaternion(),base:new THREE.Matrix4(),visible:null,doors:[],doorChanged:[]};this._lodPoseCache.set(pod,pose);}
      const visible=pod.cameraDistance>pod.lodDistance&&pod.cameraDistance<600000;
      pose.changed=pose.visible!==visible||!pose.offset.equals(pod.offset)||!pose.yaw.equals(pod.yaw);
      if(pose.changed){pose.visible=visible;pose.offset.copy(pod.offset);pose.yaw.copy(pod.yaw);pose.base.compose(pod.offset,pod.yaw,unit);}
      for(let i=0;i<2;i++){const x=pod.doors[i]?.position.x;pose.doorChanged[i]=pose.doors[i]!==x;pose.doors[i]=x;}
      return pose;
    });
    for(const batch of this.lodBatches){
      let changed=false;
      this.pods.forEach((pod,i)=>{
        const pose=poses[i];
        if(batch._poseInitialized&&!pose.changed&&!(pose.visible&&batch.door>=0&&pose.doorChanged[batch.door]))return;
        if(!pose.visible)matrix.makeScale(0,0,0);
        else{
          local.copy(batch.matrix);
          if(batch.door>=0)local.elements[12]+=pose.doors[batch.door]-batch.closedX;
          matrix.copy(pose.base).multiply(local);
        }
        batch.instances.setMatrixAt(i,matrix);
        batch.instances.instanceMatrix.addUpdateRange(i*16,16);changed=true;
      });
      if(changed)batch.instances.instanceMatrix.needsUpdate=true;
      batch._poseInitialized=true;
    }
    const cameraDistance=origin.distanceTo(this.centre);
    // The fixed spine and rings share the pod render horizon. Keeping their
    // group visible at planetary orbit costs 93 draws for a subpixel station.
    this.lodGroup.visible=this.exterior.group.visible=cameraDistance<600000;
    this.finishRig?.update(this,position);
    updateElevator(this.hub.lift,this.multiplayerState?.hub?0:dt);
    this.exterior.rings.forEach((ring,i)=>ring.rotation.x=(ring.rotation.x+dt*RING_SPEED*(i===0?1:-1))%(Math.PI*2));
    this.hub.group.visible=cameraDistance<140;
    for(const merchant of Object.values(this.shopkeepers??{}))merchant.update(dt,{visible:this.hub.group.visible&&this.location==='hub',paused:this.nav?.enabled===false||this.nav?.focused===false||(typeof document!=='undefined'&&document.hidden)});
    this.exterior.hubShell.visible=!this.hub.group.visible;
    this.exterior.updateDetail?.(cameraDistance);
    this.annexShell.visible=Boolean(this.exterior.hubShell.visible||this.exterior.lod?.hubShell.visible);
    const lit=this.location==='hub'&&position.distanceTo(this.centre)<100;
    for(const light of this.hub.lights)light.visible=lit;
    this.hub.promenade?.update(this.location==='hub'&&this.hub.group.visible?this.hub.toLocal(position,scratchLocal):null);
    // Switching the hub's lights on gives every material a new program, and a
    // program compiles on its first draw, so the first look that swept a berth
    // paid for the docked ship's materials as a frame stall. Report the change
    // once; the owner of the renderer compiles the scene for this configuration.
    if(lit!==this._hubLit){this._hubLit=lit;if(lit)this.onHubLit?.();}
    this.rebase(origin);
  }
  rebase(origin){
    for(const pod of this.pods){pod.group.position.copy(pod.worldPosition).sub(origin);pod.group.quaternion.copy(pod.quaternion);}
    for(const group of [this.exterior.group,this.hub.group,this.lodGroup,this.annexShell]){group.position.copy(this.centre).sub(origin);group.quaternion.copy(this.baseQuaternion);}
  }
  constrainStep(previous,proposed,orientation,walking=false,layout=SHIP_LAYOUT){
    if(!this.ready)return {point:proposed.clone(),hit:false};
    let closest={point:proposed.clone(),hit:false};
    const keep=result=>{if(result.hit&&(!closest.hit||result.point.distanceToSquared(previous)<closest.point.distanceToSquared(previous)))closest=result;};
    if(this.defense)keep(this.defense.constrainStep(previous,proposed,orientation,walking,layout));
    if(walking){
      // A suit can enter any berth, including one different from its ship's
      // assigned hangar. Test those physical frames before selecting a deck.
      for(const frame of [...this.pods,this.hub]){
        const start=frame.toLocal(previous,new THREE.Vector3()),end=frame.toLocal(proposed,new THREE.Vector3());
        // Refill one array per frame instead of spreading a fresh one every
        // step. The hub's authored box list grew fourfold with the promenade,
        // and this runs for all twenty-one frames on every walking substep.
        const doors=frame._doorScratch??=[];
        doors.length=0;
        for(const box of updateElevatorBoxes(frame.lift))doors.push(box);
        for(const box of frame.lift.staticBoxes)doors.push(box);
        if(frame.staticBoxes)for(const box of frame.staticBoxes)doors.push(box);
        if(frame.doorBoxes)for(const box of frame.doorBoxes)doors.push(box);
        if(frame===this.hub&&this.shopkeepers)for(const merchant of Object.values(this.shopkeepers))for(const box of merchant.collisionBoxes)doors.push(box);
        const result=constrainStationSweep(frame.colliders,doors,start,end,new THREE.Vector3(-.25,-layout.eyeHeight,-.25),new THREE.Vector3(.25,.15,.25));
        frame.toWorld(result.point,result.point);keep(result);
      }
      return closest;
    }
    // All berths participate in swept flight collision; LOD affects only rendering.
    for(const pod of this.pods)keep(pod.constrainStep(previous,proposed,orientation,false,layout));
    const start=this.hub.toLocal(previous,new THREE.Vector3()),end=this.hub.toLocal(proposed,new THREE.Vector3());
    const radius=Math.max(...layout.flightBounds.max.map((v,i)=>Math.max(Math.abs(v-layout.seatEye[i]),Math.abs(layout.flightBounds.min[i]-layout.seatEye[i]))));
    const min=new THREE.Vector3().setScalar(-radius),max=new THREE.Vector3().setScalar(radius);
    for(const tree of [this.spineColliders,this.hub.colliders]){
      const result=constrainStationSweep(tree,[],start,end,min,max);this.hub.toWorld(result.point,result.point);keep(result);
    }
    this.exterior.rings.forEach((ring,i)=>{
      const inverse=ring.quaternion.clone().invert();
      const a=start.clone().sub(ring.position).applyQuaternion(inverse),b=end.clone().sub(ring.position).applyQuaternion(inverse);
      const result=constrainStationSweep(this.ringColliders[i],[],a,b,min,max);
      result.point.applyQuaternion(ring.quaternion).add(ring.position);this.hub.toWorld(result.point,result.point);keep(result);
    });
    return closest;
  }
  interaction(nav){
    if(!this.ready||nav.mode!=='walk'||nav.insideShip||!stationPhysicsAt(this,nav.position))return null;
    const p=this.toLocal(nav.position,new THREE.Vector3()),floor=this.interiorBox.min.y;
    if(Math.abs(p.y-floor-nav.layout.eyeHeight)>1)return null;
    if(this.location==='hangar'&&p.distanceTo(new THREE.Vector3(-12,floor+nav.layout.eyeHeight,20.7))<2.3){
      return this.activeIndex===this.parkedPod?{kind:'cargo',label:'F · CARGO TRANSFER TERMINAL'}:{kind:'unavailable',label:`SHIP PARKED AT BERTH ${this.parkedPod+1}`};
    }
    if(this.location==='hub'){
      for(const [x,shopId,name] of [[-10.7,'weapons','WATCHKEEP ARMORY'],[10.7,'equipment','KESTREL SHIPWORKS']]){
        if(Math.hypot(p.x-x,p.z)<1.75)return {kind:'shop',shopId,label:`F · ${name}`};
      }
      const promenade=promenadeInteraction(p);
      if(promenade)return promenade;
    }
    const lift=this.lift;
    if(Math.abs(p.x)<1.65&&p.z>lift.z+.65&&p.z<lift.z+3.1)return {kind:'travel',label:'F · ELEVATOR DESTINATIONS'};
    if(Math.abs(p.x)<3.4&&p.z>lift.z-3&&p.z<lift.z+.6)return {kind:'door',label:lift.open?'WALK INTO ELEVATOR · F TO CLOSE':'F · CALL ELEVATOR'};
    return null;
  }
  get snapshot(){return {shopkeeper:this.shopkeepers?.weapons.state??null,shopkeepers:Object.fromEntries(Object.entries(this.shopkeepers??{}).map(([id,merchant])=>[id,merchant.state])),exterior:this.exteriorStatus,exteriorDetail:this.exterior.detailLevel??'hero',exteriorError:this.exteriorError,exteriorLodError:this.exteriorLodError,finish:this.finishStatus,finishError:this.finishError,finishMaterials:this.finishMaterials?.stats,pods:this.pods.length,lodBatches:this.lodBatches.length,activePod:this.activeIndex+1,parkedPod:this.parkedPod+1,location:this.location,rings:this.exterior.rings.map(r=>r.rotation.x),elevator:this.lift?.progress};}
}
