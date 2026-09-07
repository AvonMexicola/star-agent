import * as THREE from 'three';
import { Plasma } from '../effects/energy-effects.js';
import { cargoAsset } from './visuals.js';
import { crateSize } from './grid.js';
import { aimedCrate,tractorSlot,TRACTOR_INTERVAL } from './tractor-physics.js';
import './tractor.css';

/** Presentation/input only. All custody, collision and movement commits go
 * through the same local/server cargo command API. */
export function createCargoTractor({scene,nav,api,ships,worldClear,getMuzzle}){
  const models=new Map(),beams=new Map(),panel=document.createElement('aside');panel.id='tractor-panel';panel.hidden=true;
  panel.innerHTML='<small>FIELD MULTITOOL / TRACTOR</small><strong class="tractor-target">Aim at an SBU crate</strong><p class="tractor-status" role="status"></p><div class="tractor-controls"><button data-tractor="near">↑ Pull closer</button><button data-tractor="far">↓ Push away</button><button data-tractor="align">← Align to ship</button><button data-tractor="stow">X · Secure grid</button><button data-tractor="power">HOLD RT / T · TRACTOR</button><button data-tractor="exit">→ Holster tractor</button></div>';
  document.body.append(panel);const $=s=>panel.querySelector(s),power=$('[data-tractor="power"]');
  const ghost=new THREE.BoxHelper(new THREE.Mesh(new THREE.BoxGeometry(1,1,1)),0xb6efd1);ghost.name='Tractor compatible grid slot';ghost.visible=false;scene.add(ghost);
  let busy=false,key=false,pointer=false,distance=2,elapsed=0,message='',target=null,slot=null,time=0,triggerBefore=false,requireRelease=false,lastOwner=null;
  const loose=()=>api.snapshot().loose??[],held=()=>loose().find(c=>c.holder===api.snapshot().owner&&c.until>Date.now());
  const live=()=>nav.tractorActive&&['walk','eva'].includes(nav.mode)&&nav.enabled&&nav.focused&&!document.hidden&&!nav.buildActive&&!nav.roverOccupied&&!document.querySelector('dialog[open]');
  const clear=()=>{key=false;pointer=false;requireRelease=true;nav.gamepad.suspend();};
  async function command(op,fields={}){
    if(busy)return;busy=true;
    try{const result=await api.command({op,...fields});if(result.message)message=result.message;}
    catch(e){message=e.message;requireRelease=true;key=false;pointer=false;}
    finally{busy=false;}
  }
  async function release(){const c=held();if(c&&!busy)await command('tractor-release',{crate:c.id});}
  function holster(){nav.tractorActive=false;clear();void release();}
  async function equip(){
    if(!['walk','eva'].includes(nav.mode)||api.snapshot().account?.carried)throw new Error('Stand with empty hands before equipping the tractor.');
    await api.equipTractor?.();nav.tractorActive=true;clear();message='Aim at a crate. Release controls, then hold RT / T to lock.';
  }
  function secure(){const c=held();if(!c||!slot||busy)return false;requireRelease=true;key=false;pointer=false;void command('tractor-stow',{crate:c.id,ship:slot.ship.id});return true;}
  function align(){const c=held(),ship=ships().find(s=>s.owner===api.snapshot().owner&&s.hull===nav.shipId);if(c&&ship)void command('tractor-align',{crate:c.id,ship:ship.id});}
  function adjust(delta){distance=THREE.MathUtils.clamp(distance+delta,.8,11);}
  $('[data-tractor="near"]').onclick=()=>adjust(-.5);$('[data-tractor="far"]').onclick=()=>adjust(.5);$('[data-tractor="align"]').onclick=align;$('[data-tractor="stow"]').onclick=secure;$('[data-tractor="exit"]').onclick=holster;
  power.addEventListener('pointerdown',e=>{if(!live())return;e.preventDefault();pointer=true;requireRelease=false;power.setPointerCapture(e.pointerId);});
  const pointerUp=()=>{pointer=false;};power.addEventListener('pointerup',pointerUp);power.addEventListener('pointercancel',clear);power.addEventListener('lostpointercapture',pointerUp);
  const down=e=>{if(!live()||e.repeat||e.target.closest('dialog,input,textarea'))return;if(e.code==='KeyT'){key=true;requireRelease=false;}if(e.code==='KeyR')holster();if(e.code==='BracketLeft')adjust(-.5);if(e.code==='BracketRight')adjust(.5);};
  const up=e=>{if(e.code==='KeyT')key=false;};
  const mouse=e=>{if(live()&&e.button===0&&nav.locked){pointer=true;requireRelease=false;}};
  document.addEventListener('keydown',down);document.addEventListener('keyup',up);nav.canvas.addEventListener('pointerdown',mouse);window.addEventListener('pointerup',pointerUp);window.addEventListener('blur',clear);document.addEventListener('visibilitychange',clear);document.addEventListener('pointerlockchange',clear);
  nav.onTractorHolster=holster;
  return {equip,holster,secure,get held(){return held();},get active(){return Boolean(nav.tractorActive);},
    get state(){return {active:Boolean(nav.tractorActive),held:held()?.id??null,target:target?.id??null,slot:slot?{ship:slot.ship.id,position:slot.position.toArray()}:null,distance,busy,message,beam:[...beams.values()].some(b=>b.mesh.visible),loose:models.size};},
    controller(pad){if(!nav.tractorActive||!live())return;for(const [index,action]of [[12,()=>adjust(-.5)],[13,()=>adjust(.5)],[14,align],[15,holster]])if(pad.pressed.has(index)){pad.pressed.delete(index);action();}},
    update(dt,origin){
      time+=dt;elapsed+=dt;const s=api.snapshot(),all=ships(),items=loose(),c=held(),active=live();
      if(lastOwner!==null&&lastOwner!==s.owner){nav.tractorActive=false;clear();}lastOwner=s.owner;
      panel.hidden=!active;
      let trigger=active&&Boolean(key||pointer||(nav.gamepad.armed&&nav.toolTrigger>.1));
      if(!trigger&&(!nav.controllerActive||nav.gamepad.armed))requireRelease=false;
      if(requireRelease)trigger=false;
      if(!active){key=false;pointer=false;requireRelease=true;}
      target=active&&!c?aimedCrate(nav.position,nav.orientation,all,items,worldClear):null;
      slot=null;if(c&&active){for(const ship of all.filter(x=>x.owner===s.owner)){const candidate=tractorSlot(ship,c,nav.position,all,items,worldClear);if(candidate){slot={...candidate,ship};break;}}}
      if(!busy){
        if(c&&(!trigger||!active))void release();
        else if(trigger&&c&&elapsed>=TRACTOR_INTERVAL){elapsed=0;void command('tractor-move',{crate:c.id,distance});}
        else if(trigger&&!triggerBefore&&target){distance=THREE.MathUtils.clamp(new THREE.Vector3(...target.position).distanceTo(nav.position),.8,11);elapsed=0;void command('tractor-grab',{crate:target.id,ship:target.ship});}
      }
      triggerBefore=trigger;
      $('.tractor-target').textContent=c?`${c.sbu} SBU · ${c.resource.toUpperCase()}`:target?`${target.sbu} SBU · ${target.resource.toUpperCase()}`:'Aim at an SBU crate';
      $('.tractor-status').textContent=c?`${distance.toFixed(1)} m hold distance · ${slot?'Grid ready — X to secure':'Guide toward your cargo grid'}${message?' · '+message:''}`:message||'12 m range · Larger crates move more slowly';
      $('[data-tractor="stow"]').disabled=!slot||busy;$('[data-tractor="align"]').disabled=!c||busy;
      ghost.visible=Boolean(slot&&active);if(slot){const half=new THREE.Vector3(...crateSize(c.sbu)).multiplyScalar(.5),box=new THREE.Box3(half.clone().negate(),half);ghost.box=box;const points=[];for(let i=0;i<8;i++)points.push(new THREE.Vector3(i&1?half.x:-half.x,i&2?half.y:-half.y,i&4?half.z:-half.z).applyQuaternion(slot.quaternion).add(slot.position).sub(origin));const indices=[0,1,0,2,0,4,1,3,1,5,2,3,2,6,3,7,4,5,4,6,5,7,6,7];ghost.geometry.setAttribute('position',new THREE.Float32BufferAttribute(indices.flatMap(i=>points[i].toArray()),3));ghost.geometry.setIndex(null);ghost.geometry.computeBoundingSphere();}
      const ids=new Set();for(const item of items){ids.add(item.id);let model=models.get(item.id);if(!model){model=new THREE.Group();model.name=`Tractored ${item.sbu} SBU`;model.userData.world=new THREE.Vector3(...item.position);model.quaternion.fromArray(item.quaternion);scene.add(model);models.set(item.id,model);cargoAsset(item.sbu).then(mesh=>{mesh.position.y=-crateSize(item.sbu)[1]/2+.01;model.add(mesh);}).catch(e=>{model.userData.error=e.message;});}
        model.userData.world.lerp(new THREE.Vector3(...item.position),1-Math.exp(-dt*18));model.position.copy(model.userData.world).sub(origin);model.quaternion.slerp(new THREE.Quaternion(...item.quaternion),1-Math.exp(-dt*14));model.visible=model.position.length()<2000;
        let beam=beams.get(item.id);if(!beam){beam=new Plasma(scene);beam.material.uniforms.color.value.setRGB(.18,1.4,.9);beams.set(item.id,beam);}
        const peer=s.online?s.players?.find(p=>p.id===item.holder):null;
        const own=item.holder===s.owner,start=own?(getMuzzle?.()??new THREE.Vector3(.25,-.3,-.5).applyQuaternion(nav.orientation).add(nav.position)):peer?new THREE.Vector3(...peer.position).add(new THREE.Vector3(.25,-.3,-.5).applyQuaternion(new THREE.Quaternion(...peer.orientation))):null;
        if(start&&item.until>Date.now()&&(!own||trigger&&active))beam.set(start,model.userData.world,.045,origin,time,.65);else beam.mesh.visible=false;
      }
      for(const[id,model]of models)if(!ids.has(id)){model.removeFromParent();models.delete(id);beams.get(id)?.dispose();beams.delete(id);}
    },
    dispose(){holster();panel.remove();ghost.removeFromParent();ghost.geometry.dispose();ghost.material.dispose();for(const model of models.values())model.removeFromParent();for(const beam of beams.values())beam.dispose();document.removeEventListener('keydown',down);document.removeEventListener('keyup',up);nav.canvas.removeEventListener('pointerdown',mouse);window.removeEventListener('pointerup',pointerUp);window.removeEventListener('blur',clear);document.removeEventListener('visibilitychange',clear);document.removeEventListener('pointerlockchange',clear);},
  };
}
