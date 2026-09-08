import {Vector3,Quaternion,PointLight,Mesh,BoxGeometry,MeshStandardMaterial} from 'three';
import {createFreighter} from '../freighter.js';
import {createBuildObstacles} from '../build/obstacles.js';
import {recoveryJob,recoveryPose,recoveryEncounter} from './catalog.js';
import {disabledAtlasSystems,wreckParts,wreckRaycast} from './geometry.js';

/** Solo mission director. Transactions own cargo/rewards; the normal combat
 * simulation owns defender damage. No input polling or player teleport here. */
export function createRecoverySystem({scene,nav,trading,combat,settlements}){
  const systems=disabledAtlasSystems(),parts=wreckParts(systems);let wreck=null,clock=0,busy=false,guardBusy=false,error='',lastMission=null,lastFailure=0;
  const pose={position:new Vector3(),quaternion:new Quaternion()},lights=[],lamps=[];
  const mission=()=>!nav.multiplayer?.connected?trading.api.snapshot().account?.recovery?.active:null;
  const canAccept=(j,ship)=>!nav.multiplayer?.connected&&!nav.openingActive&&!['transit','engage','complete'].includes(combat.state.phase)&&!['destroyed','crashed'].includes(nav.mode)&&(!j.guards.length||['nomad','atlas'].includes(ship?.hull));
  const active=()=>{const m=mission();if(m){pose.position.fromArray(m.position);pose.quaternion.fromArray(m.quaternion);}return m;};
  const atWreck=m=>Boolean(wreck?.userData.assetStatus==='ready'&&!nav.travel&&['flight','walk','eva'].includes(nav.mode)&&nav.position.distanceTo(new Vector3(...m.position))<1500);
  function makeWreck(){
    if(wreck)return;wreck=createFreighter(systems);wreck.name='Disabled Atlas · emergency power';scene.add(wreck);wreck.syncFlight({powered:false});
    const material=new MeshStandardMaterial({color:0xa05c21,emissive:0xff9b32,emissiveIntensity:1.2,roughness:.45,metalness:.25});
    for(const z of [-23.5,23.5]){
      const lamp=new Mesh(new BoxGeometry(2.4,.10,.12),material);lamp.position.set(0,8.35,z);wreck.add(lamp);lamps.push(lamp);
      const light=new PointLight(0xffa64d,12,26,2);light.position.set(0,7.8,z);wreck.add(light);lights.push(light);
    }
    wreck.readyPromise.then(model=>{
      if(!model){error='Atlas model unavailable. Recovery cargo will wait for the authored ship to load.';return;}
      // Existing emissive trim and engine materials are made cold; only the
      // two emergency strips illuminate the unpowered cargo bay.
      const copies=new Map();model.traverse(o=>{if(!o.isMesh)return;o.material=(Array.isArray(o.material)?o.material:[o.material]).map(m=>{if(!m.emissive||m.emissive.getHex()===0)return m;if(!copies.has(m)){const copy=m.clone();copy.emissiveIntensity=.02;copies.set(m,copy);}return copies.get(m);});if(o.material.length===1)o.material=o.material[0];});
      systems.applyTransforms();
    });
  }
  async function transact(op,m){
    if(busy)return;busy=true;
    try{const result=await trading.api.command({op,mission:m.id});error='';if(mission()?.id===m.id||op==='recovery-clear')nav.notify(result.message);if(op==='recovery-clear')combat.finishRecoveryEncounter?.(m.id);}
    catch(e){error=e.message;lastFailure=clock;}
    finally{busy=false;}
  }
  const api={nav,get grounded(){return false;},constrainWalker:(_a,b)=>({point:b,hit:false,grounded:false}),
    raycast(a,d,range,envelope){return active()&&a.distanceTo(pose.position)<=range+180?wreckRaycast(a,d,range,pose,parts,envelope):null;},
    context:{available:()=>!nav.multiplayer?.connected,canAccept,pose:j=>{const site=settlements.layouts.find(s=>s.id===j.destination);return site?recoveryPose(j,site):null;},atWreck,defeated:m=>(combat.state.phase==='complete'&&combat.state.contract?.id===m.id)||combat.state.reports.some(r=>r.contractId===m.id),canHandle:id=>Boolean(mission()?.id===id&&mission().cleared)},
    get ships(){const m=active();return m?[{id:`wreck-${m.id}`,owner:`wreck-${m.id}`,hull:'atlas',crates:[],pose,speed:0,open:true,systems}]:[];},
    get beacons(){const m=mission();if(!m)return [];const j=recoveryJob(m.job);return [{id:`wreck-${m.id}`,name:`${j.name} · disabled Atlas`,kind:'Deep-space recovery · open aft bay',summary:`${j.container} · ${j.sbu} SBU required · ${j.crates-1} optional loot · ${j.reward} CR · ${m.cleared?'Recovery authorized':'Defending flight'}`,category:'missions',parent:'star',body:'aeon',center:[...m.position],radius:0},...trading.api.snapshot().loose.filter(c=>c.recovery?.id===m.id).map(c=>({id:`recovery-crate-${c.id}`,name:c.recovery.optional?'Bonus loot · 2 SBU':`${j.container} · REQUIRED · ${c.id}`,kind:c.recovery.optional?'Optional recovery loot':'Required mission container',category:'missions',parent:'star',center:[...c.position],radius:0}))];},
    get state(){const m=active();return {available:!nav.multiplayer?.connected,mission:m?.id??null,position:m?[...m.position]:null,quaternion:m?[...m.quaternion]:null,asset:wreck?.userData.assetStatus??'unloaded',error,busy,guardBusy,alarmIntensity:lights[0]?.intensity??0,ramps:systems.snapshot.ramps,visible:Boolean(wreck?.visible),models:wreck?1:0};},
    update(dt,origin){
      clock+=Math.max(0,dt);const m=active();
      if(lastMission&&m?.id!==lastMission)combat.cancelRecoveryEncounter?.(lastMission);lastMission=m?.id??null;
      if(!m){if(wreck)wreck.visible=false;return;}makeWreck();wreck.position.copy(pose.position).sub(origin);wreck.quaternion.copy(pose.quaternion);wreck.visible=nav.position.distanceTo(pose.position)<5000;
      const pulse=.65+.35*Math.sin(clock*Math.PI*1.2);for(const l of lights)l.intensity=12*pulse;for(const l of lamps)l.material.emissiveIntensity=1.2*pulse;
      if(!nav.enabled||!nav.focused||document.hidden||document.querySelector('dialog[open]')||nav.travel||clock-lastFailure<3)return;
      if(m.phase==='accepted'&&atWreck(m))void transact('recovery-arrive',m);
      if(m.phase==='recover'&&!m.cleared){
        if(api.context.defeated(m)){void transact('recovery-clear',m);return;}
        if(nav.mode==='flight'&&nav.position.distanceTo(pose.position)<1500&&!guardBusy&&!['transit','engage','complete','failed'].includes(combat.state.phase)){
          guardBusy=true;void combat.beginRecoveryEncounter(pose.position,recoveryEncounter(recoveryJob(m.job),m)).catch(e=>{error=e.message;lastFailure=clock;}).finally(()=>{guardBusy=false;});
        }
      }
    },
    dispose(){combat.cancelRecoveryEncounter?.(lastMission);wreck?.removeFromParent();},
  };
  const priorRay=nav.buildingRaycast;nav.buildingRaycast=(...args)=>{const a=priorRay?.(...args),b=api.raycast(...args);return b&&(!a||b.distance<a.distance)?b:a;};
  nav.surfaceObstacles=createBuildObstacles(nav.surfaceObstacles,api);
  nav.recoveryActive=()=>mission()?.id??null;trading.api.recoveryState=()=>api.state;trading.api.recoveryCanAccept=canAccept;
  return api;
}
