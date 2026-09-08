import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import kestrelURL from '../../assets/kestrel/kestrel.glb?url';
import {shipWeaponStatus} from './flight-policy.js';
import {occupiesShip} from './ship-occupancy.js';
import {SHIP_LAYOUT} from '../boarding.js';
import {CombatSimulation,interceptPoint,projectileSpan} from './simulation.js';
import {shipWeaponProfile,SHIP_WEAPON_SIZES} from '../ship-weapon-profiles.js';
import {loadShipWeaponKit,attachShipWeapons} from '../ship-weapons.js';
import {createWeaponTarget} from '../effects/weapon-target.js';
import {markerDistance,projectShipMarker} from '../ship-marker-projection.js';
import {DIFFICULTIES,encounterRegion,encounterContract,encounterWaypoint} from './encounters.js';
import './space-combat.css';

/** Session patrols. Shared input owns arming and the existing native dialog router. */
export function createSpaceCombat({scene,nav,camera,effects,mining}){
  const models=new Map(),templates=new Map(),loader=new GLTFLoader();let assetsPromise,weaponKit,assetError='',loading=false,lastPhase='idle',lastDock=false,lastWave=0,awaitingWave=false;
  let selectedDifficulty='standard',selectedRegion=encounterRegion(nav.position);
  const target=createWeaponTarget({nav,mining}),currentOrigin=new THREE.Vector3();
  const group=new THREE.Group();group.name='Patrol contacts';scene.add(group);
  const boltGeometry=new THREE.CylinderGeometry(1,1,1,6);boltGeometry.rotateX(Math.PI/2);
  const voidGeometry=new THREE.SphereGeometry(1,12,8),boltMaterials=new Map();
  for(const type of ['pulse','void'])for(const size of [1,2,3]){
    const profile=shipWeaponProfile(type,size);
    boltMaterials.set(`${type}:${size}`,new THREE.MeshBasicMaterial({color:profile.color,toneMapped:false}));
  }
  const bolts=Array.from({length:128},()=>{const mesh=new THREE.Mesh(boltGeometry,boltMaterials.get('pulse:1'));mesh.visible=false;group.add(mesh);return mesh;});
  const sim=new CombatSimulation({obstruction:(start,direction,range)=>target(start,direction,currentOrigin,range),onShot:shot=>{
    const profile=shot.profile;
    if(shot.weapon==='laser')effects.fire(shot.position,shot.direction,{weapon:'laser',range:shot.remaining,muzzle:false,muzzlePosition:shot.muzzlePosition,size:profile.size,pitch:profile.soundPitch,power:profile.power,speed:profile.speed,color:profile.color});
    else effects.onSound?.({type:'shot',weapon:shot.weapon,sound:shot.weapon,point:shot.position.clone(),size:profile.size,pitch:profile.soundPitch,power:profile.power});
  },onHit:({point,normal,shield,destroyed,entity,weapon,profile})=>{
    effects.impact(point,normal??new THREE.Vector3(0,1,0),(destroyed?9:shield?2:1.5)*(profile?.effectScale??1),{color:shield?0x80d9ff:profile?.color??0xff9a60,kind:weapon});
    if(entity==='player'){hud.classList.remove('combat-hit');void hud.offsetWidth;hud.classList.add('combat-hit');}
    if(destroyed&&entity&&entity!=='player')nav.notify(`${entity.label} destroyed.`);
  }});
  const dialog=document.createElement('dialog');dialog.id='patrol-console';dialog.setAttribute('aria-labelledby','patrol-title');
  dialog.innerHTML=`<button class="station-close" aria-label="Close patrol console">×</button>
    <p class="eyebrow">SECURITY DISPATCH / <span class="patrol-region"></span></p>
    <div class="patrol-difficulties" role="group" aria-label="Encounter difficulty">${Object.values(DIFFICULTIES).map(d=>`<button type="button" data-controller-key="patrol-${d.id}" data-difficulty="${d.id}" aria-pressed="false">${d.label}</button>`).join('')}</div>
    <h2 id="patrol-title"></h2><p class="patrol-brief"></p>
    <dl><dt>CONTACTS</dt><dd class="patrol-roster"></dd><dt>OBJECTIVE</dt><dd class="patrol-goal"></dd><dt>THREAT</dt><dd class="patrol-threat"></dd><dt>SHIP SYSTEMS</dt><dd>Shields recharge after 6 seconds without a hit. Hull repairs at the dock.</dd></dl>
    <button data-controller-key="transport-contracts">Transport contracts · sealed freight</button><p class="patrol-status" role="status"></p><div class="patrol-actions"><button data-controller-key="patrol-accept" data-controller-focus>Accept patrol</button><button data-controller-key="patrol-debrief">File combat report</button><button data-controller-key="patrol-abort">Abandon patrol</button><button data-controller-key="patrol-recover">Recover in orbit</button></div>
    <p class="patrol-log"></p><ol class="patrol-reports" aria-label="Recent combat reports"></ol>
    <small>Local dispatch: visit Aeon, Selene, Pyre, Miasma or the asteroid belt for different sorties. Fly to the amber beacon; surface dispatch requires climbing into orbit. T / RT fires · Next target / Menu → Ship selects targets. Reports reset on reload; no credit or cargo reward.</small>`;
  document.body.append(dialog);
  const button=document.createElement('button');button.id='patrol-console-button';button.textContent='PATROL CONSOLE';button.onclick=()=>open();document.body.append(button);
  const hud=document.createElement('aside');hud.id='combat-hud';hud.hidden=true;hud.setAttribute('aria-label','Ship combat systems');
  hud.innerHTML='<span class="combat-kicker">SHIP INTEGRITY</span><div class="combat-integrity"></div><p class="combat-objective"></p><div class="combat-target"></div><button class="combat-cycle">Next target</button><small class="combat-hint"></small>';
  document.body.append(hud);hud.querySelector('button').onclick=()=>sim.cycle();
  const markers=document.createElement('div');markers.id='combat-markers';markers.setAttribute('aria-hidden','true');document.body.append(markers);
  const markerNodes=Array.from({length:4},()=>{const el=document.createElement('div');el.className='combat-marker';el.innerHTML='<span>◇</span><small></small>';markers.append(el);return el;});
  const statuses={idle:'Available · Ready for dispatch',transit:'Patrol accepted · Fly to the beacon',engage:'Weapons free · Eliminate the hostile flight',complete:'Area clear · File your combat report',debriefed:'Report filed · Patrol complete',failed:'Ship lost · Patrol failed',aborted:'Patrol abandoned'};
  const locked=()=>['transit','engage','complete'].includes(sim.phase);
  const selection=()=>locked()||sim.phase==='failed'?sim.contract:encounterContract(selectedRegion?.id??'aeon',selectedDifficulty);
  function objective(){
    if(sim.phase==='engage')return sim.reinforcementIn>0?`Wave ${sim.wave} clear · Reinforcements in ${Math.ceil(sim.reinforcementIn)}s · Stay within 9 km of the beacon`:`Wave ${sim.wave} / ${sim.contract.waves.length} · Hostiles ${sim.enemies.filter(e=>e.integrity.hull===0).length} / ${sim.contract.total} cleared`;
    return statuses[sim.phase];
  }
  function renderDialog(){
    const contract=selection();
    dialog.querySelector('.patrol-region').textContent=contract.region;
    dialog.querySelector('#patrol-title').textContent=contract.title;
    dialog.querySelector('.patrol-brief').textContent=contract.brief;
    dialog.querySelector('.patrol-roster').textContent=contract.waves.map((w,i)=>`Wave ${i+1}: ${w.map(id=>id==='nomad'?'Nomad 02':'Kestrel').join(' + ')}`).join(' / ');
    dialog.querySelector('.patrol-goal').textContent=`Eliminate ${contract.total} hostile${contract.total===1?'':'s'} · ${contract.waves.length} wave${contract.waves.length===1?'':'s'}${contract.waves.length>1?' · 10s reinforcement warning':''}`;
    dialog.querySelector('.patrol-threat').textContent=contract.difficulty.detail;
    for(const b of dialog.querySelectorAll('[data-difficulty]')){b.disabled=loading||locked()||nav.mode==='destroyed';b.setAttribute('aria-pressed',String(b.dataset.difficulty===contract.difficulty.id));}
    dialog.querySelector('.patrol-status').textContent=assetError|| (loading?'Preparing hostile ship assets…':objective());
    dialog.querySelector('[data-controller-key="patrol-accept"]').disabled=loading||nav.mode==='destroyed'||['transit','engage','complete'].includes(sim.phase);
    dialog.querySelector('[data-controller-key="patrol-debrief"]').disabled=sim.phase!=='complete';
    dialog.querySelector('[data-controller-key="patrol-abort"]').disabled=!['transit','engage'].includes(sim.phase);
    dialog.querySelector('[data-controller-key="patrol-recover"]').hidden=sim.phase!=='failed'||nav.mode!=='destroyed';
    dialog.querySelector('[data-controller-key="patrol-accept"]').disabled ||= !permitted();
    if(!permitted())dialog.querySelector('.patrol-status').textContent=nav.multiplayer?.connected?'Patrol contracts are available in offline flight.':!['nomad','kestrel','atlas'].includes(nav.shipId)?'Choose an armed Nomad, Kestrel or Atlas for security contracts.':!selectedRegion?'No security dispatch near the star. Visit a planet, moon or the asteroid belt.':'Board your ship or visit a station terminal to accept a patrol.';
    dialog.querySelector('.patrol-log').textContent=`Reports filed: ${sim.completed}`+(sim.enemies.length?` · ${locked()?'This':'Previous'} sortie: ${sim.enemies.filter(e=>e.integrity.hull===0).length} / ${sim.contract.total} hostiles cleared`:'');
    const reports=dialog.querySelector('.patrol-reports');reports.replaceChildren();
    for(const r of sim.reports.slice(0,3)){const item=document.createElement('li');item.textContent=`${r.title} · ${r.difficulty} · ${r.region} — ${r.kills} kills / ${r.waves} waves · ${r.seconds}s · Hull ${r.hull} · ${r.hits} hits from ${r.shots} shots`;reports.append(item);}
  }
  const permitted=()=>!nav.multiplayer?.connected&&!nav.openingActive&&['nomad','kestrel','atlas'].includes(nav.shipId)&&Boolean(encounterRegion(nav.position))&&(['flight','landed'].includes(nav.mode)||nav.dockedAtStation||sim.phase==='failed');
  for(const b of dialog.querySelectorAll('[data-difficulty]'))b.onclick=()=>{
    if(loading||locked())return;
    selectedDifficulty=b.dataset.difficulty;selectedRegion=encounterRegion(nav.position);assetError='';
    if(sim.phase==='debriefed')sim.phase='idle';
    renderDialog();
  };
  function open(){
    if(nav.openingActive||document.querySelector('dialog[open]'))return;
    const content=dialog.querySelector('.gameplay-content');if(content)content.dataset.controllerScroll='';
    if(!locked())selectedRegion=encounterRegion(nav.position);
    nav.keys.clear();nav.gamepad.suspend();nav.enabled=false;if(document.pointerLockElement)document.exitPointerLock();renderDialog();dialog.showModal();
  }
  dialog.querySelector('[data-controller-key="transport-contracts"]').onclick=()=>{dialog.addEventListener('close',()=>nav.openTransport?.(),{once:true});dialog.close();};
  dialog.querySelector('.station-close').onclick=()=>dialog.close();
  dialog.addEventListener('close',()=>{nav.keys.clear();nav.gamepad.suspend();nav.enabled=true;nav.canvas.focus();});
  async function prepare(){
    if(!assetsPromise)assetsPromise=Promise.all([loadShipWeaponKit(),...([['nomad',`${import.meta.env.BASE_URL}models/nomad.glb`],['kestrel',kestrelURL]].map(async([id,url])=>{
      const gltf=await loader.loadAsync(url),asset=gltf.scene;
      const mixer=new THREE.AnimationMixer(asset);
      for(const clip of gltf.animations){const action=mixer.clipAction(clip);action.play();action.paused=true;action.time=0;}
      mixer.update(0);
      // Nomad's gear uses the canonical authored pivots, not animation clips.
      if(id==='nomad')for(const spec of SHIP_LAYOUT.gear.legs){
        const leg=asset.getObjectByName(spec.name);if(!leg)throw new Error(`Nomad missing ${spec.name}`);
        leg.position.fromArray(spec.pivot).add(new THREE.Vector3(...spec.retractOffset));leg.rotation.z=spec.retractAngle;
      }
      templates.set(id,asset);
    }))]).then(([kit])=>{if(!kit)throw new Error('Ship weapon kit unavailable');weaponKit=kit;}).catch(error=>{assetsPromise=null;throw error;});
    return assetsPromise;
  }
  dialog.querySelector('[data-controller-key="patrol-accept"]').onclick=async()=>{
    if(!permitted()||loading||['transit','engage','complete'].includes(sim.phase))return;
    loading=true;assetError='';renderDialog();
    try{await prepare();if(!permitted())return;selectedRegion=encounterRegion(nav.position);const contract=encounterContract(selectedRegion.id,selectedDifficulty);nav.onTakeControl?.();sim.accept(encounterWaypoint(nav,selectedRegion),nav.orientation,contract);nav.notify(`${contract.title} accepted · ${contract.difficulty.label}. Follow the amber beacon, brake on arrival, then engage.`);}
    catch(error){assetError=`Patrol unavailable: ${error.message}`;}
    finally{loading=false;renderDialog();}
  };
  dialog.querySelector('[data-controller-key="patrol-debrief"]').onclick=()=>{if(sim.debrief())nav.notify('Combat report filed. Patrol complete.');renderDialog();};
  dialog.querySelector('[data-controller-key="patrol-abort"]').onclick=()=>{sim.abort();renderDialog();};
  function recover(){if(sim.phase!=='failed'||nav.mode!=='destroyed')return false;nav.destruction=null;nav.orbit();sim.recover();nav.enabled=true;if(dialog.open)dialog.close();nav.notify('Replacement ship ready in orbit. Open Patrol console to retry.');return true;}
  dialog.querySelector('[data-controller-key="patrol-recover"]').onclick=recover;
  document.addEventListener('keydown',event=>{
    if(event.code==='Enter'&&!event.repeat&&sim.phase==='failed'&&!document.querySelector('dialog[open]'))recover();
  });
  function marker(el,point,label,{lead=false,waypoint=false,selected=false}={},origin){
    const p=projectShipMarker(origin,camera.quaternion,point,{width:innerWidth,height:innerHeight,fov:camera.getEffectiveFOV()});
    el.hidden=lead&&!p.onScreen;el.style.left=`${p.x}px`;el.style.top=`${p.y}px`;
    el.className=`combat-marker${waypoint?' waypoint':''}${lead?' lead':''}${selected?' selected':''}`;
    el.querySelector('span').textContent=p.onScreen?(lead?'○':selected?'[ ◇ ]':'◇'):'➤';
    el.querySelector('span').style.transform=p.onScreen?'':`rotate(${p.angle}deg)`;
    el.querySelector('small').textContent=lead?'LEAD':`${label} · ${markerDistance(p.distance)}${p.behind?' · BEHIND':''}`;
  }
  function tSnapshot(){const t=sim.target;return t?{label:t.label,shield:t.integrity.shield,hull:t.integrity.hull}:null;}
  function update(dt,origin,{weapon='pulse',suspended=false}={}){
    currentOrigin.copy(origin);
    if(['transit','engage'].includes(sim.phase)&&(nav.multiplayer?.connected||nav.shipId!==sim.shipId||['crashed','destroyed'].includes(nav.mode)))sim.abort();
    sim.setShip(nav.shipId);
    const dock=nav.dockedAtStation&&nav.mode==='landed';if(dock&&!lastDock){sim.repair();nav.notify('Dock service complete · hull and shields restored.');}lastDock=dock;
    const active=!suspended&&nav.enabled&&nav.focused&&!document.hidden&&!nav.travel&&!nav.multiplayer?.connected&&nav.mode==='flight';
    for(const {armament} of models.values()){
      if(!active)armament.stop();
      else armament.update(Math.min(.2,Math.max(0,Number.isFinite(dt)?dt:0)));
    }
    sim.update(dt,{position:nav.position,velocity:nav.velocity,orientation:nav.orientation,active});
    if(sim.phase==='engage'&&sim.reinforcementIn>0&&!awaitingWave)nav.notify('First wave clear. Reinforcements arrive in 10 seconds. Stay near the beacon; let shields recharge.');
    if(sim.phase==='engage'&&sim.wave>lastWave&&sim.wave>1)nav.notify(`Reinforcements arrived · Wave ${sim.wave} / ${sim.contract.waves.length}`);
    awaitingWave=sim.reinforcementIn>0;lastWave=sim.wave;
    if(sim.phase!==lastPhase){
      lastPhase=sim.phase;nav.notify(statuses[sim.phase]);
      if(sim.phase==='failed'&&occupiesShip(nav)){
        nav.cabinFlight=false;nav.insideShip=false;
        nav.mode='destroyed';nav.destruction={position:nav.position.toArray(),normal:nav.normal.toArray(),reason:'Combat damage'};
        nav.travel=null;nav.autoland=false;nav.velocity.set(0,0,0);nav.angularVelocity.set(0,0,0);nav.keys.clear();nav.gamepad.suspend();
        if(document.pointerLockElement)document.exitPointerLock();
      }
      if(dialog.open)renderDialog();
    }
    // A crash, transit, boarding or escape cannot leave an active ambush firing offscreen.
    if(sim.phase==='engage'&&(nav.mode!=='flight'||nav.travel||nav.position.distanceTo(sim.point)>9000)){sim.abort();nav.notify('Patrol abandoned: you left the engagement.');}
    const visibleEnemies=sim.phase==='engage'?sim.living:[];
    const ids=new Set(visibleEnemies.map(e=>e.id));
    for(const [id,{model,armament}] of models)if(!ids.has(id)){armament.dispose();model.removeFromParent();models.delete(id);}
    for(const e of visibleEnemies){
      if(!models.has(e.id)&&templates.has(e.ship)&&weaponKit){
        const model=templates.get(e.ship).clone(true);model.name=e.label;
        try{
          const armament=attachShipWeapons(model,e.ship,weaponKit);
          if(!armament)throw new Error(`${e.ship} has no fitted weapon armament`);
          e.armament=armament;group.add(model);models.set(e.id,{model,armament});
        }catch(error){
          assetError=`Patrol unavailable: ${error.message}`;sim.abort();
          for(const record of models.values()){record.armament.dispose();record.model.removeFromParent();}
          models.clear();nav.notify(assetError);break;
        }
      }
      const model=models.get(e.id)?.model;if(model){model.position.copy(e.position).sub(origin);model.quaternion.copy(e.orientation);}
    }
    group.visible=!nav.multiplayer?.connected;
    bolts.forEach((mesh,i)=>{
      const shot=sim.projectiles[i];mesh.visible=Boolean(shot);
      if(!shot)return;
      const scale=shot.profile.effectScale??1,isVoid=shot.weapon==='void';
      const span=projectileSpan(shot,(isVoid?1.4:8)*scale);
      mesh.visible=span.length>0;
      mesh.position.copy(span.position).sub(origin);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,-1),shot.velocity.clone().normalize());
      mesh.geometry=isVoid?voidGeometry:boltGeometry;
      mesh.scale.set((isVoid?.6:.16)*scale,(isVoid?.6:.16)*scale,span.length/(isVoid?2:1));
      mesh.material=boltMaterials.get(`${isVoid?'void':'pulse'}:${shot.profile.size??1}`)??boltMaterials.get('pulse:1');
    });
    const modal=Boolean(document.querySelector('dialog[open]'));
    button.hidden=!permitted()||modal||!nav.enabled;
    hud.hidden=!nav.enabled||!document.body.classList.contains('player-active')||nav.multiplayer?.connected||!['flight','landed','destroyed'].includes(nav.mode)||modal;
    const p=sim.player;
    nav.combat={phase:sim.phase,player:p,point:sim.point,target:tSnapshot()};
    hud.querySelector('.combat-integrity').innerHTML=`<label>SHIELD <b>${Math.ceil(p.shield)} / ${p.maxShield}</b><meter min="0" max="${p.maxShield}" value="${p.shield}"></meter></label><label>HULL <b>${Math.ceil(p.hull)} / ${p.maxHull}</b><meter min="0" max="${p.maxHull}" value="${p.hull}"></meter></label>`;
    hud.querySelector('.combat-objective').textContent=sim.phase==='failed'?'SHIP LOST · Enter / A to recover':locked()?`${sim.contract.title} · ${sim.contract.difficulty.label}\n${objective()}`:objective();
    const t=sim.target;
    hud.querySelector('.combat-target').textContent=t?`${t.label} / ${t.strategy.toUpperCase()}\nSHIELD ${Math.ceil(t.integrity.shield)} · HULL ${Math.ceil(t.integrity.hull)}`:'NO TARGET';
    hud.querySelector('.combat-cycle').disabled=!sim.living.length;
    hud.querySelector('.combat-hint').textContent=nav.controllerActive?'RT · Fire / Menu · Next hostile':'T · Fire / Menu → Ship · Next hostile';
    markers.hidden=modal||nav.mode!=='flight'||nav.multiplayer?.connected;
    markerNodes.forEach(el=>el.hidden=true);let i=0;
    if(sim.phase==='transit'||sim.reinforcementIn>0)marker(markerNodes[i++],sim.point,sim.contract.title.toUpperCase(),{waypoint:true},origin);
    for(const e of visibleEnemies)marker(markerNodes[i++],e.position,e.ship.toUpperCase(),{selected:e.id===sim.targetId},origin);
    const profile=shipWeaponProfile(weapon,SHIP_WEAPON_SIZES[nav.shipId]??1);
    if(t&&i<4&&Number.isFinite(profile.speed)){const point=interceptPoint(nav.position,t.position,t.velocity.clone().sub(nav.velocity),profile.speed);marker(markerNodes[i],point,'LEAD',{lead:true},origin);}
  }
  return {open,permitted,recover,cycle:()=>sim.cycle(),update,receiveExternalHit(amount,point,direction){if(nav.multiplayer?.connected||!occupiesShip(nav)||!Number.isFinite(amount)||amount<=0)return false;sim.setShip(nav.shipId);sim.hit('player',{damage:amount,direction,weapon:'laser',profile:{effectScale:.6,color:0xffab50}},point);if(sim.player.hull<=0)sim.phase='failed';return true;},fire:(...args)=>{if(shipWeaponStatus(nav)==='WEAPONS READY')sim.fire(...args);},get state(){return {...sim.state,assets:[...templates.keys()],models:models.size,assetError};}};
}
