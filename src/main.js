import {createHUDDisplay} from './hud-display.js';
import './hud-display.css';
import {createRoverBuildSupport} from './rover-build-support.js';
import {createGarageSystem} from './settlements/garage-system.js';
import { createSettlements } from './settlements/system.js';
import './model-cache.js';
import {createShipMining} from './ship-mining.js';
import {MINING_KEY} from './mining/store.js';
import {createShipMiningInput} from './ship-mining-input.js';
import {createMediumShip} from './medium-ships.js';
import {StratumGameplaySystems,GannetGameplaySystems,STRATUM_GAMEPLAY_LAYOUT,GANNET_GAMEPLAY_LAYOUT} from './medium-ship-gameplay.js';
import {isHandsFree} from './station-hub-policy.js';
import {StationDefense} from './station-security.js';
import { createTradingSystem } from './trading/system.js';
import {BasePower} from './build/power-system.js';
import {BaseCloud} from './build/cloud.js';
import { controllerHints } from './controller-hints.js';
import {createMiningRover} from './mining-rover.js';
import {createSentrySystem,sentryVehicleRouter} from './sentry/system.js';
import {createHostileFauna} from './fauna/hostile-fauna.js';
import {parkedShipHit} from './fauna/fauna-target.js';
import {samplePyrebearHabitat} from './fauna/pyrebear-habitat.js';
import {sampleSuloherHabitat} from './fauna/suloher-habitat.js';
import {AEON_AMPHIBIAN_QA} from './fauna/aeon-amphibian-habitat.js';
import {AEON_GRAZER_QA} from './fauna/aeon-grazer-habitat.js';
import {createSpaceCombat} from './combat/space-combat.js';
import { rockTextureState } from './rock-material.js';
import { Miasma } from './miasma.js';
import { MIASMA_POSITION, MIASMA_RADIUS, MIASMA_ATMOSPHERE, MIASMA_LIGHTING, MIASMA_ARRIVAL_ALTITUDE, MIASMA_SITES, miasmaSurface, miasmaArrivalDirection } from './miasma-world.js';
import { gearPrompt } from './gear-flight.js';
import { RenderResolution, fullscreenViewport } from './render-resolution.js';
import { createGraphicsSettings } from './graphics-settings.js';
import { createUtilityLights, installLandingGear } from './ship-utilities.js';
import { StartupPreload, blockStartupInput } from './startup-preload.js';
import { sandboxStorage, sandboxURL, prepareSandbox, refillSandbox, sandboxTotals, spawnInSandbox, SANDBOX_BINS } from './build/sandbox.js';
import { BuildSystem } from './build/system.js';
import { createBuildUI } from './build/ui.js';
import { createBuildObstacles } from './build/obstacles.js';
import { LandmarkRocks,createLandmarkObstacles } from './landmark-rocks.js';
import { flightDownwash } from './meadow.js';
import * as THREE from 'three';
import { WEAPONS } from './effects/weapons.js';
import { createFlightEffects } from './effects/flight-effects.js';
import { enginePresentation, updateShipEngineVisuals } from './effects/engine-state.js';
import { equipShipWeapons, armedShipLayout } from './ship-weapons.js';
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
import { createControllerLayout } from './controller-layout.js';
import { createGameplayMenu } from './gameplay-menu.js';
import { bindStationLedger } from './inventory/station-ledger.js';
import { Loadout } from './inventory/loadout.js';
import { createLoadoutBar } from './inventory/loadout-ui.js';
import { createMiningTool } from './mining/tool.js';
import { MOON_RADIUS, MOON_POSITION, MOON_LANDING_DIRECTION, moonRegion, moonResources, RESOURCE_PROVINCES } from './moon-world.js';
import { EnergyEffects } from './effects/energy-effects.js';
import { Atmosphere } from './atmosphere.js';
import { StationComplex } from './station-complex.js';
import { PLAYABLE_STATION_OPTIONS } from './station-fleet-hangar.js';
import { placeStationExteriorPreview } from './station-exterior.js';
import { createStationServices } from './station-services.js';
import { SELENE, PYRE, MIASMA, bodySurfacePoint, bodyAltitude } from './celestial.js';
import { Pyre, PYRE_MESH_RANGE } from './pyre.js';
import { PYRE_RADIUS, PYRE_POSITION, PYRE_ARRIVAL_ALTITUDE, pyreArrivalDirection, PYRE_ATMOSPHERE, PYRE_LIGHTING, PYRE_EPOCH, PYRE_GENERATOR_VERSION, VOLCANOES, LAVA_FIELDS, pyreLandingDirection, pyreLatLon, fromPyreBody, pyreRegion, pyreResources, pyreHeat } from './pyre-world.js';
import { SurfaceWeather } from './surface-weather.js';
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
import { PLAYER_AVATAR } from './player-avatar.js';
import { createWalkableShip } from './ship-walkable.js';
import { createShipPowerUI } from './ship-power-ui.js';
import { ShipInventory } from './ship-inventory.js';
import { createMediumShipInventory } from './medium-ship-inventory.js';
import { createInventoryUI } from './ship-inventory-ui.js';
import { Fleet, SHIPS } from './fleet.js';
import { createFleetUI } from './fleet-ui.js';
import { createFreighter } from './freighter.js';
import { FREIGHTER_LAYOUT, FreighterSystems } from './freighter-layout.js';
import { ATLAS_RAMP_CALLS } from './atlas-gameplay.js';
import { SHIP_LAYOUT, shipFloorAt } from './boarding.js';
import { KESTREL_LAYOUT, KestrelAccess } from './kestrel-access.js';
import { createKestrel } from './kestrel.js';
import kestrelURL from '../assets/kestrel/kestrel.glb?url';
import { testFlightStorage } from './test-flight.js';
import { flightEntryOptions, devLaunchURL, ATLAS_MEADOW_SEED } from './dev-launch-options.js';
import { createDevLauncher } from './dev-launcher.js';
import { MERIDIAN } from './ship-manufacturers.js';
import { createNavigationTargeting } from './navigation-targeting.js';
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

