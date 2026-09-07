import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {buildStationColliders,constrainStationSweep} from './station-collision.js';
import {DEFENSE_LAYOUT,STATION_DEFENSE_MOUNTS,AEON_STATION_ID} from './station-security-policy.js';

const Z=new THREE.Vector3(0,0,1),RECOIL=.6,RETURN_SECONDS=.42;
const modelUrl='/models/station-defense.glb';
const finiteArray=(a,n)=>Array.isArray(a)&&a.length===n&&a.every(Number.isFinite);

function relativeMatrix(node,root){
  const chain=[];for(let p=node;p&&p!==root;p=p.parent)chain.push(p);
  const matrix=new THREE.Matrix4();for(const p of chain.reverse()){p.updateMatrix();matrix.multiply(p.matrix);}return matrix;
}

/** Shared articulated geometry. The server and browser use the same small
 * collision trees and named DOFs. Only this group's render position is rebased. */
export class StationDefense {
  constructor(scene,station,{gltf=null,render=true,loader=new GLTFLoader()}={}){
    this.station=station;station.defense=this;this.render=render;
    this.group=new THREE.Group();this.group.name='Meridian Bastion batteries';
    if(render)scene.add(this.group);
    this.rigs=[];this.ready=false;this.disposed=false;this.error=null;this.pendingState=null;this.pendingEvents=[];
    this.seen=new Set();this.strikes=0;this.lastStrike=null;this.beams=[];
    this.readyPromise=Promise.all([station.readyPromise,gltf??loader.loadAsync(modelUrl)]).then(([,asset])=>{
      if(this.disposed)return this;
      let meshes=0;
      asset.scene.updateMatrixWorld(true);
      asset.scene.traverse(mesh=>{
        if(!mesh.isMesh)return;
        const position=mesh.geometry?.attributes.position,index=mesh.geometry?.index,count=index?.count??position?.count;
        if(!position||position.itemSize!==3||position.count<3||!count||count%3||
          !mesh.matrixWorld.elements.every(Number.isFinite)||Math.abs(mesh.matrixWorld.determinant())<1e-12)throw new Error('Bastion contains invalid body geometry.');
        for(let i=0;i<position.count;i++)if(![position.getX(i),position.getY(i),position.getZ(i)].every(Number.isFinite))throw new Error('Bastion contains nonfinite body vertices.');
        if(index)for(let i=0;i<count;i++)if(!Number.isInteger(index.getX(i))||index.getX(i)<0||index.getX(i)>=position.count)throw new Error('Bastion contains invalid triangle indices.');
        meshes++;
      });
      if(!meshes)throw new Error('Bastion body geometry is empty.');
      const trees=new Map();
      for(const mount of STATION_DEFENSE_MOUNTS){
        const root=asset.scene.clone(true);root.name=mount.id;root.position.fromArray(mount.position);root.quaternion.fromArray(mount.rotation);
        const yaw=root.getObjectByName(DEFENSE_LAYOUT.yawNode),pitch=root.getObjectByName(DEFENSE_LAYOUT.pitchNode);
        const muzzles=DEFENSE_LAYOUT.muzzles.map(spec=>root.getObjectByName(spec.node));
        const recoil=['Port','Starboard'].map(side=>root.getObjectByName(`Bastion_Recoil_${side}`));
        if(!yaw||!pitch||muzzles.some(p=>!p)||recoil.some(p=>!p)||pitch.parent!==yaw||muzzles.some(p=>p.parent!==pitch))throw new Error('Bastion articulation contract is incomplete.');
        if(pitch.position.distanceTo(new THREE.Vector3(...DEFENSE_LAYOUT.pitchPivot))>1e-5)throw new Error('Bastion pitch pivot differs from the shot authority.');
        muzzles.forEach((node,i)=>{if(node.position.distanceTo(new THREE.Vector3(...DEFENSE_LAYOUT.muzzles[i].position))>1e-5)throw new Error('Bastion muzzle differs from the shot authority.');});
        this.group.add(root);
        const parts=[];
        root.traverse(mesh=>{
          if(!mesh.isMesh)return;
          mesh.castShadow=true;mesh.receiveShadow=true;
          let tree=trees.get(mesh.geometry);
          if(!tree){const proxy=new THREE.Mesh(mesh.geometry);tree=buildStationColliders(proxy);trees.set(mesh.geometry,tree);}
          parts.push({mesh,tree,matrix:new THREE.Matrix4(),inverse:new THREE.Matrix4()});
        });
        const rig={mount,root,yaw,pitch,muzzles,recoil,parts,kick:[0,0]};this.rigs.push(rig);this.refresh(rig);
      }
      this.ready=true;
      if(this.pendingState)this.setState(this.pendingState);
      for(const event of this.pendingEvents)this.strike(event);this.pendingEvents.length=0;
      return this;
    }).catch(error=>{this.ready=false;this.rigs.length=0;this.group.clear();this.error=error.message;throw error;});
  }
  refresh(rig){for(const part of rig.parts){part.matrix.copy(relativeMatrix(part.mesh,this.group));part.inverse.copy(part.matrix).invert();}}
  setState(states){
    if(this.disposed)return;
    if(!Array.isArray(states))return;if(!this.ready){this.pendingState=states;return;}
    for(const state of states){
      const rig=this.rigs.find(r=>r.mount.id===state.mountId);
      if(!rig||!Number.isFinite(state.yaw)||!Number.isFinite(state.pitch)||state.pitch<-.2||state.pitch>Math.PI/2||!finiteArray(state.recoil,2))continue;
      rig.yaw.rotation.set(0,state.yaw,0);rig.pitch.rotation.set(state.pitch,0,0);
      state.recoil.forEach((value,i)=>{rig.kick[i]=THREE.MathUtils.clamp(value,0,RECOIL);rig.recoil[i].position.z=rig.kick[i];});this.refresh(rig);
    }
  }
  strike(event){
    if(this.disposed||event?.stationId!==AEON_STATION_ID||typeof event.id!=='string'||this.seen.has(event.id)||
      !finiteArray(event.origin,3)||!finiteArray(event.direction,3)||!finiteArray(event.target,3))return false;
    if(!this.ready){if(this.pendingEvents.length<16)this.pendingEvents.push(event);return false;}
    const rig=this.rigs.find(r=>r.mount.id===event.mountId),barrel=event.barrel;
    if(!rig||![0,1].includes(barrel)||!Number.isFinite(event.yaw)||!Number.isFinite(event.pitch)||event.pitch<-.2||event.pitch>Math.PI/2)return false;
    rig.yaw.rotation.set(0,event.yaw,0);rig.pitch.rotation.set(event.pitch,0,0);
    // The instant shot starts at the rest muzzle. The afterimage remains at that
    // historical shot pose while the real barrel recoils and returns.
    rig.kick[barrel]=0;rig.recoil[barrel].position.z=0;this.refresh(rig);
    const origin=this.muzzle(rig,barrel);
    if(origin.distanceTo(new THREE.Vector3(...event.origin))>.002)return false;
    this.seen.add(event.id);if(this.seen.size>128)this.seen.delete(this.seen.values().next().value);
    this.strikes++;this.lastStrike={...event,origin:origin.toArray()};
    if(this.render)this.addBeam(origin,new THREE.Vector3(...event.target));
    rig.kick[barrel]=RECOIL;rig.recoil[barrel].position.z=RECOIL;this.refresh(rig);return true;
  }
  muzzle(rig,barrel){
    const point=new THREE.Vector3(0,0,rig.kick[barrel]).applyMatrix4(relativeMatrix(rig.muzzles[barrel],this.group));
    return point.applyQuaternion(this.station.baseQuaternion).add(this.station.centre);
  }
  addBeam(start,end){
    if(this.beams.length>=8)this.removeBeam(this.beams[0]);
    const mesh=new THREE.Group(),geometry=new THREE.CylinderGeometry(1,1,1,8,1,true);
    geometry.rotateX(Math.PI/2);geometry.translate(0,0,.5);
    for(const [radius,color,opacity] of [[.7,0x60ffe0,.45],[.16,0xffffff,.95]]){
      const material=new THREE.MeshBasicMaterial({color,transparent:true,opacity,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false});
      const layer=new THREE.Mesh(geometry,material);layer.scale.set(radius,radius,1);mesh.add(layer);
    }
    // Standard Three materials include the scene's logarithmic-depth chunks.
    mesh.quaternion.setFromUnitVectors(Z,end.clone().sub(start).normalize());mesh.scale.z=start.distanceTo(end);
    this.group.parent?.add(mesh);this.beams.push({mesh,start:start.clone(),age:0,geometry});
  }
  removeBeam(beam){beam.mesh.removeFromParent();beam.geometry.dispose();for(const layer of beam.mesh.children)layer.material.dispose();this.beams.splice(this.beams.indexOf(beam),1);}
  update(dt,origin=null){
    if(!this.ready)return;
    const step=Number.isFinite(dt)?Math.max(0,Math.min(.25,dt)):0;
    for(const rig of this.rigs){
      let changed=false;
      for(let i=0;i<2;i++)if(rig.kick[i]>0){rig.kick[i]=Math.max(0,rig.kick[i]-step*RECOIL/RETURN_SECONDS);rig.recoil[i].position.z=rig.kick[i];changed=true;}
      if(changed)this.refresh(rig);
    }
    if(origin){
      this.group.position.copy(this.station.centre).sub(origin);this.group.quaternion.copy(this.station.baseQuaternion);
      this.group.visible=origin.distanceToSquared(this.station.centre)<25000**2;
      for(const beam of [...this.beams]){
        beam.age+=step;if(beam.age>=.2){this.removeBeam(beam);continue;}
        beam.mesh.position.copy(beam.start).sub(origin);beam.mesh.children.forEach((layer,i)=>{layer.material.opacity=(i?.95:.45)*(1-beam.age/.2);});
      }
    }
  }
  /** Extents are in world axes about the moving eye/ray origin. Each articulated
   * mesh has a local tree and local transform, independent of render rebasing. */
  sweep(previous,proposed,worldMin,worldMax){
    let closest={point:proposed.clone(),hit:false};if(!this.ready)return closest;
    const stationInverse=this.station.baseQuaternion.clone().invert();
    const a=previous.clone().sub(this.station.centre).applyQuaternion(stationInverse),b=proposed.clone().sub(this.station.centre).applyQuaternion(stationInverse);
    const extent=Math.max(worldMin.length(),worldMax.length()),line=new THREE.Line3(a,b),near=new THREE.Vector3();
    for(const rig of this.rigs){
      line.closestPointToPoint(rig.root.position,true,near);if(near.distanceToSquared(rig.root.position)>(50+extent)**2)continue;
      for(const part of rig.parts){
        const start=a.clone().applyMatrix4(part.inverse),end=b.clone().applyMatrix4(part.inverse),bounds=new THREE.Box3();
        const rotation=new THREE.Matrix3().setFromMatrix4(part.inverse);
        for(let i=0;i<8;i++){
          const corner=new THREE.Vector3(...[0,1,2].map(axis=>(i&(1<<axis)?worldMax:worldMin).getComponent(axis)));
          bounds.expandByPoint(corner.applyQuaternion(stationInverse).applyMatrix3(rotation));
        }
        const hit=constrainStationSweep(part.tree,[],start,end,bounds.min,bounds.max);
        if(hit.hit){
          hit.point.applyMatrix4(part.matrix).applyQuaternion(this.station.baseQuaternion).add(this.station.centre);
          if(!closest.hit||hit.point.distanceToSquared(previous)<closest.point.distanceToSquared(previous))closest=hit;
        }
      }
    }
    return closest;
  }
  constrainStep(previous,proposed,orientation,walking,layout){
    const shape=walking?{min:[-.25,-layout.eyeHeight,-.25],max:[.25,.2,.25]}:{min:layout.flightBounds.min.map((n,i)=>n-layout.seatEye[i]),max:layout.flightBounds.max.map((n,i)=>n-layout.seatEye[i])};
    const bounds=new THREE.Box3();for(let i=0;i<8;i++)bounds.expandByPoint(new THREE.Vector3(...[0,1,2].map(axis=>shape[i&(1<<axis)?'max':'min'][axis])).applyQuaternion(orientation));
    return this.sweep(previous,proposed,bounds.min,bounds.max);
  }
  raycast(origin,direction,range){
    const min=new THREE.Vector3(-.004,-.004,-.004),hit=this.sweep(origin,origin.clone().addScaledVector(direction,range),min,min.clone().negate());
    return hit.hit?origin.distanceTo(hit.point):null;
  }
  resetSession(){
    this.pendingState=null;this.pendingEvents.length=0;this.seen.clear();this.strikes=0;this.lastStrike=null;
    for(const beam of [...this.beams])this.removeBeam(beam);
    if(this.ready)this.setState(this.rigs.map(rig=>({mountId:rig.mount.id,yaw:0,pitch:0,recoil:[0,0]})));
  }
  dispose(){
    this.resetSession();this.disposed=true;this.ready=false;this.group.removeFromParent();this.group.clear();this.rigs.length=0;
    if(this.station.defense===this)this.station.defense=null;
  }
  get snapshot(){return this.rigs.map(rig=>({mountId:rig.mount.id,yaw:rig.yaw.rotation.y,pitch:rig.pitch.rotation.x,recoil:[...rig.kick]}));}
  get state(){return {ready:this.ready,error:this.error,strikes:this.strikes,mounts:this.snapshot,lastStrike:this.lastStrike};}
}
