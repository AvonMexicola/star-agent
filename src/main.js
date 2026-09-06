import { flightDownwash } from './meadow.js';
import * as THREE from 'three';
import { WEAPONS } from './effects/weapons.js';
import { createFlightEffects } from './effects/flight-effects.js';
import './style.css';
import './player-interface.css';
import { OpeningSequence, openingStationOptions } from './opening-sequence.js';
import { createSystemMap, travelPhaseLabel } from './system-map.js';
import { TravelEffects } from './travel-effects.js';
import { LIGHT_SPEED } from './travel-model.js';
import { RADIUS, SUN_DISTANCE, SUN_DIRECTION, terrainHeight, biomeAt, findDestinations } from './world.js';
import { Planet } from './planet.js';
import { Moon } from './moon.js';
import { MiningField, ringSurveyPoint, resourceSurveyPoint } from './mining/field.js';
import { createControllerUI } from './controller-ui.js';
import { bindStationLedger } from './inventory/station-ledger.js';
import { Loadout } from './inventory/loadout.js';
import { createLoadoutBar } from './inventory/loadout-ui.js';
import { createMiningTool } from './mining/tool.js';
import { MOON_RADIUS, MOON_POSITION, MOON_LANDING_DIRECTION, moonRegion, moonResources, RESOURCE_PROVINCES } from './moon-world.js';
import { EnergyEffects } from './effects/energy-effects.js';
import { Atmosphere } from './atmosphere.js';
import { StationComplex } from './station-complex.js';
import { createStationServices } from './station-services.js';
import { SELENE, PYRE, bodySurfacePoint, bodyAltitude } from './celestial.js';
import { Pyre, PYRE_MESH_RANGE } from './pyre.js';
import { PYRE_RADIUS, PYRE_POSITION, PYRE_ATMOSPHERE, PYRE_LIGHTING, PYRE_EPOCH, PYRE_GENERATOR_VERSION, VOLCANOES, LAVA_FIELDS, pyreLandingDirection, fromPyreBody, pyreRegion, pyreResources, pyreHeat } from './pyre-world.js';
import { Navigation } from './navigation.js';
import { Vegetation } from './vegetation.js';
import { CrashEffects, playCrashSound } from './crash-effects.js';
import { FlightAudio } from './audio.js';
import { ReentryHeating } from './reentry.js';
import { createWalkableShip } from './ship-walkable.js';
import { createShipPowerUI } from './ship-power-ui.js';
import { ShipInventory } from './ship-inventory.js';
import { createInventoryUI } from './ship-inventory-ui.js';
import { Fleet, SHIPS } from './fleet.js';
import { createFleetUI } from './fleet-ui.js';
import { createFreighter } from './freighter.js';
import { FREIGHTER_LAYOUT, FreighterSystems } from './freighter-layout.js';
import { SHIP_LAYOUT, shipFloorAt } from './boarding.js';
import { createShipMarker } from './ship-marker.js';
import { createLighting } from './lighting.js';
import { updateStationFinishSun } from './station-finish-lighting.js';
import { weatherShip } from './surface-materials.js';
import { SEED, GENERATOR_VERSION } from './generation.js';

const $=id=>document.getElementById(id);
let toastTimeout;
function notify(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>$('toast').classList.remove('visible'),4500);}
function fatal(message){document.body.classList.add('fatal');$('loading').classList.remove('hidden');$('loading').querySelector('p').textContent='FLIGHT SYSTEM OFFLINE';$('loading').querySelector('span').textContent=message;}

