import { rockTextureState } from './rock-material.js';
import { Miasma } from './miasma.js';
import { MIASMA_POSITION, MIASMA_RADIUS, MIASMA_ATMOSPHERE, MIASMA_LIGHTING, MIASMA_ARRIVAL_ALTITUDE, MIASMA_SITES, miasmaSurface, miasmaArrivalDirection } from './miasma-world.js';
import { gearPrompt } from './gear-flight.js';
import { RenderResolution, fullscreenViewport } from './render-resolution.js';
import { createGraphicsSettings } from './graphics-settings.js';
import { createUtilityLights, installLandingGear } from './ship-utilities.js';
import { StartupPreload, blockStartupInput } from './startup-preload.js';
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
import { RADIUS, SUN_RADIUS, SUN_DISTANCE, SUN_DIRECTION, terrainHeight, biomeAt, findDestinations } from './world.js';
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
import { SELENE, PYRE, MIASMA, bodySurfacePoint, bodyAltitude } from './celestial.js';
import { Pyre, PYRE_MESH_RANGE } from './pyre.js';
import { PYRE_RADIUS, PYRE_POSITION, PYRE_ARRIVAL_ALTITUDE, pyreArrivalDirection, PYRE_ATMOSPHERE, PYRE_LIGHTING, PYRE_EPOCH, PYRE_GENERATOR_VERSION, VOLCANOES, LAVA_FIELDS, pyreLandingDirection, fromPyreBody, pyreRegion, pyreResources, pyreHeat } from './pyre-world.js';
import { Sun } from './sun.js';
import { SUN_POSITION, SUN_STANDOFF } from './stellar-world.js';
import { STELLAR_THERMAL, stellarExposure } from './stellar-thermal.js';
import { StellarDestruction, playStellarDestruction } from './stellar-destruction.js';
import { Navigation } from './navigation.js';
import { Vegetation } from './vegetation.js';
import { CrashEffects, playCrashSound } from './crash-effects.js';
import { FlightAudio } from './audio.js';
import { ReentryHeating } from './reentry.js';
import { ShipCamera, groundRadiusAt, isShipCameraKey, playerUp, clipShipCamera } from './ship-camera.js';
import { Character } from './character.js';
import { createWalkableShip } from './ship-walkable.js';
import { createShipPowerUI } from './ship-power-ui.js';
import { ShipInventory } from './ship-inventory.js';
import { createInventoryUI } from './ship-inventory-ui.js';
import { Fleet, SHIPS } from './fleet.js';
import { createFleetUI } from './fleet-ui.js';
import { createFreighter } from './freighter.js';
import { FREIGHTER_LAYOUT, FreighterSystems } from './freighter-layout.js';
import { SHIP_LAYOUT, shipFloorAt } from './boarding.js';
import { KESTREL_LAYOUT, KestrelAccess } from './kestrel-access.js';
import { createKestrel } from './kestrel.js';
import kestrelURL from '../assets/kestrel/kestrel.glb?url';
import { testFlightStorage } from './test-flight.js';
import { MERIDIAN } from './ship-manufacturers.js';
import { createShipMarker } from './ship-marker.js';
import { createLighting } from './lighting.js';
import { updateStationFinishSun } from './station-finish-lighting.js';
import { weatherShip } from './surface-materials.js';
import { createNomadCabinControls } from './nomad-cabin-controls.js';
import { SEED, GENERATOR_VERSION } from './generation.js';
import { MultiplayerClient } from './multiplayer/client.js';
import { createMultiplayerUI } from './multiplayer/ui.js';
import { RemotePlayers, applySuitColor } from './multiplayer/remote-players.js';
import { SUIT_COLORS, WORLD_SEED } from './multiplayer/protocol.js';

const $=id=>document.getElementById(id);
let toastTimeout;
function notify(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>$('toast').classList.remove('visible'),4500);}
function fatal(message){document.body.classList.add('fatal');$('loading').classList.remove('hidden');$('loading').querySelector('p').textContent='FLIGHT SYSTEM OFFLINE';$('loading').querySelector('span').textContent=message;}

