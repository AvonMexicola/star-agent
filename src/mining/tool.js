import * as THREE from 'three';
import { createWeaponTarget } from '../effects/weapon-target.js';
import { Equipment, loadSocketCalibration } from '../equipment.js';
import { PLAYER_AVATAR } from '../player-avatar.js';
import { MINERALS } from './volume.js';
import { MINERAL_CAPACITY_PER_BOX } from '../inventory/containers.js';
import {isHandsFree,HANDS_FREE_REASON,createHubFireGate} from '../station-hub-policy.js';
import './mining.css';

/** One equipment instance moves between the first-person mount and the player's
 * rig. Both views use the same inventory, heat, ammunition and muzzle validation. */
export function createMiningTool({scene,camera,canvas,nav,rock,effects=null,loadout=null,character=null,thirdPerson=()=>false}){
  const mount=new THREE.Group(),hand=new THREE.Bone(),back=new THREE.Bone();hand.name='RightHand';back.name='Spine2';
  hand.rotation.y=-Math.PI/2;back.visible=false;mount.add(hand,back);scene.add(mount);
  const sockets={rigs:{mannequin:{bones:{RightHand:'RightHand',Spine2:'Spine2'},items:Object.fromEntries(['mining-laser-tool','rifle-laser','sidearm-pistol'].map(id=>[id,{position:[0,0,0],rotation:[0,0,0]}]))}}};
  let hit=null,held=false,keyHeld=false,selected=true,active=false,recoil=0,direction=new THREE.Vector3();
  let restrictedLast=false,inputSequence=0;
  const hubFire=createHubFireGate(),physicalPointers=new Set();
  const viewRig={skeleton:{bones:[hand,back]}};let rigSockets=null,external=false,attached=false;
  const aimOrigin=new THREE.Vector3(),handAim=new THREE.Vector3();
  loadSocketCalibration().then(value=>{rigSockets=value;});
  const equipment=new Equipment(viewRig,scene,{camera,sockets,onMine:data=>{if(hit&&active)rock.onMine({...data,point:hit.point.clone(),normal:hit.normal?.clone(),target:hit.rock},direction);}});
  equipment.equip(loadout?.item??'mining-laser-tool');
  const weaponTarget=createWeaponTarget({nav,mining:rock});
  const panel=document.createElement('aside');panel.id='mining-panel';panel.hidden=true;
  panel.innerHTML='<div class="mining-eyebrow">SELENE / FIELD SURVEY</div><strong class="mining-target"></strong><div class="field-equipment"><button data-field-item="rifle-laser">1 · Carbine</button><button data-field-item="sidearm-pistol">2 · Sidearm</button><button data-field-item="mining-laser-tool">3 · Cutter</button></div><p class="mining-guide"></p><div class="mining-heat"><span>LASER HEAT</span><meter min="0" max="1" value="0" aria-label="Mining laser heat"></meter></div><p class="mining-resources"></p><button type="button" class="mining-trigger">HOLD TO MINE</button><small class="mining-feedback" role="status"></small>';
  document.body.append(panel);const $=s=>panel.querySelector(s),button=$('.mining-trigger');
  const clear=()=>{held=false;keyHeld=false;recoil=0;if(!nav.roverOccupied)rock.budget=0;if(effects)effects.miningInput=null;};
  function select(slot){clear();nav.gamepad.suspend();if(slot!==null&&isHandsFree(nav)){nav.notify(HANDS_FREE_REASON);return;}if(loadout){const result=loadout.select(slot);if(!result.ok)nav.notify(result.message);}else selected=slot!==null;}
  function cycle(){clear();nav.gamepad.suspend();if(isHandsFree(nav)){nav.notify(HANDS_FREE_REASON);return;}if(loadout){const result=loadout.cycle();if(!result.ok)nav.notify(result.message);}}
  // Keep a physical hold separate from clear(), which stops effects. A held
  // finger surviving a modal or arrival is not a fresh trigger.
  document.addEventListener('pointerdown',e=>{if(e.button===0&&(nav.locked||e.target.closest?.('.mining-trigger')))physicalPointers.add(e.pointerId);});
  const releasePointer=e=>physicalPointers.delete(e.pointerId);
  window.addEventListener('pointerup',releasePointer);window.addEventListener('pointercancel',releasePointer);
  window.addEventListener('blur',()=>physicalPointers.clear());
  canvas.addEventListener('pointerdown',e=>{if(e.button===0&&active&&nav.locked)held=true;});
  window.addEventListener('pointerup',()=>{held=false;});
  window.addEventListener('blur',clear);document.addEventListener('visibilitychange',clear);document.addEventListener('pointerlockchange',clear);
  button.addEventListener('pointerdown',e=>{if(!active)return;e.preventDefault();held=true;button.setPointerCapture(e.pointerId);});
  button.addEventListener('pointerup',clear);button.addEventListener('pointercancel',clear);button.addEventListener('lostpointercapture',clear);
  button.addEventListener('keydown',e=>{if(active&&(e.code==='Space'||e.code==='Enter')){e.preventDefault();e.stopPropagation();held=true;}});
  button.addEventListener('keyup',e=>{if(e.code==='Space'||e.code==='Enter'){e.stopPropagation();clear();}});
  document.addEventListener('keydown',e=>{if(!active||e.repeat||e.target.closest('dialog,input'))return;if(e.code==='KeyT')keyHeld=true;const slot={Digit1:'weapon1',Digit2:'weapon2',Digit3:'tool'}[e.code];if(slot)select(slot);if(e.code==='KeyR')select(null);});
  document.addEventListener('keyup',e=>{if(e.code==='KeyT')keyHeld=false;});
  return {
    equipment,select,cycle,
    get pose(){const held=!isHandsFree(nav)&&!nav.buildActive&&(nav.mode==='walk'||nav.mode==='eva')&&!nav.openingActive&&!nav.insideShip&&nav.enabled&&nav.focused&&!document.querySelector('dialog[open]');return {aiming:held?equipment.aimingInput():'none',firing:held&&equipment.firingInput()};},
    toggle(){select(loadout?(loadout.active==='tool'?null:'tool'):(selected?null:'tool'));},
    update(dt,origin){
      const restricted=isHandsFree(nav);
      const triggerReady=hubFire.update(restricted,Boolean(physicalPointers.size||nav.physicalKeys?.has('KeyT')||nav.toolTrigger>.1),++inputSequence);
      if(restricted&&!restrictedLast){clear();nav.gamepad.suspend();if(loadout&&!nav.multiplayer?.connected)loadout.select(null);else if(!loadout)selected=false;}
      restrictedLast=restricted;
      if(loadout){selected=Boolean(loadout.item);if(equipment.equipped!==loadout.item){clear();if(loadout.item)equipment.equip(loadout.item);else equipment.unequip();}}
      const isMining=equipment.equipped==='mining-laser-tool';
      const distance=nav.position.distanceTo(rock.position);
      active=!restricted&&!nav.buildActive&&(nav.mode==='walk'||nav.mode==='eva')&&!nav.openingActive&&!nav.insideShip&&nav.enabled&&nav.focused&&!document.hidden&&!document.querySelector('dialog[open]');
      panel.hidden=!active;
      external=thirdPerson();
      attached=Boolean(external&&character?.ready&&rigSockets);
      equipment.bindCharacter(attached?character:viewRig,attached?PLAYER_AVATAR.rig:'mannequin',attached?rigSockets:sockets);
      mount.visible=active&&selected&&!external;
      if(!active)clear();
      direction.set(0,0,-1).applyQuaternion(external?camera.quaternion:nav.orientation);
      aimOrigin.copy(external?origin:nav.position);
      const rayRange=8+aimOrigin.distanceTo(nav.position);
      const inspected=active&&isMining?rock.inspectTarget?.(aimOrigin,direction,8,nav.position):null;
      hit=active&&isMining?rock.raycast(aimOrigin,direction,rayRange):null;
      if(hit&&hit.point.distanceTo(nav.position)>8)hit=null;
      if(hit)hit={...hit,distance:hit.point.distanceTo(nav.position)};
      if(hit&&nav.buildingRaycast?.(aimOrigin,direction,aimOrigin.distanceTo(hit.point)))hit=null;
      recoil*=Math.exp(-dt*18);
      mount.position.set(equipment.equipped==='sidearm-pistol'?.25:.29,equipment.equipped==='sidearm-pistol'?-.25:-.35,-.47+recoil).applyQuaternion(nav.orientation);mount.position.add(nav.position.clone().sub(origin));mount.quaternion.copy(nav.orientation);mount.updateMatrixWorld(true);
      const gesture=character?.gestureActive==='wave'||character?.state==='dead';
      equipment.setRenderOrigin(origin);equipment.holster(!active||!selected||gesture);
      const weaponRange=equipment.equipped==='rifle-laser'?1200:450;
      const sightTarget=attached&&active&&selected&&!gesture&&!isMining?weaponTarget(aimOrigin,direction,origin,weaponRange):null;
      const sightEnd=sightTarget?.point??aimOrigin.clone().addScaledVector(direction,weaponRange);
      if(attached&&active&&selected&&!gesture){
        const wrist=equipment.muzzleWorldPosition();
        handAim.copy(isMining?(hit?.point??aimOrigin.clone().addScaledVector(direction,8)):sightEnd);
        handAim.sub(wrist??nav.position).normalize();
        equipment.aimHeld(handAim);
      }
      // Check muzzle obstruction too, so a close edge cannot be mined through.
      const muzzle=equipment.muzzleWorldPosition();
      if(hit&&muzzle){const obstruction=nav.buildingRaycast?.(muzzle,hit.point.clone().sub(muzzle).normalize(),muzzle.distanceTo(hit.point));if(obstruction)hit=null;}
      if(hit&&muzzle){const to=hit.point.clone().sub(muzzle),length=to.length(),muzzleHit=rock.raycast(muzzle,to.normalize(),length+.1);if(muzzleHit&&muzzleHit.point.distanceTo(hit.point)>.22)hit=null;}
      const firing=triggerReady&&active&&selected&&!gesture&&Boolean(held||keyHeld||(nav.gamepad.armed&&nav.toolTrigger>.1))&&!rock.store.blocked&&(isMining?rock.store.free>.001&&!rock.error:loadout?.ammoFor()>0);
      equipment.update(dt,{firing,authorizeFire:item=>loadout?.spendRound(item)??false,hasHit:Boolean(hit),targetWorldPoint:hit?.point??(inspected?.point?.distanceTo(nav.position)<=8?inspected.point:null)??aimOrigin.clone().addScaledVector(direction,rayRange)});
      if(effects&&!isMining&&equipment.firingInput()){
        const start=equipment.muzzleWorldPosition(),range=weaponRange;
        if(start){
          const rifle=equipment.equipped==='rifle-laser';
          const target=attached?sightTarget:weaponTarget(aimOrigin,direction,origin,range),end=target?.point??sightEnd;
          const ray=end.clone().sub(start).normalize();
          const trajectory=rifle?ray:ray.clone().multiplyScalar(450).add(nav.velocity).normalize();
          const contact=weaponTarget(start,trajectory,origin,range);
          if(contact?.kind==='fauna')nav.onFaunaWeaponHit?.(contact,equipment.equipped);
          effects.fire(start,ray,{hit:contact,range,velocity:nav.velocity,muzzlePosition:()=>active&&equipment.equipped===(rifle?'rifle-laser':'sidearm-pistol')?equipment.muzzleWorldPosition():null,sound:rifle?'carbine':'sidearm',weapon:rifle?'laser':'pulse',color:rifle?0xff902d:0xff395f,power:rifle?.45:.32});
          if(!effects.reducedMotion)recoil=rifle?.065:.04;
        }
      }
      if(effects){
        // Equipment still owns muzzle calibration, heat and validated cut requests.
        equipment.vfx.visible=false;
        const start=equipment.muzzleWorldPosition();
        effects.miningInput=isMining&&start&&equipment.beaming?{active:true,start,end:hit?.point.clone()??start.clone().addScaledVector(direction,8),hit:Boolean(hit),normal:hit?.normal?.clone()}:null;
      }
      if(!firing)if(!nav.roverOccupied)rock.budget=0;
      if(!active)return;
      $('.mining-heat').hidden=!isMining;button.textContent=isMining?'HOLD TO MINE':'HOLD TO FIRE';
      if(!isMining){
        $('.mining-eyebrow').textContent='SUIT / EQUIPMENT';
        $('.mining-target').textContent=equipment.item?.label.toUpperCase()??'HANDS FREE';
        $('.mining-guide').textContent=selected?'RT / mouse · Fire · D-pad left · Cycle weapons':'Select a weapon or tool from Equipment.';
        $('.mining-resources').textContent=selected?`${loadout?.ammoFor()??0} compatible charges in ammo slots`:'1 / 2 · Weapons · 3 · Mining tool';
        $('.mining-feedback').textContent=rock.store.warning||(!selected?'K / Menu · Equipment':loadout?.ammoFor()>0?'K / View · Manage equipment and ammo':'No compatible ammo equipped. Open Equipment.');
        button.disabled=!selected||rock.store.blocked||!(loadout?.ammoFor()>0);return;
      }
      const local=rock.position.clone().sub(nav.position).applyQuaternion(nav.orientation.clone().invert()),angle=Math.atan2(local.x,-local.z)*180/Math.PI;
      $('.mining-eyebrow').textContent=nav.mode==='eva'?`SUIT TOOL / EVA · ${nav.speed.toFixed(1)} m/s`:`${nav.body.id.toUpperCase()} / FIELD TOOL`;
      $('.mining-target').textContent=(inspected?.name??(distance<40000?rock.targetName:'Mining laser')??'Mining laser').toUpperCase();
      const targetMessages={preparing:'Preparing this rock for mining…', 'too-large':'Too large for the handheld cutter', 'save-full':'Survey save full · Previously edited rocks remain mineable', 'out-of-range':'Move within 8 m of the rock surface'};
      const targetMessage=targetMessages[inspected?.status];
      $('.mining-guide').textContent=targetMessage?`${inspected.distance.toFixed(1)} m · ${targetMessage}`:hit?`${hit.distance.toFixed(1)} m · Cut the rock to collect its minerals`:distance<40000?`${distance.toFixed(0)} m · ${Math.abs(angle).toFixed(0)}° ${angle<0?'LEFT':'RIGHT'} · Tool range 8 m`:'Aim at a mineral outcrop or small asteroid · Tool range 8 m';
      $('meter').value=equipment.heat;
      $('.mining-resources').textContent=`Pouch ${rock.store.mass.toFixed(2)} / ${rock.store.capacity??MINERAL_CAPACITY_PER_BOX} kg · ${rock.store.state.pack.map((m,i)=>`${MINERALS[i]} ${m.toFixed(2)}`).join(' / ')}`;
      button.disabled=!selected||Boolean(rock.error)||rock.store.blocked||rock.store.free<.001;
      $('.mining-feedback').textContent=rock.error||rock.store.warning||(rock.store.free<.001?'Pouch full. Use Deposit all resources at ship cargo.':equipment.overheated?'Cooling down…':!selected?(nav.controllerActive?'D-pad → · Equip mining laser':'3 · Equip mining laser'):rock.pending?'Cutting rock…':(nav.controllerActive?'RT · Mine / D-pad → · Holster / View · Backpack':'Hold T / mouse · R holsters · I opens backpack'));
    },
    get state(){return {active,muzzleDirection:equipment.muzzleWorldDirection()?.toArray()??null,aimDirection:direction.toArray(),attachment:external?(attached?'character-hand':'loading'):'first-person',item:equipment.equipped,ammo:loadout?.ammoFor()??0,hit:hit?.point.toArray()??null,heat:equipment.heat,beaming:equipment.beaming,selected,target:rock.inspectState??null,toolError:equipment.error};},
  };
}
