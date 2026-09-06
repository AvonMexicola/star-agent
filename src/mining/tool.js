import * as THREE from 'three';
import { createWeaponTarget } from '../effects/weapon-target.js';
import { Equipment } from '../equipment.js';
import { MINERALS } from './volume.js';
import './mining.css';

/** First-person socket adapter for the existing Equipment implementation. A full
 * character rig can later supply its hand sockets and the same validated onMine. */
export function createMiningTool({scene,camera,canvas,nav,rock,effects=null,loadout=null}){
  const mount=new THREE.Group(),hand=new THREE.Bone(),back=new THREE.Bone();hand.name='RightHand';back.name='Spine2';
  hand.rotation.y=-Math.PI/2;back.visible=false;mount.add(hand,back);scene.add(mount);
  const sockets={rigs:{mannequin:{bones:{RightHand:'RightHand',Spine2:'Spine2'},items:Object.fromEntries(['mining-laser-tool','rifle-laser','sidearm-pistol'].map(id=>[id,{position:[0,0,0],rotation:[0,0,0]}]))}}};
  let hit=null,held=false,keyHeld=false,selected=true,active=false,direction=new THREE.Vector3();
  const equipment=new Equipment({skeleton:{bones:[hand,back]}},scene,{camera,sockets,onMine:data=>{if(hit&&active)rock.onMine({...data,point:hit.point.clone(),normal:hit.normal?.clone(),target:hit.rock},direction);}});
  equipment.equip(loadout?.item??'mining-laser-tool');
  const weaponTarget=createWeaponTarget({nav,mining:rock});
  const lamp=new THREE.SpotLight(new THREE.Color(.82,.93,1),4,12,.58,.6,2);
  lamp.castShadow=true;lamp.shadow.mapSize.set(512,512);lamp.shadow.camera.near=.1;lamp.shadow.camera.far=12;lamp.shadow.bias=-.0002;lamp.shadow.normalBias=.015;
  scene.add(lamp,lamp.target);
  const panel=document.createElement('aside');panel.id='mining-panel';panel.hidden=true;
  panel.innerHTML='<div class="mining-eyebrow">SELENE / FIELD SURVEY</div><strong class="mining-target"></strong><p class="mining-guide"></p><div class="mining-heat"><span>LASER HEAT</span><meter min="0" max="1" value="0" aria-label="Mining laser heat"></meter></div><p class="mining-resources"></p><button type="button" class="mining-trigger">HOLD TO MINE</button><small class="mining-feedback" role="status"></small>';
  document.body.append(panel);const $=s=>panel.querySelector(s),button=$('.mining-trigger');
  const clear=()=>{held=false;keyHeld=false;rock.budget=0;if(effects)effects.miningInput=null;};
  function select(slot){clear();nav.gamepad.suspend();if(loadout){const result=loadout.select(slot);if(!result.ok)nav.notify(result.message);}else selected=slot!==null;}
  function cycle(){clear();nav.gamepad.suspend();if(loadout)loadout.cycle();}
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
    toggle(){select(loadout?(loadout.active==='tool'?null:'tool'):(selected?null:'tool'));},
    update(dt,origin){
      if(loadout){selected=Boolean(loadout.item);if(equipment.equipped!==loadout.item){clear();if(loadout.item)equipment.equip(loadout.item);else equipment.unequip();}}
      const isMining=equipment.equipped==='mining-laser-tool';
      const distance=nav.position.distanceTo(rock.position);
      active=(nav.mode==='walk'||nav.mode==='eva')&&!nav.insideShip&&nav.enabled&&nav.focused&&!document.hidden&&!document.querySelector('dialog[open]');
      panel.hidden=!active;mount.visible=active&&selected;
      if(!active)clear();
      direction.set(0,0,-1).applyQuaternion(nav.orientation);
      const inspected=active&&isMining?rock.inspectTarget?.(nav.position,direction,8):null;
      hit=active&&isMining?rock.raycast(nav.position,direction):null;
      lamp.visible=active&&selected;lamp.position.set(.15,-.18,0).applyQuaternion(nav.orientation);lamp.target.position.copy(direction).multiplyScalar(6);
      mount.position.set(equipment.equipped==='sidearm-pistol'?.25:.29,equipment.equipped==='sidearm-pistol'?-.25:-.35,-.47).applyQuaternion(nav.orientation);mount.quaternion.copy(nav.orientation);mount.updateMatrixWorld(true);
      equipment.setRenderOrigin(origin);equipment.holster(!active||!selected);
      // Check muzzle obstruction too, so a close edge cannot be mined through.
      const muzzle=equipment.muzzleWorldPosition();
      if(muzzle){lamp.position.copy(muzzle).sub(origin).addScaledVector(direction,.06);lamp.target.position.copy(lamp.position).addScaledVector(direction,6);}
      if(hit&&muzzle){const to=hit.point.clone().sub(muzzle),length=to.length(),muzzleHit=rock.raycast(muzzle,to.normalize(),length+.1);if(muzzleHit&&muzzleHit.point.distanceTo(hit.point)>.22)hit=null;}
      const firing=active&&selected&&Boolean(held||keyHeld||(nav.gamepad.armed&&nav.toolTrigger>.1))&&!rock.store.blocked&&(isMining?rock.store.free>.001&&!rock.error:loadout?.ammoFor()>0);
      equipment.update(dt,{firing,authorizeFire:item=>loadout?.spendRound(item)??false,hasHit:Boolean(hit),targetWorldPoint:hit?.point??(inspected?.distance<=8?inspected.point:null)??nav.position.clone().addScaledVector(direction,8)});
      if(effects&&!isMining&&equipment.firingInput()){
        const start=equipment.muzzleWorldPosition(),range=equipment.equipped==='rifle-laser'?1200:450;
        if(start){const target=weaponTarget(nav.position,direction,origin,range),end=target?.point??nav.position.clone().addScaledVector(direction,range),ray=end.clone().sub(start).normalize(),contact=weaponTarget(start,ray,origin,range);effects.fire(start,ray,{hit:contact,range,power:equipment.equipped==='rifle-laser'?.45:.32});}
      }
      if(effects){
        // Equipment still owns muzzle calibration, heat and validated cut requests.
        equipment.vfx.visible=false;
        const start=equipment.muzzleWorldPosition();
        effects.miningInput=isMining&&start&&equipment.beaming?{active:true,start,end:hit?.point.clone()??start.clone().addScaledVector(direction,8),hit:Boolean(hit),normal:hit?.normal?.clone()}:null;
      }
      if(!firing)rock.budget=0;
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
      const targetMessages={preparing:'Preparing this rock for mining…', 'too-large':'Large asteroid · Hand mining unavailable', 'save-full':'Survey save full · Previously edited rocks remain mineable', 'out-of-range':'Move within 8 m of the rock surface'};
      const targetMessage=targetMessages[inspected?.status];
      $('.mining-guide').textContent=targetMessage?`${inspected.distance.toFixed(1)} m · ${targetMessage}`:hit?`${hit.distance.toFixed(1)} m · Cut the rock to collect its minerals`:distance<40000?`${distance.toFixed(0)} m · ${Math.abs(angle).toFixed(0)}° ${angle<0?'LEFT':'RIGHT'} · Tool range 8 m`:'Aim at a mineral outcrop or small asteroid · Tool range 8 m';
      $('meter').value=equipment.heat;
      $('.mining-resources').textContent=`Pouch ${rock.store.mass.toFixed(2)} / ${rock.store.capacity??12} kg · ${rock.store.state.pack.map((m,i)=>`${MINERALS[i]} ${m.toFixed(2)}`).join(' / ')}`;
      button.disabled=!selected||Boolean(rock.error)||rock.store.blocked||rock.store.free<.001;
      $('.mining-feedback').textContent=rock.error||rock.store.warning||(rock.store.free<.001?'Pouch full. Stow samples in the ship cargo locker.':equipment.overheated?'Cooling down…':!selected?(nav.controllerActive?'D-pad → · Equip mining laser':'3 · Equip mining laser'):rock.pending?'Cutting rock…':(nav.controllerActive?'RT · Mine / D-pad → · Holster / View · Backpack':'Hold T / mouse · R holsters · I opens backpack'));
    },
    get state(){return {active,item:equipment.equipped,ammo:loadout?.ammoFor()??0,hit:hit?.point.toArray()??null,heat:equipment.heat,beaming:equipment.beaming,selected,target:rock.inspectState??null,toolError:equipment.error};},
  };
}
