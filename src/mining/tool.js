import * as THREE from 'three';
import { Equipment } from '../equipment.js';
import { MINERALS } from './volume.js';
import { POUCH_CAPACITY } from './store.js';
import './mining.css';

/** First-person socket adapter for the existing Equipment implementation. A full
 * character rig can later supply its hand sockets and the same validated onMine. */
export function createMiningTool({scene,camera,canvas,nav,rock}){
  const mount=new THREE.Group(),hand=new THREE.Bone(),back=new THREE.Bone();hand.name='RightHand';back.name='Spine2';
  hand.rotation.y=-Math.PI/2;back.visible=false;mount.add(hand,back);scene.add(mount);
  const sockets={rigs:{mannequin:{bones:{RightHand:'RightHand',Spine2:'Spine2'},items:{'mining-laser-tool':{position:[0,0,0],rotation:[0,0,0]}}}}};
  let hit=null,held=false,selected=true,active=false,mouseArmed=false,direction=new THREE.Vector3();
  const equipment=new Equipment({skeleton:{bones:[hand,back]}},scene,{camera,sockets,onMine:data=>{if(hit&&active)rock.onMine({...data,point:hit.point.clone()},direction);}});
  equipment.equip('mining-laser-tool');
  const lamp=new THREE.SpotLight(new THREE.Color(.82,.93,1),12,12,.58,.6,2);
  lamp.castShadow=true;lamp.shadow.mapSize.set(512,512);lamp.shadow.camera.near=.1;lamp.shadow.camera.far=12;lamp.shadow.bias=-.0002;lamp.shadow.normalBias=.015;
  scene.add(lamp,lamp.target);
  const panel=document.createElement('aside');panel.id='mining-panel';panel.hidden=true;
  panel.innerHTML='<div class="mining-eyebrow">SELENE / FIELD SURVEY</div><strong class="mining-target"></strong><p class="mining-guide"></p><div class="mining-heat"><span>LASER HEAT</span><meter min="0" max="1" value="0" aria-label="Mining laser heat"></meter></div><p class="mining-resources"></p><button type="button" class="mining-trigger">HOLD TO MINE</button><small class="mining-feedback" role="status"></small>';
  document.body.append(panel);const $=s=>panel.querySelector(s),button=$('.mining-trigger');
  const clear=()=>{held=false;mouseArmed=false;rock.budget=0;};
  canvas.addEventListener('pointerdown',e=>{if(e.button===0&&active&&nav.locked)held=true;});
  window.addEventListener('pointerup',()=>{held=false;mouseArmed=true;});
  window.addEventListener('blur',clear);document.addEventListener('visibilitychange',clear);document.addEventListener('pointerlockchange',clear);
  button.addEventListener('pointerdown',e=>{if(!active)return;e.preventDefault();held=true;button.setPointerCapture(e.pointerId);});
  button.addEventListener('pointerup',clear);button.addEventListener('pointercancel',clear);button.addEventListener('lostpointercapture',clear);
  button.addEventListener('keydown',e=>{if(active&&(e.code==='Space'||e.code==='Enter')){e.preventDefault();e.stopPropagation();held=true;}});
  button.addEventListener('keyup',e=>{if(e.code==='Space'||e.code==='Enter'){e.stopPropagation();clear();}});
  document.addEventListener('keydown',e=>{if(!active||e.repeat||e.target.closest('dialog,input'))return;if(e.code==='Digit3')selected=true;if(e.code==='KeyR')selected=!selected;});
  return {
    equipment,
    update(dt,origin){
      const distance=nav.position.distanceTo(rock.position);
      active=nav.mode==='walk'&&!nav.insideShip&&nav.body.id==='selene'&&nav.enabled&&nav.focused&&!document.hidden&&!document.querySelector('dialog[open]')&&distance<90;
      panel.hidden=!active;mount.visible=active&&selected;
      if(!active)clear();
      direction.set(0,0,-1).applyQuaternion(nav.orientation);
      hit=active?rock.raycast(nav.position,direction):null;
      lamp.visible=active&&selected;lamp.position.set(.15,-.18,0).applyQuaternion(nav.orientation);lamp.target.position.copy(direction).multiplyScalar(6);
      mount.position.set(.29,-.35,-.47).applyQuaternion(nav.orientation);mount.quaternion.copy(nav.orientation);mount.updateMatrixWorld(true);
      equipment.setRenderOrigin(origin);equipment.holster(!active||!selected);
      // Check muzzle obstruction too, so a close edge cannot be mined through.
      const muzzle=equipment.muzzleWorldPosition();
      if(hit&&muzzle){const to=hit.point.clone().sub(muzzle),length=to.length(),muzzleHit=rock.raycast(muzzle,to.normalize(),length+.1);if(muzzleHit&&muzzleHit.point.distanceTo(hit.point)>.22)hit=null;}
      const firing=active&&selected&&Boolean(held||nav.keys.has('KeyT')||nav.toolTrigger>.1)&&Boolean(hit)&&rock.store.free>.001&&!rock.error&&!rock.store.blocked;
      equipment.update(dt,{firing,targetWorldPoint:hit?.point});
      if(!firing)rock.budget=0;
      if(!active)return;
      const local=rock.position.clone().sub(nav.position).applyQuaternion(nav.orientation.clone().invert()),angle=Math.atan2(local.x,-local.z)*180/Math.PI;
      $('.mining-target').textContent=hit?'COPPER-BEARING BASALT':'CRESCENT DEPOSIT';
      $('.mining-guide').textContent=hit?`${hit.distance.toFixed(1)} m · Cut the rock to expose copper and ice`:`${distance.toFixed(0)} m · ${Math.abs(angle).toFixed(0)}° ${angle<0?'LEFT':'RIGHT'} · Tool range 8 m`;
      $('meter').value=equipment.heat;
      $('.mining-resources').textContent=`Pouch ${rock.store.mass.toFixed(2)} / ${POUCH_CAPACITY} kg · ${rock.store.state.pack.map((m,i)=>`${MINERALS[i]} ${m.toFixed(2)}`).join(' / ')}`;
      button.disabled=!hit||!selected||Boolean(rock.error)||rock.store.blocked||rock.store.free<.001;
      $('.mining-feedback').textContent=rock.error||rock.store.warning||(rock.store.free<.001?'Pouch full. Stow samples in the ship cargo locker.':equipment.overheated?'Cooling down…':!selected?'3 · Equip mining laser':rock.pending?'Cutting rock…':'Hold T / mouse / RT · R holsters · Cuts saved on this browser');
    },
    get state(){return {active,hit:hit?.point.toArray()??null,heat:equipment.heat,beaming:equipment.beaming,selected,toolError:equipment.error};},
  };
}
