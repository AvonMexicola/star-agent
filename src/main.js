import * as THREE from 'three';
import './style.css';
import { RADIUS, SUN_DISTANCE, SUN_DIRECTION, terrainHeight, biomeAt, findDestinations } from './world.js';
import { Planet } from './planet.js';
import { Moon } from './moon.js';
import { MOON_RADIUS, MOON_POSITION, MOON_LANDING_DIRECTION, moonRegion } from './moon-world.js';
import { Atmosphere } from './atmosphere.js';
import { Station } from './station.js';
import { SELENE, bodySurfacePoint, bodyAltitude } from './celestial.js';
import { Navigation } from './navigation.js';
import { Vegetation } from './vegetation.js';
import { FlightAudio } from './audio.js';
import { createWalkableShip } from './ship-walkable.js';
import { ShipInventory } from './ship-inventory.js';
import { createInventoryUI } from './ship-inventory-ui.js';
import { SHIP_LAYOUT } from './boarding.js';
import { createLighting } from './lighting.js';
import { weatherShip } from './surface-materials.js';
import { SEED, GENERATOR_VERSION } from './generation.js';

const $=id=>document.getElementById(id);
let toastTimeout;
function notify(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>$('toast').classList.remove('visible'),4500);}
function fatal(message){document.body.classList.add('fatal');$('loading').classList.remove('hidden');$('loading').querySelector('p').textContent='FLIGHT SYSTEM OFFLINE';$('loading').querySelector('span').textContent=message;}