try {
  const multiplayerEntry=import.meta.env.VITE_MULTIPLAYER_ENTRY==='1';
  const testFlight=new URLSearchParams(location.search).get('ship')==='kestrel';
  const introEnabled=!testFlight&&new URLSearchParams(location.search).get('intro')!=='0';
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
  const cabinControls=createNomadCabinControls(nav);
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
  const sun=new Sun(scene),destructionEffects=new StellarDestruction(scene);
  const pyre=new Pyre(scene);atmosphere.setBody(1,PYRE_POSITION,PYRE_RADIUS,PYRE_ATMOSPHERE);
  const miasma=new Miasma(scene);atmosphere.setBody(2,MIASMA_POSITION,MIASMA_RADIUS,MIASMA_ATMOSPHERE);
  const pyreDirection=new THREE.Vector3(),aeonDirection=new THREE.Vector3();let heat=0;
  const origin=new THREE.Vector3(),shipCamera=new ShipCamera();
  const shipMarker=createShipMarker({nav,camera,entryLocal:new THREE.Vector3(0,shipFloorAt(0,6,true)+SHIP_LAYOUT.eyeHeight,6)});
  const lighting=createLighting(renderer,scene);const utilityLights=createUtilityLights(scene);
  const character=new Character(scene,{url:'/models/props/player-male.glb',modelYaw:Math.PI,eyeHeight:SHIP_LAYOUT.eyeHeight});
  character.setVisible(false);
  const remotePlayers=new RemotePlayers(scene),multiplayer=new MultiplayerClient();
  multiplayer.attach({nav,station,remotePlayers});
  let localInventoryStorage;try{localInventoryStorage=testFlight?testFlightStorage():window.localStorage;}catch{}
  const fleet=new Fleet(localInventoryStorage),freighterSystems=new FreighterSystems();
  if(testFlight)fleet.active='kestrel';
  nav.testFlight=testFlight;
  const layoutFor=id=>id==='kestrel'?KESTREL_LAYOUT:id==='atlas'?FREIGHTER_LAYOUT:SHIP_LAYOUT;
  function configureShip(id){
    nav.shipId=id;nav.layout=layoutFor(id);nav.freighter=id==='atlas'?freighterSystems:null;
    nav.kestrelAccess=id==='kestrel'?new KestrelAccess():null;
    shipMarker.setShip({shipName:SHIPS[id].name,entryLocal:new THREE.Vector3(...(id==='kestrel'?KESTREL_LAYOUT.entryEye:id==='atlas'?[0,1.75,13]:[0,shipFloorAt(0,6,true)+SHIP_LAYOUT.eyeHeight,6])),accessLabel:id==='kestrel'?'PORT LADDER':id==='atlas'?'BELLY ELEVATOR':'REAR RAMP'});
  }
  const shipModels=new Map();
  function modelFor(id){
    if(!shipModels.has(id)){
      const model=id==='kestrel'?createKestrel({url:kestrelURL,flight:true}):id==='atlas'?createFreighter(freighterSystems):createWalkableShip();
      if(!model.updateGear)installLandingGear(model);model.visible=false;scene.add(model);
      if(id!=='kestrel'){weatherShip(model,planet.surfaceTexture);model.readyPromise.then(asset=>{if(asset)weatherShip(asset,planet.surfaceTexture);});}
      const heating=new ReentryHeating(model);model.userData.reentryHeating=heating;
      model.readyPromise.then(()=>heating.refresh(),()=>{});
      shipModels.set(id,model);
    }
    return shipModels.get(id);
  }
  let ship=modelFor(fleet.active);
  configureShip(fleet.active);
  const opening=introEnabled&&fleet.active!=='kestrel'?new OpeningSequence({scene,nav,station,onGesture:()=>{
    if(!audio.context)audio.toggle().then(enabled=>{$('sound-button').textContent=enabled?'SOUND ON':'SOUND OFF';$('sound-button').setAttribute('aria-pressed',String(enabled));});
  }}):null;
  if(opening)Promise.all([station.readyPromise,ship.readyPromise,opening.character.readyPromise]).then(()=>{opening.start();nav.enabled=false;}).catch(error=>{
    opening.fail();nav.enabled=false;notify('Opening unavailable. Starting in orbit.');console.warn('Opening fallback:',error);
  });
  const inventory=new ShipInventory(localInventoryStorage,SHIPS[fleet.active].capacity||120);
  const mining=new MiningField(scene,localInventoryStorage,moon.rings);nav.surfaceObstacles=mining;
  const effects=new EnergyEffects(scene,{capacity:1024,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches});
  const loadout=new Loadout(mining.store);
  const miningTool=createMiningTool({scene,camera,canvas,nav,rock:mining,effects,loadout,character,thirdPerson:()=>shipCamera.active});
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
  document.addEventListener('keydown',e=>{if(e.repeat||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||document.querySelector('dialog[open]'))return;if(e.code==='KeyK'){e.preventDefault();inventoryUI.openEquipment();}else if(nav.enabled&&nav.focused&&['walk','eva'].includes(nav.mode)&&/^Digit[5-8]$/.test(e.code))useQuick(Number(e.code.slice(5))-5);});
  const flightEffects=createFlightEffects({effects,nav,mining,camera});
  inventoryUI.registerContainer?.({id:'crescent-cache',name:'Crescent field cache',kind:'base',boxes:2,available:()=>nav.mode==='walk'&&!nav.insideShip&&nav.position.distanceTo(mining.fieldCache.position)<4});
  bindStationLedger(inventory,mining.store);
  if(testFlight)inventory.transferAll('ship','station');
  if(fleet.active==='kestrel'&&(inventory.mass('ship')>0||mining.store.state.ship.some(m=>m>0))){
    // Inconsistent/older saves retain every item and load a hull with storage.
    ship.visible=false;fleet.active='nomad';ship=modelFor('nomad');configureShip('nomad');
  }
  inventory.capacity.ship=SHIPS[fleet.active].capacity;
  function parkShip(id){
    const layout=layoutFor(id),b=station.interiorBox,centre=b.getCenter(new THREE.Vector3());centre.y=b.min.y;
    centre.x-=(layout.flightBounds.min[0]+layout.flightBounds.max[0])/2;centre.z-=(layout.flightBounds.min[2]+layout.flightBounds.max[2])/2;
    configureShip(id);nav.shipPosition=station.toWorld(centre,centre);nav.shipOrientation.copy(station.quaternion);nav.orientation.copy(station.quaternion);
    nav.position.copy(nav.fromShipLocal(new THREE.Vector3(...layout.seatEye)));nav.velocity.set(0,0,0);nav.angularVelocity.set(0,0,0);
    nav.mode='landed';nav.dockedAtStation=true;nav.stationLift=false;nav.autoland=false;nav.gearDeployed=true;nav.gearProgress=1;
    nav.doorOpen=false;nav.doorProgress=0;nav.insideShip=true;nav.jumpHeight=0;nav.jumpVelocity=0;nav.resetCabinFlight();
  }
  const testFlightReady=testFlight?Promise.all([station.readyPromise,ship.readyPromise]).then(()=>{
    if(!station.ready)throw new Error('Test-flight hangar unavailable.');
    parkShip('kestrel');
    const launch=document.createElement('section');launch.className='kestrel-launch-card';launch.setAttribute('aria-labelledby','kestrel-launch-title');
    launch.innerHTML=`<img src="${MERIDIAN.emblemURL}" alt="Meridian Shipworks"><span>MERIDIAN SHIPWORKS / FLIGHT TRIAL</span><h2 id="kestrel-launch-title">Kestrel.</h2><p>One seat. Open sky.</p><dl><dt>B</dt><dd>Launch / land</dd><dt>W / S</dt><dd>Thrust / reverse</dd><dt>G</dt><dd>Landing gear</dd><dt>4</dt><dd>Exterior camera</dd><dt>F</dt><dd>Port ladder when landed</dd></dl><button id="kestrel-begin">Fly Kestrel ↗</button><small>Temporary flight · regular save unchanged<br>Four S2 mounts · unarmed</small>`;
    document.body.append(launch);launch.querySelector('button').addEventListener('click',capture);
  }):Promise.resolve();
  createStationServices(nav,station,inventory);
  nav.onVoyage=event=>{if(event==='dock')station.parkedPod=station.activeIndex;if(fleet.record(event))notify('Atlas unlocked! Open Fleet (U) while seated at the station to board your freighter.');};
  let selectingShip=false;
  const fleetUI=createFleetUI(nav,fleet,async id=>{
    if(selectingShip)return 'Ship preparation in progress.';
    if(!fleet.allows(id)||!SHIPS[id])return 'This ship is locked.';
    if(nav.mode!=='landed'||!nav.dockedAtStation)return 'Dock at Aeon Orbital before switching ships.';
    if(inventory.mass('ship')>SHIPS[id].capacity)return 'Too much cargo for this ship. Transfer supplies before switching.';
    if(id==='kestrel'&&mining.store.state.ship.some(m=>m>0))return 'Kestrel has no cargo hold. Unload ship minerals at the station first.';
    selectingShip=true;
    try{
      const next=modelFor(id);await next.readyPromise;
      if(nav.mode!=='landed'||!nav.dockedAtStation)return 'Ship selection cancelled: you left the station pad.';
      if(inventory.mass('ship')>SHIPS[id].capacity||id==='kestrel'&&mining.store.state.ship.some(m=>m>0))return 'Cargo changed during preparation. Unload before switching to Kestrel.';
      // Hangar services replace the parked ship at the pad centre, aligned with the bay.
      const layout=layoutFor(id),b=station.interiorBox;
      const centre=b.getCenter(new THREE.Vector3());centre.y=b.min.y;
      const orientation=station.quaternion.clone();
      const bounds=layout.flightBounds;
      if(bounds.max[0]-bounds.min[0]>b.max.x-b.min.x-2||bounds.max[2]-bounds.min[2]>b.max.z-b.min.z-2||bounds.max[1]>b.max.y-b.min.y-1)return 'This hangar cannot accommodate the selected ship.';
      centre.x-=(bounds.min[0]+bounds.max[0])/2;centre.z-=(bounds.min[2]+bounds.max[2])/2;
      ship.visible=false;ship=next;configureShip(id);
      nav.shipPosition=station.toWorld(centre,centre);nav.shipOrientation.copy(orientation);nav.orientation.copy(orientation);
      nav.position.copy(nav.fromShipLocal(new THREE.Vector3(...layout.seatEye)));nav.velocity.set(0,0,0);nav.angularVelocity.set(0,0,0);
      nav.doorOpen=false;nav.doorProgress=0;nav.insideShip=true;nav.jumpHeight=0;nav.jumpVelocity=0;
      if(layout.gear){nav.gearProgress=1;nav.gearDeployed=true;}
      inventory.capacity.ship=SHIPS[id].capacity;fleet.active=id;fleet.record('selection');
      nav.gearDeployed=true;nav.gearProgress=1;
      return `${SHIPS[id].name} ready. Close Fleet, then ${id==='kestrel'?'B to launch or F to descend the port ladder':'F to stand and explore'}.`;
    }catch(error){
      const failed=shipModels.get(id);if(failed!==ship&&failed?.userData.assetStatus==='error'){failed.removeFromParent();failed.dispose();shipModels.delete(id);}
      return `Ship unavailable: ${error.message}. Your current ship remains selected.`;
    }finally{selectingShip=false;}
  });
  const multiplayerUI=createMultiplayerUI({nav,client:multiplayer,onJoin:async account=>{
    if(SEED!==WORLD_SEED){const url=new URL(location.href);url.searchParams.set('seed',String(WORLD_SEED));location.replace(url);throw new Error('Reloading the shared world seed. Join again after reload.');}
    await Promise.all([station.readyPromise,character.readyPromise,opening?.character?.readyPromise]);opening?.leave();
    const nomad=modelFor('nomad');await nomad.readyPromise;
    if(ship!==nomad){ship.visible=false;ship=nomad;nav.layout=SHIP_LAYOUT;nav.freighter=null;nav.shipId='nomad';}
    const state=await multiplayer.connect(account),self=state.players.find(player=>player.id===state.ownId);
    if(self)await applySuitColor(character,SUIT_COLORS[self.colorIndex]??SUIT_COLORS[0]);
    enterPlayerInterface();return state;
  },onLeave:async()=>{multiplayer.disconnect();location.reload();}});
  nav.openComms=multiplayerUI.openComms;
  const localOpenPack=()=>inventoryUI.openPack(),localOpenEquipment=()=>inventoryUI.openEquipment();
  nav.openInventory=()=>multiplayer.connected?multiplayerUI.openInventory():inventoryUI.openContainer?.('ship');
  const localItemGetter=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(loadout),'item').get;
  const localAmmoFor=loadout.ammoFor.bind(loadout),localSpendRound=loadout.spendRound.bind(loadout),localMine=mining.onMine.bind(mining);
  let localSuitColor=-1,serverWeapon=null;
  Object.defineProperty(loadout,'item',{configurable:true,get:()=>multiplayer.connected?serverWeapon:localItemGetter.call(loadout)});
  loadout.ammoFor=item=>{
    if(!multiplayer.connected)return localAmmoFor(item);
    const ammo=item==='rifle-laser'?'carbine-charge':item==='sidearm-pistol'?'sidearm-charge':null;
    return ammo?Number(multiplayer.state.inventory?.containers?.pack?.[ammo]??0):0;
  };
  loadout.spendRound=item=>multiplayer.connected?false:localSpendRound(item);
  mining.onMine=(...args)=>multiplayer.connected?null:localMine(...args);
  multiplayer.subscribe(state=>{
    const online=state.connected;
    document.body.classList.toggle('multiplayer-online',online);
    const fleetButton=$('fleet-button');if(fleetButton)fleetButton.disabled=online;
    const backpackButton=$('backpack-button'),loadoutNode=$('loadout-bar');if(backpackButton)backpackButton.hidden=online;if(loadoutNode)loadoutNode.hidden=online;
    for(const button of document.querySelectorAll('#quick-transit-menu [data-destination]'))button.disabled=online||button.id==='station-destination'&&!station.ready;
    const self=state.players.find(player=>player.id===state.ownId);
    serverWeapon=self?.weapon??null;
    if(self&&self.colorIndex!==localSuitColor){localSuitColor=self.colorIndex;void applySuitColor(character,SUIT_COLORS[self.colorIndex]??SUIT_COLORS[0]);}
  });
  document.addEventListener('keydown',event=>{
    if(!multiplayer.connected||event.repeat||/INPUT|TEXTAREA|SELECT/.test(event.target.tagName)||document.querySelector('dialog[open]'))return;
    if(['KeyI','KeyK','KeyU','Digit5','Digit6','Digit7','Digit8'].includes(event.code)){
      event.preventDefault();event.stopImmediatePropagation();
      if(event.code==='KeyU')notify('Fleet selection is managed by the shared server.');else multiplayerUI.openInventory();
    }
  },true);
  $('backpack-button')?.addEventListener('click',event=>{if(multiplayer.connected){event.preventDefault();event.stopImmediatePropagation();multiplayerUI.openInventory();}},true);
  multiplayer.onEvent(event=>{
    if(event.event==='disconnect'){notify(event.message||'Multiplayer connection lost.');multiplayerUI.openComms();return;}
    if(event.event==='notice'&&event.message)notify(event.message);
    if(event.event==='hit'&&event.targetId===multiplayer.state.ownId)notify('Suit impact registered by server.');
    if(event.event==='fire'){
      remotePlayers.fire(event.peerId);
      if(event.targetId===multiplayer.state.ownId&&Number.isFinite(event.damage))notify(`Suit hit · ${event.damage} damage registered by server.`);
      if(Array.isArray(event.origin)&&Array.isArray(event.direction)){
        const start=new THREE.Vector3().fromArray(event.origin),direction=new THREE.Vector3().fromArray(event.direction).normalize();
        const hit=event.kind&&Number.isFinite(event.distance)?{point:start.clone().addScaledVector(direction,event.distance),normal:direction.clone().negate()}:null;
        effects.fire(start,direction,{weapon:event.weapon,range:Number.isFinite(event.distance)?event.distance:undefined,hit});
      }
    }
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
    if(name==='star'){nav.travelTarget='star';const center=new THREE.Vector3(...SUN_POSITION),point=nav.position.clone().sub(center).normalize().multiplyScalar(SUN_STANDOFF).add(center);course={name,label:'Our star',point,direction:point.clone().normalize(),system:true};$('course-guidance').hidden=false;notify('Stellar observation course selected. M opens the map; J engages the drive.');return;}
    if(name==='ring'){course={name,point:ringSurveyPoint(),direction:ringSurveyPoint().normalize()};$('course-guidance').hidden=false;notify('Course set for the Selene ring survey.');return;}
    if(name==='moon'){course={name,point:bodySurfacePoint(new THREE.Vector3(...MOON_LANDING_DIRECTION),SELENE,180),direction:new THREE.Vector3(...MOON_POSITION).normalize()};$('course-guidance').hidden=false;notify('Course set for Selene. Fly to the lunar approach marker.');return;}
    if(name==='miasma'){nav.travelTarget='miasma';const point=bodySurfacePoint(new THREE.Vector3(...miasmaArrivalDirection()),MIASMA,MIASMA_ARRIVAL_ALTITUDE);course={name,label:'Miasma',point,direction:point.clone().normalize(),system:true};$('course-guidance').hidden=false;notify('Miasma selected. M opens the map; J engages the drive.');return;}
    if(name==='pyre'){nav.travelTarget='pyre';course={name,point:bodySurfacePoint(new THREE.Vector3(...pyreArrivalDirection()),PYRE,PYRE_ARRIVAL_ALTITUDE),direction:new THREE.Vector3(...PYRE_POSITION).normalize()};$('course-guidance').hidden=false;notify('Course set for Pyre. Use the system map drive (M) for the interplanetary crossing.');return;}
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
  nav.enabled=false;
  const preload=new StartupPreload([
    {label:'Loading the station',promise:station.readyPromise},
    {label:'Preparing your ship',promise:ship.readyPromise},
    {label:'Preparing the test flight',promise:testFlightReady},
    {label:'Preparing your character',promise:Promise.all([character.readyPromise,opening?.character.readyPromise])},
    {label:'Loading surface materials',promise:planet.terrainMaps.loaded},
    {label:'Preparing Aeon',promise:planet.orbitalSurface.readyPromise},
  ],async()=>{
    await renderer.compileAsync(scene,camera);
    // Calibration should measure prepared graphics, not asset/shader stalls.
    frames=0;frameAccumulator=0;
  });
  const releaseLoadingKeys=blockStartupInput(document,()=>firstReady);
  let elapsed=0,last=null,lastHud=0,frames=0,fps=0,frameAccumulator=0,firstReady=false,transiting=false,hidden=false;
  document.addEventListener('visibilitychange',()=>{last=null;});
  const resolution=new RenderResolution();let resizePending=false;
  function resize(){renderer.setPixelRatio(resolution.pixelRatio);const width=Math.floor(innerWidth*resolution.scale),height=Math.floor(innerHeight*resolution.scale);renderer.setSize(width,height,false);canvas.style.width='100%';canvas.style.height='100%';camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();const size=renderer.getDrawingBufferSize(new THREE.Vector2());atmosphere.resize(size.x,size.y);}
  function viewportChanged(){
    resolution.viewport({width:innerWidth,height:innerHeight,dpr:devicePixelRatio,fullscreen:fullscreenViewport({element:document.fullscreenElement,width:innerWidth,height:innerHeight,outerWidth,outerHeight,screenWidth:screen.width,screenHeight:screen.height})});
    resizePending=true;
  }
  window.addEventListener('resize',viewportChanged);document.addEventListener('fullscreenchange',viewportChanged);
  document.addEventListener('visibilitychange',()=>resolution.resetMeasurements());
  viewportChanged();resize();resizePending=false;
  const mfdRaycaster=new THREE.Raycaster(),mfdPointer=new THREE.Vector2();
  function activateMFD(event){
    if(!nav.powered||!['flight','landed'].includes(nav.mode)||document.querySelector('dialog[open]'))return false;
    const bounds=canvas.getBoundingClientRect();mfdPointer.set((event.clientX-bounds.left)/bounds.width*2-1,-(event.clientY-bounds.top)/bounds.height*2+1);
    scene.updateMatrixWorld(true);mfdRaycaster.setFromCamera(mfdPointer,camera);
    for(const hit of mfdRaycaster.intersectObject(ship,true)){let target=hit.object;while(target&&target!==ship&&!target.userData.action)target=target.parent;if(target?.userData.action){target.userData.action();return true;}}
    return false;
  }
  function capture(event){if(activateMFD(event)||transiting||!nav.enabled||opening?.active)return;enterPlayerInterface();nav.capture();}
  canvas.addEventListener('click',capture);$('begin-button').addEventListener('click',capture);
  // Drag fallback also works when browser pointer-lock is unavailable.
  let dragging=false;
  canvas.addEventListener('pointerdown',e=>{if(!nav.locked){dragging=true;canvas.setPointerCapture(e.pointerId);}});
  canvas.addEventListener('pointerup',()=>dragging=false);
  canvas.addEventListener('pointermove',e=>{if(dragging&&!nav.locked){const yaw=-e.movementX*.002,pitch=-e.movementY*.002;multiplayer.captureLook(yaw,pitch);nav.look(yaw,pitch);}});
  const help=$('help-dialog');
  function openHelp(){if(!nav.enabled||nav.mode==='destroyed'||transiting||opening?.active||inventoryUI.open||fleetUI.open||document.querySelector("#station-cargo-dialog[open],#station-elevator-dialog[open],#station-shop-dialog[open]")||systemMap.open)return;if(document.pointerLockElement)document.exitPointerLock();nav.keys.clear();nav.enabled=false;shipPowerUI.update();help.showModal();}
  function closeHelp(){help.close();nav.enabled=!transiting;}
  $('help-button').addEventListener('click',openHelp);$('close-help').addEventListener('click',closeHelp);help.addEventListener('close',()=>{
    $('quick-transit-menu').open=false;
    nav.enabled=!transiting&&!document.querySelector('dialog[open]');
    if(nav.enabled)canvas.focus({preventScroll:true});
  });
  $('map-button').addEventListener('click',()=>{closeHelp();systemMap.openMap();});
  $('help-fly').addEventListener('click',()=>{closeHelp();capture();});
  $('sound-button').addEventListener('click',async()=>{const enabled=await audio.toggle();$('sound-button').textContent=enabled?'SOUND ON':'SOUND OFF';$('sound-button').setAttribute('aria-pressed',String(enabled));});
  const photo=()=>{hidden=!hidden;document.body.classList.toggle('photo-mode',hidden);};$('photo-button').addEventListener('click',()=>{closeHelp();photo();});
  document.addEventListener('keydown',e=>{if(opening?.active||e.repeat||inventoryUI.open||fleetUI.open||(document.querySelector('dialog[open]')&&!help.open)||systemMap.open)return;if(e.code==='KeyH'){help.open?closeHelp():openHelp();}if(e.code==='Tab'&&!help.open){e.preventDefault();photo();}if(e.code==='KeyO'&&!help.open)transit('orbit');});
  function toggleCamera(){
    if(nav.berthRest||nav.berthTransition)return;
    if(opening?.active||transiting||!nav.enabled||inventoryUI.open||document.querySelector('dialog[open]'))return;
    if(!shipCamera.toggle(nav.mode))return;
    if(nav.mode==='walk'){notify(shipCamera.playerExternal?'Third-person view. 4 returns to first person.':'First-person view. 4 shows your character.');return;}
    notify(shipCamera.external?'External ship view. Flight controls unchanged; 4 returns to cockpit.':'Cockpit view. 4 shows the ship.');
  }
  $('camera-button').addEventListener('click',toggleCamera);
  document.addEventListener('keydown',event=>{if(isShipCameraKey(event)){event.preventDefault();toggleCamera();}});
  async function transit(name){
    // Elevator travel closes its dialog before the fade ends, while navigation
    // stays paused. A second transit must wait for that owner to release control.
    if(multiplayer.connected){notify('Quick transit is unavailable in shared flight. Use the system map drive.');return;}
    if(!nav.enabled||nav.mode==='destroyed'||opening?.active||inventoryUI.open||fleetUI.open||document.querySelector("#station-cargo-dialog[open],#station-elevator-dialog[open],#station-shop-dialog[open]")||systemMap.open||transiting||name==='station'&&!station.ready)return;opening?.leave();transiting=true;nav.enabled=false;nav.keys.clear();nav.velocity.set(0,0,0);
    if(document.pointerLockElement)document.exitPointerLock();
    const resourceRoute=resourceRoutes.find(r=>r.id===name);
    const button=document.querySelector(`[data-destination="${name}"]`);$('transit-name').textContent=(resourceRoute?.label??button?.querySelector('strong')?.textContent??'Survey').toUpperCase();$('transit').classList.add('active');
    await new Promise(r=>setTimeout(r,350));
    if(name==='star')nav.transitStar();
    else if(name==='miasma')nav.transitMiasma();
    else if(resourceRoute){const point=resourceSurveyPoint(resourceRoute.province.id),direction=point.clone().sub(new THREE.Vector3(...MOON_POSITION)).normalize();nav.transitMoon(180,direction.toArray());const away=point.clone().sub(bodySurfacePoint(new THREE.Vector3(...resourceRoute.province.direction),SELENE,1.35));away.addScaledVector(direction,-away.dot(direction)).normalize();nav.orientToward(nav.position.clone().addScaledVector(away,1000).addScaledVector(direction,-180),direction);}
    else if(name==='ring'){nav.transitMoon();nav.position.copy(ringSurveyPoint()).add(new THREE.Vector3(0,0,42));nav.velocity.set(0,0,0);nav.orientToward(ringSurveyPoint(),new THREE.Vector3(0,1,0));}
    else if(name==='moon')nav.transitMoon();
    else if(name==='pyre'){nav.transitPyre();pyre.terrain.prewarm(pyreLandingDirection(),9);}
    else if(name==='station'){const target=station.transitParams(180,6);nav.transit(target.direction,target.altitude);nav.orientToward(target.lookAt,target.up);}
    else if(name==='orbit')nav.orbit();else nav.transit(destinations[name],name==='mountain'?700:name==='polar'?90:95);
    for(const b of document.querySelectorAll('.destination'))b.classList.toggle('active',b===button);
    // This optional shortcut conceals its teleport while streamed terrain catches up.
    planet.cameraWorld.copy(nav.position);planet.select();
    const started=performance.now();
    const limit=name==='pyre'||name==='miasma'?12000:6500;
    while(performance.now()-started<limit){await new Promise(r=>setTimeout(r,150));if(performance.now()-started>1100 && planet.pending<4 && (name==='moon'||resourceRoute?moon.terrain.maxLevel>=14:name==='pyre'?pyre.ready:name==='miasma'?miasma.ready:name==='star'||name==='orbit'||name==='station'||name==='ring'||planet.maxVisibleLevel>=12))break;}
    $('transit').classList.remove('active');transiting=false;nav.enabled=true;
    notify(name==='star'?'Stellar observation point: 500,000 km above the photosphere. Space + Shift retreats; watch shield temperature.':resourceRoute?`${resourceRoute.label}. B / Y lands. The marked outcrop shares this region's minerals; the terrain itself cannot be excavated.`:name==='ring'?'Ring survey. Brake to a stop, F leaves the chair; open the hatch and walk outside. G activates suit thrusters.':name==='moon'?'Selene descent. B lands; F leaves the chair. Open the rear hatch and walk down the ramp to explore.':name==='miasma'?'Miasma: sulphur clouds, mineral basins and toxic air. Descend to land; surface exploration uses your sealed suit.':name==='pyre'?`Pyre, ${PYRE_ARRIVAL_ALTITUDE/1000} km above the twilight line. Sunlight left, glowing night side right; Miasma above the dark limb. Descend to explore.`:name==='station'?'Station approach. W enters the bay; X brakes. Over the central pad, B docks.':name==='orbit'?'High orbit. Click to fly. W approaches Aeon; Space moves away.':'Arrival complete. Click to fly · B lands · F leaves the pilot chair.');
  }
  $('crash-recover').addEventListener('click',()=>transit('orbit'));
  const ringButton=document.createElement('button');ringButton.type='button';ringButton.className=$('moon-destination')?.className??'destination';ringButton.dataset.destination='ring';ringButton.innerHTML='<span class="destination-icon">⌁</span><span><strong>Selene rings</strong><small>ASTEROID SURVEY · EVA</small></span>';document.querySelector('[data-destination="moon"]').after(ringButton);
  const graphicsSettings=createGraphicsSettings({nav,storage:localInventoryStorage,onChange:settings=>{
    vegetation.distantMeadow.configure(settings);
    resolution.configure(settings.resolution);
    resizePending=true;
  }});
  const graphicsButton=document.createElement('button');graphicsButton.type='button';graphicsButton.id='graphics-button';graphicsButton.textContent='GRAPHICS';graphicsButton.addEventListener('click',()=>graphicsSettings.open());document.querySelector('.top-actions').prepend(graphicsButton);
  for(const [label,open,secondary] of [['ACCOUNT',multiplayerUI.openAccount,true],['COMMS',multiplayerUI.openComms,false],['INVENTORY',multiplayerUI.openInventory,true]]){
    const button=document.createElement('button');button.type='button';button.className=`mp-top-button${secondary?' mp-top-secondary':''}`;button.textContent=label;button.addEventListener('click',()=>open());document.querySelector('.top-actions').prepend(button);
  }
  const gearNotice=document.createElement('div');gearNotice.id='gear-flight-prompt';gearNotice.setAttribute('role','status');gearNotice.hidden=true;document.body.append(gearNotice);
  const utilityStatus=document.createElement('div');utilityStatus.id='ship-utility-status';document.querySelector('.telemetry').append(utilityStatus);
  const controllerUI=createControllerUI({nav,actions:[
    {id:'free-drive',label:'Heading drive · N / LB+RB + ↑',activate:()=>nav.travel?nav.cancelTravel():nav.beginFreeTravel(),enabled:()=>Boolean(nav.travel)||nav.mode==='flight'},
    {id:'gear',label:'Landing gear · G / LB+RB + ↓',activate:()=>nav.toggleGear(),enabled:()=>nav.mode==='flight'&&!nav.autoland&&!nav.stationLift&&!nav.travel&&nav.powered},
    {id:'lights',label:'Lights / flashlight · L / LB+RB + ←',activate:()=>nav.toggleLights(),enabled:()=>nav.mode!=='crashed'},
    {id:'camera-view',label:'Camera view · 4 / LB+RB + →',activate:()=>document.getElementById('camera-button').click(),enabled:()=>['flight','walk','landed'].includes(nav.mode)},
    {id:'account',label:'Pilot account',activate:()=>multiplayerUI.openAccount()},{id:'comms',label:'Multiplayer comms',activate:()=>multiplayerUI.openComms()},{id:'server-inventory',label:'Server inventory',activate:()=>multiplayerUI.openInventory(),enabled:()=>multiplayer.connected},
    {id:'graphics',label:'Graphics · LB+RB + Menu',activate:()=>graphicsSettings.open()},{id:'crash-recover',label:'Return to orbit after crash',activate:()=>transit('orbit'),enabled:()=>nav.mode==='crashed'},{id:'fleet',label:'Fleet registry',activate:()=>fleetUI.openMenu(),enabled:()=>!multiplayer.connected},{id:'power',label:'Toggle ship main power',activate:()=>nav.togglePower(),enabled:()=>nav.canTogglePower},...Object.entries(WEAPONS).map(([id,p])=>({id:`weapon-${id}`,label:`Ship weapon · ${p.label}`,activate:()=>flightEffects.select(id),enabled:()=>nav.mode==='flight'&&nav.shipId!=='kestrel'&&!multiplayer.connected}))],openBackpack:()=>multiplayer.connected?multiplayerUI.openInventory():localOpenPack(),toggleTool:()=>multiplayer.connected?multiplayerUI.openInventory():miningTool.toggle(),openEquipment:()=>multiplayer.connected?multiplayerUI.openInventory():localOpenEquipment(),cycleEquipment:()=>multiplayer.connected?multiplayerUI.openInventory():miningTool.cycle(),cycleQuick:()=>{if(multiplayer.connected){multiplayerUI.openInventory();return;}const r=loadout.selectQuick((loadout.state.quickIndex+1)%4);if(!r.ok)nav.notify(r.message);},useQuick:()=>multiplayer.connected?multiplayerUI.openInventory():useQuick(loadout.state.quickIndex),destinations:[...document.querySelectorAll('#quick-transit-menu [data-destination]')].map(button=>({id:button.dataset.destination,label:button.dataset.destination==='moon'?'Selene':button.dataset.destination==='ring'?'Selene rings':button.textContent.trim(),activate:()=>transit(button.dataset.destination),enabled:()=>!button.disabled&&!multiplayer.connected})).concat(resourceRoutes.map(route=>({id:route.id,label:route.label,activate:()=>transit(route.id),enabled:()=>!multiplayer.connected})))});
  nav.onControllerInput=(pad,dt)=>{
    if(!firstReady)return;
    if(systemMap.open){systemMap.controllerInput(pad.ui);return;}
    // Account dialogs pause the intro but still need the shared modal router.
    if(document.querySelector('dialog[open]')){controllerUI.update(pad,dt);return;}
    if(nav.openingActive){if(pad.pressed.has(9))multiplayerUI.openAccount();return;}
    if(pad.pressed.has(14)&&nav.mode==='flight'){systemMap.openMap();return;}
    controllerUI.update(pad,dt);flightEffects.controller(pad);
  };
  const systemsHelp=document.createElement('button');systemsHelp.type='button';systemsHelp.textContent='Ship systems / Graphics';systemsHelp.addEventListener('click',()=>{closeHelp();controllerUI.open();});document.querySelector('.menu-actions').append(systemsHelp);
  nav.openCommands=()=>controllerUI.open();
  const menuButton=document.createElement('button');menuButton.id='commands-button';menuButton.type='button';menuButton.textContent='MENU';menuButton.title='Command menu · controller Menu';menuButton.addEventListener('click',()=>controllerUI.open());document.querySelector('.top-actions').prepend(menuButton);
  for(const button of document.querySelectorAll('#quick-transit-menu [data-destination]'))button.addEventListener('click',event=>{
    closeHelp();
    if(event.shiftKey)setCourse(button.dataset.destination);else transit(button.dataset.destination);
  });
  function updateHud(time){
    const controller=nav.controllerActive;
    const departurePrompt=gearPrompt(nav,controller);if(gearNotice.textContent!==departurePrompt)gearNotice.textContent=departurePrompt;gearNotice.hidden=!departurePrompt||Boolean(document.querySelector('dialog[open]'));
    utilityStatus.textContent=(nav.mode==='walk'||nav.mode==='eva')?`LIGHT ${nav.flashlightOn?'ON':'OFF'} · ${controller?'LB+RB + ←':'L'}`:`GEAR ${nav.gearDeployed?'DOWN':'UP'} · LIGHTS ${nav.shipLightsOn?'ON':'OFF'} · ${controller?'LB+RB SHORTCUTS':'N DRIVE'}`;
    document.body.classList.toggle('piloting',nav.locked||controller);
    $('controller-status').textContent=nav.gamepad.status;
    $('keyboard-hints').hidden=controller;$('controller-hints').hidden=!controller;
    const onFoot=nav.mode==='walk'||nav.mode==='eva',eva=nav.mode==='eva';document.body.classList.toggle('on-foot',onFoot);
    const hints=nav.berthRest?[[controller?'X':'F','LEAVE BERTH'],[controller?'RS':'ARROWS','LOOK'],[controller?'VIEW':'I','BACKPACK']]:controller?(nav.controllerShortcutModifier?[['LB + RB','HOLD'],['↑','DRIVE ON / OFF'],['↓','GEAR'],['←',onFoot?'FLASHLIGHT':'LIGHTS'],['→','CAMERA'],['MENU','GRAPHICS']]:onFoot?[['LS','MOVE'],['RS','LOOK'],['RT',loadout.item==='mining-laser-tool'?'MINE':'FIRE'],[eva?'A / B':'A',eva?'RISE / LOWER':'JUMP'],['X','INTERACT'],[eva?'LT':'Y',eva?'BRAKE':'SUIT'],['D-PAD ← / →','CYCLE / TOOL'],['↑ / ↓','QUICK / USE'],['VIEW','BACKPACK'],['MENU','COMMANDS'],['LB + RB','SHORTCUTS']]:[['LS','MOVE'],['RS','LOOK'],['RT / LT','UP / DOWN'],['Y','LAND / LAUNCH'],['X','INTERACT / EVA'],['MENU','COMMANDS'],['LB + RB','SHORTCUTS']]):onFoot?[['WASD','MOVE'],[eva?'SPACE / C':'SPACE',eva?'RISE / LOWER':'JUMP'],['T / MOUSE',loadout.item==='mining-laser-tool'?'MINE':'FIRE'],['F','INTERACT'],['I / K','PACK / GEAR'],['L','FLASHLIGHT'],['M','MAP']]:[['WASD','MOVE'],['SPACE / C','UP / DOWN'],['B','LAND / LAUNCH'],['N','DRIVE'],['G','GEAR'],['L','LIGHTS'],['F','INTERACT / EVA'],['M','MAP']];
    $('controller-hints').classList.toggle('utility-shortcuts',controller&&nav.controllerShortcutModifier);
    const hintsNode=$(controller?'controller-hints':'keyboard-hints'),hintMode=`${controller}-${nav.mode}-${nav.berthRest}-${nav.insideShip}-${nav.dockedAtStation}-${loadout.item}-${nav.controllerShortcutModifier}`;
    if(hintsNode.dataset.mode!==hintMode){hintsNode.innerHTML=hints.filter(([,label])=>!(label==='JUMP'&&nav.insideShip)&&!(label==='SUIT'&&(nav.insideShip||nav.dockedAtStation))).map(([key,label])=>`<span><kbd>${key}</kbd> ${label}</span>`).join('');hintsNode.dataset.mode=hintMode;}
    const nearMoon=nav.body.id==='selene',onPyre=nav.body.id==='pyre',onMiasma=nav.body.id==='miasma',onStar=nav.body.star===true;document.body.classList.toggle('surveying-moon',nearMoon);
    const resources=nearMoon?moonResources(...nav.normal.toArray()):null;resourceLegend.hidden=!nearMoon||onFoot;
    if(resources)resourceLegend.querySelector('p').textContent=`Below: ${resources.province} · ${resources.dominant.toUpperCase()} RICH`;
    const alt=nav.altitude,speed=nav.cabinFlight?nav.shipSpeed:nav.speed,n=nav.normal,flightEnv=nav.flightEnvironment;
    $('camera-button').setAttribute('aria-pressed',String(shipCamera.selected(nav.mode)));
    $('camera-button').innerHTML=shipCamera.selected(nav.mode)?`${nav.mode==='walk'?'FIRST PERSON':'COCKPIT'} <kbd>4</kbd>`:'EXTERNAL <kbd>4</kbd>';
    $('camera-button').disabled=Boolean(nav.berthRest||nav.berthTransition)||(nav.mode!=='flight'&&nav.mode!=='landed'&&nav.mode!=='walk');
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
      $('travel-phase').textContent=`${travel.phase.toUpperCase()} · ${Number.isFinite(travel.eta)?travel.eta.toFixed(1)+'s':'0.9c MAX'} · ${controller?'B':travel.manual?'N':'X'} TO DISENGAGE`;
      $('travel-progress').firstElementChild.style.width=`${travel.progress*100}%`;
    }
    $('altitude-reference').textContent=onStar?'ABOVE PHOTOSPHERE':nearMoon?'ABOVE SELENE':onPyre?'ABOVE PYRE':onMiasma?'ABOVE MIASMA':'ABOVE AEON';
    $('altitude').textContent=alt>=1000?(alt/1000).toLocaleString('en-US',{maximumFractionDigits:1}):alt.toFixed(1);$('altitude-unit').textContent=alt>=1000?'km':'m';
    $('velocity').textContent=speed>=1000?(speed/1000).toLocaleString('en-US',{maximumFractionDigits:1}):Math.round(speed).toLocaleString();$('velocity-unit').textContent=speed>=1000?'km/s':'m/s';
    if(travel&&speed>LIGHT_SPEED*.001){$('velocity').textContent=(speed/LIGHT_SPEED).toFixed(3);$('velocity-unit').textContent='c';}
    $('altitude-meter').style.width=`${Math.min(100,Math.log10(alt+1)/7*100)}%`;
    const lat=Math.asin(n.y)*180/Math.PI,lon=Math.atan2(n.x,n.z)*180/Math.PI;
    $('latitude').textContent=`${Math.abs(lat).toFixed(3)}° ${lat>=0?'N':'S'}`;$('longitude').textContent=`${Math.abs(lon).toFixed(3)}° ${lon>=0?'E':'W'}`;
    const mode=nav.mode==='destroyed'||nav.mode==='crashed'?'SHIP DESTROYED':onStar?'STELLAR APPROACH':onMiasma?(nav.mode==='walk'?'MIASMA EXPLORATION':nav.mode==='landed'?'LANDED · MIASMA':alt>MIASMA_ATMOSPHERE.height?'MIASMA ORBIT':'MIASMA · TOXIC ATMOSPHERE'):onPyre?(nav.mode==='walk'?'PYRE EXPLORATION':nav.mode==='landed'?'LANDED · PYRE':'PYRE FLIGHT'):nav.mode==='eva'?'EVA · SUIT THRUSTERS':nav.cabinFlight?'IN-FLIGHT CABIN':nearMoon?(nav.mode==='walk'?'LUNAR EXPLORATION':nav.mode==='landed'?'LANDED · SELENE':'LUNAR FLIGHT'):nav.dockedAtStation?(nav.mode==='walk'?'STATION EXPLORATION':'DOCKED'):nav.mode==='walk'?'SURFACE EXPLORATION':nav.mode==='landed'?'LANDED':flightEnv.regime==='SPACE'?'SPACE FLIGHT':flightEnv.regime==='TRANSITION'?`TRANSITION · ATMO ${Math.round(flightEnv.atmosphereFraction*100)}%`:'ATMOSPHERIC FLIGHT';
    $('mode-label').textContent=mode;$('biome').textContent=onStar?'OUR STAR · CORONA':onMiasma?`MIASMA · ${miasmaSurface(n.x,n.y,n.z).region}`:onPyre?`PYRE · ${pyreRegion(n.x,n.y,n.z)}`:nearMoon?`SELENE · ${moonRegion(n.x,n.y,n.z)}`:nav.stationDistance<500?'AEON ORBITAL':alt>70000?'EXOSPHERE':biomeAt(n.x,n.y,n.z);$('fps').textContent=`${fps} FPS`;
    $('state-text').textContent=nav.mode==='crashed'?'CRITICAL IMPACT · FLIGHT SYSTEMS OFFLINE':nav.stationLift?'UNDOCKING':nav.autoland?(nav.stationDistance<500?'DOCKING ASSIST':'LANDING ASSIST'):nav.mode==='walk'||nav.mode==='landed'?nav.interaction:nav.stationDistance<500?(station.doorsOpen<.98?'HANGAR DOORS OPENING':nav.canDock?'B · DOCK ON DECK':'FLY OVER THE CENTRAL PAD'):nav.boost?'BOOST ENGAGED':'FREE FLIGHT';
    $('drive-label').textContent=nav.mode==='eva'?`EVA · ${nav.speed.toFixed(1)} m/s`:!nav.powered?'MAIN POWER OFF':nav.cabinFlight?(nav.flightAssist?'COURSE HOLD':'INERTIAL COAST'):nav.mode==='walk'?'ON FOOT':nav.autoland?'AUTOLAND':nav.flightAssist?`ASSIST ×${nav.speedScale.toFixed(1)}`:'INERTIAL · V TO ASSIST';
    if(travel){$('mode-label').textContent='RELATIVISTIC DRIVE';$('drive-label').textContent='0.9c MAX';$('state-text').textContent=travel.aborting?'ABORT BRAKING':travel.manual&&travel.phase==='spooling'?'HEADING LOCKED · SPOOLING':travelPhaseLabel(travel.phase);}
    if(!nav.powered&&nav.mode==='flight')$('state-text').textContent=nav.kestrelAccess?'P · MAIN POWER ON':'P · MAIN POWER ON / F · LEAVE SEAT';
    if(controller){$('state-text').textContent=$('state-text').textContent.replace(/\bF ·/g,'X / □ ·').replace(/\bB ·/g,'Y / △ ·').replace('P · MAIN POWER ON','MENU · MAIN POWER');$('drive-label').textContent=$('drive-label').textContent.replace('V TO ASSIST','R3 TO ASSIST');}
    $('terrain-status').textContent=onStar?'STELLAR OBSERVATION':onMiasma?`${miasma.terrain.visibleCount} PATCHES · LOD ${miasma.terrain.maxLevel}`:onPyre?`${pyre.terrain.visibleCount} PATCHES · LOD ${pyre.terrain.maxLevel}`:nearMoon?`${moon.terrain.visibleCount} PATCHES · LOD ${moon.terrain.maxLevel}`:`${planet.visibleCount} PATCHES · LOD ${planet.maxVisibleLevel}`;
    const survey=$('pyre-survey');survey.hidden=!(onPyre||onMiasma)||alt>2000000;
    if(onPyre||onMiasma){const profile=onMiasma?miasmaSurface(n.x,n.y,n.z).resources:pyreResources(n.x,n.y,n.z);$('pyre-composition').textContent=profile.ids.map((id,i)=>`${id.toUpperCase()} ${Math.round(profile.weights[i]*100)}%`).join(' · ');}
    const heatWarning=$('heat-warning');heatWarning.hidden=heat<.3;heatWarning.classList.toggle('critical',heat>.75);heatWarning.textContent=`HULL TEMP ${Math.round(40+heat*360)} °C · ${heat>.75?'CRITICAL':'RISING'}`;
    $('toxic-warning').hidden=!onMiasma||alt>MIASMA_ATMOSPHERE.height;
    updateStellarHud();
    lastHud=time;
  }
  let graphicsStopped=false;
  const stopGraphics=message=>{graphicsStopped=true;nav.enabled=false;preload.error=message;fatal(message);};
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();stopGraphics('The graphics context was lost. Reload the page to restart your flight.');});
  let renderedFrames=0;
  let wasDestroyed=false;
  const recover=()=>{if(nav.mode!=='destroyed')return;nav.recoverFromStar();course=null;$('course-guidance').hidden=true;$('stellar-loss').hidden=true;document.body.classList.remove('stellar-destroyed');};
  nav.onRecovery=recover;$('stellar-recover').addEventListener('click',recover);
  document.addEventListener('keydown',e=>{if(e.code==='Enter'&&nav.mode==='destroyed')recover();});
  function updateStellarHud(){
    const thermal=nav.stellarThermal,exposure=stellarExposure(sun.distance),active=nav.body.star||thermal.temperature>600||thermal.hull<100;
    const damaging=thermal.temperature>=STELLAR_THERMAL.damage,warning=exposure.equilibrium>=STELLAR_THERMAL.warning;
    $('stellar-shields').hidden=!active||thermal.destroyed;
    $('stellar-shields').classList.toggle('danger',damaging||warning);
    $('stellar-status').textContent=damaging?'THERMAL DAMAGE · RETREAT':warning?'RADIATION WARNING':'STELLAR OBSERVATION';
    $('stellar-temperature').textContent=`${Math.round(thermal.temperature-273.15)} °C`;
    $('stellar-hull').textContent=`${Math.ceil(thermal.hull)}%`;
    $('stellar-heat-meter').value=Math.min(1,(thermal.temperature-290)/(STELLAR_THERMAL.critical-290));
    $('stellar-loss').hidden=!thermal.destroyed;document.body.classList.toggle('stellar-destroyed',thermal.destroyed);
    if(thermal.destroyed){$('stellar-loss-reason').textContent=thermal.reason;if(!wasDestroyed){if(document.pointerLockElement)document.exitPointerLock();$('stellar-recover').focus();}}
    wasDestroyed=thermal.destroyed;
  }
  function frame(time){
    requestAnimationFrame(frame);const realDt=last===null?0:Math.max(0,(time-last)/1000),dt=nav.travel||opening?.active?realDt:Math.min(realDt,.2);last=time;
    if(graphicsStopped)return;
    if(!firstReady){
      const status=preload.state;
      $('loading-status').textContent=status.label;
      $('loading-progress').max=status.total;$('loading-progress').value=status.completed;
    }
    if(document.hidden||opening?.phase==='loading'){resolution.resetMeasurements();return;}
    if(systemMap.open){resolution.resetMeasurements();nav.update(0);return;}
    elapsed+=dt;
    const steps=nav.travel||opening?.active?1:Math.max(1,Math.ceil(dt/.025));nav.beginFrame(dt);if(firstReady)for(let i=0;i<steps;i++)nav.update(dt/steps);multiplayer.update(dt);
    cabinControls.update();
    if(systemMap.open){resolution.resetMeasurements();return;}
    opening?.update(firstReady?dt:0);
    shipPowerUI.update();
    // Keep the last scene behind menus while input/controller polling and world
    // updates continue. A resize needs one fresh frame at the new canvas size.
    const drawScene=resizePending||!firstReady||(!systemMap.open&&!document.querySelector('dialog[open]'));
    if(resizePending){resize();resizePending=false;}
    shipCamera.update(nav,{
      clipStation:(start,end,orientation)=>station.constrainStep(start,end,orientation,true).point,
      clipShip:nav.shipPosition?(start,end)=>clipShipCamera(start,end,ship,point=>nav.toShipLocal(point)):undefined,
    });
    character.setVisible(nav.mode==='walk'&&shipCamera.active&&!nav.kestrelAccess?.busy);
    if(nav.mode==='walk'){
      const up=playerUp(nav),feet=nav.position.clone().addScaledVector(up,-SHIP_LAYOUT.eyeHeight);
      character.alignToSurface(feet,up,new THREE.Vector3(0,0,-1).applyQuaternion(nav.orientation));
      character.update(dt,{speed:nav.velocity.clone().projectOnPlane(up).length(),grounded:nav.jumpHeight===0,jumping:nav.jumpHeight>0,...miningTool.pose});
    }
    document.body.classList.toggle('external-view',shipCamera.active);
    document.body.classList.toggle('camera-engaged',shipCamera.engaged&&nav.mode==='flight');
    origin.copy(shipCamera.position);camera.position.set(0,0,0);camera.quaternion.copy(shipCamera.orientation);
    character.placeCameraRelative(origin);
    remotePlayers.update(dt,origin);
    const fighterCockpit=nav.shipId==='kestrel'&&!shipCamera.active&&['flight','landed'].includes(nav.mode);
    const viewFov=fighterCockpit?76:52;
    if(!opening?.placeCamera(camera,origin)){
      if(camera.fov!==viewFov){camera.fov=viewFov;camera.updateProjectionMatrix();}
      // The seated interceptor view includes the side MFDs without moving the
      // physical PilotEye or changing ship attitude / flight direction.
      if(fighterCockpit)camera.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-.14));
    }
    $('reticle').style.top=fighterCockpit?`${50-50*Math.tan(.14)/Math.tan(THREE.MathUtils.degToRad(viewFov/2))}%`:'50%';
    station.update(nav.position,origin,nav.sunDirection,dt);
    travelEffects.update(nav.enabled?dt:0,nav,camera);
    const sunDirection=nav.sunDirection,normal=nav.normal,altitude=nav.altitude;
    document.body.classList.toggle('exploring',nav.body.star||nav.body.id==='pyre'||nav.body.id==='miasma'||altitude<12000||nav.mode!=='flight'||nav.stationDistance<2000);
    const onPyre=nav.body.id==='pyre';
    lighting.update(normal,sunDirection,altitude,nav.body.airless,onPyre?PYRE_LIGHTING:nav.body.id==='miasma'?MIASMA_LIGHTING:null);
    aeonGroup.visible=nav.position.length()<PYRE_MESH_RANGE;
    shipMarker.update(innerWidth,innerHeight);
    moon.update(nav.position,origin,elapsed,!nav.insideShip,nav.shipPosition);
    mining.update(origin);miningTool.update(dt,origin);inventoryUI.update?.();loadoutBar.update();
    pyre.update(origin,origin);
    miasma.update(origin,origin,elapsed,nav.shipPosition);
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
    ship.visible=Boolean(nav.shipPosition)||(nav.mode==='flight'&&(nav.shipId==='kestrel'||nav.locked||nav.controllerActive||shipCamera.engaged||document.body.classList.contains('player-active')));
    if(ship.visible){
      if(nav.shipPosition){ship.position.copy(nav.shipPosition).sub(origin);ship.quaternion.copy(nav.shipOrientation);}
      else{ship.quaternion.copy(nav.orientation);ship.position.copy(nav.position).sub(origin).sub(new THREE.Vector3(...nav.layout.seatEye).applyQuaternion(nav.orientation));}
      ship.syncFlight?.(nav);ship.setDoor(nav.doorOpen);ship.update(dt);
      ship.updateDisplays(dt,nav,inventory,course);
      ship.updateCabin?.(nav,mining.store);
    }
    camera.updateMatrixWorld();sun.update(origin,camera,dt,elapsed,{atmosphereFraction:nav.flightEnvironment.atmosphereFraction});atmosphere.setSun(sun);
    if(destructionEffects.update(nav.destruction,origin,dt))playStellarDestruction(audio);
    ship.updateGear(dt,nav.gearDeployed,nav.gearProgress);utilityLights.update(nav,origin);
    ship.userData.reentryHeating.update({density:nav.flightEnvironment.density,velocity:nav.cabinFlight?nav.shipVelocity:nav.velocity,active:nav.mode==='flight'||nav.cabinFlight,reset:transiting},dt,camera);
    document.body.classList.toggle('crashed',nav.mode==='crashed');
    $('crash-panel').hidden=nav.mode!=='crashed';
    if(nav.crash)$('crash-impact').textContent=`${nav.crash.impactSpeed.toFixed(1)} m/s into ${nav.crash.surface==="ice"?"polar ice":nav.crash.surface==="water"?"water":"the ground"}`;
    if(crashEffects.update(nav.crash,origin,dt))playCrashSound(audio);
    flightEffects.update(dt,origin,{suspended:transiting||!nav.enabled||!nav.focused||Boolean(document.querySelector('dialog[open]'))});
    audio.update({powered:nav.powered,speed:nav.shipSpeed,altitude,mode:nav.cabinFlight?'flight':nav.mode,boost:!nav.cabinFlight&&nav.boost,airless:nav.body.airless,inHangar,doorMotion:station.doorsOpen>0&&station.doorsOpen<1?1:0},dt);
    renderer.info.reset();
    if(drawScene){atmosphere.render(scene,camera,origin,sunDirection,elapsed,nav.position.distanceTo(new THREE.Vector3(...SUN_DIRECTION).multiplyScalar(SUN_DISTANCE)));travelEffects.render(renderer,camera);}
    if(drawScene)renderedFrames++;frames++;frameAccumulator+=realDt;if(frameAccumulator>=2){fps=Math.round(frames/frameAccumulator);frames=0;frameAccumulator=0;}
    if(resolution.frame(realDt,firstReady&&drawScene&&nav.focused&&!transiting&&nav.enabled&&!document.querySelector('dialog[open]')))resizePending=true;
    if(time-lastHud>150)updateHud(time);
    if(!firstReady){
      preload.update({terrainReady:planet.ready,settled:planet.lodStats.settled,dt:realDt,resizing:resizePending});
      if(preload.error){stopGraphics(preload.error);return;}
      if(preload.ready){
        firstReady=true;nav.keys.clear();nav.physicalKeys.clear();nav.gamepad.suspend();nav.enabled=true;
        releaseLoadingKeys();
        $('loading-status').textContent='Ready to explore';$('loading-progress').value=preload.state.total;
        $('loading').classList.add('hidden');
        if(multiplayerEntry)multiplayerUI.openAccount();
      }
    }
    if(planet.error)stopGraphics(planet.error);
  }
  window.addEventListener('beforeunload',()=>{multiplayerUI.dispose();multiplayer.dispose();remotePlayers.dispose();},{once:true});
  requestAnimationFrame(frame);
  // Explicit read-only diagnostics plus navigational hooks for reproducible browser tests.
  window.starAgent={get state(){return {enabled:nav.enabled,focused:nav.focused,manufacturer:MERIDIAN.name,testFlight,kestrel:ship.snapshot?.()??null,kestrelAccess:nav.kestrelAccess?.snapshot??null,rockMaterial:rockTextureState(),sun:{distance:sun.distance,clearance:sun.distance-SUN_RADIUS,angularRadius:sun.angularRadius,sphereVisible:sun.sphere.visible,diskWeight:sun.diskWeight,visibility:sun.visibility},stellarThermal:{...nav.stellarThermal},multiplayer:{...multiplayer.state,remote:remotePlayers.state},preload:{...preload.state,orbitalResolution:planet.orbitalSurface.resolution,orbitalComplete:planet.orbitalSurface.complete},reentryHeat:ship.userData.reentryHeating.heat,crash:nav.crash?structuredClone(nav.crash):null,renderedFrames,graphics:graphicsSettings.state,utilities:{gearDeployed:nav.gearDeployed,gearProgress:ship.userData.gearProgress,gearAssemblies:ship.userData.gearAssemblies,...utilityLights.state},miasma:{...miasma.state,altitude:bodyAltitude(nav.position,MIASMA),surface:nav.body.id==='miasma'?miasmaSurface(...nav.normal.toArray()):null},pyre:{...pyre.state,altitude:bodyAltitude(nav.position,PYRE),ready:pyre.ready,epoch:PYRE_EPOCH,generatorVersion:PYRE_GENERATOR_VERSION,resources:nav.body.id==='pyre'?pyreResources(...nav.normal.toArray()):null,region:nav.body.id==='pyre'?pyreRegion(...nav.normal.toArray()):null},heat,terrainDetail:planet.detailStats,terrainLod:planet.lodStats,loadout:structuredClone(loadout.state),equippedMass:loadout.mass,effects:{...effects.state,...flightEffects.state,beamVisible:effects.beam.mesh.visible,bloom:atmosphere.bloom.enabled},shipMarker:shipMarker.state,fieldCache:mining.fieldCache.position.toArray(),containers:inventoryUI.state,eva:nav.evaState,rings:moon.rings.state,mining:{...mining.state,tool:miningTool.state},fleet:fleet.snapshot,shipId:nav.shipId,powered:nav.powered,cabinFlight:nav.cabinFlight,berthRest:nav.berthRest,berthTransition:Boolean(nav.berthTransition),nomadCargo:ship.cabinState?.(),landingGear:{progress:nav.gearProgress,target:nav.gearDeployed,visual:ship.userData.gearProgress},hardpoints:ship.userData.hardpoints??[],shipSpeed:nav.shipSpeed,shipVelocity:nav.shipVelocity.toArray(),shipPosition:nav.shipPosition?.toArray(),shipOrientation:nav.shipOrientation.toArray(),lifts:nav.freighter?.snapshot,opening:opening?.state??{phase:'skipped'},character:{ready:character.ready,visible:character.object.visible,state:character.state,position:character.worldPosition.toArray(),error:character.error},camera:{mode:nav.mode==='walk'?(shipCamera.active?'third-person':'first-person'):(shipCamera.active?'external':'cockpit'),shipVisible:ship.visible,selected:shipCamera.selected(nav.mode),obstructed:shipCamera.obstructed,position:origin.toArray(),fov:camera.fov},audio:{created:Boolean(audio.context),enabled:audio.enabled},travel:nav.travelState,travelTarget:nav.travelTarget,mapOpen:systemMap.open,tunnel:travelEffects.state,speedProfile:nav.speedProfile,moon:{resources:moonResources(...nav.position.clone().sub(moon.worldPosition).normalize().toArray()),resourceProvinces:RESOURCE_PROVINCES,effects:moon.effects,position:moon.worldPosition.toArray(),radius:MOON_RADIUS,altitude:bodyAltitude(nav.position,SELENE),patches:moon.terrain.visibleCount,lod:moon.terrain.maxLevel,distance:nav.position.distanceTo(moon.worldPosition)},controller:{id:nav.gamepad.id,connected:nav.gamepad.connected,active:nav.controllerActive,armed:nav.gamepad.armed,status:nav.gamepad.status},body:nav.body.id,seed:SEED,generatorVersion:GENERATOR_VERSION,position:nav.position.toArray(),altitude:nav.altitude,speed:nav.speed,mode:nav.mode,autoland:nav.autoland,flightAssist:nav.flightAssist,flightRegime:nav.flightEnvironment.regime,atmosphereFraction:nav.flightEnvironment.atmosphereFraction,velocity:nav.velocity.toArray(),angularVelocity:nav.angularVelocity.toArray(),groundHeight:nav.groundHeight,biome:nav.body.airless?'SELENE · AIRLESS MOON':biomeAt(...nav.normal.toArray()),sunDistance:nav.position.clone().sub(new THREE.Vector3(...SUN_DIRECTION).multiplyScalar(SUN_DISTANCE)).length(),patches:planet.visibleCount,lod:planet.maxVisibleLevel,pending:planet.pending,vegetation:vegetation.stats,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,ready:firstReady,transiting,fps,shipAsset:ship.userData.assetStatus,shipAssetError:ship.userData.assetError,storageOpen:ship.userData.storageOpen,storageProgress:ship.userData.storageProgress,inventory:inventory.snapshot,mfds:ship.displayState(),doorOpen:nav.doorOpen,doorProgress:nav.doorProgress,insideShip:nav.insideShip,station:{...station.snapshot,ready:station.ready,error:station.error,doorsOpen:station.doorsOpen,distance:nav.stationDistance,local:nav.stationLocal?.toArray(),deckClearance:nav.deckClearance,docked:nav.dockedAtStation,lifting:nav.stationLift,canDock:nav.canDock},shipLocal:nav.toShipLocal()?.toArray(),interaction:nav.interaction,renderScale:resolution.scale,renderResolution:resolution.state};},destinations,transit,land:()=>nav.landOrLaunch(),embark:()=>nav.embark(),setRenderScale(value){resolution.setScale(THREE.MathUtils.clamp(value,.4,1));resizePending=true;},get openingSequence(){return new URLSearchParams(location.search).has('debug')?opening:undefined;},get planet(){return import.meta.env.DEV||new URLSearchParams(location.search).has('debug')?planet:undefined;},get navigation(){return import.meta.env.DEV||new URLSearchParams(location.search).has('debug')?nav:undefined;},get miasmaSites(){return MIASMA_SITES;},get pyreSites(){return {landing:pyreLandingDirection(),volcanoes:VOLCANOES.map(v=>({name:v.name,height:v.height,active:v.active,direction:fromPyreBody(...v.direction)})),fields:LAVA_FIELDS.map(f=>({name:f.name,direction:fromPyreBody(...f.direction)}))};}};
}catch(error){console.error(error);fatal(`Could not start WebGL 2. Use a current desktop browser with hardware acceleration enabled. ${error.message}`);}
