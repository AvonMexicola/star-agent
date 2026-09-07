import * as THREE from 'three';
import { SHIP_LAYOUT } from '../boarding.js';
import { createWeaponTarget } from './weapon-target.js';
import { WEAPONS, weaponProfile } from './weapons.js';
import { shipWeaponStatus, stoppingDistance } from '../combat/flight-policy.js';

/** Input/pose adapter. A fires in flight; RT retains flight ascent and suit fire. */
export function createFlightEffects({effects,nav,mining,camera,onFire,getShip}){
  let cooldown=0,side=1,weapon='pulse',keyHeld=false,pointerHeld=false,controllerFire=false,controllerArmed=false;
  const position=new THREE.Vector3(),forward=new THREE.Vector3(),collector=new THREE.Vector3();
  const target=createWeaponTarget({nav,mining});
  const panel=document.createElement('aside');panel.id='ship-weapons';panel.hidden=true;
  panel.innerHTML='<span>SHIP / ENERGY ARRAY</span><button class="ship-combat-mode" type="button">COMBAT / CRUISE · Z</button><div class="ship-weapon-options"></div><button class="ship-trigger" type="button">HOLD TO FIRE</button><small>T · Fire / 1–3 · Weapon</small><small class="ship-motion"></small>';
  document.body.append(panel);const trigger=panel.querySelector('.ship-trigger');
  panel.querySelector('.ship-combat-mode').onclick=()=>{nav.toggleCombatMode();clear();};
  const clear=()=>{keyHeld=false;pointerHeld=false;controllerArmed=false;};
  const ready=()=>nav.mode==='flight'&&nav.powered!==false&&!nav.travel&&nav.enabled&&nav.focused&&!document.hidden&&!document.querySelector('dialog[open]');
  function select(id){if(!WEAPONS[id])return;weapon=id;clear();nav.gamepad.suspend();controllerFire=false;cooldown=.12;}
  for(const [i,[id,profile]] of Object.entries(Object.entries(WEAPONS))){
    const button=document.createElement('button');button.type='button';button.textContent=`${Number(i)+1} · ${profile.label}`;button.dataset.shipWeapon=id;button.onclick=()=>select(id);panel.querySelector('.ship-weapon-options').append(button);
  }
  document.addEventListener('keydown',e=>{
    if(!ready()||e.repeat||e.target.closest('input,dialog'))return;
    const id={Digit1:'pulse',Digit2:'laser',Digit3:'void'}[e.code];if(id)select(id);
    if(e.code==='KeyT')keyHeld=true;
  });
  document.addEventListener('keyup',e=>{if(e.code==='KeyT')keyHeld=false;});
  window.addEventListener('blur',clear);document.addEventListener('visibilitychange',clear);
  trigger.addEventListener('pointerdown',e=>{if(!ready())return;e.preventDefault();pointerHeld=true;trigger.setPointerCapture(e.pointerId);});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])trigger.addEventListener(event,()=>pointerHeld=false);
  trigger.addEventListener('keydown',e=>{if(['Space','Enter'].includes(e.code)){e.preventDefault();e.stopPropagation();if(!e.repeat&&ready())pointerHeld=true;}});
  trigger.addEventListener('keyup',e=>{if(['Space','Enter'].includes(e.code)){e.preventDefault();e.stopPropagation();pointerHeld=false;}});
  return {
    select,
    controller(pad){controllerFire=Boolean(pad.jump&&!pad.ui);},
    get state(){return {weapon,controllerFire,weaponStatus:shipWeaponStatus(nav),combatMode:nav.combatMode};},
    update(dt,origin,{suspended=false}={}){
      const active=ready()&&!suspended;
      panel.hidden=Boolean(nav.multiplayer?.connected)||nav.mode!=='flight'||Boolean(document.querySelector('dialog[open]'));
      if(!active)clear();
      else if(!controllerFire)controllerArmed=true;
      for(const b of panel.querySelectorAll('[data-ship-weapon]'))b.setAttribute('aria-pressed',String(b.dataset.shipWeapon===weapon));
      const status=shipWeaponStatus(nav),weaponsReady=status==='WEAPONS READY';
      trigger.disabled=!weaponsReady;
      panel.querySelector('.ship-combat-mode').textContent=`${nav.combatMode?'COMBAT':'CRUISE'} · Z / Menu`;
      panel.querySelector('small').textContent=weaponsReady?nav.controllerActive?'A / ✕ · Fire / Menu · Weapon':'T · Fire / 1–3 · Weapon':status;
      position.set(...(nav.layout??SHIP_LAYOUT).seatEye).applyQuaternion(nav.orientation).negate().add(nav.position);
      forward.set(0,0,-1).applyQuaternion(nav.orientation);
      const drift=nav.velocity.clone().addScaledVector(forward,-nav.velocity.dot(forward)).length();
      panel.querySelector('.ship-motion').textContent=`DRIFT ${drift.toFixed(0)} m/s · BRAKE ≈ ${Math.round(stoppingDistance(nav)).toLocaleString()} m`;
      cooldown=Math.max(0,cooldown-dt);
      if(active&&weaponsReady&&!nav.multiplayer?.connected&&(keyHeld||pointerHeld||(controllerArmed&&controllerFire))&&cooldown===0){
        const layout=nav.layout??SHIP_LAYOUT;
        const socket=layout.hardpoints?.find(p=>Math.sign(p.position[0])===side);
        const node=getShip?.()?.getObjectByName(socket?.name??(side<0?'HP_WingL':'HP_WingR'));
        const fallback=[side*2.35,layout.seatEye[1]-.7,layout.flightBounds.min[2]-.4];
        const offset=new THREE.Vector3(...(socket?.position??fallback)).sub(new THREE.Vector3(...layout.seatEye));
        const muzzle=()=>{
          if(nav.mode!=='flight')return null;
          if(node){node.updateWorldMatrix(true,false);return node.getWorldPosition(new THREE.Vector3()).add(origin);}
          return offset.clone().applyQuaternion(nav.orientation).add(nav.position);
        };
        const start=muzzle();
        const direction=nav.position.clone().addScaledVector(forward,400).sub(start).normalize();
        const speed=weaponProfile(weapon).speed,trajectory=Number.isFinite(speed)?direction.clone().multiplyScalar(speed).add(nav.velocity).normalize():direction;
        const hit=target(start,trajectory,origin);
        if(!onFire?.(start,direction,weapon,hit,nav.velocity,muzzle))effects.fire(start,direction,{hit,weapon,velocity:nav.velocity,muzzle});side*=-1;cooldown=weaponProfile(weapon).interval;
      }
      collector.set(.2,-.35,-.15).applyQuaternion(nav.orientation).add(nav.position);
      const throttle=active?Math.max(nav.keys.has('KeyW')?1:0,Math.min(1,Math.abs(nav.velocity.dot(forward))/200)):0;
      // Kestrel renders its authored engine cores/cones at the real nozzles.
      effects.update(dt,{origin,camera,shipPosition:nav.shipId==='kestrel'?null:position,shipQuaternion:nav.orientation,velocity:nav.velocity,flying:active,inSpace:nav.flightEnvironment.regime==='SPACE'&&nav.stationDistance>500,relativistic:Boolean(nav.travel),boost:nav.boost,throttle,mining:effects.miningInput,collector,suspended:suspended||!nav.focused||document.hidden});
    },
  };
}