try {
  const canvas=$('viewport');
  const renderer=new THREE.WebGLRenderer({canvas,antialias:false,logarithmicDepthBuffer:true,powerPreference:'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));renderer.outputColorSpace=THREE.LinearSRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;
  renderer.info.autoReset=false;
  const scene=new THREE.Scene();
  const camera=new THREE.PerspectiveCamera(52,innerWidth/innerHeight,.08,SUN_DISTANCE*5);
  const atmosphere=new Atmosphere(renderer),nav=new Navigation(canvas,notify),planet=new Planet(scene),vegetation=new Vegetation(scene),audio=new FlightAudio();
  const station=new Station(scene);nav.station=station;
  const stationButton=$('station-destination');
  station.readyPromise.then(()=>{stationButton.disabled=false;stationButton.querySelector('small').textContent='HANGAR · DOCK & EXPLORE';}).catch(()=>{stationButton.querySelector('small').textContent='STATION UNAVAILABLE';notify('Station unavailable. Planet flight is still available.');});
  const moon=new Moon(scene);
  const origin=new THREE.Vector3();
  const lighting=createLighting(renderer,scene);
  const ship=createWalkableShip();ship.visible=false;scene.add(ship);weatherShip(ship,planet.surfaceTexture);
  let localInventoryStorage;try{localInventoryStorage=window.localStorage;}catch{}
  const inventory=new ShipInventory(localInventoryStorage);
  const inventoryUI=createInventoryUI(nav,ship,inventory);
  ship.readyPromise.then(model=>{if(model)weatherShip(model,planet.surfaceTexture);});
  $('planet-seed').textContent=`Terrestrial · Seed ${SEED.toLocaleString('en-US')}`;
  $('seed-input').value=SEED;
  $('seed-form').addEventListener('submit',event=>{event.preventDefault();const url=new URL(location.href);url.searchParams.set('seed',String($('seed-input').valueAsNumber));location.assign(url);});
  const destinations=findDestinations();
  let course=null;
  function setCourse(name){
    if(name==='moon'){course={name,point:bodySurfacePoint(new THREE.Vector3(...MOON_LANDING_DIRECTION),SELENE,180),direction:new THREE.Vector3(...MOON_POSITION).normalize()};$('course-guidance').hidden=false;notify('Course set for Selene. Fly to the lunar approach marker.');return;}
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
  let elapsed=0,last=null,lastHud=0,frames=0,fps=0,frameAccumulator=0,firstReady=false,transiting=false,hidden=false;
  let renderScale=1, automaticScale=true, resizePending=false;
  function resize(){const width=Math.floor(innerWidth*renderScale),height=Math.floor(innerHeight*renderScale);renderer.setSize(width,height,false);canvas.style.width='100%';canvas.style.height='100%';camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();const size=renderer.getDrawingBufferSize(new THREE.Vector2());atmosphere.resize(size.x,size.y);}
  window.addEventListener('resize',()=>resizePending=true);resize();
  function capture(){if(transiting)return;nav.capture();}
  canvas.addEventListener('click',capture);$('begin-button').addEventListener('click',capture);
  // Drag fallback also works when browser pointer-lock is unavailable.
  let dragging=false;
  canvas.addEventListener('pointerdown',e=>{if(!nav.locked){dragging=true;canvas.setPointerCapture(e.pointerId);}});
  canvas.addEventListener('pointerup',()=>dragging=false);
  canvas.addEventListener('pointermove',e=>{if(dragging&&!nav.locked)nav.look(-e.movementX*.002,-e.movementY*.002);});
  const help=$('help-dialog');
  function openHelp(){if(inventoryUI.open)return;if(document.pointerLockElement)document.exitPointerLock();nav.keys.clear();nav.enabled=false;help.showModal();}
  function closeHelp(){help.close();nav.enabled=true;}
  $('help-button').addEventListener('click',openHelp);$('close-help').addEventListener('click',closeHelp);help.addEventListener('close',()=>nav.enabled=true);
  $('help-fly').addEventListener('click',()=>{closeHelp();capture();});
  $('sound-button').addEventListener('click',async()=>{const enabled=await audio.toggle();$('sound-button').textContent=enabled?'SOUND ON':'SOUND OFF';$('sound-button').setAttribute('aria-pressed',String(enabled));});
  nav.onControllerMenu=()=>{if(transiting||document.body.classList.contains('fatal'))return;if(help.open)closeHelp();else if(nav.enabled&&!document.querySelector('dialog[open]'))openHelp();};
  nav.onControllerScroll=amount=>{if(help.open)help.scrollTop+=amount;};
  nav.onControllerHud=()=>photo();
  const photo=()=>{hidden=!hidden;document.body.classList.toggle('photo-mode',hidden);};$('photo-button').addEventListener('click',photo);
  document.addEventListener('keydown',e=>{if(e.repeat||inventoryUI.open)return;if(e.code==='KeyH'){help.open?closeHelp():openHelp();}if(e.code==='Tab'&&!help.open){e.preventDefault();photo();}if(e.code==='KeyO'&&!help.open)transit('orbit');});
  async function transit(name){
    if(inventoryUI.open||transiting||name==='station'&&!station.ready)return;transiting=true;nav.enabled=false;nav.keys.clear();nav.velocity.set(0,0,0);
    if(document.pointerLockElement)document.exitPointerLock();
    const button=document.querySelector(`[data-destination="${name}"]`);$('transit-name').textContent=button.querySelector('strong').textContent.toUpperCase();$('transit').classList.add('active');
    await new Promise(r=>setTimeout(r,350));
    if(name==='moon')nav.transitMoon();
    else if(name==='station'){const target=station.transitParams(180,6);nav.transit(target.direction,target.altitude);nav.orientToward(target.lookAt,target.up);}
    else if(name==='orbit')nav.orbit();else nav.transit(destinations[name],name==='mountain'?700:name==='polar'?90:95);
    for(const b of document.querySelectorAll('.destination'))b.classList.toggle('active',b===button);
    // This optional shortcut conceals its teleport while streamed terrain catches up.
    planet.cameraWorld.copy(nav.position);planet.select();
    const started=performance.now();
    while(performance.now()-started<6500){await new Promise(r=>setTimeout(r,150));if(performance.now()-started>1100 && planet.pending<4 && (name==='moon'?moon.terrain.maxLevel>=14:name==='orbit'||name==='station'||planet.maxVisibleLevel>=12))break;}
    $('transit').classList.remove('active');transiting=false;nav.enabled=true;
    notify(name==='moon'?'Selene descent. L lands; F leaves the chair. Open the rear hatch and walk down the ramp to explore.':name==='station'?'Station approach. W enters the bay; X brakes. Over the central pad, L docks.':name==='orbit'?'High orbit. Click to fly. W approaches Aeon; Space moves away.':'Arrival complete. Click to fly · L lands · F leaves the pilot chair.');
  }
  for(const button of document.querySelectorAll('[data-destination]'))button.addEventListener('click',event=>event.shiftKey?setCourse(button.dataset.destination):transit(button.dataset.destination));
  function updateHud(time){
    const controller=nav.controllerActive;
    document.body.classList.toggle('piloting',nav.locked||controller);
    $('controller-status').textContent=nav.gamepad.status;
    $('keyboard-hints').hidden=controller;$('controller-hints').hidden=!controller;
    const nearMoon=nav.body.airless;
    const alt=nav.altitude,speed=nav.speed,n=nav.normal,flightEnv=nav.flightEnvironment;
    if(course){
      const offset=course.point.clone().sub(nav.position),distance=offset.length();
      const local=offset.clone().applyQuaternion(nav.orientation.clone().invert());
      const bearing=Math.atan2(local.x,-local.z)*180/Math.PI;
      const beyond=course.name!=='orbit'&&course.name!=='moon'&&Math.acos(THREE.MathUtils.clamp(n.dot(course.direction),-1,1))>Math.acos(THREE.MathUtils.clamp(RADIUS/nav.position.length(),0,1));
      const title=document.querySelector(`[data-destination="${course.name}"] strong`).textContent;
      $('course-guidance').textContent=`${title} · ${(distance/1000).toFixed(1)} km · ${Math.abs(bearing).toFixed(0)}° ${bearing<0?'LEFT':'RIGHT'}${beyond?' · BEYOND HORIZON — CLIMB':''}`;
    }
    $('altitude-reference').textContent=nearMoon?'ABOVE SELENE':'ABOVE AEON';
    $('altitude').textContent=alt>=1000?(alt/1000).toLocaleString('en-US',{maximumFractionDigits:1}):alt.toFixed(1);$('altitude-unit').textContent=alt>=1000?'km':'m';
    $('velocity').textContent=speed>=1000?(speed/1000).toLocaleString('en-US',{maximumFractionDigits:1}):Math.round(speed).toLocaleString();$('velocity-unit').textContent=speed>=1000?'km/s':'m/s';
    $('altitude-meter').style.width=`${Math.min(100,Math.log10(alt+1)/7*100)}%`;
    const lat=Math.asin(n.y)*180/Math.PI,lon=Math.atan2(n.x,n.z)*180/Math.PI;
    $('latitude').textContent=`${Math.abs(lat).toFixed(3)}° ${lat>=0?'N':'S'}`;$('longitude').textContent=`${Math.abs(lon).toFixed(3)}° ${lon>=0?'E':'W'}`;
    const mode=nearMoon?(nav.mode==='walk'?'LUNAR EXPLORATION':nav.mode==='landed'?'LANDED · SELENE':'LUNAR FLIGHT'):nav.dockedAtStation?(nav.mode==='walk'?'STATION EXPLORATION':'DOCKED'):nav.mode==='walk'?'SURFACE EXPLORATION':nav.mode==='landed'?'LANDED':flightEnv.regime==='SPACE'?'SPACE FLIGHT':flightEnv.regime==='TRANSITION'?`TRANSITION · ATMO ${Math.round(flightEnv.atmosphereFraction*100)}%`:'ATMOSPHERIC FLIGHT';
    $('mode-label').textContent=mode;$('biome').textContent=nearMoon?`SELENE · ${moonRegion(n.x,n.y,n.z)}`:nav.stationDistance<500?'AEON ORBITAL':alt>70000?'EXOSPHERE':biomeAt(n.x,n.y,n.z);$('fps').textContent=`${fps} FPS`;
    $('state-text').textContent=nav.stationLift?'UNDOCKING':nav.autoland?(nav.stationDistance<500?'DOCKING ASSIST':'LANDING ASSIST'):nav.mode==='walk'||nav.mode==='landed'?nav.interaction:nav.stationDistance<500?(station.doorsOpen<.98?'HANGAR DOORS OPENING':station.canDock(nav.position)?'L · DOCK ON DECK':'FLY OVER THE CENTRAL PAD'):nav.boost?'BOOST ENGAGED':'FREE FLIGHT';
    $('drive-label').textContent=nav.mode==='walk'?'ON FOOT':nav.autoland?'AUTOLAND':nav.flightAssist?`ASSIST ×${nav.speedScale.toFixed(1)}`:'INERTIAL · V TO ASSIST';
    if(controller){$('state-text').textContent=$('state-text').textContent.replace(/\bF ·/g,'X / □ ·').replace(/\bL ·/g,'Y / △ ·');$('drive-label').textContent=$('drive-label').textContent.replace('V TO ASSIST','R3 TO ASSIST');}
    $('terrain-status').textContent=nearMoon?`${moon.terrain.visibleCount} PATCHES · LOD ${moon.terrain.maxLevel}`:`${planet.visibleCount} PATCHES · LOD ${planet.maxVisibleLevel}`;
    lastHud=time;
  }
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();nav.enabled=false;fatal('The graphics context was lost. Reload the page to restart your flight.');});
  function frame(time){
    requestAnimationFrame(frame);const realDt=last===null?0:Math.max(0,(time-last)/1000),dt=Math.min(realDt,.2);last=time;elapsed+=dt;
    if(document.hidden)return;
    station.update(nav.position,nav.position,nav.sunDirection,dt);
    const steps=Math.max(1,Math.ceil(dt/.025));for(let i=0;i<steps;i++)nav.update(dt/steps);
    if(resizePending){resize();resizePending=false;}
    origin.copy(nav.position);station.group.position.copy(station.worldPosition).sub(origin);camera.position.set(0,0,0);camera.quaternion.copy(nav.orientation);
    const sunDirection=nav.sunDirection,normal=nav.normal,altitude=nav.altitude;
    document.body.classList.toggle('exploring',altitude<12000||nav.mode!=='flight'||nav.stationDistance<2000);
    lighting.update(normal,sunDirection,altitude,nav.body.airless);
    moon.update(nav.position,origin,elapsed,!nav.insideShip);
    if(nav.stationDistance<500)lighting.sun.castShadow=true;
    planet.update(nav.position,origin,sunDirection,elapsed,Math.max(0,nav.position.length()-RADIUS));vegetation.setExclusion?.(nav.shipPosition);vegetation.update(nav.position,origin,elapsed);
    ship.visible=Boolean(nav.shipPosition)||(nav.mode==='flight'&&(nav.locked||nav.controllerActive));
    if(ship.visible){
      if(nav.shipPosition){ship.position.copy(nav.shipPosition).sub(origin);ship.quaternion.copy(nav.shipOrientation);}
      else{ship.quaternion.copy(nav.orientation);ship.position.set(...SHIP_LAYOUT.seatEye).applyQuaternion(nav.orientation).negate();}
      ship.setDoor(nav.doorOpen);ship.update(dt);
      ship.updateDisplays(dt,nav,inventory,course);
    }
    audio.update({speed:nav.speed,altitude,mode:nav.mode,boost:nav.boost,airless:nav.body.airless},dt);
    renderer.info.reset();atmosphere.render(scene,camera,nav.position,sunDirection,elapsed);
    frames++;frameAccumulator+=realDt;if(frameAccumulator>=2){fps=Math.round(frames/frameAccumulator);frames=0;frameAccumulator=0;if(automaticScale&&firstReady&&!transiting&&fps<23&&renderScale>.55){renderScale=Math.max(.55,renderScale*.85);resizePending=true;}}
    if(time-lastHud>150)updateHud(time);
    if(!firstReady&&planet.ready&&elapsed>1){firstReady=true;$('loading').classList.add('hidden');}
    if(planet.error)fatal(planet.error);
  }
  requestAnimationFrame(frame);
  // Explicit read-only diagnostics plus navigational hooks for reproducible browser tests.
  window.starAgent={get state(){return {moon:{effects:moon.effects,position:moon.worldPosition.toArray(),radius:MOON_RADIUS,altitude:bodyAltitude(nav.position,SELENE),patches:moon.terrain.visibleCount,lod:moon.terrain.maxLevel,distance:nav.position.distanceTo(moon.worldPosition)},controller:{connected:nav.gamepad.connected,active:nav.controllerActive,armed:nav.gamepad.armed,status:nav.gamepad.status},body:nav.body.id,seed:SEED,generatorVersion:GENERATOR_VERSION,position:nav.position.toArray(),altitude:nav.altitude,speed:nav.speed,mode:nav.mode,autoland:nav.autoland,flightAssist:nav.flightAssist,flightRegime:nav.flightEnvironment.regime,atmosphereFraction:nav.flightEnvironment.atmosphereFraction,velocity:nav.velocity.toArray(),angularVelocity:nav.angularVelocity.toArray(),groundHeight:nav.groundHeight,biome:nav.body.airless?`SELENE · ${moonRegion(...nav.normal.toArray())}`:biomeAt(...nav.normal.toArray()),sunDistance:nav.position.clone().sub(new THREE.Vector3(...SUN_DIRECTION).multiplyScalar(SUN_DISTANCE)).length(),patches:planet.visibleCount,lod:planet.maxVisibleLevel,pending:planet.pending,vegetation:vegetation.stats,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,ready:firstReady,transiting,fps,shipAsset:ship.userData.assetStatus,shipAssetError:ship.userData.assetError,storageOpen:ship.userData.storageOpen,storageProgress:ship.userData.storageProgress,inventory:inventory.snapshot,mfds:ship.displayState(),doorOpen:nav.doorOpen,doorProgress:nav.doorProgress,insideShip:nav.insideShip,station:{ready:station.ready,error:station.error,doorsOpen:station.doorsOpen,distance:nav.stationDistance,local:nav.stationLocal?.toArray(),deckClearance:nav.deckClearance,docked:nav.dockedAtStation,lifting:nav.stationLift,canDock:station.canDock(nav.position)},shipLocal:nav.toShipLocal()?.toArray(),interaction:nav.interaction,renderScale};},destinations,transit,land:()=>nav.landOrLaunch(),embark:()=>nav.embark(),setRenderScale(value){automaticScale=false;renderScale=THREE.MathUtils.clamp(value,.4,1);resizePending=true;},get navigation(){return import.meta.env.DEV||new URLSearchParams(location.search).has('debug')?nav:undefined;}};
}catch(error){console.error(error);fatal(`Could not start WebGL 2. Use a current desktop browser with hardware acceleration enabled. ${error.message}`);}
