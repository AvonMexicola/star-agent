import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {SENTRY_LAYOUT as L} from './layout.js';
import {RoverCuttingBeam} from '../rover-cutting-beam.js';
import {createRoverDisplayFaces} from '../rover-display.js';

let asset;
export function loadSentryAsset(){return asset??=new GLTFLoader().loadAsync('/models/burrow-sentry.glb').then(g=>g.scene);}
export function createSentryRenderer(scene){
  const instances=new Map(),pulses=[],v=x=>new THREE.Vector3(...x),up=new THREE.Vector3(0,1,0);
  let clock=0;
  function displays(model){
    const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;
    const context=canvas.getContext('2d'),texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.generateMipmaps=false;texture.minFilter=THREE.LinearFilter;
    const material=new THREE.MeshBasicMaterial({map:texture,toneMapped:false}),faces=createRoverDisplayFaces(model,material);
    const anchor=model.getObjectByName('GunnerDisplay');
    if(anchor){const geometry=new THREE.PlaneGeometry(.70,.36);const uv=geometry.attributes.uv;for(let i=0;i<uv.count;i++)uv.setXY(i,uv.getX(i)*.625,.547+uv.getY(i)*.453);const mesh=new THREE.Mesh(geometry,material);mesh.position.z=.023;anchor.add(mesh);faces.push(mesh);}
    let last='';
    return {update(s){
      const label=JSON.stringify([Math.round(s.charge*100),s.health,s.seats.gunner.id,s.seats.pilot.id,Math.round(s.speed*10),s.armed,s.shots]);if(label===last)return;last=label;
      context.fillStyle='#09181c';context.fillRect(0,0,1024,512);
      const panel=(x,y,w,h,title,lines)=>{
        context.fillStyle='#517880';context.beginPath();context.roundRect(x+8,y+8,30,h-16,12);context.fill();
        context.fillStyle='#b6efd1';context.beginPath();context.roundRect(x+46,y+8,w-56,28,13);context.fill();
        context.fillStyle='#09181c';context.font='600 17px sans-serif';context.fillText(title,x+57,y+29);
        lines.forEach((line,i)=>{context.fillStyle=i?'#b6efd1':'#d8dfd8';context.font=(i?'18px':'26px')+' sans-serif';context.fillText(line,x+56,y+85+i*36);});
      };
      panel(0,0,640,232,'BURROW SENTRY',['S-04 · '+(s.seats.gunner.id?'GUNNER CONTROL':'PILOT CONTROL'),`Charge ${Math.round(s.charge*100)}% · ${Math.abs(s.speed).toFixed(1)} m/s`,s.armed?'RT / T  FIRE · X / F EXIT':'RELEASE CONTROLS']);
      panel(656,0,304,256,'LASER ARRAY',[s.destroyed?'DISABLED':Math.round(s.charge*100)+'% CHARGE',`Hull ${s.health} / ${L.hull}`,`${s.shots} bursts fired`]);
      panel(0,256,304,256,'CREW',['PILOT '+(s.seats.pilot.id?'SEATED':'EMPTY'),'GUNNER '+(s.seats.gunner.id?'SEATED':'EMPTY'),'View / I  Backpack']);
      panel(320,256,192,240,'DRIVE',[s.speed<-.05?'REVERSE':s.speed>.05?'FORWARD':'PARKED','LS / WASD']);
      panel(528,256,192,240,'TURRET',['RS AIM','RT FIRE']);texture.needsUpdate=true;
    },dispose(){for(const m of faces)m.geometry.dispose();material.dispose();texture.dispose();}};
  }
  async function instance(id){
    let entry=instances.get(id);if(entry)return entry;
    entry={id,object:new THREE.Group(),model:null,error:null,display:null,materials:new Set(),destroyed:false};entry.object.name='Burrow Sentry '+id;scene.add(entry.object);instances.set(id,entry);
    try{
      entry.model=(await loadSentryAsset()).clone(true);if(!instances.has(id))return entry;
      for(const name of ['SentryYaw','SentryPitch','SentryMuzzle_Port','SentryMuzzle_Starboard','SentrySight','GunnerDoor','CabinDoor'])if(!entry.model.getObjectByName(name))throw new Error('Missing Sentry mechanism '+name);
      const materials=new Map();entry.object.add(entry.model);entry.model.traverse(o=>{if(o.isMesh){o.receiveShadow=true;o.castShadow=o.material?.transparent!==true;const clone=m=>{if(!materials.has(m)){const copy=m.clone();materials.set(m,copy);entry.materials.add(copy);}return materials.get(m);};o.material=Array.isArray(o.material)?o.material.map(clone):clone(o.material);}});entry.display=displays(entry.model);
    }catch(error){entry.error=error.message;}
    return entry;
  }
  const api={instances,ready:loadSentryAsset,
    fire(event){
      const beam=new RoverCuttingBeam(scene);pulses.push({beam,start:v(event.start),end:v(event.end),left:.13,rendered:false,hit:Boolean(event.targetId)});
      while(pulses.length>20){const old=pulses.shift();old.beam.dispose();}
    },
    update(dt,origin,snapshots){
      clock+=dt;const keep=new Set(snapshots.map(s=>s.id));
      for(const [id,e]of instances)if(!keep.has(id)){e.display?.dispose();for(const m of e.materials)m.dispose();e.object.removeFromParent();instances.delete(id);}
      for(const s of snapshots){
        if(!instances.has(s.id)){void instance(s.id);continue;}
        const e=instances.get(s.id);e.object.position.fromArray(s.position).sub(origin);e.object.quaternion.fromArray(s.quaternion);
        const m=e.model;if(!m)continue;
        if(s.destroyed&&!e.destroyed){e.destroyed=true;for(const material of e.materials){material.color?.multiplyScalar(.24);material.emissive?.set(0);}}
        m.getObjectByName('CabinDoor').rotation.y=s.seats.pilot.door*1.65;m.getObjectByName('GunnerDoor').rotation.y=-s.seats.gunner.door*1.6;
        m.getObjectByName('SentryYaw').rotation.y=s.yaw;m.getObjectByName('SentryPitch').rotation.x=s.pitch;
        for(const w of L.wheels){const state=s.wheels.find(p=>p.id===w.id);if(!state)continue;const suspension=m.getObjectByName('Suspension_'+w.id);suspension.position.y=w.position[1]+state.suspension;m.getObjectByName(w.steer??'Axle_'+w.id).rotation.y=state.steer;m.getObjectByName(w.node).rotation.x=state.spin;}
        for(const link of L.links){const index=L.wheels.findIndex(w=>w.id===link.wheel),w=s.wheels[index];if(!w)continue;const end=v(link.wheelOffset).applyAxisAngle(up,w.steer).add(v(L.wheels[index].position));end.y+=w.suspension;const delta=end.sub(v(link.anchor)),node=m.getObjectByName(link.node);node.quaternion.setFromUnitVectors(up,delta.clone().normalize());node.scale.y=delta.length()/node.userData.restLength;}
        e.display.update(s);e.object.updateMatrixWorld(true);
      }
      // A newly confirmed pulse must reach the renderer once, even when the
      // current slow frame took longer than its visual lifetime.
      for(let i=pulses.length-1;i>=0;i--){const p=pulses[i];if(p.rendered)p.left-=dt;else p.rendered=true;if(p.left<=0){p.beam.dispose();pulses.splice(i,1);}else p.beam.set(p.start,p.end,origin,clock,{hit:p.hit,reducedMotion:false});}
    },
    beamState(){return pulses.map(p=>({visible:p.beam.mesh.visible,start:p.start.toArray(),end:p.end.toArray(),remaining:p.left}));},
    state(){return [...instances.values()].map(e=>({id:e.id,ready:Boolean(e.model),error:e.error}));},
    dispose(){for(const e of instances.values()){e.display?.dispose();for(const m of e.materials)m.dispose();e.object.removeFromParent();}instances.clear();for(const p of pulses)p.beam.dispose();pulses.length=0;},
  };return api;
}