const {devOptions,atlasMeadowStart,testFlight,sandboxEnabled,introEnabled}=flightEntryOptions(location.search,import.meta.env.VITE_DEV_TOOLS==='1');
// Normalize a shared preset link before creating a renderer or generation workers.
if(atlasMeadowStart&&SEED!==ATLAS_MEADOW_SEED){
  location.replace(devLaunchURL(location.href,devOptions));
}else try {
  const multiplayerEntry=import.meta.env.VITE_MULTIPLAYER_ENTRY==='1';
  const surfaceRoverStart=devOptions?.location==='rover-surface';
  const sentryStart=devOptions?.location==='sentry-surface';
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
  const surfaceWeather=new SurfaceWeather(scene,atmosphere,{enabled:new URLSearchParams(location.search).get('weather')!=='0'});
  function enterPlayerInterface(){
    if(document.body.classList.contains('player-active'))return;
    document.body.classList.add('player-active');
    for(const element of document.querySelectorAll('.topbar,.mission-panel,.statusbar'))element.inert=true;
  }
  nav.onTakeControl=enterPlayerInterface;
  const station=new StationComplex(scene,{...(introEnabled?openingStationOptions():{}),...PLAYABLE_STATION_OPTIONS});nav.station=station;station.nav=nav;
  const stationDefense=new StationDefense(scene,station);
  stationDefense.readyPromise.catch(error=>{console.error(error);notify("Station defense model unavailable.");});
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
  const character=new Character(scene,{...PLAYER_AVATAR,eyeHeight:SHIP_LAYOUT.eyeHeight});
  character.setVisible(false);
  const remotePlayers=new RemotePlayers(scene),multiplayer=new MultiplayerClient();
  multiplayer.attach({nav,station,remotePlayers});
  let localInventoryStorage;try{localInventoryStorage=testFlight&&!sandboxEnabled?testFlightStorage(devOptions&&!atlasMeadowStart&&new URLSearchParams(location.search).get('cargo-test')==='1'?(window.__starAgentCargoTestSeed??[]):[]):window.localStorage;}catch{}
  if(sandboxEnabled)localInventoryStorage=sandboxStorage(localInventoryStorage);
  const fleet=new Fleet(localInventoryStorage),freighterSystems=new FreighterSystems();
  const mediumSystems={stratum:new StratumGameplaySystems(),gannet:new GannetGameplaySystems()};
  let rover=null;
  if(devOptions){fleet.active=devOptions.ship;fleet.unlocked=true;fleet.surfaceVisited=true;}
  else if(testFlight)fleet.active='kestrel';
  nav.testFlight=testFlight;
  const layoutFor=id=>armedShipLayout(id==='stratum'?STRATUM_GAMEPLAY_LAYOUT:id==='gannet'?GANNET_GAMEPLAY_LAYOUT:id==='kestrel'?KESTREL_LAYOUT:id==='atlas'?FREIGHTER_LAYOUT:SHIP_LAYOUT,shipModels.get(id)?.armament);
  function configureShip(id){
    if(id==='atlas'&&nav.freighter!==freighterSystems)freighterSystems.reset({gearProgress:nav.gearProgress});
    nav.shipId=id;nav.layout=layoutFor(id);nav.freighter=mediumSystems[id]??(id==='atlas'?freighterSystems:null);
    if(mediumSystems[id])mediumSystems[id].reset({gearProgress:nav.gearProgress});
    rover?.bindCarrier();
    nav.kestrelAccess=id==='kestrel'?new KestrelAccess():null;
    shipMarker.setShip({shipName:SHIPS[id].name,entryLocal:new THREE.Vector3(...(mediumSystems[id]?mediumSystems[id].entry:id==='kestrel'?KESTREL_LAYOUT.entryEye:id==='atlas'?ATLAS_RAMP_CALLS.find(r=>r.id==='front').approach:[0,shipFloorAt(0,6,true)+SHIP_LAYOUT.eyeHeight,6])),accessLabel:mediumSystems[id]?.accessLabel??(id==='kestrel'?'PORT LADDER':id==='atlas'?'FORWARD RAMP':'REAR RAMP')});
  }
  const shipModels=new Map();
  function modelFor(id){
    if(!shipModels.has(id)){
      const model=mediumSystems[id]?createMediumShip(id,mediumSystems[id]):id==='kestrel'?createKestrel({url:kestrelURL,flight:true}):id==='atlas'?createFreighter(freighterSystems):createWalkableShip();
      if(!mediumSystems[id])equipShipWeapons(model,id);
      model.readyPromise.then(()=>{if(nav.shipId===id)nav.layout=layoutFor(id);},()=>{});
      if(!model.updateGear)installLandingGear(model);model.visible=false;scene.add(model);
      if(id!=='kestrel'&&!mediumSystems[id]){weatherShip(model,planet.surfaceTexture);model.readyPromise.then(asset=>{if(asset)weatherShip(asset,planet.surfaceTexture);});}
      const heating=new ReentryHeating(model);model.userData.reentryHeating=heating;
      model.readyPromise.then(()=>heating.refresh(),()=>{});
      shipModels.set(id,model);
    }
    return shipModels.get(id);
  }
  let ship=modelFor(fleet.active);
  configureShip(fleet.active);
  const opening=introEnabled&&fleet.active!=='kestrel'?new OpeningSequence({scene,nav,station,character,onGesture:()=>{
    unlockAudio();
  }}):null;
  if(opening)Promise.all([station.readyPromise,ship.readyPromise,opening.character.readyPromise]).then(()=>{opening.start();nav.enabled=false;}).catch(error=>{
    opening.fail();nav.enabled=false;notify('Opening unavailable. Starting in orbit.');console.warn('Opening fallback:',error);
  });
  const inventory=new ShipInventory(localInventoryStorage,SHIPS[fleet.active].capacity||120);
  const mining=new MiningField(scene,localInventoryStorage,moon.rings);nav.surfaceObstacles=mining;
  const mediumInventory=createMediumShipInventory(mining.store,inventory);
  // Read the actual committed adapter bytes only on an explicit diagnostic view.
  // Practice flights intentionally use an isolated in-memory save.
  function miningSaveSnapshot(){
    if(!import.meta.env.DEV&&!new URLSearchParams(location.search).has('debug'))return undefined;
    const kind=sandboxEnabled?'sandbox-storage':testFlight?'practice-memory':'browser-local';
    try{return {kind,key:MINING_KEY,value:localInventoryStorage?.getItem(MINING_KEY)??null};}
    catch(error){return {kind,key:MINING_KEY,value:null,error:error.message};}
  }
  const effects=new EnergyEffects(scene,{onSound:event=>audio.gameplay?.event(event,nav),capacity:1024,reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches});
  const loadout=new Loadout(mining.store);
  const fauna=createHostileFauna({scene,nav,loadout,seed:SEED,online:()=>multiplayer.connected,onSound:event=>audio.gameplay?.event(event,nav)});
  nav.faunaRaycast=fauna.raycast;nav.onFaunaWeaponHit=fauna.weaponHit;
  nav.parkedShipRaycast=(start,direction,range)=>nav.mode==='walk'||nav.mode==='eva'?parkedShipHit(nav,start,direction,range):null;
  const miningTool=createMiningTool({scene,camera,canvas,nav,rock:mining,effects,loadout,character,thirdPerson:()=>shipCamera.active,getBuild:()=>build});
  // Vehicle-bin feedback stays at the cut; backpack pickups can approach the suit.
  // Use the committed job's destination, even if the player has changed seats.
  mining.onExtract=({point,yields,normal,destination='pack'})=>effects.collect(point,yields,normal,{attract:destination==='pack'});
  const resetMiningEffects=()=>{effects.miningInput=null;effects.reset();};
  window.addEventListener('blur',resetMiningEffects);
  document.addEventListener('visibilitychange',resetMiningEffects);
  $('mining-reduced-motion').checked=effects.reducedMotion;
  $('mining-reduced-motion').addEventListener('change',()=>{effects.reducedMotion=$('mining-reduced-motion').checked;resetMiningEffects();});
  $('mining-bloom').addEventListener('change',()=>atmosphere.bloom.enabled=$('mining-bloom').checked);
  if(sandboxEnabled){const result=prepareSandbox(mining.store);if(!result.ok)throw Error(result.message);}
  const sandbox=sandboxEnabled?{totals:()=>sandboxTotals(mining.store),refill:()=>refillSandbox(mining.store)}:null;
  const build=new BuildSystem({scene,nav,store:mining.store,supplySources:()=>sandboxEnabled?SANDBOX_BINS.map(b=>b.id):[]});
  const settlements=createSettlements({scene,nav,enabled:()=>!sandboxEnabled});
  build.protectedClaims=()=>settlements.claims;
  if(sandboxEnabled)spawnInSandbox(nav,build);
  const inventoryUI=createInventoryUI(nav,()=>ship,inventory,mining.store,{loadout,canClaimStarter:()=>!build.blocked&&nav.shipId!=='kestrel'});
  const basePower=new BasePower({store:mining.store,build,sandbox:sandboxEnabled});build.power=basePower;
  const baseCloud=new BaseCloud({store:mining.store,build,power:basePower,sandbox:sandboxEnabled});void baseCloud.restore();
  const buildUI=createBuildUI({nav,build,store:mining.store,sandbox,onSandbox:()=>location.assign(sandboxURL(location.href)),onOpenStorage:id=>inventoryUI.openStorage(id)});
  build.onRegisterContainer=definition=>inventoryUI.registerContainer(definition);
  build.onSound=event=>audio.gameplay?.event(event,nav);
  build.onMainframe=claim=>buildUI.openMainframe(claim);
  build.onOpenStorage=id=>inventoryUI.openStorage(id);
  if(sandboxEnabled)for(const bin of SANDBOX_BINS)inventoryUI.registerContainer({id:bin.id,name:mining.store.container(bin.id).name,kind:'base',boxes:8,available:()=>true});
  const landmarks=new LandmarkRocks(scene,{clearings:[...build.claims,...settlements.claims].filter(c=>c.body==='aeon').map(c=>({position:c.origin,radius:c.radius}))});mining.landmarks=landmarks;
  landmarks.useClearings=()=>!nav.multiplayer?.connected;
  nav.surfaceObstacles=createLandmarkObstacles(createBuildObstacles(createBuildObstacles(mining,build),settlements),landmarks,nav);
  nav.baseAction=()=>build.interact();nav.baseInteraction=()=>build.interaction;
  nav.baseLandingSurface=pose=>build.landingSurface(pose)??settlements.landingSurface(pose);
  nav.baseLandingRevision=()=>build.store.state.build;
  nav.buildingRaycast=(...args)=>[build.raycast(...args),settlements.raycast(...args)].filter(Boolean).sort((a,b)=>a.distance-b.distance)[0]??null;
  const roverConstruction=createRoverBuildSupport({claims:()=>[...build.claims,...settlements.claims],doorFraction:(claim,piece)=>build.claims.includes(claim)?build.doorFraction(piece,claim):piece.doorOpen});
  const roverTerrainObstacles=createLandmarkObstacles(mining,landmarks,nav);
  const sentry=createSentrySystem({scene,canvas,nav,mining,effects,inventoryUI,multiplayer,enabled:sentryStart});
  const vehicleRouter=sentryVehicleRouter(sentry,()=>rover);nav.vehicle=vehicleRouter;nav.sentryNetworkInput=input=>sentry.networkInput(input);
  const ensureRover=()=>{if(!rover)rover=createMiningRover({scene,canvas,nav,mining,effects,inventoryUI,getShip:()=>ship,available:()=>!multiplayer.connected,construction:roverConstruction,terrainObstacles:roverTerrainObstacles});nav.vehicle=vehicleRouter;rover.bindCarrier();return rover;};
  if(surfaceRoverStart||atlasMeadowStart||fleet.active==='gannet'||(devOptions?.ship==='atlas'&&new URLSearchParams(location.search).get('rover')==='1'))ensureRover();
  const garages=createGarageSystem({scene,nav,settlements,ensureRover,getRover:()=>rover});
  nav.baseAction=()=>garages.interact()||build.interact();nav.baseInteraction=()=>garages.interaction||build.interaction;
  const ensureMediumStorage=id=>id!=='stratum'||inventoryUI.registerContainer({id:'stratum-ore',name:'Stratum dedicated ore bin',kind:'ship',boxes:8,available:()=>nav.shipId==='stratum'&&!multiplayer.connected&&(nav.insideShip||['flight','landed'].includes(nav.mode)||nav.shipPosition&&nav.position.distanceTo(nav.shipPosition)<50)});
  ensureMediumStorage(fleet.active);nav.openShipStorage=id=>inventoryUI.openStorage(id);
  const useQuick=index=>{const result=loadout.useQuick(index);nav.notify(result.message);};
  const loadoutBar=createLoadoutBar({loadout,nav,onSelect:id=>{if(build.active)build.cancel();miningTool.select(id);},onUse:useQuick,open:()=>inventoryUI.openEquipment()});
  document.addEventListener('keydown',e=>{if(e.repeat||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||document.querySelector('dialog[open]'))return;if(e.code==='KeyK'){e.preventDefault();inventoryUI.openEquipment();}else if(!build.active&&nav.enabled&&nav.focused&&['walk','eva'].includes(nav.mode)&&/^Digit[5-8]$/.test(e.code))useQuick(Number(e.code.slice(5))-5);});
  const shipMining=createShipMining({scene,nav,mining,getShip:()=>ship,effects,context:()=>({online:multiplayer.connected,blocked:transiting,inputContext:`${nav.gamepad.id}:${nav.gamepad.connected}:${nav.gamepad.status}`})});
  const shipMiningInput=createShipMiningInput({nav,canvas,mining,cutter:shipMining,inventoryUI});
  const combat=createSpaceCombat({scene,nav,camera,effects,mining});
  nav.openPatrolConsole=()=>combat.open();
  const flightEffects=createFlightEffects({effects,nav,mining,camera,getShip:()=>ship,onFire:(...args)=>{if(combat.state.phase!=='engage')return false;combat.fire(...args);return true;}});
  inventoryUI.registerContainer?.({id:'crescent-cache',name:'Crescent field cache',kind:'base',boxes:2,available:()=>nav.mode==='walk'&&!nav.insideShip&&nav.position.distanceTo(mining.fieldCache.position)<4});
  bindStationLedger(inventory,mining.store);
  const trading=createTradingSystem({scene,nav,station,store:mining.store,multiplayer,getShip:()=>ship,build,settlements,mining,remotePlayers,getMuzzle:()=>miningTool.equipment.muzzleWorldPosition()});
  if(mediumSystems[fleet.active]&&!trading.registerHull(fleet.active))notify(mining.store.warning||'Ship cargo registration unavailable.');
  if(testFlight&&fleet.active==='kestrel')inventory.transferAll('ship','station');
  const shipCargoLoaded=()=>Object.values(mining.store.container('ship')?.items??{}).some(quantity=>quantity>0);
  if(fleet.active==='kestrel'&&shipCargoLoaded()){
    // Inconsistent/older saves retain every item and load a hull with storage.
    ship.visible=false;fleet.active='nomad';ship=modelFor('nomad');configureShip('nomad');
  }
  inventory.capacity.ship=SHIPS[fleet.active].capacity;
  if(fleet.active!=='kestrel'&&!build.blocked&&!mining.store.blocked)mining.store.claimStarterConstruction();
  function parkShip(id){
    const layout=layoutFor(id),b=station.interiorBox,centre=b.getCenter(new THREE.Vector3());centre.y=b.min.y;
    centre.x-=(layout.flightBounds.min[0]+layout.flightBounds.max[0])/2;centre.z-=(layout.flightBounds.min[2]+layout.flightBounds.max[2])/2;
    configureShip(id);nav.shipPosition=station.toWorld(centre,centre);nav.shipOrientation.copy(station.quaternion);nav.orientation.copy(station.quaternion);
    nav.position.copy(nav.fromShipLocal(new THREE.Vector3(...layout.seatEye)));nav.velocity.set(0,0,0);nav.angularVelocity.set(0,0,0);
    nav.mode='landed';nav.dockedAtStation=true;nav.stationLift=false;nav.autoland=false;nav.gearDeployed=true;nav.gearProgress=1;
    nav.doorOpen=false;nav.doorProgress=0;nav.insideShip=true;nav.jumpHeight=0;nav.jumpVelocity=0;nav.resetCabinFlight();
  }
  // The opening owns the walking spawn; a later practice setup must not reseat it.
  const testFlightReady=testFlight&&!sandboxEnabled&&!opening?Promise.all([station.readyPromise,ship.readyPromise]).then(()=>{
    if(!station.ready)throw new Error('Test-flight hangar unavailable.');
    parkShip(fleet.active);
    if(devOptions)return;
    const launch=document.createElement('section');launch.className='kestrel-launch-card';launch.setAttribute('aria-labelledby','kestrel-launch-title');
    launch.innerHTML=`<img src="${MERIDIAN.emblemURL}" alt="Meridian Shipworks"><span>MERIDIAN SHIPWORKS / FLIGHT TRIAL</span><h2 id="kestrel-launch-title">Kestrel.</h2><p>One seat. Open sky.</p><dl><dt>B</dt><dd>Launch / land</dd><dt>W / S</dt><dd>Thrust / reverse</dd><dt>G</dt><dd>Landing gear</dd><dt>4</dt><dd>Exterior camera</dd><dt>F</dt><dd>Port ladder when landed</dd></dl><button id="kestrel-begin">Fly Kestrel ↗</button><small>Temporary flight · regular save unchanged<br>Four S2 mounts · energy array online</small>`;
    document.body.append(launch);launch.querySelector('button').addEventListener('click',capture);
  }):Promise.resolve();
  createStationServices(nav,station,inventory,{loadout,online:()=>multiplayer.connected,request:fields=>multiplayer.request('stationHub',fields)});
  nav.onVoyage=event=>{if(event==='dock')station.parkedPod=station.activeIndex;if(fleet.record(event))notify('Atlas unlocked! Open Fleet (U) while seated at the station to board your freighter.');};
  let selectingShip=false;
  const fleetUI=createFleetUI(nav,fleet,async id=>{
    if(selectingShip)return 'Ship preparation in progress.';
    if(multiplayer.connected&&mediumSystems[id])return 'The medium ships are available in solo play while multiplayer integration is pending.';
    if(rover?.state.aboard&&id!==nav.shipId)return 'Unload the Burrow before changing carriers.';
    if(!fleet.allows(id)||!SHIPS[id])return 'This ship is locked.';
    if(nav.mode!=='landed'||!nav.dockedAtStation)return 'Dock at Aeon Orbital before switching ships.';
    if(inventory.mass('ship')>SHIPS[id].capacity)return 'Too much cargo for this ship. Transfer supplies before switching.';
    if(id==='kestrel'&&shipCargoLoaded())return 'Kestrel has no cargo hold. Unload all ship cargo before switching.';
    selectingShip=true;let selected=false;
    try{
      const next=modelFor(id);await next.readyPromise;
      if(id==='gannet'){
        const vehicle=ensureRover();await vehicle.readyPromise;
        if(!vehicle.state.ready)throw new Error('Burrow model unavailable. Reload to retry loading it');
      }
      if(nav.mode!=='landed'||!nav.dockedAtStation)return 'Ship selection cancelled: you left the station pad.';
      if(inventory.mass('ship')>SHIPS[id].capacity||id==='kestrel'&&shipCargoLoaded())return 'Cargo changed during preparation. Unload before switching to Kestrel.';
      // Hangar services replace the parked ship at the pad centre, aligned with the bay.
      const layout=layoutFor(id),b=station.interiorBox;
      const centre=b.getCenter(new THREE.Vector3());centre.y=b.min.y;
      const orientation=station.quaternion.clone();
      const bounds=layout.flightBounds;
      if(bounds.max[0]-bounds.min[0]>b.max.x-b.min.x-2||bounds.max[2]-bounds.min[2]>b.max.z-b.min.z-2||bounds.max[1]>b.max.y-b.min.y-1)return 'This hangar cannot accommodate the selected ship.';
      centre.x-=(bounds.min[0]+bounds.max[0])/2;centre.z-=(bounds.min[2]+bounds.max[2])/2;
      if(mediumSystems[id]&&(!ensureMediumStorage(id)||!trading.registerHull(id)))return mining.store.warning||'Ship cargo save unavailable.';
      ship.visible=false;ship=next;configureShip(id);
      nav.shipPosition=station.toWorld(centre,centre);nav.shipOrientation.copy(orientation);nav.orientation.copy(orientation);
      nav.position.copy(nav.fromShipLocal(new THREE.Vector3(...layout.seatEye)));nav.velocity.set(0,0,0);nav.angularVelocity.set(0,0,0);
      nav.doorOpen=false;nav.doorProgress=0;nav.insideShip=true;nav.jumpHeight=0;nav.jumpVelocity=0;
      if(layout.gear){nav.gearProgress=1;nav.gearDeployed=true;}
      inventory.capacity.ship=SHIPS[id].capacity;fleet.active=id;fleet.record('selection');
      nav.gearDeployed=true;nav.gearProgress=1;
      selected=true;
      if(id==='gannet'&&!rover.state.spawned&&!await rover.spawn())return 'Gannet selected, but the Burrow could not be placed. Clear the vehicle bay, switch to another ship, then select Gannet to retry.';
      return `${SHIPS[id].name} ready. Close Fleet, then ${id==='kestrel'?'B to launch or F to descend the port ladder':'F to stand and explore'}.`;
    }catch(error){
      if(selected)return `${SHIPS[id].name} selected, but the Burrow could not be placed: ${error.message}. Switch to another ship, then select Gannet to retry.`;
      const failed=shipModels.get(id);if(failed!==ship&&failed?.userData.assetStatus==='error'){failed.removeFromParent();failed.dispose();shipModels.delete(id);}
      return `Ship unavailable: ${error.message}. Your current ship remains selected.`;
    }finally{selectingShip=false;}
  });
  let onlineHullPending=null;
  multiplayer.subscribe(state=>{if(!state.connected)return;const hull=state.players.find(p=>p.id===state.ownId)?.shipId;if(!['nomad','atlas'].includes(hull)||shipModels.get(hull)===ship||onlineHullPending===hull)return;onlineHullPending=hull;const next=modelFor(hull);next.readyPromise.then(()=>{if(multiplayer.connected&&onlineHullPending===hull){ship.visible=false;ship=next;configureShip(hull);}onlineHullPending=null;});});
  const multiplayerUI=createMultiplayerUI({nav,client:multiplayer,onJoin:async account=>{
    if(SEED!==WORLD_SEED){const url=new URL(location.href);url.searchParams.set('seed',String(WORLD_SEED));location.replace(url);throw new Error('Reloading the shared world seed. Join again after reload.');}
    await Promise.all([station.readyPromise,character.readyPromise,opening?.character?.readyPromise]);opening?.leave();build.cancel();
    const nomad=modelFor('nomad');await nomad.readyPromise;
    if(ship!==nomad){ship.visible=false;ship=nomad;}configureShip('nomad');
    const state=await multiplayer.connect(account),self=state.players.find(player=>player.id===state.ownId);
    if(self)await applySuitColor(character,SUIT_COLORS[self.colorIndex]??SUIT_COLORS[0]);
    if(opening&&self){
      const joinedShip=modelFor(self.shipId);await joinedShip.readyPromise;
      if(ship!==joinedShip){ship.visible=false;ship=joinedShip;configureShip(self.shipId);}
      opening.start({authoritative:true});
    }
    enterPlayerInterface();return state;
  },onLeave:async()=>{multiplayer.disconnect();location.reload();}});
  nav.openComms=multiplayerUI.openComms;
  const localOpenPack=()=>inventoryUI.openPack(),localOpenEquipment=()=>inventoryUI.openEquipment();
  nav.openInventory=()=>multiplayer.connected?multiplayerUI.openInventory():inventoryUI.openContainer?.('ship');
  const localItemGetter=Object.getOwnPropertyDescriptor(Object.getPrototypeOf(loadout),'item').get;
  const localAmmoFor=loadout.ammoFor.bind(loadout),localSpendRound=loadout.spendRound.bind(loadout),localMine=mining.onMine.bind(mining);
  let localSuitColor=-1,serverWeapon=null;
  Object.defineProperty(loadout,'item',{configurable:true,get:()=>!loadout.canSelect()?null:multiplayer.connected?serverWeapon:localItemGetter.call(loadout)});
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
    if(event.event==='stationStrike'){
      if(stationDefense.strike(event))effects.impact(new THREE.Vector3(...event.target),new THREE.Vector3(...event.direction).negate(),5,{color:0x80ffe1,kind:'laser'});
    }
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
  const navigationTargets=createNavigationTargeting({nav,camera,destinations,station,build,multiplayer,combat});
  const systemMap=createSystemMap(nav,navigationTargets);
  function setCourse(name){
    const navigationId=({moon:'selene',station:'station-aeon',coast:'site-coast',forest:'site-forest',mountain:'site-mountain',polar:'site-polar'})[name]??name;
    if(navigationTargets.targets().some(t=>t.id===navigationId)){course=null;$('course-guidance').hidden=true;navigationTargets.select(navigationId);return;}

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
    {label:'Loading the station',promise:Promise.all([station.readyPromise,stationDefense.readyPromise])},
    {label:'Preparing your ship',promise:ship.readyPromise},
    ...(rover?[{label:'Preparing the Burrow rover',promise:rover.readyPromise}]:[]),
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
  let elapsed=0,last=null,lastHud=0,frames=0,fps=0,frameAccumulator=0,firstReady=false,transiting=false;
  document.addEventListener('visibilitychange',()=>{last=null;refreshAudioSuspension();});
  window.addEventListener('blur',()=>audio.setSuspended(true));
  window.addEventListener('focus',()=>refreshAudioSuspension());
  window.addEventListener('pagehide',event=>{if(event.persisted)audio.setSuspended(true);else audio.dispose();});
  window.addEventListener('pageshow',()=>refreshAudioSuspension());
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
    if(!Number.isFinite(event?.clientX)||!Number.isFinite(event?.clientY))return false;
    if(!nav.powered||!['flight','landed'].includes(nav.mode)||document.querySelector('dialog[open]'))return false;
    const bounds=canvas.getBoundingClientRect();mfdPointer.set((event.clientX-bounds.left)/bounds.width*2-1,-(event.clientY-bounds.top)/bounds.height*2+1);
    scene.updateMatrixWorld(true);mfdRaycaster.setFromCamera(mfdPointer,camera);
    for(const hit of mfdRaycaster.intersectObject(ship,true)){let target=hit.object;while(target&&target!==ship&&!target.userData.action)target=target.parent;if(target?.userData.action){target.userData.action();return true;}}
    return false;
  }
  function capture(event){
    if(activateMFD(event)||transiting||!nav.enabled||opening?.active)return;
    enterPlayerInterface();
    // A short touch drag can also produce a click. Mouse capture would then
    // lock out the canvas touch-look path until the player releases that lock.
    if(event?.pointerType!=='touch'&&!event?.sourceCapabilities?.firesTouchEvents)nav.capture();
  }
  canvas.addEventListener('click',capture);$('begin-button').addEventListener('click',capture);
  // Touch and pointer-lock fallback share the same look path. The canvas owns
  // this gesture; cancelling it must not leave a drag alive behind a dialog.
  let drag = null;
  const canDrag = () => nav.enabled && nav.focused && !document.hidden && !nav.locked && !opening?.active && !document.querySelector('dialog[open]');
  const stopDrag = () => { drag = null; };
  canvas.addEventListener('pointerdown',e=>{
    if(e.button!==0 || drag || !canDrag())return;
    nav.onTakeControl?.();nav.controllerActive=false;
    drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,e=>{if(drag?.id===e.pointerId)stopDrag();});
  window.addEventListener('blur',stopDrag);document.addEventListener('visibilitychange',stopDrag);document.addEventListener('pointerlockchange',stopDrag);
  new MutationObserver(records=>{if(records.some(record=>record.target.localName==='dialog'))stopDrag();}).observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});
  canvas.addEventListener('pointermove',e=>{
    if(drag?.id!==e.pointerId)return;
    if(!canDrag()){stopDrag();return;}
    const yaw=-(e.clientX-drag.x)*.002,pitch=-(e.clientY-drag.y)*.002;
    drag.x=e.clientX;drag.y=e.clientY;multiplayer.captureLook(yaw,pitch);nav.look(yaw,pitch);
  });
  const help=$('help-dialog');
  function openHelp(){if(!nav.enabled||nav.mode==='destroyed'||transiting||opening?.active||inventoryUI.open||fleetUI.open||document.querySelector("#station-cargo-dialog[open],#station-elevator-dialog[open],#station-shop-dialog[open]")||systemMap.open)return;if(document.pointerLockElement)document.exitPointerLock();nav.keys.clear();nav.enabled=false;shipPowerUI.update();help.showModal();}
  function closeHelp(){help.close();nav.enabled=!transiting;}
  $('help-button').addEventListener('click',openHelp);$('close-help').addEventListener('click',closeHelp);help.addEventListener('close',()=>{
    $('quick-transit-menu').open=false;
    nav.enabled=!transiting&&!document.querySelector('dialog[open]');
    if(nav.enabled)canvas.focus({preventScroll:true});
  });
  $('map-button').addEventListener('click',()=>{closeHelp();systemMap.openMap();});
  $('help-fly').addEventListener('click',event=>{closeHelp();capture(event);});
  $('sound-button').addEventListener('click',toggleAudio);
  const hudDisplay=createHUDDisplay({body:document.body,canvas,canChange:()=>firstReady&&nav.enabled&&nav.focused&&!opening?.active&&!transiting&&!document.querySelector('dialog[open]')});
  $('photo-button').addEventListener('click',closeHelp);hudDisplay.bind($('photo-button'));
  document.addEventListener('keydown',e=>{if(opening?.active||e.repeat||inventoryUI.open||fleetUI.open||(document.querySelector('dialog[open]')&&!help.open)||systemMap.open)return;if(e.code==='KeyH'){help.open?closeHelp():openHelp();}if(e.code==='KeyO'&&!help.open)transit('orbit');});
  function toggleCamera(){
    if(nav.berthRest||nav.berthTransition)return;
    if(opening?.active||transiting||!nav.enabled||inventoryUI.open||document.querySelector('dialog[open]'))return;
    if(!shipCamera.toggle(nav.mode))return;
    if(rover?.occupied){notify(shipCamera.playerExternal?'Burrow chase camera. 4 returns to its cockpit.':'Burrow cockpit. 4 opens its chase camera.');return;}
    if(nav.mode==='walk'||nav.mode==='eva'){notify(shipCamera.playerExternal?'Third-person view. 4 returns to first person.':'First-person view. 4 shows your character.');return;}
    notify(shipCamera.external?'External ship view. Flight controls unchanged; 4 returns to cockpit.':'Cockpit view. 4 shows the ship.');
  }
  $('camera-button').addEventListener('click',toggleCamera);
  document.addEventListener('keydown',event=>{if(isShipCameraKey(event)){event.preventDefault();toggleCamera();}});
  async function transit(name){
    if(rover?.occupied||rover?.busy){notify('Leave the rover cabin before using quick transit.');return;}
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
    else if(name==='pyre'||name==='pyre-surface'){nav.transitPyre(name==='pyre-surface'?180:undefined);pyre.terrain.prewarm(pyreLandingDirection(),9);}
    else if(name==='pyrebear-habitat'){const site=samplePyrebearHabitat(pyreLatLon(5,90));const direction=fromPyreBody(...site.bodyDirection);nav.transitPyre(35,direction);pyre.terrain.prewarm(direction,9);}
    else if(name==='suloher-habitat'){const site=sampleSuloherHabitat([1,0,0]);nav.transitMiasma(35,site.bodyDirection);}
    else if(name==='amphibian-habitat')nav.transit(AEON_AMPHIBIAN_QA.direction,35);
    else if(name==='grazer-habitat')nav.transit(AEON_GRAZER_QA.direction,35);
    else if(name==='miasma-surface')nav.transitMiasma(180);
    else if(name==='station'){const target=station.transitParams(180,6);nav.transit(target.direction,target.altitude);nav.orientToward(target.lookAt,target.up);}
    else if(name.startsWith('settlement-'))settlements.approach(name);
    else if(name==='orbit')nav.orbit();else nav.transit(destinations[name],name==='mountain'?700:name==='polar'?90:95);
    for(const b of document.querySelectorAll('.destination'))b.classList.toggle('active',b===button);
    // This optional shortcut conceals its teleport while streamed terrain catches up.
    planet.cameraWorld.copy(nav.position);planet.select();
    const started=performance.now();
    const limit=name.startsWith('pyre')||(name.startsWith('miasma')||name==='suloher-habitat')?12000:6500;
    while(performance.now()-started<limit){await new Promise(r=>setTimeout(r,150));if(performance.now()-started>1100 && planet.pending<4 && (name==='moon'||resourceRoute?moon.terrain.maxLevel>=14:name.startsWith('pyre')?pyre.ready:(name.startsWith('miasma')||name==='suloher-habitat')?miasma.ready:name==='star'||name==='orbit'||name==='station'||name==='ring'||planet.maxVisibleLevel>=12))break;}
    $('transit').classList.remove('active');transiting=false;nav.enabled=true;
    notify(name==='amphibian-habitat'?'Tideback beach · Y / B lands · X / F leaves the seat. Tidebacks defend themselves if attacked.':name==='grazer-habitat'?'Mallow grassland · Y / B lands · X / F leaves the seat. These large grazers are peaceful.':name.endsWith('-habitat')?'Wildlife habitat · Y / B lands · X / F leaves the seat. On foot: RT / T fires · D-pad left selects weapon.':name==='pyre-surface'?'Pyre surface test. B / Y lands; F / X leaves the seat.':name==='miasma-surface'?'Miasma surface test. B / Y lands; F / X leaves the seat.':name==='star'?'Stellar observation point: 500,000 km above the photosphere. Space + Shift retreats; watch shield temperature.':resourceRoute?`${resourceRoute.label}. B / Y lands. The marked outcrop shares this region's minerals; the terrain itself cannot be excavated.`:name==='ring'?'Ring survey. Brake to a stop, F leaves the chair; open the hatch and walk outside. G activates suit thrusters.':name==='moon'?'Selene descent. B lands; F leaves the chair. Open the rear hatch and walk down the ramp to explore.':name==='miasma'?'Miasma: sulphur clouds, mineral basins and toxic air. Descend to land; surface exploration uses your sealed suit.':name==='pyre'?`Pyre, ${PYRE_ARRIVAL_ALTITUDE/1000} km above the twilight line. Sunlight left, glowing night side right; Miasma above the dark limb. Descend to explore.`:name==='station'?'Station approach. W enters the bay; X brakes. Over the central pad, B docks.':name==='orbit'?'High orbit. Click to fly. W approaches Aeon; Space moves away.':'Arrival complete. Click to fly · B lands · F leaves the pilot chair.');
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
  const devLauncher=devOptions?createDevLauncher({nav,options:devOptions,seed:SEED,available:()=>!transiting&&!multiplayer.connected}):null;
  const controllerLayout=createControllerLayout({nav});
  const controllerUI=createControllerUI({nav,canOpenBuild:()=>build.controllerAvailable,openBuild:()=>multiplayer.connected?notify('Construction is available in offline testing.'):buildUI.open(),openRecipes:()=>multiplayer.connected?notify('Field recipes use the offline inventory.'):buildUI.openRecipes(),buildActive:()=>build.active,handleBuild:pad=>buildUI.handleController(pad),actions:[{id:'sentry-deploy',label:'Deploy Burrow Sentry',activate:()=>sentry.deploy(),enabled:()=>sentry.state.canDeploy},{id:'combat-mode',label:'Combat / cruise mode · Z',activate:()=>nav.toggleCombatMode(),enabled:()=>nav.mode==='flight'&&!nav.travel},{id:'build-sandbox',label:sandboxEnabled?'Sandbox supplies / refill':'Open build sandbox',activate:()=>sandboxEnabled?buildUI.openSandbox():location.assign(sandboxURL(location.href)),enabled:()=>!multiplayer.connected},...(sandboxEnabled?[{id:'sandbox-exit',label:'Return to regular game',activate:()=>location.assign(sandboxURL(location.href,false))}]:[]),{id:'controller-layout',label:'Controller layout',activate:()=>controllerLayout.open()},{id:'patrol-console',label:'Patrol console · Missions / report',activate:()=>combat.open(),enabled:()=>combat.permitted()},{id:'combat-target',label:'Next hostile target',activate:()=>combat.cycle(),enabled:()=>nav.mode==='flight'&&combat.state.enemies.some(e=>e.hull>0)},
    ...(devLauncher?[{id:'dev-launcher',label:'DEV · Ship & location',activate:()=>devLauncher.open(),enabled:()=>!transiting&&!multiplayer.connected}]:[]),
    {id:'free-drive',label:'Relativistic drive · N / LB+RB + ↑',activate:()=>nav.travel?nav.cancelTravel():nav.beginFreeTravel(),enabled:()=>Boolean(nav.travel)||nav.mode==='flight'},
    {id:'gear',label:'Landing gear · G / LB+RB + ↓',activate:()=>nav.toggleGear(),enabled:()=>nav.mode==='flight'&&!nav.autoland&&!nav.stationLift&&!nav.travel&&nav.powered},
    {id:'lights',label:'Lights / flashlight · L / LB+RB + ←',activate:()=>nav.toggleLights(),enabled:()=>nav.mode!=='crashed'},
    {id:'camera-view',label:'Camera view · 4 / LB+RB + →',activate:()=>document.getElementById('camera-button').click(),enabled:()=>['flight','walk','eva','landed'].includes(nav.mode)},
    {id:'wave',label:'Wave',activate:()=>character.playGesture('wave'),enabled:()=>nav.mode==='walk'&&character.ready&&loadout.state.health>0},
    {id:'account',label:'Pilot account',activate:()=>multiplayerUI.openAccount()},{id:'comms',label:'Multiplayer comms',activate:()=>multiplayerUI.openComms()},{id:'server-inventory',label:'Server inventory',activate:()=>multiplayerUI.openInventory(),enabled:()=>multiplayer.connected},
    {id:'graphics',label:'Graphics · LB+RB + Menu',activate:()=>graphicsSettings.open()},{id:'crash-recover',label:'Return to orbit after crash',activate:()=>transit('orbit'),enabled:()=>nav.mode==='crashed'},{id:'fleet',label:'Fleet registry',activate:()=>fleetUI.openMenu(),enabled:()=>!multiplayer.connected},{id:'power',label:'Toggle ship main power',activate:()=>nav.togglePower(),enabled:()=>nav.canTogglePower},...Object.entries(WEAPONS).map(([id,p])=>({id:`weapon-${id}`,label:`Ship weapon · ${p.label}`,activate:()=>flightEffects.select(id),enabled:()=>nav.mode==='flight'&&!multiplayer.connected}))],openBackpack:()=>multiplayer.connected?multiplayerUI.openInventory():localOpenPack(),toggleTool:()=>multiplayer.connected?multiplayerUI.openInventory():miningTool.toggle(),openEquipment:()=>multiplayer.connected?multiplayerUI.openInventory():localOpenEquipment(),cycleEquipment:()=>multiplayer.connected?multiplayerUI.openInventory():miningTool.cycle(),cycleQuick:()=>{if(multiplayer.connected){multiplayerUI.openInventory();return;}const r=loadout.selectQuick((loadout.state.quickIndex+1)%4);if(!r.ok)nav.notify(r.message);},useQuick:()=>multiplayer.connected?multiplayerUI.openInventory():useQuick(loadout.state.quickIndex),destinations:[...document.querySelectorAll('#quick-transit-menu [data-destination]')].map(button=>({id:button.dataset.destination,label:button.dataset.destination==='moon'?'Selene':button.dataset.destination==='ring'?'Selene rings':button.textContent.trim(),activate:()=>transit(button.dataset.destination),enabled:()=>!button.disabled&&!multiplayer.connected})).concat(resourceRoutes.map(route=>({id:route.id,label:route.label,activate:()=>transit(route.id),enabled:()=>!multiplayer.connected})))});
  const gameplayMenu=createGameplayMenu({nav,dev:Boolean(devLauncher),screens:[
    {id:'comms',label:'Comms',dialogs:['multiplayer-comms-dialog','multiplayer-account-dialog'],open:()=>multiplayerUI.openComms()},
    {id:'map',label:'Map',dialogs:['system-map'],open:()=>systemMap.openMap()},
    {id:'contracts',label:'Contracts',dialogs:['patrol-console'],open:()=>combat.open()},
    {id:'inventory',label:'Inventory',dialogs:['cargo-dialog','multiplayer-inventory-dialog'],open:()=>multiplayer.connected?multiplayerUI.openInventory():localOpenPack()},
    {id:'trade',label:'Trade',dialogs:['trading-dialog'],open:()=>trading.ui.openView()},
    {id:'loadout',label:'Loadout',dialogs:['cargo-dialog'],open:()=>multiplayer.connected?multiplayerUI.openInventory():localOpenEquipment()},
    {id:'ship',label:'Ship',dialogs:['controller-menu','fleet-dialog','build-dialog','station-elevator-dialog'],open:()=>controllerUI.open()},
    {id:'settings',label:'Settings',dialogs:['graphics-settings','controller-layout'],open:()=>graphicsSettings.open()},
    {id:'dev',label:'Dev',dev:true,dialogs:['dev-launcher'],open:()=>devLauncher?.open()},
  ]});
  nav.openGameplayMenu=()=>gameplayMenu.open();
  function switchScreen(open){const dialog=document.querySelector('dialog[open]');if(dialog){dialog.addEventListener('close',()=>open(),{once:true});dialog.close();}else open();}
  const controlsSettings=document.createElement('button');controlsSettings.type='button';controlsSettings.dataset.controllerKey='controller-layout';controlsSettings.textContent='Controller layout';controlsSettings.onclick=()=>switchScreen(()=>controllerLayout.open());document.querySelector('#graphics-settings .graphics-options').after(controlsSettings);
  const hudSettings=document.createElement('button');hudSettings.type='button';hudSettings.id='hud-display-button';hudSettings.dataset.controllerKey='hud-display';hudDisplay.bind(hudSettings);
  const hudNote=document.createElement('p');hudNote.id='hud-display-note';hudNote.textContent='Tab cycles Everything → Markers and reticle → No HUD. Touch: tap the view with two fingers to restore Everything.';hudSettings.setAttribute('aria-describedby',hudNote.id);controlsSettings.after(hudSettings,hudNote);
  const menuAudio=document.createElement('button');menuAudio.type='button';menuAudio.dataset.controllerKey='menu-audio';menuAudio.onclick=toggleAudio;controlsSettings.after(menuAudio);
  function syncAudioControls(){
    const enabled=audio.enabled;menuAudio.textContent='Sound · '+(enabled?'On':'Off');menuAudio.setAttribute('aria-pressed',String(enabled));
    $('sound-button').textContent=enabled?'SOUND ON':'SOUND OFF';$('sound-button').setAttribute('aria-pressed',String(enabled));
  }
  function toggleAudio(){
    const pending=audio.toggle();syncAudioControls();
    // A browser-blocked resume may remain pending. Keep the desired state
    // visible and let the player mute again without waiting for that promise.
    void pending.then(syncAudioControls);
  }
  function refreshAudioSuspension(){
    audio.setSuspended(graphicsStopped||document.hidden||!nav.focused||transiting||!firstReady||systemMap.open||Boolean(document.querySelector('dialog[open]'))||(!nav.enabled&&!opening?.active));
  }
  function unlockAudio(event){
    if(event?.isTrusted===false||(!firstReady&&!opening?.active)||audio.disposed)return;
    if(event?.target?.closest?.('#sound-button,[data-controller-key="menu-audio"]'))return;
    if(audio.enabled&&audio.context?.state==='running'&&!audio.music?.state.activationRequired)return;
    refreshAudioSuspension();const pending=audio.unlock();syncAudioControls();void pending.then(syncAudioControls);
  }
  syncAudioControls();
  document.addEventListener('pointerdown',unlockAudio,{capture:true});
  document.addEventListener('keydown',unlockAudio,{capture:true});
  let controllerAudioUsed=false;
  if(devLauncher){
    const dialog=document.getElementById('dev-launcher'),content=dialog.querySelector('.gameplay-content');
    const tabs=document.createElement('nav');tabs.className='dev-screen-tabs';tabs.innerHTML='<button type="button" data-dev-page="launch" data-controller-key="dev-page-launch" aria-pressed="true">Test starts</button><button type="button" data-dev-page="consoles" data-controller-key="dev-page-consoles" aria-pressed="false">Console list</button><button type="button" data-dev-page="review" data-controller-key="dev-page-review" aria-pressed="false">Content review</button>';
    const consoles=document.createElement('section');consoles.className='dev-console-list';consoles.hidden=true;
    for(const [label,id] of [['Station comms','comms'],['System map','map'],['Patrol contract console','contracts'],['Cargo & storage','inventory'],['Equipment & loadout','loadout'],['Ship systems','ship'],['Graphics & controls','settings']]){const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.controllerKey='dev-console-'+id;b.onclick=()=>gameplayMenu.open(id);consoles.append(b);}
    for(const b of tabs.querySelectorAll('button'))b.onclick=()=>{const page=b.dataset.devPage,launch=page==='launch';for(const item of tabs.children)item.setAttribute('aria-pressed',String(item===b));consoles.hidden=page!=='consoles';content.querySelector('.dev-review-list').hidden=page!=='review';for(const el of content.querySelectorAll('.dev-choices,footer,.dev-footer,.dev-intro'))el.hidden=!launch;};
    content.prepend(tabs);content.append(consoles);
  }
  nav.onControllerInput=(pad,dt)=>{
    shipMiningInput.controller(pad);
    if(!firstReady)return;
    const audioInput=Boolean(pad.used||pad.pressed?.size||pad.menuPressed?.size||pad.ui?.pressed?.size);
    if(audioInput&&!controllerAudioUsed&&!document.activeElement?.matches?.('#sound-button,[data-controller-key="menu-audio"]'))unlockAudio();
    controllerAudioUsed=audioInput;
    if(gameplayMenu.controller(pad))return;
    if(systemMap.open&&!gameplayMenu.active){systemMap.controllerInput(pad.ui);return;}
    // Account dialogs pause the intro but still need the shared modal router.
    if(document.querySelector('dialog[open]')){controllerUI.update(pad,dt);return;}
    if(nav.openingActive){if(pad.pressed.has(9)){if(devLauncher&&!multiplayer.connected)devLauncher.open();else multiplayerUI.openAccount();}return;}
    if(pad.pressed.has(14)&&nav.mode==='flight'){systemMap.openMap();return;}
    if((rover?.occupied||sentry.occupied)&&!pad.shortcuts?.size){
      if(pad.pressed.has(9))gameplayMenu.open();
      else if(pad.pressed.has(8))(sentry.occupied?sentry:rover).openCargo();
      return;
    }
    trading.tractor.controller(pad);controllerUI.update(pad,dt);flightEffects.controller(nav.shipId==='stratum'?{...pad,fire:0}:pad);
  };
  const systemsHelp=document.createElement('button');systemsHelp.type='button';systemsHelp.textContent='Ship systems / Graphics';systemsHelp.addEventListener('click',()=>{closeHelp();gameplayMenu.open('ship');});document.querySelector('.menu-actions').append(systemsHelp);
  $('controller-layout-help').addEventListener('click',()=>{closeHelp();controllerLayout.open();});
  nav.openCommands=()=>gameplayMenu.open();
  const menuButton=document.createElement('button');menuButton.id='commands-button';menuButton.type='button';menuButton.textContent='MENU';menuButton.title='Gameplay menu · controller Menu';menuButton.addEventListener('click',()=>gameplayMenu.open());document.querySelector('.top-actions').prepend(menuButton);
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
    const canControllerBuild=build.controllerAvailable;
    const carrierHints=rover?.state.aboard?[[controller?'Y':'G',rover.state.carrierControl.toUpperCase()]]:[];
    const hints=sentry.occupied?(controller?[['LS','DRIVE / STEER'],['RS','AIM TURRET'],['RT','LASERS'],['LT','BRAKE'],['X','EXIT'],['VIEW','BACKPACK']]:[['WASD','DRIVE'],['ARROWS','AIM TURRET'],['T','LASERS'],['X','BRAKE'],['F','EXIT'],['I','BACKPACK']]):nav.roverOccupied?(controller?[['LS','DRIVE / STEER'],['RS','AIM CUTTERS'],['RT','TWIN BEAMS'],['LT','BRAKE'],['X','EXIT'],...carrierHints,['VIEW','ORE BINS'],['MENU','COMMANDS']]:[['WASD','DRIVE / STEER'],['ARROWS','AIM CUTTERS'],['T / MOUSE','TWIN BEAMS'],['X','BRAKE'],['F','EXIT'],...carrierHints,['I','ORE BINS'],['4','CAMERA']]):nav.berthRest?[[controller?'X':'F','LEAVE BERTH'],[controller?'RS':'ARROWS','LOOK'],[controller?'VIEW':'I','BACKPACK']]:controller?(nav.controllerShortcutModifier?[['LB + RB','HOLD'],['↑','DRIVE ON / OFF'],['↓','GEAR'],['←',onFoot?'FLASHLIGHT':'LIGHTS'],['→','CAMERA'],['MENU','GRAPHICS']]:controllerHints({mode:nav.mode,handsFree:isHandsFree(nav),insideShip:nav.insideShip,dockedAtStation:nav.dockedAtStation,canBuild:canControllerBuild,tool:nav.tractorActive?'cargo-tractor':loadout.item})):nav.tractorActive&&onFoot&&!isHandsFree(nav)?[['WASD','MOVE'],['T / MOUSE','TRACTOR'],['F','SECURE GRID'],['[ / ]','HOLD DISTANCE'],['R','HOLSTER'],['ESC','MENU']]:onFoot?[['WASD','MOVE'],[eva?'SPACE / C':'SPACE',eva?'RISE / LOWER':'JUMP'],...(!isHandsFree(nav)?[['T / MOUSE',loadout.item==='mining-laser-tool'?'MINE':'FIRE']]:[]),['F','INTERACT'],['I / K','PACK / GEAR'],['L','FLASHLIGHT'],['M','MAP']]:[['WASD','MOVE'],['SPACE / C','UP / DOWN'],['B','LAND / LAUNCH'],['N','DRIVE'],['G','GEAR'],['L','LIGHTS'],['F','INTERACT / EVA'],['M','MAP']];
    $('controller-hints').classList.toggle('utility-shortcuts',controller&&nav.controllerShortcutModifier);
    const hintsNode=$(controller?'controller-hints':'keyboard-hints'),hintMode=`${controller}-${nav.roverOccupied}-${rover?.state.aboard}-${nav.mode}-${nav.berthRest}-${nav.insideShip}-${nav.dockedAtStation}-${loadout.item}-${nav.tractorActive}-${isHandsFree(nav)}-${nav.controllerShortcutModifier}-${canControllerBuild}`;
    if(hintsNode.dataset.mode!==hintMode){hintsNode.innerHTML=hints.filter(([,label])=>!(label==='JUMP'&&nav.insideShip)&&!(label==='SUIT'&&(nav.insideShip||nav.dockedAtStation))).map(([key,label])=>`<span><kbd>${key}</kbd> ${label}</span>`).join('');hintsNode.dataset.mode=hintMode;}
    const nearMoon=nav.body.id==='selene',onPyre=nav.body.id==='pyre',onMiasma=nav.body.id==='miasma',onStar=nav.body.star===true;document.body.classList.toggle('surveying-moon',nearMoon);
    const resources=nearMoon?moonResources(...nav.normal.toArray()):null;resourceLegend.hidden=!nearMoon||onFoot;
    if(resources)resourceLegend.querySelector('p').textContent=`Below: ${resources.province} · ${resources.dominant.toUpperCase()} RICH`;
    const alt=nav.altitude,speed=nav.cabinFlight?nav.shipSpeed:nav.speed,n=nav.normal,flightEnv=nav.flightEnvironment;
    $('camera-button').setAttribute('aria-pressed',String(shipCamera.selected(nav.mode)));
    $('camera-button').innerHTML=shipCamera.selected(nav.mode)?`${nav.mode==='walk'||nav.mode==='eva'?'FIRST PERSON':'COCKPIT'} <kbd>4</kbd>`:'EXTERNAL <kbd>4</kbd>';
    $('camera-button').disabled=Boolean(nav.berthRest||nav.berthTransition)||!['flight','landed','walk','eva'].includes(nav.mode);
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
      $('travel-phase').textContent=`${travel.phase.toUpperCase()} · ${Number.isFinite(travel.eta)?travel.eta.toFixed(1)+'s':'0.9c MAX'} · ${controller?'LT':travel.manual?'N':'X'} TO DISENGAGE`;
      $('travel-progress').firstElementChild.style.width=`${travel.progress*100}%`;
    }
    $('altitude-reference').textContent=onStar?'ABOVE PHOTOSPHERE':nearMoon?'ABOVE SELENE':onPyre?'ABOVE PYRE':onMiasma?'ABOVE MIASMA':'ABOVE AEON';
    $('altitude').textContent=alt>=1000?(alt/1000).toLocaleString('en-US',{maximumFractionDigits:1}):alt.toFixed(1);$('altitude-unit').textContent=alt>=1000?'km':'m';
    $('velocity').textContent=speed>=1000?(speed/1000).toLocaleString('en-US',{maximumFractionDigits:1}):Math.round(speed).toLocaleString();$('velocity-unit').textContent=speed>=1000?'km/s':'m/s';
    if(travel&&speed>LIGHT_SPEED*.001){$('velocity').textContent=(speed/LIGHT_SPEED).toFixed(3);$('velocity-unit').textContent='c';}
    $('altitude-meter').style.width=`${Math.min(100,Math.log10(alt+1)/7*100)}%`;
    const lat=Math.asin(n.y)*180/Math.PI,lon=Math.atan2(n.x,n.z)*180/Math.PI;
    $('latitude').textContent=`${Math.abs(lat).toFixed(3)}° ${lat>=0?'N':'S'}`;$('longitude').textContent=`${Math.abs(lon).toFixed(3)}° ${lon>=0?'E':'W'}`;
    const mode=nav.roverOccupied?'BURROW · GROUND VEHICLE':nav.mode==='destroyed'||nav.mode==='crashed'?'SHIP DESTROYED':onStar?'STELLAR APPROACH':onMiasma?(nav.mode==='walk'?'MIASMA EXPLORATION':nav.mode==='landed'?'LANDED · MIASMA':alt>MIASMA_ATMOSPHERE.height?'MIASMA ORBIT':'MIASMA · TOXIC ATMOSPHERE'):onPyre?(nav.mode==='walk'?'PYRE EXPLORATION':nav.mode==='landed'?'LANDED · PYRE':'PYRE FLIGHT'):nav.mode==='eva'?'EVA · SUIT THRUSTERS':nav.cabinFlight?'IN-FLIGHT CABIN':nearMoon?(nav.mode==='walk'?'LUNAR EXPLORATION':nav.mode==='landed'?'LANDED · SELENE':'LUNAR FLIGHT'):nav.dockedAtStation?(nav.mode==='walk'?'STATION EXPLORATION':'DOCKED'):nav.mode==='walk'?'SURFACE EXPLORATION':nav.mode==='landed'?'LANDED':flightEnv.regime==='SPACE'?'SPACE FLIGHT':flightEnv.regime==='TRANSITION'?`TRANSITION · ATMO ${Math.round(flightEnv.atmosphereFraction*100)}%`:'ATMOSPHERIC FLIGHT';
    $('mode-label').textContent=mode;$('biome').textContent=onStar?'OUR STAR · CORONA':onMiasma?`MIASMA · ${miasmaSurface(n.x,n.y,n.z).region}`:onPyre?`PYRE · ${pyreRegion(n.x,n.y,n.z)}`:nearMoon?`SELENE · ${moonRegion(n.x,n.y,n.z)}`:nav.stationDistance<500?'AEON ORBITAL':alt>70000?'EXOSPHERE':biomeAt(n.x,n.y,n.z);$('fps').textContent=`${fps} FPS`;
    $('flight-state').classList.toggle('base-target',Boolean(build.nearbyInteraction()));
    $('state-text').textContent=nav.mode==='crashed'?'CRITICAL IMPACT · FLIGHT SYSTEMS OFFLINE':nav.stationLift?'UNDOCKING':nav.autoland?(nav.stationDistance<500?'DOCKING ASSIST':'LANDING ASSIST'):nav.mode==='walk'||nav.mode==='landed'?nav.interaction:nav.stationDistance<500?(station.doorsOpen<.98?'HANGAR DOORS OPENING':nav.canDock?'B · DOCK ON DECK':'FLY OVER THE CENTRAL PAD'):nav.boost?'BOOST ENGAGED':'FREE FLIGHT';
    $('drive-label').textContent=nav.roverOccupied?'WHEELED DRIVE':nav.mode==='eva'?`EVA · ${nav.speed.toFixed(1)} m/s`:!nav.powered?'MAIN POWER OFF':nav.cabinFlight?(nav.flightAssist?'COURSE HOLD':'INERTIAL COAST'):nav.mode==='walk'?'ON FOOT':nav.autoland?'AUTOLAND':`${nav.combatMode?'COMBAT':'CRUISE'} · ${nav.flightAssist?'FLY-BY-WIRE':'UNLOCKED'} · V / R3`;
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
  const audioDebug=import.meta.env.DEV&&new URLSearchParams(location.search).has('audioDebug')?document.createElement('output'):null;
  if(audioDebug){audioDebug.id='audio-debug';audioDebug.style.cssText='position:fixed;left:8px;top:80px;z-index:100;max-width:420px;pointer-events:none;white-space:pre-wrap;background:#07121dea;color:#b5ffe0;padding:8px;font:12px monospace';document.body.append(audioDebug);}
  if(audioDebug){
    const controls=document.createElement('div');controls.style.cssText='position:fixed;right:8px;top:80px;z-index:100;display:grid;gap:5px';document.body.append(controls);
    for(const [label,code,key,duration] of [['Walk backward for 2 seconds','KeyS','s',2000],['Fire equipped for 1 second','KeyT','t',1000]]){
      const button=document.createElement('button');button.textContent=label;controls.append(button);
      button.onclick=()=>{button.disabled=true;canvas.focus();canvas.dispatchEvent(new KeyboardEvent('keydown',{code,key,bubbles:true}));setTimeout(()=>{canvas.dispatchEvent(new KeyboardEvent('keyup',{code,key,bubbles:true}));button.disabled=false;},duration);};
    }
  }
  let graphicsStopped=false;
  const stopGraphics=message=>{graphicsStopped=true;nav.enabled=false;preload.error=message;fatal(message);};
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();stopGraphics('The graphics context was lost. Reload the page to restart your flight.');});
  let renderedFrames=0;
  let wasDestroyed=false;
  const recover=()=>{if(combat.recover())return;if(nav.mode!=='destroyed')return;nav.recoverFromStar();course=null;$('course-guidance').hidden=true;$('stellar-loss').hidden=true;document.body.classList.remove('stellar-destroyed');};
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
    refreshAudioSuspension();
    if(graphicsStopped)return;
    if(!firstReady){
      const status=preload.state;
      $('loading-status').textContent=status.label;
      $('loading-progress').max=status.total;$('loading-progress').value=status.completed;
    }
    if(document.hidden||opening?.phase==='loading'){resolution.resetMeasurements();return;}
    if(systemMap.open){navigationTargets.reset();resolution.resetMeasurements();nav.update(0);refreshAudioSuspension();return;}
    fauna.medical.update();
    elapsed+=dt;
    const steps=nav.travel||opening?.active?1:Math.max(1,Math.ceil(dt/.025));nav.beginFrame(dt);if(firstReady)for(let i=0;i<steps;i++)nav.update(dt/steps);multiplayer.update(dt);
    cabinControls.update();
    refreshAudioSuspension();
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
    sentry.camera(shipCamera);
    rover?.camera(shipCamera,nav.shipPosition?(start,end)=>clipShipCamera(start,end,ship,point=>nav.toShipLocal(point)):null);
    const onFoot=nav.mode==='walk'||nav.mode==='eva';
    if(!opening?.active){
      character.setHeadHidden(false);
      character.setVisible(onFoot&&shipCamera.active&&!nav.kestrelAccess?.busy&&!nav.roverOccupied);
    }
    if(onFoot&&!opening?.active){
      const eva=nav.mode==='eva',up=eva?new THREE.Vector3(0,1,0).applyQuaternion(nav.orientation):playerUp(nav),feet=nav.position.clone().addScaledVector(up,-SHIP_LAYOUT.eyeHeight);
      if(eva)character.setWorldPose(feet,nav.orientation);
      else character.alignToSurface(feet,up,new THREE.Vector3(0,0,-1).applyQuaternion(nav.orientation));
      character.update(dt,{speed:eva?0:nav.velocity.clone().projectOnPlane(up).length(),grounded:eva||nav.jumpHeight===0,jumping:!eva&&nav.jumpHeight>0,health:loadout.state.health/100,...miningTool.pose});
    }
    document.body.classList.toggle('external-view',shipCamera.active);
    document.body.classList.toggle('camera-engaged',shipCamera.engaged&&nav.mode==='flight');
    origin.copy(shipCamera.position);camera.position.set(0,0,0);camera.quaternion.copy(shipCamera.orientation);
    character.placeCameraRelative(origin);
    const fighterCockpit=nav.shipId==='kestrel'&&!shipCamera.active&&['flight','landed'].includes(nav.mode);
    const viewFov=nav.roverOccupied?76:fighterCockpit?76:['stratum','gannet'].includes(nav.shipId)&&!shipCamera.active&&['flight','landed'].includes(nav.mode)?(nav.shipId==='stratum'?66:60):52;
    const cockpitTilt=fighterCockpit?.14:nav.shipId==='stratum'&&!shipCamera.active&&['flight','landed'].includes(nav.mode)?.12:0;
    if(!opening?.placeCamera(camera,origin)){
      if(camera.fov!==viewFov){camera.fov=viewFov;camera.updateProjectionMatrix();}
      // Include the cockpit's lower MFD rows from its fixed physical pilot eye.
      // Ship attitude/aim stays unchanged; the reticle follows the optical offset.
      if(cockpitTilt)camera.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-cockpitTilt));
    }
    remotePlayers.update(dt,origin);
    $('reticle').style.top=cockpitTilt?`${50-50*Math.tan(cockpitTilt)/Math.tan(THREE.MathUtils.degToRad(viewFov/2))}%`:'50%';
    station.update(nav.position,origin,nav.sunDirection,dt);stationDefense.update(dt,origin);
    travelEffects.update(nav.enabled?dt:0,nav,camera);
    const sunDirection=nav.sunDirection,normal=nav.normal,altitude=nav.altitude;
    document.body.classList.toggle('exploring',nav.body.star||nav.body.id==='pyre'||nav.body.id==='miasma'||altitude<12000||nav.mode!=='flight'||nav.stationDistance<2000);
    const onPyre=nav.body.id==='pyre';
    lighting.update(normal,sunDirection,altitude,nav.body.airless,onPyre?PYRE_LIGHTING:nav.body.id==='miasma'?MIASMA_LIGHTING:null,landmarks.stats.nearest?.distance<500?460:110);
    aeonGroup.visible=nav.position.length()<PYRE_MESH_RANGE;
    shipMarker.update(innerWidth,innerHeight);
    navigationTargets.update(dt,{width:innerWidth,height:innerHeight,origin,orientation:camera.quaternion});
    moon.update(nav.position,origin,elapsed,!nav.insideShip,nav.shipPosition);
    landmarks.update(origin,camera);mining.update(origin);basePower.update();baseCloud.update(dt);build.update(dt,origin);settlements.update(dt,origin);garages.update(origin);fauna.update(dt,origin);shipMiningInput.beforeUpdate();miningTool.update(dt,origin);trading.update(origin,dt);rover?.update(dt,origin);sentry.update(dt,origin);inventoryUI.update?.();loadoutBar.update();buildUI.update();
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
    surfaceWeather.update(origin,nav.body,sunDirection,elapsed,dt,{sheltered:inHangar,cabin:nav.insideShip||nav.mode==='flight',focal:renderer.domElement.height/(2*Math.tan(camera.fov*Math.PI/360))});
    updateStationFinishSun(lighting.sun,station.finishStatus==='ready'&&station.location==='hangar'&&inHangar);
    if(station.finishStatus!=='ready')lighting.sun.intensity=inHangar ? .65 : 3.4;
    if(nav.stationDistance<500)lighting.sun.castShadow=true;
    planet.update(origin,origin,sunDirection,elapsed,Math.max(0,nav.position.length()-RADIUS));const settlementClearing=settlements.claims.find(c=>c.body==='aeon'&&nav.position.distanceTo(new THREE.Vector3(...c.origin))<1400);vegetation.setExclusion?.(settlementClearing?new THREE.Vector3(...settlementClearing.origin):nav.shipPosition,settlementClearing?settlementClearing.radius:13);vegetation.update(nav.position,origin,elapsed,nav.mode==='walk'&&!nav.insideShip&&!nav.body.airless&&!nav.dockedAtStation,flightDownwash(nav));
    const effectsSuspended=transiting||!nav.enabled||!nav.focused||document.hidden||Boolean(document.querySelector('dialog[open]'));
    const engine=enginePresentation(nav,{suspended:effectsSuspended});
    ship.visible=Boolean(nav.shipPosition)||(nav.mode==='flight'&&(nav.shipId==='kestrel'||nav.locked||nav.controllerActive||shipCamera.engaged||document.body.classList.contains('player-active')));
    // Hidden cockpit hulls still own the live firing pose. Visibility must not
    // leave a named muzzle at an old/identity transform before first movement.
    if(nav.shipPosition){ship.position.copy(nav.shipPosition).sub(origin);ship.quaternion.copy(nav.shipOrientation);}
    else{ship.quaternion.copy(nav.orientation);ship.position.copy(nav.position).sub(origin).sub(new THREE.Vector3(...nav.layout.seatEye).applyQuaternion(nav.orientation));}
    if(ship.visible){
      ship.syncFlight?.(nav);ship.setDoor(nav.doorOpen);ship.update(dt);
      ship.updateDisplays(dt,nav,mediumSystems[nav.shipId]&&!multiplayer.connected?mediumInventory:inventory,navigationTargets.course??course);
      ship.updateCabin?.(nav,mining.store);
    }
    updateShipEngineVisuals(ship,engine);
    camera.updateMatrixWorld();sun.update(origin,camera,dt,elapsed,{atmosphereFraction:nav.flightEnvironment.atmosphereFraction});atmosphere.setSun(sun);
    if(destructionEffects.update(nav.destruction,origin,dt))playStellarDestruction(audio);
    ship.updateGear(dt,nav.gearDeployed,nav.gearProgress);shipMining.update(dt,origin);shipMiningInput.update();utilityLights.update(nav,origin);
    ship.userData.reentryHeating.update({density:nav.flightEnvironment.density,velocity:nav.cabinFlight?nav.shipVelocity:nav.velocity,active:nav.mode==='flight'||nav.cabinFlight,reset:transiting},dt,camera);
    document.body.classList.toggle('crashed',nav.mode==='crashed');
    $('crash-panel').hidden=nav.mode!=='crashed';
    if(nav.crash)$('crash-impact').textContent=`${nav.crash.impactSpeed.toFixed(1)} m/s into ${nav.crash.surface==="ice"?"polar ice":nav.crash.surface==="water"?"water":"the ground"}`;
    if(crashEffects.update(nav.crash,origin,dt))playCrashSound(audio);
    combat.update(dt,origin,{weapon:flightEffects.state.weapon,suspended:transiting||!nav.enabled||!nav.focused||Boolean(document.querySelector('dialog[open]'))});
    flightEffects.update(dt,origin,{suspended:effectsSuspended,engine});
    audio.flyby?.update([...remotePlayers.peers].filter(([,entry])=>entry.ship.visible).map(([id,entry])=>({id,position:entry.shipPosition})),origin,camera.quaternion,realDt,{active:!transiting&&nav.enabled&&nav.focused&&!document.hidden&&!document.querySelector('dialog[open]')});
    audio.gameplay?.update(nav,dt,{active:!transiting&&nav.enabled&&nav.focused&&!document.hidden&&!document.querySelector('dialog[open]'),mining:rover?.audioMining??shipMining.audioMining??effects.miningInput,heat:miningTool.equipment.heat,overheated:miningTool.equipment.overheated});
    audio.update({...engine,speed:nav.shipSpeed,altitude,musicAltitude:nav.flightEnvironment.altitude,verticalSpeed:(nav.cabinFlight?nav.shipVelocity:nav.velocity).dot(nav.normal),airless:nav.body.airless,inHangar,doorMotion:station.doorsOpen>0&&station.doorsOpen<1?1:0},dt);
    if(audioDebug)audioDebug.textContent=JSON.stringify({mode:nav.mode,audio:audio.enabled,music:audio.music?.state,engine:audio.engineAudio?.state,flyby:audio.flyby?.state,effects:audio.gameplay?.state},null,2);
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
        if(sandboxEnabled){devLauncher?.ready();enterPlayerInterface();notify('Build sandbox · 4,608 kg supply bank. B / Menu → Build. Supplies tab refills the bank.');}
        else if(devLauncher){
          devLauncher.ready();
          if(devOptions.autoStart){
            enterPlayerInterface();canvas.focus({preventScroll:true});
            const launch=sentryStart?sentry.spawnSurface(mining.ground.position).then(ok=>{if(!ok)throw new Error('Sentry surface start unavailable.');}):surfaceRoverStart?rover.spawnSurface({target:mining.ground.position}).then(ok=>{
              if(!ok)throw new Error('Burrow surface placement failed.');
            }):devOptions.location!=='hangar'?transit(atlasMeadowStart?'grazer-habitat':devOptions.location):Promise.resolve();
            launch.then(async()=>{
              if(atlasMeadowStart){
                const {placeAtlasMeadow}=await import('./dev-atlas-meadow.js');
                await placeAtlasMeadow(nav);
              }else if(rover&&!surfaceRoverStart&&!sentryStart){
                if(devOptions.location==='moon')nav.touchDown();
                if(!await rover.spawn())throw new Error('Burrow cargo placement failed.');
                notify(nav.shipId==='gannet'?'Gannet + Burrow. F leaves the chair; walk aft and approach the rover’s port door.':'Atlas + Burrow mining test. F leaves the chair; ride the crew lift to the cargo deck, then walk aft to the rover’s port door.');
              }
              if(!atlasMeadowStart&&new URLSearchParams(location.search).get('exteriorView')==='overview'&&station.exterior.authored){
                placeStationExteriorPreview(nav,innerWidth/innerHeight);
                notify('Station exterior · geometry preview. Fly freely; F2 opens test locations.');
              }
            }).catch(error=>{nav.enabled=true;notify('Test start failed: '+error.message);});
          }
        }else if(multiplayerEntry)multiplayerUI.openAccount();
      }
    }
    if(planet.error)stopGraphics(planet.error);
  }
  window.addEventListener('beforeunload',()=>{garages.dispose();stationDefense.dispose();shipMiningInput.dispose();shipMining.dispose();landmarks.dispose();multiplayerUI.dispose();multiplayer.dispose();remotePlayers.dispose();},{once:true});
  requestAnimationFrame(frame);
  // Explicit read-only diagnostics plus navigational hooks for reproducible browser tests.
  window.starAgent={get state(){return {sentry:sentry.state,garages:garages.state,settlements:settlements.state,stationDefense:stationDefense.state,trading:trading.state,fauna:fauna.state,rover:rover?.state??null,sandbox:sandboxEnabled,landmarks:landmarks.stats,navigationTargets:navigationTargets.state,combat:combat.state,surfaceWeather:surfaceWeather.state,dev:devLauncher?.state??null,build:build.state,enabled:nav.enabled,focused:nav.focused,manufacturer:MERIDIAN.name,testFlight,kestrel:ship.snapshot?.()??null,kestrelAccess:nav.kestrelAccess?.snapshot??null,rockMaterial:rockTextureState(),sun:{distance:sun.distance,clearance:sun.distance-SUN_RADIUS,angularRadius:sun.angularRadius,sphereVisible:sun.sphere.visible,diskWeight:sun.diskWeight,visibility:sun.visibility},stellarThermal:{...nav.stellarThermal},multiplayer:{...multiplayer.state,remote:remotePlayers.state},preload:{...preload.state,orbitalResolution:planet.orbitalSurface.resolution,orbitalComplete:planet.orbitalSurface.complete},reentryHeat:ship.userData.reentryHeating.heat,crash:nav.crash?structuredClone(nav.crash):null,renderedFrames,graphics:graphicsSettings.state,utilities:{gearDeployed:nav.gearDeployed,gearProgress:ship.userData.gearProgress,gearAssemblies:ship.userData.gearAssemblies,...utilityLights.state},miasma:{...miasma.state,altitude:bodyAltitude(nav.position,MIASMA),surface:nav.body.id==='miasma'?miasmaSurface(...nav.normal.toArray()):null},pyre:{...pyre.state,altitude:bodyAltitude(nav.position,PYRE),ready:pyre.ready,epoch:PYRE_EPOCH,generatorVersion:PYRE_GENERATOR_VERSION,resources:nav.body.id==='pyre'?pyreResources(...nav.normal.toArray()):null,region:nav.body.id==='pyre'?pyreRegion(...nav.normal.toArray()):null},heat,terrainDetail:planet.detailStats,terrainLod:planet.lodStats,loadout:structuredClone(loadout.state),equippedMass:loadout.mass,effects:{...effects.state,...flightEffects.state,beamVisible:effects.beam.mesh.visible,bloom:atmosphere.bloom.enabled},shipMarker:shipMarker.state,fieldCache:mining.fieldCache.position.toArray(),containers:inventoryUI.state,eva:nav.evaState,rings:moon.rings.state,mining:{...mining.state,tool:miningTool.state,ship:nav.shipMiningState},fleet:fleet.snapshot,shipId:nav.shipId,powered:nav.powered,cabinFlight:nav.cabinFlight,berthRest:nav.berthRest,berthTransition:Boolean(nav.berthTransition),nomadCargo:ship.cabinState?.(),landingGear:{progress:nav.gearProgress,target:nav.gearDeployed,visual:ship.userData.gearProgress},hardpoints:ship.userData.hardpoints??[],shipSpeed:nav.shipSpeed,shipVelocity:nav.shipVelocity.toArray(),shipPosition:nav.shipPosition?.toArray(),shipOrientation:nav.shipOrientation.toArray(),lifts:nav.freighter?.snapshot,opening:opening?.state??{phase:'skipped'},character:{ready:character.ready,visible:character.object.visible,state:character.state,position:character.worldPosition.toArray(),error:character.error},camera:{mode:(nav.mode==='walk'||nav.mode==='eva')?(shipCamera.active?'third-person':'first-person'):(shipCamera.active?'external':'cockpit'),shipVisible:ship.visible,selected:shipCamera.selected(nav.mode),obstructed:shipCamera.obstructed,position:origin.toArray(),orientation:camera.quaternion.toArray(),fov:camera.fov},audio:audio.state,travel:nav.travelState,travelTarget:nav.travelTarget,mapOpen:systemMap.open,tunnel:travelEffects.state,speedProfile:nav.speedProfile,moon:{resources:moonResources(...nav.position.clone().sub(moon.worldPosition).normalize().toArray()),resourceProvinces:RESOURCE_PROVINCES,effects:moon.effects,position:moon.worldPosition.toArray(),radius:MOON_RADIUS,altitude:bodyAltitude(nav.position,SELENE),patches:moon.terrain.visibleCount,lod:moon.terrain.maxLevel,pending:moon.terrain.jobs.size+moon.terrain.queue.length+moon.terrain.waitingCount,distance:nav.position.distanceTo(moon.worldPosition)},controller:{id:nav.gamepad.id,connected:nav.gamepad.connected,active:nav.controllerActive,armed:nav.gamepad.armed,status:nav.gamepad.status},body:nav.body.id,seed:SEED,generatorVersion:GENERATOR_VERSION,position:nav.position.toArray(),altitude:nav.altitude,speed:nav.speed,mode:nav.mode,autoland:nav.autoland,flightAssist:nav.flightAssist,combatMode:nav.combatMode,flightRegime:nav.flightEnvironment.regime,atmosphereFraction:nav.flightEnvironment.atmosphereFraction,velocity:nav.velocity.toArray(),angularVelocity:nav.angularVelocity.toArray(),groundHeight:nav.groundHeight,biome:nav.body.airless?'SELENE · AIRLESS MOON':biomeAt(...nav.normal.toArray()),sunDistance:nav.position.clone().sub(new THREE.Vector3(...SUN_DIRECTION).multiplyScalar(SUN_DISTANCE)).length(),patches:planet.visibleCount,lod:planet.maxVisibleLevel,pending:planet.pending,vegetation:vegetation.stats,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,ready:firstReady,transiting,fps,shipAsset:ship.userData.assetStatus,shipAssetError:ship.userData.assetError,storageOpen:ship.userData.storageOpen,storageProgress:ship.userData.storageProgress,inventory:inventory.snapshot,mfds:ship.displayState(),doorOpen:nav.doorOpen,doorProgress:nav.doorProgress,insideShip:nav.insideShip,station:{...station.snapshot,ready:station.ready,error:station.error,doorsOpen:station.doorsOpen,distance:nav.stationDistance,local:nav.stationLocal?.toArray(),deckClearance:nav.deckClearance,docked:nav.dockedAtStation,lifting:nav.stationLift,canDock:nav.canDock},shipLocal:nav.toShipLocal()?.toArray(),interaction:nav.interaction,renderScale:resolution.scale,renderResolution:resolution.state};},destinations,transit,land:()=>nav.landOrLaunch(),embark:()=>nav.embark(),setRenderScale(value){resolution.setScale(THREE.MathUtils.clamp(value,.4,1));resizePending=true;},get miningSave(){return miningSaveSnapshot();},get openingSequence(){return new URLSearchParams(location.search).has('debug')?opening:undefined;},get planet(){return import.meta.env.DEV||new URLSearchParams(location.search).has('debug')?planet:undefined;},get navigation(){return import.meta.env.DEV||new URLSearchParams(location.search).has('debug')?nav:undefined;},get miasmaSites(){return MIASMA_SITES;},get pyreSites(){return {landing:pyreLandingDirection(),volcanoes:VOLCANOES.map(v=>({name:v.name,height:v.height,active:v.active,direction:fromPyreBody(...v.direction)})),fields:LAVA_FIELDS.map(f=>({name:f.name,direction:fromPyreBody(...f.direction)}))};}};
}catch(error){console.error(error);fatal(`Could not start WebGL 2. Use a current desktop browser with hardware acceleration enabled. ${error.message}`);}
