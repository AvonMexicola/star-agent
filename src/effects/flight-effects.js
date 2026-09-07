import * as THREE from 'three';
import { SHIP_LAYOUT } from '../boarding.js';
import { createWeaponTarget } from './weapon-target.js';
import { WEAPONS } from './weapons.js';
import {shipWeaponStatus,stoppingDistance} from '../combat/flight-policy.js';
import { enginePresentation, engineExhaust } from './engine-state.js';

/** Input/pose adapter. RT fires in flight and on foot; movement stays independent. */
export function createFlightEffects({effects,nav,mining,camera,onFire,getShip}){
  let cooldown=0,weapon='pulse',keyHeld=false,pointerHeld=false,controllerFire=false,controllerArmed=false,lastShip=null;
  const position=new THREE.Vector3(),forward=new THREE.Vector3(),collector=new THREE.Vector3();
  const target=createWeaponTarget({nav,mining});
  const panel=document.createElement('aside');panel.id='ship-weapons';panel.hidden=true;
  panel.innerHTML='<span>SHIP / ENERGY ARRAY</span><button class="ship-combat-mode" type="button">COMBAT / CRUISE · Z</button><div class="ship-weapon-options"></div><button class="ship-trigger" type="button">HOLD TO FIRE</button><small>T · Fire / 1–3 · Weapon</small><small class="ship-motion"></small>';
  document.body.append(panel);const trigger=panel.querySelector('.ship-trigger');
  const clear=()=>{keyHeld=false;pointerHeld=false;controllerArmed=false;getShip?.()?.armament?.stop?.();};
  panel.querySelector('.ship-combat-mode').onclick=()=>{nav.toggleCombatMode();clear();};
  const ready=()=>nav.mode==='flight'&&nav.powered!==false&&!nav.travel&&nav.enabled&&nav.focused&&!document.hidden&&!document.querySelector('dialog[open]');
  const fireReady=()=>ready()&&!nav.multiplayer?.connected;
  function select(id){if(!WEAPONS[id])return;weapon=id;clear();nav.gamepad.suspend();controllerFire=false;cooldown=.12;}
  for(const [i,[id,profile]] of Object.entries(Object.entries(WEAPONS))){
    const button=document.createElement('button');button.type='button';button.textContent=`${Number(i)+1} · ${profile.label}`;button.dataset.shipWeapon=id;button.onclick=()=>select(id);panel.querySelector('.ship-weapon-options').append(button);
  }
  document.addEventListener('keydown',e=>{
    if(!fireReady()||e.repeat||e.target.closest('input,dialog'))return;
    const id={Digit1:'pulse',Digit2:'laser',Digit3:'void'}[e.code];if(id)select(id);
    if(e.code==='KeyT')keyHeld=true;
  });
  document.addEventListener('keyup',e=>{if(e.code==='KeyT')keyHeld=false;});
  window.addEventListener('blur',clear);document.addEventListener('visibilitychange',clear);
  trigger.addEventListener('pointerdown',e=>{if(!fireReady())return;e.preventDefault();pointerHeld=true;trigger.setPointerCapture(e.pointerId);});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])trigger.addEventListener(event,()=>pointerHeld=false);
  trigger.addEventListener('keydown',e=>{if(['Space','Enter'].includes(e.code)){e.preventDefault();e.stopPropagation();if(!e.repeat&&fireReady())pointerHeld=true;}});
  trigger.addEventListener('keyup',e=>{if(['Space','Enter'].includes(e.code)){e.preventDefault();e.stopPropagation();pointerHeld=false;}});
  return {
    select,
    controller(pad){controllerFire=Boolean(pad.fire>0&&!pad.ui);},
    get state(){return {weapon,controllerFire,armament:getShip?.()?.armament?.state??null,weaponStatus:shipWeaponStatus(nav),combatMode:nav.combatMode,engineVisuals:getShip?.()?.userData?.enginePresentation??null};},
    update(dt,origin,{suspended=false,engine=null}={}){
      const ship=getShip?.(),armament=ship?.armament;
      if(ship!==lastShip){clear();lastShip=ship;cooldown=.12;}
      if(armament?.status==='ready')armament.select(weapon);
      armament?.update?.(dt);
      const active=ready()&&!suspended;
      const secured=nav.gearProgress<=.001&&!nav.gearDeployed;
      const weaponStatus=shipWeaponStatus(nav);
      const armed=weaponStatus==='WEAPONS READY'&&active&&!nav.multiplayer?.connected&&secured&&armament?.status==='ready';
      panel.hidden=Boolean(nav.multiplayer?.connected)||nav.mode!=='flight'||Boolean(document.querySelector('dialog[open]'));
      if(!armed)clear();
      else if(!controllerFire)controllerArmed=true;
      for(const b of panel.querySelectorAll('[data-ship-weapon]'))b.setAttribute('aria-pressed',String(b.dataset.shipWeapon===weapon));
      panel.querySelector('small').textContent=nav.controllerActive?'RT / R2 · Fire / Menu → Ship · Weapon':'T · Fire / 1–3 · Weapon';
      const status=armament?.status==='ready'?'S'+armament.size+' / '+armament.state.mounts.length+' GUNS':'WEAPONS '+(armament?.status==='unavailable'?'UNAVAILABLE':'LOADING');
      panel.querySelector('span').textContent='SHIP / '+status;
      trigger.disabled=!armed;
      trigger.textContent=!secured?'GEAR DOWN · RAISE TO FIRE':weaponStatus==='WEAPONS READY'?'HOLD TO FIRE':weaponStatus;
      if(!secured)panel.querySelector('small').textContent=nav.controllerActive?'Raise landing gear: Menu → Ship → Gear':'Raise landing gear to fire · G';
      panel.querySelector('.ship-combat-mode').textContent=`${nav.combatMode?'COMBAT':'CRUISE'} · Z / Menu → Ship`;
      if(weaponStatus!=='WEAPONS READY')panel.querySelector('small').textContent=weaponStatus;
      position.set(...(nav.layout??SHIP_LAYOUT).seatEye).applyQuaternion(nav.orientation).negate().add(nav.position);
      forward.set(0,0,-1).applyQuaternion(nav.orientation);
      const drift=nav.velocity.clone().addScaledVector(forward,-nav.velocity.dot(forward)).length();
      panel.querySelector('.ship-motion').textContent=`DRIFT ${drift.toFixed(0)} m/s · BRAKE ≈ ${Math.round(stoppingDistance(nav)).toLocaleString()} m`;
      cooldown=Math.max(0,cooldown-dt);
      if(armed&&!nav.multiplayer?.connected&&(keyHeld||pointerHeld||(controllerArmed&&controllerFire))&&cooldown===0){
        const pose=armament.nextMuzzle({origin}),{position:start,direction,profile}=pose;
        const trajectory=Number.isFinite(profile.speed)?direction.clone().multiplyScalar(profile.speed).add(nav.velocity).normalize():direction;
        const hit=target(start,trajectory,origin,profile.range);
        const muzzlePosition=()=>nav.mode==='flight'&&getShip?.()===ship&&armament.state.type===pose.type?armament.muzzle(pose.index,{origin,type:pose.type})?.position:null;
        if(!onFire?.(start,direction,weapon,hit,profile,nav.velocity,muzzlePosition))effects.fire(start,direction,{hit,weapon,muzzle:false,muzzlePosition,velocity:nav.velocity,speed:profile.speed,range:profile.range,power:profile.power,color:profile.color,size:profile.size,pitch:profile.soundPitch});
        armament.fired(pose);cooldown=profile.interval;
      }
      collector.set(.2,-.35,-.15).applyQuaternion(nav.orientation).add(nav.position);
      const paused=suspended||!nav.enabled||!nav.focused||document.hidden||Boolean(document.querySelector('dialog[open]'));
      engine??=enginePresentation(nav,{suspended:paused});
      effects.update(dt,{origin,camera,engine,exhaust:engineExhaust(ship,engine.shipId),velocity:engine.velocity,flying:engine.flying&&engine.active,inSpace:nav.flightEnvironment.regime==='SPACE'&&nav.stationDistance>500,relativistic:Boolean(nav.travel),mining:effects.miningInput,collector,suspended:paused});
    },
  };
}