try {
  const introEnabled=new URLSearchParams(location.search).get('intro')!=='0';
  const canvas=$('viewport');
  const renderer=new THREE.WebGLRenderer({canvas,antialias:false,logarithmicDepthBuffer:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));renderer.outputColorSpace=THREE.LinearSRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;
  renderer.info.autoReset=false;
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(52,innerWidth/innerHeight,.08,SUN_DISTANCE*5);
  // Aeon-local scenery lives in one group so it can be hidden when it is sub-pixel from Pyre.
  const aeonGroup=new THREE.Group();aeonGroup.name='Aeon';scene.add(aeonGroup);
  const atmosphere=new Atmosphere(renderer),nav=new Navigation(canvas,notify),planet=new Planet(aeonGroup),vegetation=new Vegetation(aeonGroup),audio=new FlightAudio();
  const shipPowerUI=createShipPowerUI(nav);
  function enterPlayerInterface(){
    if(document.body.classList.contains('player-active'))return;
    document.body.classList.add('player-active');
    for(const element of document.querySelectorAll('.topbar,.mission-panel,.statusbar'))element.inert=true;
  }
  nav.onTakeControl=enterPlayerInterface;
  const station=new StationComplex(scene,introEnabled?openingStationOptions():{});nav.station=station;station.nav=nav;
  const crashEffects=new CrashEffects(scene);
  const stationButton=$('station-destination');
  station.readyPromise.then(()=>{if(station.finishStatus!=='ready'){weatherShip(station.pods[0].model,planet.surfaceTexture);weatherShip(station.hub.group,planet.surfaceTexture);}stationButton.disabled=false;stationButton.querySelector('small').textContent='HANGAR · DOCK & EXPLORE';}).catch(()=>{stationButton.querySelector('small').textContent='STATION UNAVAILABLE';notify('Station unavailable. Planet flight is still available.');});
  const moon=new Moon(aeonGroup);
  const pyre=new Pyre(scene);atmosphere.setBody(1,PYRE_POSITION,PYRE_RADIUS,PYRE_ATMOSPHERE);
  const pyreDirection=new THREE.Vector3(),aeonDirection=new THREE.Vector3();let heat=0;
  const origin=new THREE.Vector3();
  const shipMarker=createShipMarker({nav,camera,entryLocal:new THREE.Vector3(0,shipFloorAt(0,6,true)+SHIP_LAYOUT.eyeHeight,6)});
  const lighting=createLighting(renderer,scene);
  let localInventoryStorage;try{localInventoryStorage=window.localStorage;}catch{}
  const fleet=new Fleet(localInventoryStorage),freighterSystems=new FreighterSystems();
  const shipModels=new Map();
  function modelFor(id){
    if(!shipModels.has(id)){
      const model=id==='atlas'?createFreighter(freighterSystems):createWalkableShip();
      model.visible=false;scene.add(model);weatherShip(model,planet.surfaceTexture);
      model.readyPromise.then(asset=>{if(asset)weatherShip(asset,planet.surfaceTexture);});
      const heating=new ReentryHeating(model);model.userData.reentryHeating=heating;
      model.readyPromise.then(()=>heating.refresh());
      shipModels.set(id,model);
    }
    return shipModels.get(id);
  }
  let ship=modelFor(fleet.active);
  nav.shipId=fleet.active;nav.layout=fleet.active==='atlas'?FREIGHTER_LAYOUT:SHIP_LAYOUT;nav.freighter=fleet.active==='atlas'?freighterSystems:null;
  const opening=introEnabled?new OpeningSequence({scene,nav,station,onGesture:()=>{
    if(!audio.context)audio.toggle().then(enabled=>{$('sound-button').textContent=enabled?'SOUND ON':'SOUND OFF';$('sound-button').setAttribute('aria-pressed',String(enabled));});
  }}):null;
  if(opening)Promise.all([station.readyPromise,ship.readyPromise,opening.character.readyPromise]).then(()=>opening.start()).catch(error=>{
    opening.fail();notify('Opening unavailable. Starting in orbit.');console.warn('Opening fallback:',error);
  });
  const inventory=new ShipInventory(localInventoryStorage,SHIPS[fleet.active].capacity);
  const mining=new MiningField(scene,localInventoryStorage,moon.rings);nav.surfaceObstacles=mining;
  const effects=new EnergyEffects(scene,{capacity:1024,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches});
  const loadout=new Loadout(mining.store);
  const miningTool=createMiningTool({scene,camera,canvas,nav,rock:mining,effects,loadout});
  mining.onExtract=({point,yields,normal})=>effects.collect(point,yields,normal);
  const resetMiningEffects=()=>{effects.miningInput=null;effects.reset();};
  window.addEventListener('blur',resetMiningEffects);
  document.addEventListener('visibilitychange',resetMiningEffects);
  $('mining-reduced-motion').checked=effects.reducedMotion;
  $('mining-reduced-motion').addEventListener('change',()=>{effects.reducedMotion=$('mining-reduced-motion').checked;resetMiningEffects();});
  $('mining-bloom').addEventListener('change',()=>atmosphere.bloom.enabled=$('mining-bloom').checked);
  const inventoryUI=createInventoryUI(nav,()=>ship,inventory,mining.store,{loadout});
  const useQuick=index=>{const result=loadout.useQuick(index);nav.notify(result.message);};
  const loadoutBar=createLoadoutBar({loadout,nav,onSelect:id=>miningTool.select(id),onUse:useQuick,open:()=>inventoryUI.openEquipment()});
  document.addEventListener('keydown',e=>{if(e.repeat||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||document.querySelector('dialog[open]'))return;if(e.code==='KeyK'){e.preventDefault();inventoryUI.openEquipment();}else if(nav.enabled&&nav.focused&&['walk','eva'].includes(nav.mode)&&/^Digit[4-7]$/.test(e.code))useQuick(Number(e.code.slice(5))-4);});
  const flightEffects=createFlightEffects({effects,nav,mining,camera});
  inventoryUI.registerContainer?.({id:'crescent-cache',name:'Crescent field cache',kind:'base',boxes:2,available:()=>nav.mode==='walk'&&!nav.insideShip&&nav.position.distanceTo(mining.fieldCache.position)<4});
  bindStationLedger(inventory,mining.store);
  createStationServices(nav,station,inventory);
  nav.onVoyage=event=>{if(event==='dock')station.parkedPod=station.activeIndex;if(fleet.record(event))notify('Atlas unlocked! Open Fleet (G) while seated at the station to board your freighter.');};
  let selectingShip=false;
  const fleetUI=createFleetUI(nav,fleet,async id=>{
    if(selectingShip)return 'Ship preparation in progress.';
    if(!fleet.allows(id)||!SHIPS[id])return 'This ship is locked.';
    if(nav.mode!=='landed'||!nav.dockedAtStation)return 'Dock at Aeon Orbital before switching ships.';
    if(inventory.mass('ship')>SHIPS[id].capacity)return 'Too much cargo for this ship. Transfer supplies before switching.';
    selectingShip=true;
    try{
      const next=modelFor(id);await next.readyPromise;
      if(nav.mode!=='landed'||!nav.dockedAtStation)return 'Ship selection cancelled: you left the station pad.';
      // Hangar services replace the parked ship at the pad centre, aligned with the bay.
      const layout=id==='atlas'?FREIGHTER_LAYOUT:SHIP_LAYOUT,b=station.interiorBox;
      const centre=b.getCenter(new THREE.Vector3());centre.y=b.min.y;
      const orientation=station.quaternion.clone();
      const bounds=layout.flightBounds;
      if(bounds.max[0]-bounds.min[0]>b.max.x-b.min.x-2||bounds.max[2]-bounds.min[2]>b.max.z-b.min.z-2||bounds.max[1]>b.max.y-b.min.y-1)return 'This hangar cannot accommodate the selected ship.';
      centre.x-=(bounds.min[0]+bounds.max[0])/2;centre.z-=(bounds.min[2]+bounds.max[2])/2;
      ship.visible=false;ship=next;nav.layout=layout;nav.shipId=id;nav.freighter=id==='atlas'?freighterSystems:null;
      nav.shipPosition=station.toWorld(centre,centre);nav.shipOrientation.copy(orientation);nav.orientation.copy(orientation);
      nav.position.copy(nav.fromShipLocal(new THREE.Vector3(...layout.seatEye)));nav.velocity.set(0,0,0);nav.angularVelocity.set(0,0,0);
      nav.doorOpen=false;nav.doorProgress=0;nav.insideShip=true;nav.jumpHeight=0;nav.jumpVelocity=0;
      inventory.capacity.ship=SHIPS[id].capacity;fleet.active=id;fleet.record('selection');
      return `${SHIPS[id].name} ready. Close Fleet, then F to stand and explore.`;
    }finally{selectingShip=false;}
  });
  $('planet-seed').textContent=`Terrestrial · Seed ${SEED.toLocaleString('en-US')}`;
  $('seed-input').value=SEED;
  $('seed-form').addEventListener('submit',event=>{event.preventDefault();const url=new URL(location.href);url.searchParams.set('seed',String($('seed-input').valueAsNumber));location.assign(url);});
  const destinations=findDestinations();
  const resourceRoutes=RESOURCE_PROVINCES.map(p=>({id:`resource-${p.id}`,label:p.name,province:p}));
  const resourceLegend=document.createElement('aside');resourceLegend.id='resource-survey';resourceLegend.hidden=true;resourceLegend.setAttribute('aria-label','Selene resource survey');
  resourceLegend.innerHTML='<strong>SELENE · SURFACE RESOURCES</strong><div><span class="resource-swatch ice">Ice</span><span class="resource-swatch copper">Copper</span><span class="resource-swatch basalt">Basalt</span></div><p></p><small>Menu · Choose a resource survey</small>';document.body.append(resourceLegend);
  let course=null;
  const travelEffects=new TravelEffects();
  const systemMap=createSystemMap(nav,target=>{
    const center=new THREE.Vector3(...target.center);
    const point=nav.position.clone().sub(center).normalize().multiplyScalar(target.arrivalRadius).add(center);
    course={name:target.id,label:target.name,point,direction:point.clone().normalize(),system:true};
    $('course-guidance').hidden=false;
    notify('Target selected. Engage from the map or press J in flight.');
  });
  function setCourse(name){
    if(name==='ring'){course={name,point:ringSurveyPoint(),direction:ringSurveyPoint().normalize()};$('course-guidance').hidden=false;notify('Course set for the Selene ring survey.');return;}
    if(name==='moon'){course={name,point:bodySurfacePoint(new THREE.Vector3(...MOON_LANDING_DIRECTION),SELENE,180),direction:new THREE.Vector3(...MOON_POSITION).normalize()};$('course-guidance').hidden=false;notify('Course set for Selene. Fly to the lunar approach marker.');return;}
    if(name==='pyre'){course={name,point:bodySurfacePoint(new THREE.Vector3(...pyreLandingDirection()),PYRE,60000),direction:new THREE.Vector3(...PYRE_POSITION).normalize()};$('course-guidance').hidden=false;notify('Course set for Pyre. Use the system map drive (M) for the 18 M km crossing.');return;}
    if(name==='station'){
      if(!station.ready)return;
      course={name,point:station.approachWorldPosition.clone(),direction:station.direction.clone()};
      $('course-guidance').hidden=false;notify('Course set to the station approach. Fly to the marker; doors open as you approach.');return;
    }
    const direction=name==='orbit'?nav.normal:new THREE.Vector3(...destinations[name]);
    const altitude=name==='orbit'?RADIUS*1.8:Math.max(0,terrainHeight(...direction))+30;
    course={name,point:direction.clone().multiplyScalar(RADIUS+altitude),direction};
    $('course-guidance').hidden=false;
    notify('Flight course set. Steer toward the bearing; climb above the horizon for long journeys.');
  }
  let introWarmup=2;
  let elapsed=0,last=null,lastHud=0,frames=0,fps=0,frameAccumulator=0,firstReady=false,transiting=false,hidden=false;
  document.addEventListener('visibilitychange',()=>{last=null;});
  let renderScale=1, automaticScale=true, resizePending=false;
  function resize(){const width=Math.floor(innerWidth*renderScale),height=Math.floor(innerHeight*renderScale);renderer.setSize(width,height,false);canvas.style.width='100%';canvas.style.height='100%';camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();const size=renderer.getDrawingBufferSize(new THREE.Vector2());atmosphere.resize(size.x,size.y);}
  window.addEventListener('resize',()=>resizePending=true);resize();
  function capture(){if(transiting||!nav.enabled||opening?.active)return;enterPlayerInterface();nav.capture();}
  canvas.addEventListener('click',capture);$('begin-button').addEventListener('click',capture);
  // Drag fallback also works when browser pointer-lock is unavailable.
  let dragging=false;
  canvas.addEventListener('pointerdown',e=>{if(!nav.locked){dragging=true;canvas.setPointerCapture(e.pointerId);}});
  canvas.addEventListener('pointerup',()=>dragging=false);
  canvas.addEventListener('pointermove',e=>{if(dragging&&!nav.locked)nav.look(-e.movementX*.002,-e.movementY*.002);});
  const help=$('help-dialog');
  function openHelp(){if(!nav.enabled||transiting||opening?.active||inventoryUI.open||fleetUI.open||document.querySelector("#station-cargo-dialog[open],#station-elevator-dialog[open],#station-shop-dialog[open]")||systemMap.open)return;if(document.pointerLockElement)document.exitPointerLock();nav.keys.clear();nav.enabled=false;shipPowerUI.update();help.showModal();}
  function closeHelp(){help.close();nav.enabled=!transiting;}
  $('help-button').addEventListener('click',openHelp);$('close-help').addEventListener('click',closeHelp);help.addEventListener('close',()=>{
    $('quick-transit-menu').open=false;
    nav.enabled=!transiting&&!document.querySelector('dialog[open]');
    if(nav.enabled)canvas.focus({preventScroll:true});
  });
  $('map-button').addEventListener('click',()=>{closeHelp();systemMap.openMap();});
  $('help-fly').addEventListener('click',()=>{closeHelp();capture();});
  $('sound-button').addEventListener('click',async()=>{const enabled=await audio.toggle();$('sound-button').textContent=enabled?'SOUND ON':'SOUND OFF';$('sound-button').setAttribute('aria-pressed',String(enabled));});
  nav.isMapOpen=()=>systemMap.open;
  nav.onControllerMap=()=>systemMap.openMap();
  const photo=()=>{hidden=!hidden;document.body.classList.toggle('photo-mode',hidden);};$('photo-button').addEventListener('click',()=>{closeHelp();photo();});
  document.addEventListener('keydown',e=>{if(opening?.active||e.repeat||inventoryUI.open||fleetUI.open||document.querySelector("#station-cargo-dialog[open],#station-elevator-dialog[open],#station-shop-dialog[open]")||systemMap.open)return;if(e.code==='KeyH'){help.open?closeHelp():openHelp();}if(e.code==='Tab'&&!help.open){e.preventDefault();photo();}if(e.code==='KeyO'&&!help.open)transit('orbit');});
  async function transit(name){
    // Elevator travel closes its dialog before the fade ends, while navigation
    // stays paused. A second transit must wait for that owner to release control.
    if(!nav.enabled||opening?.active||inventoryUI.open||fleetUI.open||document.querySelector("#station-cargo-dialog[open],#station-elevator-dialog[open],#station-shop-dialog[open]")||systemMap.open||transiting||name==='station'&&!station.ready)return;opening?.leave();transiting=true;nav.enabled=false;nav.keys.clear();nav.velocity.set(0,0,0);
    if(document.pointerLockElement)document.exitPointerLock();
    const resourceRoute=resourceRoutes.find(r=>r.id===name);
    const button=document.querySelector(`[data-destination="${name}"]`);$('transit-name').textContent=(resourceRoute?.label??button?.querySelector('strong')?.textContent??'Survey').toUpperCase();$('transit').classList.add('active');
    await new Promise(r=>setTimeout(r,350));
    if(resourceRoute){const point=resourceSurveyPoint(resourceRoute.province.id),direction=point.clone().sub(new THREE.Vector3(...MOON_POSITION)).normalize();nav.transitMoon(180,direction.toArray());const away=point.clone().sub(bodySurfacePoint(new THREE.Vector3(...resourceRoute.province.direction),SELENE,1.35));away.addScaledVector(direction,-away.dot(direction)).normalize();nav.orientToward(nav.position.clone().addScaledVector(away,1000).addScaledVector(direction,-180),direction);}
    else if(name==='ring'){nav.transitMoon();nav.position.copy(ringSurveyPoint()).add(new THREE.Vector3(0,0,42));nav.velocity.set(0,0,0);nav.orientToward(ringSurveyPoint(),new THREE.Vector3(0,1,0));}
    else if(name==='moon')nav.transitMoon();
    else if(name==='pyre'){nav.transitPyre();pyre.terrain.prewarm(pyreLandingDirection(),9);}
    else if(name==='station'){const target=station.transitParams(180,6);nav.transit(target.direction,target.altitude);nav.orientToward(target.lookAt,target.up);}
    else if(name==='orbit')nav.orbit();else nav.transit(destinations[name],name==='mountain'?700:name==='polar'?90:95);
    for(const b of document.querySelectorAll('.destination'))b.classList.toggle('active',b===button);
    // This optional shortcut conceals its teleport while streamed terrain catches up.
    planet.cameraWorld.copy(nav.position);planet.select();
    const started=performance.now();
    while(performance.now()-started<(name==='pyre'?12000:6500)){await new Promise(r=>setTimeout(r,150));if(performance.now()-started>1100 && planet.pending<4 && (name==='moon'||resourceRoute?moon.terrain.maxLevel>=14:name==='pyre'?pyre.ready:name==='orbit'||name==='station'||name==='ring'||planet.maxVisibleLevel>=12))break;}
    $('transit').classList.remove('active');transiting=false;nav.enabled=true;
    notify(name==='pyre'?'Pyre terminator approach. Watch hull temperature on the day side.':resourceRoute?`${resourceRoute.label}. L / Y lands. The marked outcrop shares this region's minerals; the terrain itself cannot be excavated.`:name==='ring'?'Ring survey. Brake to a stop, F leaves the chair; open the hatch and walk outside. G activates suit thrusters.':name==='moon'?'Selene descent. L lands; F leaves the chair. Open the rear hatch and walk down the ramp to explore.':name==='station'?'Station approach. W enters the bay; X brakes. Over the central pad, L docks.':name==='orbit'?'High orbit. Click to fly. W approaches Aeon; Space moves away.':'Arrival complete. Click to fly · L lands · F leaves the pilot chair.');
  }
  $('crash-recover').addEventListener('click',()=>transit('orbit'));
  const ringButton=document.createElement('button');ringButton.type='button';ringButton.className=$('moon-destination')?.className??'destination';ringButton.dataset.destination='ring';ringButton.innerHTML='<span class="destination-icon">⌁</span><span><strong>Selene rings</strong><small>ASTEROID SURVEY · EVA</small></span>';document.querySelector('[data-destination="moon"]').after(ringButton);
  const controllerUI=createControllerUI({nav,openBackpack:()=>inventoryUI.openPack(),toggleTool:()=>miningTool.toggle(),openEquipment:()=>inventoryUI.openEquipment(),cycleEquipment:()=>miningTool.cycle(),cycleQuick:()=>{const r=loadout.selectQuick((loadout.state.quickIndex+1)%4);if(!r.ok)nav.notify(r.message);},useQuick:()=>useQuick(loadout.state.quickIndex),destinations:[...document.querySelectorAll('[data-destination]')].map(button=>({id:button.dataset.destination,label:button.dataset.destination==='moon'?'Selene':button.dataset.destination==='ring'?'Selene rings':button.textContent.trim(),activate:()=>transit(button.dataset.destination),enabled:()=>!button.disabled})).concat(resourceRoutes.map(route=>({id:route.id,label:route.label,activate:()=>transit(route.id)})))});
  nav.onControllerInput=(pad,dt)=>{if(nav.openingActive)return;if(systemMap.open){systemMap.controllerInput(pad.ui);return;}if(pad.pressed.has(14)&&nav.mode!=='walk'&&nav.mode!=='eva'){systemMap.openMap();return;}controllerUI.update(pad,dt);flightEffects.controller(pad);};
  const menuButton=document.createElement('button');menuButton.id='commands-button';menuButton.type='button';menuButton.textContent='MENU';menuButton.title='Command menu · controller Menu';menuButton.addEventListener('click',()=>controllerUI.open());document.querySelector('.top-actions').prepend(menuButton);
  for(const button of document.querySelectorAll('[data-destination]'))button.addEventListener('click',event=>{
    closeHelp();
    if(event.shiftKey)setCourse(button.dataset.destination);else transit(button.dataset.destination);
  });
  function updateHud(time){
    const controller=nav.controllerActive;
    document.body.classList.toggle('piloting',nav.locked||controller);
    $('controller-status').textContent=nav.gamepad.status;
    $('keyboard-hints').hidden=controller;$('controller-hints').hidden=!controller;
    const onFoot=nav.mode==='walk'||nav.mode==='eva',eva=nav.mode==='eva';document.body.classList.toggle('on-foot',onFoot);
    const hints=controller?(onFoot?[['LS','MOVE'],['RS','LOOK'],['RT',loadout.item==='mining-laser-tool'?'MINE':'FIRE'],[eva?'A / B':'A',eva?'RISE / LOWER':'JUMP'],['X','INTERACT'],[eva?'LT':'Y',eva?'BRAKE':'SUIT'],['D-PAD ← / →','CYCLE / TOOL'],['↑ / ↓','QUICK / USE'],['VIEW','BACKPACK'],['MENU','COMMANDS']]:[['LS','MOVE'],['RS','LOOK'],['RT / LT','UP / DOWN'],['Y','LAND / LAUNCH'],['X','INTERACT / EVA'],['MENU','COMMANDS']]):onFoot?[['WASD','MOVE'],[eva?'SPACE / C':'SPACE',eva?'RISE / LOWER':'JUMP'],['T / MOUSE',loadout.item==='mining-laser-tool'?'MINE':'FIRE'],['F','INTERACT'],['I / K','PACK / GEAR'],['M','MAP']]:[['WASD','MOVE'],['SPACE / C','UP / DOWN'],['L','LAND / LAUNCH'],['F','INTERACT / EVA'],['M','MAP']];
    const hintsNode=$(controller?'controller-hints':'keyboard-hints'),hintMode=`${controller}-${nav.mode}-${loadout.item}`;
    if(hintsNode.dataset.mode!==hintMode){hintsNode.innerHTML=hints.map(([key,label])=>`<span><kbd>${key}</kbd> ${label}</span>`).join('');hintsNode.dataset.mode=hintMode;}
    const nearMoon=nav.body.airless,onPyre=nav.body.id==='pyre';document.body.classList.toggle('surveying-moon',nearMoon);
    const resources=nearMoon?moonResources(...nav.normal.toArray()):null;resourceLegend.hidden=!nearMoon||onFoot;
    if(resources)resourceLegend.querySelector('p').textContent=`Below: ${resources.province} · ${resources.dominant.toUpperCase()} RICH`;
    const alt=nav.altitude,speed=nav.cabinFlight?nav.shipSpeed:nav.speed,n=nav.normal,flightEnv=nav.flightEnvironment;
    if(course){
      if(course.system&&nav.travel?.plan.kind==='travel')course.point.copy(nav.travel.plan.end);
      const offset=course.point.clone().sub(nav.position),distance=offset.length();
      const local=offset.clone().applyQuaternion(nav.orientation.clone().invert());
      const bearing=Math.atan2(local.x,-local.z)*180/Math.PI;
      const beyond=!course.system&&course.name!=='orbit'&&course.name!=='moon'&&Math.acos(THREE.MathUtils.clamp(n.dot(course.direction),-1,1))>Math.acos(THREE.MathUtils.clamp(RADIUS/nav.position.length(),0,1));
      const title=course.label||document.querySelector(`[data-destination="${course.name}"] strong`)?.textContent;
      $('course-guidance').textContent=`${title} · ${(distance/1000).toFixed(1)} km · ${Math.abs(bearing).toFixed(0)}° ${bearing<0?'LEFT':'RIGHT'}${beyond?' · BEYOND HORIZON — CLIMB':''}`;
    }
    const travel=nav.travelState;
    $('travel-status').hidden=!travel;
    document.body.classList.toggle('drive-active',Boolean(travel));
    if(travel){
      $('travel-target').textContent=travel.aborting?'DRIVE ABORT':`EN ROUTE / ${travel.targetName.toUpperCase()}`;
      $('travel-phase').textContent=`${travel.phase.toUpperCase()} · ${travel.eta.toFixed(1)}s · X TO ABORT`;
      $('travel-progress').firstElementChild.style.width=`${travel.progress*100}%`;
    }
    $('altitude-reference').textContent=nearMoon?'ABOVE SELENE':onPyre?'ABOVE PYRE':'ABOVE AEON';
    $('altitude').textContent=alt>=1000?(alt/1000).toLocaleString('en-US',{maximumFractionDigits:1}):alt.toFixed(1);$('altitude-unit').textContent=alt>=1000?'km':'m';
    $('velocity').textContent=speed>=1000?(speed/1000).toLocaleString('en-US',{maximumFractionDigits:1}):Math.round(speed).toLocaleString();$('velocity-unit').textContent=speed>=1000?'km/s':'m/s';
    if(travel&&speed>LIGHT_SPEED*.001){$('velocity').textContent=(speed/LIGHT_SPEED).toFixed(3);$('velocity-unit').textContent='c';}
    $('altitude-meter').style.width=`${Math.min(100,Math.log10(alt+1)/7*100)}%`;
    const lat=Math.asin(n.y)*180/Math.PI,lon=Math.atan2(n.x,n.z)*180/Math.PI;
    $('latitude').textContent=`${Math.abs(lat).toFixed(3)}° ${lat>=0?'N':'S'}`;$('longitude').textContent=`${Math.abs(lon).toFixed(3)}° ${lon>=0?'E':'W'}`;
    const mode=nav.mode==='crashed'?'SHIP DESTROYED':onPyre?(nav.mode==='walk'?'PYRE EXPLORATION':nav.mode==='landed'?'LANDED · PYRE':'PYRE FLIGHT'):nav.mode==='eva'?'EVA · SUIT THRUSTERS':nav.cabinFlight?'IN-FLIGHT CABIN':nearMoon?(nav.mode==='walk'?'LUNAR EXPLORATION':nav.mode==='landed'?'LANDED · SELENE':'LUNAR FLIGHT'):nav.dockedAtStation?(nav.mode==='walk'?'STATION EXPLORATION':'DOCKED'):nav.mode==='walk'?'SURFACE EXPLORATION':nav.mode==='landed'?'LANDED':flightEnv.regime==='SPACE'?'SPACE FLIGHT':flightEnv.regime==='TRANSITION'?`TRANSITION · ATMO ${Math.round(flightEnv.atmosphereFraction*100)}%`:'ATMOSPHERIC FLIGHT';
    $('mode-label').textContent=mode;$('biome').textContent=onPyre?`PYRE · ${pyreRegion(n.x,n.y,n.z)}`:nearMoon?`SELENE · ${moonRegion(n.x,n.y,n.z)}`:nav.stationDistance<500?'AEON ORBITAL':alt>70000?'EXOSPHERE':biomeAt(n.x,n.y,n.z);$('fps').textContent=`${fps} FPS`;
    $('state-text').textContent=nav.mode==='crashed'?'CRITICAL IMPACT · FLIGHT SYSTEMS OFFLINE':nav.stationLift?'UNDOCKING':nav.autoland?(nav.stationDistance<500?'DOCKING ASSIST':'LANDING ASSIST'):nav.mode==='walk'||nav.mode==='landed'?nav.interaction:nav.stationDistance<500?(station.doorsOpen<.98?'HANGAR DOORS OPENING':nav.canDock?'L · DOCK ON DECK':'FLY OVER THE CENTRAL PAD'):nav.boost?'BOOST ENGAGED':'FREE FLIGHT';
    $('drive-label').textContent=nav.mode==='eva'?`EVA · ${nav.speed.toFixed(1)} m/s`:!nav.powered?'MAIN POWER OFF':nav.cabinFlight?(nav.flightAssist?'COURSE HOLD':'INERTIAL COAST'):nav.mode==='walk'?'ON FOOT':nav.autoland?'AUTOLAND':nav.flightAssist?`ASSIST ×${nav.speedScale.toFixed(1)}`:'INERTIAL · V TO ASSIST';
    if(travel){$('mode-label').textContent='RELATIVISTIC DRIVE';$('drive-label').textContent='0.9c MAX';$('state-text').textContent=travel.aborting?'ABORT BRAKING':travelPhaseLabel(travel.phase);}
    if(!nav.powered&&nav.mode==='flight')$('state-text').textContent='P · MAIN POWER ON / F · LEAVE SEAT';
    if(controller){$('state-text').textContent=$('state-text').textContent.replace(/\bF ·/g,'X / □ ·').replace(/\bL ·/g,'Y / △ ·').replace('P · MAIN POWER ON','MENU · MAIN POWER');$('drive-label').textContent=$('drive-label').textContent.replace('V TO ASSIST','R3 TO ASSIST');}
    $('terrain-status').textContent=onPyre?`${pyre.terrain.visibleCount} PATCHES · LOD ${pyre.terrain.maxLevel}`:nearMoon?`${moon.terrain.visibleCount} PATCHES · LOD ${moon.terrain.maxLevel}`:`${planet.visibleCount} PATCHES · LOD ${planet.maxVisibleLevel}`;
    const survey=$('pyre-survey');survey.hidden=!onPyre||alt>2000000;
    if(onPyre){const profile=pyreResources(n.x,n.y,n.z);$('pyre-composition').textContent=profile.ids.map((id,i)=>`${id.toUpperCase()} ${Math.round(profile.weights[i]*100)}%`).join(' · ');}
    const heatWarning=$('heat-warning');heatWarning.hidden=heat<.3;heatWarning.classList.toggle('critical',heat>.75);heatWarning.textContent=`HULL TEMP ${Math.round(40+heat*360)} °C · ${heat>.75?'CRITICAL':'RISING'}`;
    lastHud=time;
  }
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();nav.enabled=false;fatal('The graphics context was lost. Reload the page to restart your flight.');});
  let renderedFrames=0;
  function frame(time){
    requestAnimationFrame(frame);const realDt=last===null?0:Math.max(0,(time-last)/1000),dt=nav.travel||opening?.active?realDt:Math.min(realDt,.2);last=time;
    if(document.hidden||opening?.phase==='loading')return;
    if(systemMap.open){nav.update(0);return;}
    elapsed+=dt;
    const steps=nav.travel||opening?.active?1:Math.max(1,Math.ceil(dt/.025));for(let i=0;i<steps;i++)nav.update(dt/steps);
    if(systemMap.open)return;
    opening?.update(firstReady?dt:0);
    shipPowerUI.update();
    // Keep the last scene behind menus while input/controller polling and world
    // updates continue. A resize needs one fresh frame at the new canvas size.
    const drawScene=resizePending||!firstReady||(!systemMap.open&&!document.querySelector('dialog[open]'));
    if(resizePending){resize();resizePending=false;}
    origin.copy(nav.position);camera.position.set(0,0,0);camera.quaternion.copy(nav.orientation);
    if(!opening?.placeCamera(camera,origin)&&camera.fov!==52){camera.fov=52;camera.updateProjectionMatrix();}
    station.update(nav.position,origin,nav.sunDirection,dt);
    travelEffects.update(nav.enabled?dt:0,nav,camera);
    const sunDirection=nav.sunDirection,normal=nav.normal,altitude=nav.altitude;
    document.body.classList.toggle('exploring',altitude<12000||nav.mode!=='flight'||nav.stationDistance<2000);
    const onPyre=nav.body.id==='pyre';
    lighting.update(normal,sunDirection,altitude,nav.body.airless,onPyre?PYRE_LIGHTING:null);
    aeonGroup.visible=nav.position.length()<PYRE_MESH_RANGE;
    shipMarker.update(innerWidth,innerHeight);
    moon.update(nav.position,origin,elapsed,!nav.insideShip,nav.shipPosition);
    mining.update(origin);miningTool.update(dt,origin);inventoryUI.update?.();loadoutBar.update();
    pyre.update(origin,origin);
    // Distant worlds as bright points: Pyre from Aeon and Selene, Aeon from Pyre.
    const pyreDistance=pyre.distance,aeonDistance=nav.position.length();
    pyreDirection.copy(pyre.worldPosition).sub(nav.position).normalize();aeonDirection.copy(nav.position).negate().normalize();
    const pyreFade=THREE.MathUtils.smoothstep(pyreDistance,PYRE_MESH_RANGE*.5,PYRE_MESH_RANGE),aeonFade=THREE.MathUtils.smoothstep(aeonDistance,PYRE_MESH_RANGE*.5,PYRE_MESH_RANGE);
    atmosphere.setPoint(0,pyreDirection,[9.0,6.6,4.4].map(v=>v*pyreFade*Math.min(2.5,Math.sqrt(2e10/pyreDistance))),pyreFade>0?.0016:0);
    atmosphere.setPoint(1,aeonDirection,[5.5,7.0,9.0].map(v=>v*aeonFade*Math.min(2.5,Math.sqrt(2e10/aeonDistance))),aeonFade>0?.0016:0);
    heat+=(pyreHeat(nav.position,sunDirection)-heat)*(1-Math.exp(-dt*.7));
    const inHangar=station.isInsideHangar(nav.position);
    updateStationFinishSun(lighting.sun,station.finishStatus==='ready'&&station.location==='hangar'&&inHangar);
    if(station.finishStatus!=='ready')lighting.sun.intensity=inHangar ? .65 : 3.4;
    if(nav.stationDistance<500)lighting.sun.castShadow=true;
    planet.update(origin,origin,sunDirection,elapsed,Math.max(0,nav.position.length()-RADIUS));vegetation.setExclusion?.(nav.shipPosition);vegetation.update(nav.position,origin,elapsed,nav.mode==='walk'&&!nav.insideShip&&!nav.body.airless&&!nav.dockedAtStation,flightDownwash(nav));
    ship.visible=Boolean(nav.shipPosition)||(nav.mode==='flight'&&(nav.locked||nav.controllerActive));
    if(ship.visible){
      if(nav.shipPosition){ship.position.copy(nav.shipPosition).sub(origin);ship.quaternion.copy(nav.shipOrientation);}
      else{ship.quaternion.copy(nav.orientation);ship.position.set(...nav.layout.seatEye).applyQuaternion(nav.orientation).negate();}
      ship.setDoor(nav.doorOpen);ship.update(dt);
      ship.updateDisplays(dt,nav,inventory,course);
    }
    ship.userData.reentryHeating.update({density:nav.flightEnvironment.density,velocity:nav.cabinFlight?nav.shipVelocity:nav.velocity,active:nav.mode==='flight'||nav.cabinFlight,reset:transiting},dt,camera);
    document.body.classList.toggle('crashed',nav.mode==='crashed');
    $('crash-panel').hidden=nav.mode!=='crashed';
    if(nav.crash)$('crash-impact').textContent=`${nav.crash.impactSpeed.toFixed(1)} m/s into ${nav.crash.surface==="ice"?"polar ice":nav.crash.surface==="water"?"water":"the ground"}`;
    if(crashEffects.update(nav.crash,origin,dt))playCrashSound(audio);
    flightEffects.update(dt,origin,{suspended:transiting||!nav.enabled||!nav.focused||Boolean(document.querySelector('dialog[open]'))});
    audio.update({powered:nav.powered,speed:nav.shipSpeed,altitude,mode:nav.cabinFlight?'flight':nav.mode,boost:!nav.cabinFlight&&nav.boost,airless:nav.body.airless,inHangar,doorMotion:station.doorsOpen>0&&station.doorsOpen<1?1:0},dt);
    renderer.info.reset();
    if(drawScene){atmosphere.render(scene,camera,origin,sunDirection,elapsed,nav.position.distanceTo(new THREE.Vector3(...SUN_DIRECTION).multiplyScalar(SUN_DISTANCE)));travelEffects.render(renderer,camera);}
    if(drawScene)renderedFrames++;frames++;frameAccumulator+=realDt;if(frameAccumulator>=2){fps=Math.round(frames/frameAccumulator);frames=0;frameAccumulator=0;if(automaticScale&&firstReady&&!transiting&&fps<23&&renderScale>.55){renderScale=Math.max(.55,renderScale*.85);resizePending=true;}}
    if(time-lastHud>150)updateHud(time);
    if(opening&&!firstReady&&planet.ready&&introWarmup>0)introWarmup--;
    if(!firstReady&&(opening?opening.phase!=='loading'&&planet.ready&&introWarmup===0:planet.ready&&elapsed>1)){firstReady=true;$('loading').classList.add('hidden');}
    if(planet.error)fatal(planet.error);
  }
  requestAnimationFrame(frame);
  // Explicit read-only diagnostics plus navigational hooks for reproducible browser tests.
  window.starAgent={get state(){return {reentryHeat:ship.userData.reentryHeating.heat,crash:nav.crash?structuredClone(nav.crash):null,renderedFrames,pyre:{...pyre.state,altitude:bodyAltitude(nav.position,PYRE),ready:pyre.ready,epoch:PYRE_EPOCH,generatorVersion:PYRE_GENERATOR_VERSION,resources:nav.body.id==='pyre'?pyreResources(...nav.normal.toArray()):null,region:nav.body.id==='pyre'?pyreRegion(...nav.normal.toArray()):null},heat,terrainDetail:planet.detailStats,loadout:structuredClone(loadout.state),equippedMass:loadout.mass,effects:{...effects.state,...flightEffects.state,beamVisible:effects.beam.mesh.visible,bloom:atmosphere.bloom.enabled},shipMarker:shipMarker.state,fieldCache:mining.fieldCache.position.toArray(),containers:inventoryUI.state,eva:nav.evaState,rings:moon.rings.state,mining:{...mining.state,tool:miningTool.state},fleet:fleet.snapshot,shipId:nav.shipId,powered:nav.powered,cabinFlight:nav.cabinFlight,shipSpeed:nav.shipSpeed,shipVelocity:nav.shipVelocity.toArray(),shipPosition:nav.shipPosition?.toArray(),shipOrientation:nav.shipOrientation.toArray(),lifts:nav.freighter?.snapshot,opening:opening?.state??{phase:'skipped'},camera:{position:origin.toArray(),fov:camera.fov},audio:{created:Boolean(audio.context),enabled:audio.enabled},travel:nav.travelState,travelTarget:nav.travelTarget,mapOpen:systemMap.open,tunnel:travelEffects.state,speedProfile:nav.speedProfile,moon:{resources:moonResources(...nav.position.clone().sub(moon.worldPosition).normalize().toArray()),resourceProvinces:RESOURCE_PROVINCES,effects:moon.effects,position:moon.worldPosition.toArray(),radius:MOON_RADIUS,altitude:bodyAltitude(nav.position,SELENE),patches:moon.terrain.visibleCount,lod:moon.terrain.maxLevel,distance:nav.position.distanceTo(moon.worldPosition)},controller:{id:nav.gamepad.id,connected:nav.gamepad.connected,active:nav.controllerActive,armed:nav.gamepad.armed,status:nav.gamepad.status},body:nav.body.id,seed:SEED,generatorVersion:GENERATOR_VERSION,position:nav.position.toArray(),altitude:nav.altitude,speed:nav.speed,mode:nav.mode,autoland:nav.autoland,flightAssist:nav.flightAssist,flightRegime:nav.flightEnvironment.regime,atmosphereFraction:nav.flightEnvironment.atmosphereFraction,velocity:nav.velocity.toArray(),angularVelocity:nav.angularVelocity.toArray(),groundHeight:nav.groundHeight,biome:nav.body.airless?'SELENE · AIRLESS MOON':biomeAt(...nav.normal.toArray()),sunDistance:nav.position.clone().sub(new THREE.Vector3(...SUN_DIRECTION).multiplyScalar(SUN_DISTANCE)).length(),patches:planet.visibleCount,lod:planet.maxVisibleLevel,pending:planet.pending,vegetation:vegetation.stats,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,ready:firstReady,transiting,fps,shipAsset:ship.userData.assetStatus,shipAssetError:ship.userData.assetError,storageOpen:ship.userData.storageOpen,storageProgress:ship.userData.storageProgress,inventory:inventory.snapshot,mfds:ship.displayState(),doorOpen:nav.doorOpen,doorProgress:nav.doorProgress,insideShip:nav.insideShip,station:{...station.snapshot,ready:station.ready,error:station.error,doorsOpen:station.doorsOpen,distance:nav.stationDistance,local:nav.stationLocal?.toArray(),deckClearance:nav.deckClearance,docked:nav.dockedAtStation,lifting:nav.stationLift,canDock:nav.canDock},shipLocal:nav.toShipLocal()?.toArray(),interaction:nav.interaction,renderScale};},destinations,transit,land:()=>nav.landOrLaunch(),embark:()=>nav.embark(),setRenderScale(value){automaticScale=false;renderScale=THREE.MathUtils.clamp(value,.4,1);resizePending=true;},get openingSequence(){return new URLSearchParams(location.search).has('debug')?opening:undefined;},get navigation(){return import.meta.env.DEV||new URLSearchParams(location.search).has('debug')?nav:undefined;},get pyreSites(){return {landing:pyreLandingDirection(),volcanoes:VOLCANOES.map(v=>({name:v.name,height:v.height,active:v.active,direction:fromPyreBody(...v.direction)})),fields:LAVA_FIELDS.map(f=>({name:f.name,direction:fromPyreBody(...f.direction)}))};}};
}catch(error){console.error(error);fatal(`Could not start WebGL 2. Use a current desktop browser with hardware acceleration enabled. ${error.message}`);}
