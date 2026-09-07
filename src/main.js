import { rockTextureState } from './rock-material.js';
import { Miasma } from './miasma.js';
import { MIASMA_POSITION, MIASMA_RADIUS, MIASMA_ATMOSPHERE, MIASMA_LIGHTING, MIASMA_ARRIVAL_ALTITUDE, MIASMA_SITES, miasmaSurface, miasmaArrivalDirection } from './miasma-world.js';
import * as THREE from 'three';
import './style.css';
import './player-interface.css';
import { OpeningSequence, openingStationOptions } from './opening-sequence.js';
import { createSystemMap } from './system-map.js';
import { TravelEffects } from './travel-effects.js';
import { LIGHT_SPEED } from './travel-model.js';
import { RADIUS, SUN_RADIUS, SUN_DISTANCE, SUN_DIRECTION, terrainHeight, biomeAt, findDestinations } from './world.js';
import { Planet } from './planet.js';
import { Moon } from './moon.js';
import { MOON_RADIUS, MOON_POSITION, MOON_LANDING_DIRECTION } from './moon-world.js';
import { Pyre, PYRE_MESH_RANGE } from './pyre.js';
import { PYRE_RADIUS, PYRE_POSITION, PYRE_ARRIVAL_ALTITUDE, pyreArrivalDirection, PYRE_ATMOSPHERE, PYRE_LIGHTING, PYRE_EPOCH, PYRE_GENERATOR_VERSION, VOLCANOES, LAVA_FIELDS, pyreLandingDirection, fromPyreBody, pyreRegion, pyreResources, pyreHeat } from './pyre-world.js';
import { Atmosphere } from './atmosphere.js';
import { SurfaceWeather } from './surface-weather.js';
import { Sun } from './sun.js';
import { SUN_POSITION, SUN_STANDOFF } from './stellar-world.js';
import { STELLAR_THERMAL, stellarExposure } from './stellar-thermal.js';
import { StellarDestruction, playStellarDestruction } from './stellar-destruction.js';
import { Station } from './station.js';
import { SELENE, PYRE, MIASMA, bodySurfacePoint, bodyAltitude } from './celestial.js';
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
  const surfaceWeather=new SurfaceWeather(scene,atmosphere,{enabled:new URLSearchParams(location.search).get('weather')!=='0'});
  function enterPlayerInterface(){
    if(document.body.classList.contains('player-active'))return;
    document.body.classList.add('player-active');
    for(const element of document.querySelectorAll('.topbar,.mission-panel,.statusbar'))element.inert=true;
  }
  nav.onTakeControl=enterPlayerInterface;
  const station=new Station(scene,introEnabled?openingStationOptions():{});nav.station=station;
  const stationButton=$('station-destination');
  station.readyPromise.then(()=>{stationButton.disabled=false;stationButton.querySelector('small').textContent='HANGAR · DOCK & EXPLORE';}).catch(()=>{stationButton.querySelector('small').textContent='STATION UNAVAILABLE';notify('Station unavailable. Planet flight is still available.');});
  const moon=new Moon(aeonGroup);
  const sun=new Sun(scene),destructionEffects=new StellarDestruction(scene);
  const pyre=new Pyre(scene);atmosphere.setBody(1,PYRE_POSITION,PYRE_RADIUS,PYRE_ATMOSPHERE);
  const miasma=new Miasma(scene);atmosphere.setBody(2,MIASMA_POSITION,MIASMA_RADIUS,MIASMA_ATMOSPHERE);
  const pyreDirection=new THREE.Vector3(),aeonDirection=new THREE.Vector3();let heat=0;
  const origin=new THREE.Vector3();
  const lighting=createLighting(renderer,scene);
  const ship=createWalkableShip();ship.visible=false;scene.add(ship);weatherShip(ship,planet.surfaceTexture);
  const opening=introEnabled?new OpeningSequence({scene,nav,station,onGesture:()=>{
    if(!audio.context)audio.toggle().then(enabled=>{$('sound-button').textContent=enabled?'SOUND ON':'SOUND OFF';$('sound-button').setAttribute('aria-pressed',String(enabled));});
  }}):null;
  if(opening)Promise.all([station.readyPromise,ship.readyPromise,opening.character.readyPromise]).then(()=>opening.start()).catch(error=>{
    opening.fail();notify('Opening unavailable. Starting in orbit.');console.warn('Opening fallback:',error);
  });
  let localInventoryStorage;try{localInventoryStorage=window.localStorage;}catch{}
  const inventory=new ShipInventory(localInventoryStorage);
  const inventoryUI=createInventoryUI(nav,ship,inventory);
  ship.readyPromise.then(model=>{if(model)weatherShip(model,planet.surfaceTexture);});
  $('planet-seed').textContent=`Terrestrial · Seed ${SEED.toLocaleString('en-US')}`;
  $('seed-input').value=SEED;
  $('seed-form').addEventListener('submit',event=>{event.preventDefault();const url=new URL(location.href);url.searchParams.set('seed',String($('seed-input').valueAsNumber));location.assign(url);});
  const destinations=findDestinations();
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
  function openHelp(){if(transiting||nav.mode==='destroyed'||opening?.active||inventoryUI.open||systemMap.open)return;if(document.pointerLockElement)document.exitPointerLock();nav.keys.clear();nav.enabled=false;help.showModal();}
  function closeHelp(){help.close();nav.enabled=!transiting;}
  $('help-button').addEventListener('click',openHelp);$('close-help').addEventListener('click',closeHelp);help.addEventListener('close',()=>{
    $('quick-transit-menu').open=false;
    nav.enabled=!transiting&&!document.querySelector('dialog[open]');
    if(nav.enabled)canvas.focus({preventScroll:true});
  });
  $('map-button').addEventListener('click',()=>{closeHelp();systemMap.openMap();});
  $('help-fly').addEventListener('click',()=>{closeHelp();capture();});
  $('sound-button').addEventListener('click',async()=>{const enabled=await audio.toggle();$('sound-button').textContent=enabled?'SOUND ON':'SOUND OFF';$('sound-button').setAttribute('aria-pressed',String(enabled));});
  nav.onControllerMenu=()=>{if(transiting||document.body.classList.contains('fatal'))return;if(systemMap.open)systemMap.close();else if(help.open)closeHelp();else if(nav.enabled&&!document.querySelector('dialog[open]'))openHelp();};
  nav.onControllerScroll=amount=>{if(help.open)help.scrollTop+=amount;};
  nav.onControllerHud=()=>photo();
  const photo=()=>{hidden=!hidden;document.body.classList.toggle('photo-mode',hidden);};$('photo-button').addEventListener('click',()=>{closeHelp();photo();});
  document.addEventListener('keydown',e=>{if(opening?.active||e.repeat||inventoryUI.open||systemMap.open)return;if(e.code==='KeyH'){help.open?closeHelp():openHelp();}if(e.code==='Tab'&&!help.open){e.preventDefault();photo();}if(e.code==='KeyO'&&!help.open)transit('orbit');});
  async function transit(name){
    if(nav.mode==='destroyed'||opening?.active||inventoryUI.open||systemMap.open||transiting||name==='station'&&!station.ready)return;opening?.leave();transiting=true;nav.enabled=false;nav.keys.clear();nav.velocity.set(0,0,0);
    if(document.pointerLockElement)document.exitPointerLock();
    const button=document.querySelector(`[data-destination="${name}"]`);$('transit-name').textContent=button.querySelector('strong').textContent.toUpperCase();$('transit').classList.add('active');
    await new Promise(r=>setTimeout(r,350));
    if(name==='star')nav.transitStar();
    else if(name==='moon')nav.transitMoon();
    else if(name==='pyre'){nav.transitPyre();}
    else if(name==='miasma'){nav.transitMiasma();}
    else if(name==='station'){const target=station.transitParams(180,6);nav.transit(target.direction,target.altitude);nav.orientToward(target.lookAt,target.up);}
    else if(name==='orbit')nav.orbit();else nav.transit(destinations[name],name==='mountain'?700:name==='polar'?90:95);
    for(const b of document.querySelectorAll('.destination'))b.classList.toggle('active',b===button);
    // This optional shortcut conceals its teleport while streamed terrain catches up.
    planet.cameraWorld.copy(nav.position);planet.select();
    const started=performance.now();
    const limit=name==='pyre'||name==='miasma'?12000:6500;
    while(performance.now()-started<limit){await new Promise(r=>setTimeout(r,150));if(performance.now()-started>1100 && planet.pending<4 && (name==='moon'?moon.terrain.maxLevel>=14:name==='pyre'?pyre.ready:name==='miasma'?miasma.ready:name==='star'||name==='orbit'||name==='station'||planet.maxVisibleLevel>=12))break;}
    $('transit').classList.remove('active');transiting=false;nav.enabled=true;
    notify(name==='star'?'Stellar observation point: 500,000 km above the photosphere. Space + Shift retreats; watch shield temperature.':name==='moon'?'Selene descent. L lands; F leaves the chair. Open the rear hatch and walk down the ramp to explore.':name==='miasma'?'Miasma: sulphur clouds, mineral basins and toxic air. Descend to land; surface exploration uses your sealed suit.':name==='pyre'?`Pyre, ${PYRE_ARRIVAL_ALTITUDE/1000} km above the twilight line. Sunlight left, glowing night side right; Miasma above the dark limb. Descend to explore.`:name==='station'?'Station approach. W enters the bay; X brakes. Over the central pad, L docks.':name==='orbit'?'High orbit. Click to fly. W approaches Aeon; Space moves away.':'Arrival complete. Click to fly · L lands · F leaves the pilot chair.');
  }
  for(const button of document.querySelectorAll('[data-destination]'))button.addEventListener('click',event=>{
    closeHelp();
    if(event.shiftKey)setCourse(button.dataset.destination);else transit(button.dataset.destination);
  });
  function updateHud(time){
    const controller=nav.controllerActive;
    document.body.classList.toggle('piloting',nav.locked||controller);
    $('controller-status').textContent=nav.gamepad.status;
    $('keyboard-hints').hidden=controller;$('controller-hints').hidden=!controller;
    const nearMoon=nav.body.id==='selene',onPyre=nav.body.id==='pyre',onMiasma=nav.body.id==='miasma',onStar=nav.body.star===true;
    const alt=nav.altitude,speed=nav.speed,n=nav.normal,flightEnv=nav.flightEnvironment;
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
    $('altitude-reference').textContent=onStar?'ABOVE PHOTOSPHERE':nearMoon?'ABOVE SELENE':onPyre?'ABOVE PYRE':onMiasma?'ABOVE MIASMA':'ABOVE AEON';
    $('altitude').textContent=alt>=1000?(alt/1000).toLocaleString('en-US',{maximumFractionDigits:1}):alt.toFixed(1);$('altitude-unit').textContent=alt>=1000?'km':'m';
    $('velocity').textContent=speed>=1000?(speed/1000).toLocaleString('en-US',{maximumFractionDigits:1}):Math.round(speed).toLocaleString();$('velocity-unit').textContent=speed>=1000?'km/s':'m/s';
    if(travel&&speed>LIGHT_SPEED*.001){$('velocity').textContent=(speed/LIGHT_SPEED).toFixed(3);$('velocity-unit').textContent='c';}
    $('altitude-meter').style.width=`${Math.min(100,Math.log10(alt+1)/7*100)}%`;
    const lat=Math.asin(n.y)*180/Math.PI,lon=Math.atan2(n.x,n.z)*180/Math.PI;
    $('latitude').textContent=`${Math.abs(lat).toFixed(3)}° ${lat>=0?'N':'S'}`;$('longitude').textContent=`${Math.abs(lon).toFixed(3)}° ${lon>=0?'E':'W'}`;
    const mode=nav.mode==='destroyed'?'SHIP DESTROYED':onStar?'STELLAR APPROACH':onMiasma?(nav.mode==='walk'?'MIASMA EXPLORATION':nav.mode==='landed'?'LANDED · MIASMA':alt>MIASMA_ATMOSPHERE.height?'MIASMA ORBIT':'MIASMA · TOXIC ATMOSPHERE'):nearMoon?(nav.mode==='walk'?'LUNAR EXPLORATION':nav.mode==='landed'?'LANDED · SELENE':'LUNAR FLIGHT'):onPyre?(nav.mode==='walk'?'PYRE EXPLORATION':nav.mode==='landed'?'LANDED · PYRE':flightEnv.regime==='SPACE'?'PYRE ORBIT':`PYRE FLIGHT · ATMO ${Math.round(flightEnv.atmosphereFraction*100)}%`):nav.dockedAtStation?(nav.mode==='walk'?'STATION EXPLORATION':'DOCKED'):nav.mode==='walk'?'SURFACE EXPLORATION':nav.mode==='landed'?'LANDED':flightEnv.regime==='SPACE'?'SPACE FLIGHT':flightEnv.regime==='TRANSITION'?`TRANSITION · ATMO ${Math.round(flightEnv.atmosphereFraction*100)}%`:'ATMOSPHERIC FLIGHT';
    $('mode-label').textContent=mode;$('biome').textContent=onStar?'OUR STAR · CORONA':onMiasma?`MIASMA · ${miasmaSurface(n.x,n.y,n.z).region}`:nearMoon?'SELENE · AIRLESS MOON':onPyre?(alt>PYRE_ATMOSPHERE.height?'PYRE · HOT INNER PLANET':`PYRE · ${pyreRegion(n.x,n.y,n.z)}`):nav.stationDistance<500?'AEON ORBITAL':alt>70000?'EXOSPHERE':biomeAt(n.x,n.y,n.z);$('fps').textContent=`${fps} FPS`;
    const survey=$('pyre-survey');survey.hidden=!(onPyre||onMiasma)||alt>2000000;survey.setAttribute('aria-label',`${nav.body.name} mineral survey`);
    if(onPyre||onMiasma){const profile=onMiasma?miasmaSurface(n.x,n.y,n.z).resources:pyreResources(n.x,n.y,n.z);$('pyre-composition').textContent=profile.ids.map((id,i)=>`${id.toUpperCase()} ${Math.round(profile.weights[i]*100)}%`).join(' · ');}
    $('toxic-warning').hidden=!onMiasma||alt>MIASMA_ATMOSPHERE.height;
    const heatWarning=$('heat-warning');heatWarning.hidden=heat<.3;heatWarning.classList.toggle('critical',heat>.75);heatWarning.textContent=`HULL TEMP ${Math.round(40+heat*360)} °C · ${heat>.75?'CRITICAL':'RISING'}`;
    $('state-text').textContent=nav.stationLift?'UNDOCKING':nav.autoland?(nav.stationDistance<500?'DOCKING ASSIST':'LANDING ASSIST'):nav.mode==='walk'||nav.mode==='landed'?nav.interaction:nav.stationDistance<500?(station.doorsOpen<.98?'HANGAR DOORS OPENING':station.canDock(nav.position)?'L · DOCK ON DECK':'FLY OVER THE CENTRAL PAD'):nav.boost?'BOOST ENGAGED':'FREE FLIGHT';
    $('drive-label').textContent=nav.mode==='walk'?'ON FOOT':nav.autoland?'AUTOLAND':nav.flightAssist?`ASSIST ×${nav.speedScale.toFixed(1)}`:'INERTIAL · V TO ASSIST';
    if(travel){$('mode-label').textContent='RELATIVISTIC DRIVE';$('drive-label').textContent='0.9c MAX';$('state-text').textContent='AUTOMATIC ARRIVAL BRAKING';}
    updateStellarHud();
    if(controller){$('state-text').textContent=$('state-text').textContent.replace(/\bF ·/g,'X / □ ·').replace(/\bL ·/g,'Y / △ ·');$('drive-label').textContent=$('drive-label').textContent.replace('V TO ASSIST','R3 TO ASSIST');}
    $('terrain-status').textContent=onStar?'STELLAR OBSERVATION':onMiasma?`${miasma.terrain.visibleCount} PATCHES · LOD ${miasma.terrain.maxLevel}`:nearMoon?`${moon.terrain.visibleCount} PATCHES · LOD ${moon.terrain.maxLevel}`:onPyre?`${pyre.terrain.visibleCount} PATCHES · LOD ${pyre.terrain.maxLevel}`:`${planet.visibleCount} PATCHES · LOD ${planet.maxVisibleLevel}`;
    lastHud=time;
  }
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
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();nav.enabled=false;fatal('The graphics context was lost. Reload the page to restart your flight.');});
  function frame(time){
    requestAnimationFrame(frame);const realDt=last===null?0:Math.max(0,(time-last)/1000),dt=nav.travel||opening?.active?realDt:Math.min(realDt,.2);last=time;elapsed+=dt;
    if(document.hidden||opening?.phase==='loading')return;
    const steps=nav.travel||opening?.active?1:Math.max(1,Math.ceil(dt/.025));for(let i=0;i<steps;i++)nav.update(dt/steps);
    opening?.update(firstReady?dt:0);
    if(resizePending){resize();resizePending=false;}
    origin.copy(nav.position);camera.position.set(0,0,0);camera.quaternion.copy(nav.orientation);
    if(!opening?.placeCamera(camera,origin)&&camera.fov!==52){camera.fov=52;camera.updateProjectionMatrix();}
    station.update(origin,origin,nav.sunDirection,dt);
    travelEffects.update(nav.enabled?dt:0,nav,camera);
    const sunDirection=nav.sunDirection,normal=nav.normal,altitude=nav.altitude;
    document.body.classList.toggle('exploring',nav.body.star||nav.body.id==='pyre'||nav.body.id==='miasma'||altitude<12000||nav.mode!=='flight'||nav.stationDistance<2000);
    const onPyre=nav.body.id==='pyre';
    lighting.update(normal,sunDirection,altitude,nav.body.airless,onPyre?PYRE_LIGHTING:nav.body.id==='miasma'?MIASMA_LIGHTING:null);
    aeonGroup.visible=nav.position.length()<PYRE_MESH_RANGE;
    moon.update(origin,origin);
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
    lighting.sun.intensity=inHangar?.65:3.4;
    if(nav.stationDistance<500)lighting.sun.castShadow=true;
    planet.update(origin,origin,sunDirection,elapsed,Math.max(0,nav.position.length()-RADIUS));vegetation.setExclusion?.(nav.shipPosition);vegetation.update(origin,origin,elapsed);
    ship.visible=Boolean(nav.shipPosition)||(nav.mode==='flight'&&(nav.locked||nav.controllerActive));
    if(ship.visible){
      if(nav.shipPosition){ship.position.copy(nav.shipPosition).sub(origin);ship.quaternion.copy(nav.shipOrientation);}
      else{ship.quaternion.copy(nav.orientation);ship.position.set(...SHIP_LAYOUT.seatEye).applyQuaternion(nav.orientation).negate();}
      ship.setDoor(nav.doorOpen);ship.update(dt);
      ship.updateDisplays(dt,nav,inventory,course);
    }
    camera.updateMatrixWorld();sun.update(origin,camera,dt,elapsed,{atmosphereFraction:nav.flightEnvironment.atmosphereFraction});atmosphere.setSun(sun);
    if(destructionEffects.update(nav.destruction,origin,dt))playStellarDestruction(audio);
    audio.update({speed:nav.speed,altitude,mode:nav.mode,boost:nav.boost,airless:nav.body.airless,inHangar,doorMotion:station.doorsOpen>0&&station.doorsOpen<1?1:0},dt);
    renderer.info.reset();atmosphere.render(scene,camera,origin,sunDirection,elapsed,nav.position.distanceTo(new THREE.Vector3(...SUN_DIRECTION).multiplyScalar(SUN_DISTANCE)));travelEffects.render(renderer,camera);
    frames++;frameAccumulator+=realDt;if(frameAccumulator>=2){fps=Math.round(frames/frameAccumulator);frames=0;frameAccumulator=0;if(automaticScale&&firstReady&&!transiting&&fps<23&&renderScale>.55){renderScale=Math.max(.55,renderScale*.85);resizePending=true;}}
    if(time-lastHud>150)updateHud(time);
    if(opening&&!firstReady&&planet.ready&&introWarmup>0)introWarmup--;
    if(!firstReady&&(opening?opening.phase!=='loading'&&planet.ready&&introWarmup===0:planet.ready&&elapsed>1)){firstReady=true;$('loading').classList.add('hidden');}
    if(planet.error)fatal(planet.error);
  }
  requestAnimationFrame(frame);
  // Explicit read-only diagnostics plus navigational hooks for reproducible browser tests.
  window.starAgent={get state(){return {surfaceWeather:surfaceWeather.state,rockMaterial:rockTextureState(),sun:{distance:sun.distance,clearance:sun.distance-SUN_RADIUS,angularRadius:sun.angularRadius,sphereVisible:sun.sphere.visible,diskWeight:sun.diskWeight,visibility:sun.visibility},stellarThermal:{...nav.stellarThermal},opening:opening?.state??{phase:'skipped'},camera:{position:origin.toArray(),fov:camera.fov},audio:{created:Boolean(audio.context),enabled:audio.enabled},travel:nav.travelState,travelTarget:nav.travelTarget,mapOpen:systemMap.open,tunnel:travelEffects.state,speedProfile:nav.speedProfile,moon:{position:moon.worldPosition.toArray(),radius:MOON_RADIUS,altitude:bodyAltitude(nav.position,SELENE),patches:moon.terrain.visibleCount,lod:moon.terrain.maxLevel,distance:nav.position.distanceTo(moon.worldPosition)},miasma:{...miasma.state,altitude:bodyAltitude(nav.position,MIASMA),surface:nav.body.id==='miasma'?miasmaSurface(...nav.normal.toArray()):null},pyre:{...pyre.state,altitude:bodyAltitude(nav.position,PYRE),ready:pyre.ready,epoch:PYRE_EPOCH,generatorVersion:PYRE_GENERATOR_VERSION,resources:nav.body.id==='pyre'?pyreResources(...nav.normal.toArray()):null,region:nav.body.id==='pyre'?pyreRegion(...nav.normal.toArray()):null},heat,controller:{connected:nav.gamepad.connected,active:nav.controllerActive,armed:nav.gamepad.armed,status:nav.gamepad.status},body:nav.body.id,seed:SEED,generatorVersion:GENERATOR_VERSION,position:nav.position.toArray(),altitude:nav.altitude,speed:nav.speed,mode:nav.mode,autoland:nav.autoland,flightAssist:nav.flightAssist,flightRegime:nav.flightEnvironment.regime,atmosphereFraction:nav.flightEnvironment.atmosphereFraction,velocity:nav.velocity.toArray(),angularVelocity:nav.angularVelocity.toArray(),groundHeight:nav.groundHeight,biome:nav.body.star?'OUR STAR · CORONA':nav.body.id==='selene'?'SELENE · AIRLESS MOON':nav.body.id==='miasma'?`MIASMA · ${miasmaSurface(...nav.normal.toArray()).region}`:nav.body.id==='pyre'?`PYRE · ${pyreRegion(...nav.normal.toArray())}`:biomeAt(...nav.normal.toArray()),sunDistance:nav.position.clone().sub(new THREE.Vector3(...SUN_DIRECTION).multiplyScalar(SUN_DISTANCE)).length(),patches:planet.visibleCount,lod:planet.maxVisibleLevel,pending:planet.pending,vegetation:vegetation.stats,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,ready:firstReady,transiting,fps,shipAsset:ship.userData.assetStatus,shipAssetError:ship.userData.assetError,storageOpen:ship.userData.storageOpen,storageProgress:ship.userData.storageProgress,inventory:inventory.snapshot,mfds:ship.displayState(),doorOpen:nav.doorOpen,doorProgress:nav.doorProgress,insideShip:nav.insideShip,station:{ready:station.ready,error:station.error,doorsOpen:station.doorsOpen,distance:nav.stationDistance,local:nav.stationLocal?.toArray(),deckClearance:nav.deckClearance,docked:nav.dockedAtStation,lifting:nav.stationLift,canDock:station.canDock(nav.position)},shipLocal:nav.toShipLocal()?.toArray(),interaction:nav.interaction,renderScale};},destinations,transit,land:()=>nav.landOrLaunch(),embark:()=>nav.embark(),setRenderScale(value){automaticScale=false;renderScale=THREE.MathUtils.clamp(value,.4,1);resizePending=true;},get openingSequence(){return new URLSearchParams(location.search).has('debug')?opening:undefined;},get surfaceWeather(){return new URLSearchParams(location.search).has('debug')?surfaceWeather:undefined;},get navigation(){return import.meta.env.DEV||new URLSearchParams(location.search).has('debug')?nav:undefined;},get miasmaSites(){return MIASMA_SITES;},get pyreSites(){return {landing:pyreLandingDirection(),volcanoes:VOLCANOES.map(v=>({name:v.name,height:v.height,active:v.active,direction:fromPyreBody(...v.direction)})),fields:LAVA_FIELDS.map(f=>({name:f.name,direction:fromPyreBody(...f.direction)}))};}};
}catch(error){console.error(error);fatal(`Could not start WebGL 2. Use a current desktop browser with hardware acceleration enabled. ${error.message}`);}
