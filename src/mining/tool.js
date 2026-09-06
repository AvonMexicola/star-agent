import * as THREE from 'three';
import { Equipment } from '../equipment.js';
import { MINERALS } from './volume.js';
import './mining.css';

/** First-person socket adapter for the existing Equipment implementation. A full
 * character rig can later supply its hand sockets and the same validated onMine. */
export function createMiningTool({scene,camera,canvas,nav,rock,effects=null}){
  const mount=new THREE.Group(),hand=new THREE.Bone(),back=new THREE.Bone();hand.name='RightHand';back.name='Spine2';
  hand.rotation.y=-Math.PI/2;back.visible=false;mount.add(hand,back);scene.add(mount);
  const sockets={rigs:{mannequin:{bones:{RightHand:'RightHand',Spine2:'Spine2'},items:{'mining-laser-tool':{position:[0,0,0],rotation:[0,0,0]}}}}};
  let hit=null,held=false,selected=true,active=false,mouseArmed=false,direction=new THREE.Vector3();
  const equipment=new Equipment({skeleton:{bones:[hand,back]}},scene,{camera,sockets,onMine:data=>{if(hit&&active)rock.onMine({...data,point:hit.point.clone(),normal:hit.normal?.clone(),target:hit.rock},direction);}});
  equipment.equip('mining-laser-tool');
  const lamp=new THREE.SpotLight(new THREE.Color(.82,.93,1),4,12,.58,.6,2);
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
    toggle(){selected=!selected;clear();},
    update(dt,origin){
      const distance=nav.position.distanceTo(rock.position);
      active=(nav.mode==='walk'||nav.mode==='eva')&&!nav.insideShip&&nav.enabled&&nav.focused&&!document.hidden&&!document.querySelector('dialog[open]');
      panel.hidden=!active;mount.visible=active&&selected;
      if(!active)clear();
      direction.set(0,0,-1).applyQuaternion(nav.orientation);
      const inspected=active?rock.inspectTarget?.(nav.position,direction,8):null;
      hit=active?rock.raycast(nav.position,direction):null;
      lamp.visible=active&&selected;lamp.position.set(.15,-.18,0).applyQuaternion(nav.orientation);lamp.target.position.copy(direction).multiplyScalar(6);
      mount.position.set(.29,-.35,-.47).applyQuaternion(nav.orientation);mount.quaternion.copy(nav.orientation);mount.updateMatrixWorld(true);
      equipment.setRenderOrigin(origin);equipment.holster(!active||!selected);
      // Check muzzle obstruction too, so a close edge cannot be mined through.
      const muzzle=equipment.muzzleWorldPosition();
      if(muzzle){lamp.position.copy(muzzle).sub(origin).addScaledVector(direction,.06);lamp.target.position.copy(lamp.position).addScaledVector(direction,6);}
      if(hit&&muzzle){const to=hit.point.clone().sub(muzzle),length=to.length(),muzzleHit=rock.raycast(muzzle,to.normalize(),length+.1);if(muzzleHit&&muzzleHit.point.distanceTo(hit.point)>.22)hit=null;}
      const firing=active&&selected&&Boolean(held||nav.keys.has('KeyT')||nav.toolTrigger>.1)&&rock.store.free>.001&&!rock.error&&!rock.store.blocked;
      equipment.update(dt,{firing,hasHit:Boolean(hit),targetWorldPoint:hit?.point??(inspected?.distance<=8?inspected.point:null)??nav.position.clone().addScaledVector(direction,8)});
      if(effects){
        // Equipment still owns muzzle calibration, heat and validated cut requests.
        equipment.vfx.visible=false;
        const start=equipment.muzzleWorldPosition();
        effects.miningInput=start&&equipment.beaming?{active:true,start,end:hit?.point.clone()??start.clone().addScaledVector(direction,8),hit:Boolean(hit),normal:hit?.normal?.clone()}:null;
      }
      if(!firing)rock.budget=0;
      if(!active)return;
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
    get state(){return {active,hit:hit?.point.toArray()??null,heat:equipment.heat,beaming:equipment.beaming,selected,target:rock.inspectState??null,toolError:equipment.error};},
  };
}
