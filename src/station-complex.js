import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Station, STATION_MODEL_URL, STATION_LOD_URL, stationQuaternion, defaultStationDirection, STATION_ALTITUDE } from './station.js';
import { RADIUS } from './world.js';
import { createStationFinishMaterials } from './station-finish-materials.js';
import { createStationFinishGraphics } from './station-finish-graphics.js';
import { createStationFinishLighting, prepareStationFinishShadows } from './station-finish-lighting.js';
import { SHIP_LAYOUT } from './boarding.js';
import { buildStationColliders, constrainStationSweep } from './station-collision.js';
import { POD_LAYOUT, RING_SPEED, createExterior, createHub, createElevator, updateElevator, elevatorBoxes, sign } from './station-architecture.js';

/** One asset, twenty independent berths. Positions stay in doubles until rebase(). */
export class StationComplex {
  constructor(scene,options={}){
    this.scene=scene;this.pods=[];this.activeIndex=0;this.parkedPod=0;this.location='hangar';this.ready=false;this.error=null;
    this.direction=defaultStationDirection();this.baseQuaternion=stationQuaternion(this.direction,new THREE.Quaternion());
    this.centre=this.direction.clone().multiplyScalar(RADIUS+STATION_ALTITUDE);
    this.exterior=createExterior();scene.add(this.exterior.group);
    this.lodGroup=new THREE.Group();this.lodGroup.name='Instanced distant berths';scene.add(this.lodGroup);this.lodBatches=[];
    this.hub=createHub();scene.add(this.hub.group);
    this.hub.quaternion=this.baseQuaternion.clone();this.hub.inverseQuaternion=this.baseQuaternion.clone().invert();this.hub.worldPosition=this.centre.clone();this.hub.ready=true;
    for(const name of ['toWorld','toLocal','deckPoint','deckHeightAt','isInsideHangar'])this.hub[name]=Station.prototype[name];
    this.hub.colliders=buildStationColliders(this.hub.group);
    this.hub.lift=createElevator(this.hub.group,14.3);
    this.ringColliders=this.exterior.rings.map(ring=>{
      const x=ring.position.x;ring.position.x=0;
      const tree=buildStationColliders(ring);ring.position.x=x;return tree;
    });
    // Exclude the moving rings from the fixed spine collision tree.
    for(const ring of this.exterior.rings)ring.removeFromParent();
    this.spineColliders=buildStationColliders(this.exterior.group);
    this.exterior.group.add(...this.exterior.rings);
    this.finishStatus='loading';this.finishRig=null;
    this.readyPromise=this.load(options);
  }
  async loadFinish(loader){
    try{
      const [materials,props]=await Promise.all([createStationFinishMaterials(),loader.loadAsync('/models/station-props.glb')]);
      const graphics=createStationFinishGraphics();
      await graphics.readyPromise;
      const rig=createStationFinishLighting();
      this.finishMaterials=materials;this.finishRig=rig;this.finishStatus='ready';
      return {materials,props,graphics};
    }catch(error){this.finishStatus='unavailable';this.finishError=error.message;return null;}
  }
  async load(options){
    try{
      const loader=new GLTFLoader();
      const [gltf,lod,finish]=await Promise.all([options.gltf??loader.loadAsync(STATION_MODEL_URL),options.lod??loader.loadAsync(STATION_LOD_URL).catch(()=>null),(options.finish??!options.gltf)?this.loadFinish(loader):null]);
      if(finish){gltf.scene.add(finish.props.scene,finish.graphics);finish.materials.apply(gltf.scene);if(lod)finish.materials.apply(lod.scene);}else if(this.finishStatus==='loading')this.finishStatus='disabled';
      let colliders;
      for(const spec of POD_LAYOUT){
        const pod=new Station(this.scene,{gltf:{scene:gltf.scene.clone(true),animations:gltf.animations},lodUrl:null,offset:spec.offset,yaw:spec.yaw,lodDistance:180,colliders});
        if(finish)prepareStationFinishShadows(pod.model);
        colliders??=pod.colliders;pod.id=spec.id;
        if(lod)pod.attachLod({scene:lod.scene.clone(true)});
        const number=pod.model.getObjectByName('DeckNumber');if(number)number.visible=false;
        pod.lift=createElevator(pod.group,22.3,pod.interiorBox.min.y);
        pod.services=new THREE.Group();pod.group.add(pod.services);
        sign(pod.services,`BERTH ${String(pod.id).padStart(2,'0')} / AEON`,[0,9,-26],18,2);
        sign(pod.services,'CARGO TRANSFER\nF  /  OPEN TERMINAL',[-12,pod.interiorBox.min.y+1.72,22.69],1.72,1.12);
        sign(pod.services,`BERTH ${String(pod.id).padStart(2,'0')}`,[0,pod.interiorBox.min.y+5.2,22.15],5,.75);
        this.pods.push(pod);
      }
      if(lod){
        lod.scene.updateMatrixWorld(true);
        lod.scene.traverse(mesh=>{
          if(!mesh.isMesh)return;
          let parent=mesh,door=-1;
          while(parent){if(parent.name==='HangarDoor_L')door=0;if(parent.name==='HangarDoor_R')door=1;parent=parent.parent;}
          const instances=new THREE.InstancedMesh(mesh.geometry,mesh.material,this.pods.length);
          instances.name=mesh.name;instances.frustumCulled=false;this.lodGroup.add(instances);
          this.lodBatches.push({instances,matrix:mesh.matrixWorld.clone(),door,closedX:door>=0?this.pods[0].doors[door].position.x:0});
        });
      }
      this.ready=true;return this;
    }catch(error){this.error=error.message;throw error;}
  }
  get active(){return this.pods[this.activeIndex];}
  get frame(){return this.location==='hub'?this.hub:this.active;}
  get worldPosition(){return this.frame?.worldPosition??this.centre;}
  get quaternion(){return this.frame?.quaternion??this.baseQuaternion;}
  get inverseQuaternion(){return this.frame?.inverseQuaternion??this.baseQuaternion.clone().invert();}
  get up(){return this.direction;}
  get interiorBox(){return this.frame?.interiorBox;}
  get padLocal(){return this.active?.padLocal;}
  get padWorldPosition(){return this.active?.padWorldPosition;}
  get padQuaternion(){return this.active?.padQuaternion;}
  get approachWorldPosition(){return this.active?.approachWorldPosition;}
  get openingZ(){return this.active?.openingZ;}
  get model(){return this.active?.model;}
  get doorsOpen(){return this.active?.doorsOpen??0;}
  get lift(){return this.frame?.lift;}
  toWorld(p,target){return this.frame.toWorld(p,target);}
  toLocal(p,target){return this.frame.toLocal(p,target);}
  deckPoint(p,height){return this.frame?.deckPoint(p,height)??null;}
  deckHeightAt(p){return this.frame?.deckHeightAt(p)??null;}
  canDock(...args){return this.location==='hangar'&&Boolean(this.active?.canDock(...args));}
  isInsideHangar(p){return Boolean(this.frame?.isInsideHangar(p));}
  transitParams(...args){this.location='hangar';return this.active.transitParams(...args);}
  openDoors(){this.active?.openDoors();}
  closeDoors(){this.active?.closeDoors();}
  update(position,origin,sun,dt){
    if(this.ready && this.nav?.mode==='flight'){
      this.location='hangar';let nearest=Infinity;
      this.pods.forEach((pod,i)=>{const distance=position.distanceToSquared(pod.worldPosition);if(distance<nearest){nearest=distance;this.activeIndex=i;}});
    }
    for(const pod of this.pods){
      pod.update(position,origin,sun,dt);updateElevator(pod.lift,dt);
      pod.lift.group.visible=pod.services.visible=pod.cameraDistance<230;
      if(pod.lodModel)pod.lodModel.visible=false;
    }
    const matrix=new THREE.Matrix4(),local=new THREE.Matrix4(),unit=new THREE.Vector3(1,1,1);
    for(const batch of this.lodBatches){
      this.pods.forEach((pod,i)=>{
        if(pod.cameraDistance<=pod.lodDistance||pod.cameraDistance>=600000)matrix.makeScale(0,0,0);
        else{
          local.copy(batch.matrix);
          if(batch.door>=0)local.elements[12]+=pod.doors[batch.door].position.x-batch.closedX;
          matrix.compose(pod.offset,pod.yaw,unit).multiply(local);
        }
        batch.instances.setMatrixAt(i,matrix);
      });
      batch.instances.instanceMatrix.needsUpdate=true;
    }
    this.lodGroup.visible=position.distanceTo(this.centre)<600000;
    this.finishRig?.update(this,position);
    updateElevator(this.hub.lift,dt);
    this.exterior.rings.forEach((ring,i)=>ring.rotation.x=(ring.rotation.x+dt*RING_SPEED*(i===0?1:-1))%(Math.PI*2));
    this.hub.group.visible=position.distanceTo(this.centre)<140;
    this.exterior.hubShell.visible=!this.hub.group.visible;
    for(const light of this.hub.lights)light.visible=this.location==='hub'&&position.distanceTo(this.centre)<100;
    this.rebase(origin);
  }
  rebase(origin){
    for(const pod of this.pods){pod.group.position.copy(pod.worldPosition).sub(origin);pod.group.quaternion.copy(pod.quaternion);}
    for(const group of [this.exterior.group,this.hub.group,this.lodGroup]){group.position.copy(this.centre).sub(origin);group.quaternion.copy(this.baseQuaternion);}
  }
  constrainStep(previous,proposed,orientation,walking=false,layout=SHIP_LAYOUT){
    if(!this.ready)return {point:proposed.clone(),hit:false};
    let closest={point:proposed.clone(),hit:false};
    const keep=result=>{if(result.hit&&(!closest.hit||result.point.distanceToSquared(previous)<closest.point.distanceToSquared(previous)))closest=result;};
    if(walking){
      const frame=this.frame,start=frame.toLocal(previous,new THREE.Vector3()),end=frame.toLocal(proposed,new THREE.Vector3());
      const doors=elevatorBoxes(this.lift);
      if(this.location==='hangar')doors.push(...this.active.doorBoxes);
      const result=constrainStationSweep(frame.colliders,doors,start,end,new THREE.Vector3(-.25,-layout.eyeHeight,-.25),new THREE.Vector3(.25,.15,.25));
      frame.toWorld(result.point,result.point);return result;
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
    if(!this.ready||!nav.dockedAtStation||nav.mode!=='walk'||nav.insideShip)return null;
    const p=this.toLocal(nav.position,new THREE.Vector3()),floor=this.interiorBox.min.y;
    if(Math.abs(p.y-floor-nav.layout.eyeHeight)>1)return null;
    if(this.location==='hangar'&&p.distanceTo(new THREE.Vector3(-12,floor+nav.layout.eyeHeight,20.7))<2.3){
      return this.activeIndex===this.parkedPod?{kind:'cargo',label:'F · CARGO TRANSFER TERMINAL'}:{kind:'unavailable',label:`SHIP PARKED AT BERTH ${this.parkedPod+1}`};
    }
    const lift=this.lift;
    if(Math.abs(p.x)<1.65&&p.z>lift.z+.65&&p.z<lift.z+3.1)return {kind:'travel',label:'F · ELEVATOR DESTINATIONS'};
    if(Math.abs(p.x)<3.4&&p.z>lift.z-3&&p.z<lift.z+.6)return {kind:'door',label:lift.open?'WALK INTO ELEVATOR · F TO CLOSE':'F · CALL ELEVATOR'};
    return null;
  }
  get snapshot(){return {finish:this.finishStatus,finishError:this.finishError,finishMaterials:this.finishMaterials?.stats,pods:this.pods.length,lodBatches:this.lodBatches.length,activePod:this.activeIndex+1,parkedPod:this.parkedPod+1,location:this.location,rings:this.exterior.rings.map(r=>r.rotation.x),elevator:this.lift?.progress};}
}
