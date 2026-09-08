import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {Character} from '../character.js';
import {Equipment,loadSocketCalibration} from '../equipment.js';
import {bodyAltitude} from '../celestial.js';
import {parkedShipHit} from '../fauna/fauna-target.js';
import {createPirateSites,PIRATE_ROLES} from './sites.js';
import {createPirateSquad} from './simulation.js';
import {ensurePirateLoot} from './loot.js';
import {createPirateNaturalObstacles} from './obstacles.js';
import {secondaryTouchButtons} from '../secondary-touch-buttons.js';
import './pirates.css';
const V=a=>new THREE.Vector3(...a);
const nearest=hits=>hits.filter(Boolean).sort((a,b)=>a.distance-b.distance)[0]??null;
export function createPirates({scene,nav,mining,loadout,store,effects,medical,character:player,online=()=>false,transit,openInventory}){
 const natural=createPirateNaturalObstacles(mining);
 const sites=createPirateSites(),camps=new Map(),assets=new Map(),actors=new Map();
 let disposed=false,active=null,origin=new THREE.Vector3(),shotCount=0,lastHit=null,sockets=null;
 void loadSocketCalibration().then(s=>sockets=s);
 const hud=document.createElement('aside');hud.id='pirate-status';hud.hidden=true;hud.innerHTML='<strong></strong><meter min="0" aria-label="Pirate health"></meter><span></span><small>C / R3 · Crouch &nbsp; RT / T · Fire &nbsp; D-pad down · Medical item</small><button class="pirate-crouch-touch" type="button" aria-pressed="false">Crouch</button>';document.body.append(hud);
 const crouchButton=hud.querySelector('button');crouchButton.onclick=()=>nav.toggleCrouch();const disposeTouch=secondaryTouchButtons(hud);
 const lootButton=document.createElement('button');lootButton.className='pirate-loot-button';lootButton.hidden=true;lootButton.textContent='F / X · Recover salvage cache';lootButton.onclick=()=>interact();document.body.append(lootButton);
 const dialog=document.createElement('dialog');dialog.id='pirate-console';dialog.setAttribute('aria-labelledby','pirate-console-title');dialog.innerHTML='<h2 id="pirate-console-title">Ground pirate camps</h2><p>Land outside the camp, leave your ship and recover the stolen supplies. Equip your carbine with 1 / D-pad left. Captains aim before firing: move or duck behind the salvage barriers.</p><div class="pirate-sites"></div><footer><button data-controller-key="pirate-close">Resume exploration</button></footer>';
 for(const site of sites){const article=document.createElement('article');article.innerHTML=`<h3>${site.name}</h3><p>${site.description}</p><button data-controller-key="pirate-visit-${site.id}">Quick transit · ${site.body.name} camp approach</button>`;article.querySelector('button').onclick=()=>{dialog.addEventListener('close',()=>transit(site.id),{once:true});dialog.close();};dialog.querySelector('.pirate-sites').append(article);}
 dialog.querySelector('button').setAttribute('data-controller-focus','');dialog.querySelector('[data-controller-key="pirate-close"]').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{nav.keys.clear();nav.toolTrigger=0;nav.gamepad.suspend();nav.enabled=!document.querySelector('dialog[open]');});document.body.append(dialog);
 function open(){if(online()){nav.notify('Ground pirate encounters are available in solo play.');return;}if(document.querySelector('dialog[open]'))return;nav.enabled=false;nav.keys.clear();nav.toolTrigger=0;nav.gamepad.suspend();if(document.pointerLockElement)document.exitPointerLock();dialog.showModal();dialog.querySelector('[data-controller-focus]').focus();}
 function request(id){
  if(assets.has(id))return assets.get(id);
  const state={status:'loading',gltf:null,error:null};assets.set(id,state);
  new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/pirates/${id}.glb`).then(gltf=>{if(disposed){disposeGLTF(gltf);return;}state.gltf=gltf;state.status='ready';}).catch(e=>{state.status='error';state.error=e.message;console.error('Pirate asset',id,e);});return state;
 }
 function coverRay(site,start,direction,range,padding=0){
  const inverse=new THREE.Quaternion().fromArray(site.rotation).invert(),s=start.clone().sub(V(site.origin)).applyQuaternion(inverse),d=direction.clone().applyQuaternion(inverse),ray=new THREE.Ray(s,d);let best=null;
  for(const cover of site.cover){const ground=site.local(site.ground(cover.x,cover.z)).y;
   const box=new THREE.Box3(new THREE.Vector3(cover.x-cover.w/2-padding,ground-padding,cover.z-cover.d/2-padding),new THREE.Vector3(cover.x+cover.w/2+padding,ground+cover.h+padding,cover.z+cover.d/2+padding));
   const p=ray.intersectBox(box,new THREE.Vector3());if(!p)continue;const distance=p.distanceTo(s);if(distance>range||distance>=(best?.distance??Infinity))continue;
   const normal=new THREE.Vector3();const faces=[[Math.abs(p.x-box.min.x),[-1,0,0]],[Math.abs(p.x-box.max.x),[1,0,0]],[Math.abs(p.y-box.max.y),[0,1,0]],[Math.abs(p.z-box.min.z),[0,0,-1]],[Math.abs(p.z-box.max.z),[0,0,1]]].sort((a,b)=>a[0]-b[0]);normal.fromArray(faces[0][1]).applyQuaternion(new THREE.Quaternion().fromArray(site.rotation));
   best={kind:'pirate-cover',distance,point:start.clone().addScaledVector(direction,distance),normal};
  }return best;
 }
 function obstruction(site,start,end,padding=0){const ray=end.clone().sub(start),range=ray.length();if(range<.001)return null;ray.divideScalar(range);
  const solid=nearest([coverRay(site,start,ray,range,padding),parkedShipHit(nav,start,ray,range,padding),nav.buildingRaycast?.(start,ray,range),natural.raycast(start,ray,range)]);if(solid)return solid;
  for(let t=.3;t<range;t+=.5)if(bodyAltitude(start.clone().addScaledVector(ray,t),site.body)<.04)return {distance:t};return null;
 }
 function createCamp(site){
  const group=new THREE.Group();group.name=site.name;group.quaternion.fromArray(site.rotation);scene.add(group);
  const camp={site,group,squad:null,ready:false};camps.set(site.id,camp);
  const prop=request('barricade');const cache=request('salvage-cache');for(const id of site.models)request(id);
  camp.squad=createPirateSquad(site,{
   canMove:(e,to)=>{const a=site.ground(e.x,e.z,.65),b=site.ground(to.x,to.z,.65);return Math.abs(b.clone().sub(a).dot(V(site.up)))<.2&&!obstruction(site,a,b,.32)&&natural.canWalk(site.ground(e.x,e.z,1.75),site.ground(to.x,to.z,1.75));},
   visible:(e,p,crouch)=>{const a=site.ground(e.x,e.z,crouch?1.02:1.48),b=site.ground(p.x,p.z,Math.max(.3,p.eye-.28));return !obstruction(site,a,b);},
   onShot:({entity,target,hit})=>{
    const actor=actors.get(entity.id),start=actor?.equipment.muzzleWorldPosition()??site.ground(entity.x,entity.z,entity.crouching?1.02:1.48);
    const end=V(site.origin).addScaledVector(V(site.right),target.x).addScaledVector(V(site.back),target.z).addScaledVector(V(site.up),target.y);
    const direction=end.clone().sub(start).normalize(),blocker=obstruction(site,start,end);
    const impact=blocker?{point:start.clone().addScaledVector(direction,blocker.distance),normal:blocker.normal??direction.clone().negate()}:hit?{point:end,normal:direction.clone().negate()}:null;
    effects.fire(start,direction,{range:120,hit:impact,weapon:'pulse',sound:'sidearm',color:0xff8d47,power:.22});
    return !blocker;
   },
   onDamage:(amount,e)=>{const result=medical.applyBite(amount,{creatureName:PIRATE_ROLES[e.model].name});if(result.ok)nav.notify(`${PIRATE_ROLES[e.model].name} hit · Suit ${loadout.state.health}%`);return result;},
  });return camp;
 }
 function addProps(camp){
  const {site,group}=camp;const barrier=assets.get('barricade'),cache=assets.get('salvage-cache');if(barrier?.status!=='ready'||cache?.status!=='ready')return;
  for(const cover of site.cover){const mesh=barrier.gltf.scene.clone(true);mesh.position.set(cover.x,site.local(site.ground(cover.x,cover.z)).y,cover.z);mesh.scale.set(cover.w,cover.h,cover.d);group.add(mesh);}
  const mesh=cache.gltf.scene.clone(true);mesh.position.copy(site.cache.clone().sub(V(site.origin)).applyQuaternion(new THREE.Quaternion().fromArray(site.rotation).invert()));group.add(mesh);camp.props=true;
 }
 function createActor(e,site){
  const asset=assets.get(e.model);if(asset?.status!=='ready'||!sockets)return null;
  const loader={load(_url,callback){callback({scene:clone(asset.gltf.scene),animations:asset.gltf.animations,asset:asset.gltf.asset});}};
  const character=new Character(scene,{url:`pirate:${e.model}`,modelYaw:Math.PI,loader,placeholder:false,requiredClips:['idle','walk','run','death','aim-rifle','fire-rifle','crouch-idle']});
  const equipment=new Equipment(character,scene,{rig:'player-expedition',sockets});equipment.vfx.visible=false;const actor={character,equipment,ready:false,previousShot:0,lastState:null};actors.set(e.id,actor);
  equipment.equip('rifle-laser').then(()=>actor.ready=true);return actor;
 }
 function targetRay(start,direction,range){
  if(online()||!active?.ready)return null;const site=active.site,ray=new THREE.Ray(start,direction);let best=null;
  for(const e of active.squad.entities){if(e.health<=0||!actors.get(e.id)?.ready)continue;
   const height=e.crouching?1.2:1.85,base=site.ground(e.x,e.z),up=V(site.up),center=base.clone().addScaledVector(up,height*.52),q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),up),inv=q.clone().invert();
   const local=start.clone().sub(center).applyQuaternion(inv),d=direction.clone().applyQuaternion(inv),radii=new THREE.Vector3(.32,height*.48,.28),p=local.clone().divide(radii),rd=d.clone().divide(radii),a=rd.dot(rd),b=p.dot(rd),c=p.dot(p)-1,disc=b*b-a*c;if(disc<0||a<=0)continue;
   const distance=(-b-Math.sqrt(disc))/a;if(distance<0||distance>range||distance>=(best?.distance??Infinity))continue;
   best={kind:'pirate',id:e.id,distance,point:ray.at(distance,new THREE.Vector3()),normal:local.addScaledVector(d,distance).divide(radii).divide(radii).normalize().applyQuaternion(q)};
  }return best;
 }
 function weaponHit(hit,item){
  if(online()||!nav.enabled||!nav.focused||document.hidden||document.querySelector('dialog[open]')||nav.mode!=='walk'||nav.insideShip||!active?.ready||hit?.kind!=='pirate')return false;
  const damage={'rifle-laser':30,'sidearm-pistol':20}[item];if(!damage)return false;const result=active.squad.hit(hit.id,damage);if(result.ok){shotCount++;lastHit={id:hit.id,...result};if(result.killed)nav.notify(active.squad.state.cleared?'Camp clear · recover the marked salvage cache.':'Pirate down');}return result;
 }
 function nearCache(){return active?.squad.state.cleared&&nav.mode==='walk'&&!nav.insideShip&&nav.position.distanceTo(active.site.cache.clone().addScaledVector(V(active.site.up),nav.walkEyeHeight??1.75))<2.7;}
 function interact(){
  if(online()||!nav.enabled||!nav.focused||document.querySelector('dialog[open]')||!nearCache())return false;
  const result=ensurePirateLoot(store,active.site);if(!result.ok){nav.notify(result.message);return true;}player.playGesture('interact');openInventory(result.id);return true;
 }
 function coverTarget(start,direction,range){return online()||!active?.ready?null:nearest([coverRay(active.site,start,direction,range),natural.raycast(start,direction,range)]);}
 function constrainWalker(previous,proposed){
  if(online()||!active?.ready)return {point:proposed,hit:false};
  const site=active.site,up=V(site.up),eye=nav.walkEyeHeight??1.75,offset=eye-.65,a=previous.clone().addScaledVector(up,-offset),b=proposed.clone().addScaledVector(up,-offset),delta=b.clone().sub(a),length=delta.length();if(length<1e-6)return {point:proposed,hit:false};
  const hit=coverRay(site,a,delta.normalize(),length,.3);if(!hit)return {point:proposed,hit:false};return {point:previous.clone().addScaledVector(delta,Math.max(0,hit.distance-.025)),hit:true};
 }
 function update(dt,renderOrigin){
  origin.copy(renderOrigin);hud.hidden=true;lootButton.hidden=true;
  const site=sites.find(s=>s.bodyId===nav.body.id&&nav.position.distanceTo(V(s.origin))<450);
  active=!online()&&site?(camps.get(site.id)??createCamp(site)):null;
  for(const camp of camps.values()){camp.group.visible=camp===active;camp.group.position.copy(V(camp.site.origin).sub(origin));}
  for(const actor of actors.values())actor.character.setVisible(false);
  if(!active)return;
  if(!active.props)addProps(active);
  for(const e of active.squad.entities)if(!actors.has(e.id))createActor(e,site);
  active.ready=Boolean(active.props&&site.models.every(id=>actors.get(`${site.id}:${id}`)?.ready));
  const paused=!active.ready||!nav.enabled||!nav.focused||document.hidden||Boolean(document.querySelector('dialog[open]'));
  const local=site.local(nav.position),eye=nav.walkEyeHeight??1.75;
  for(const e of active.squad.entities)e.y=site.local(site.ground(e.x,e.z)).y;
  active.squad.update(dt,{...local,eye,crouching:nav.crouching,health:loadout.state.health,active:nav.mode==='walk'&&!nav.insideShip,paused});
  for(const e of active.squad.entities){const actor=actors.get(e.id);if(!actor)continue;const c=actor.character;
   c.setVisible(true);const forward=V(site.right).multiplyScalar(Math.sin(e.heading)).addScaledVector(V(site.back),Math.cos(e.heading));c.alignToSurface(site.ground(e.x,e.z),site.normal(e.x,e.z),forward);
   if(actor.lastState!==e.state&&e.state==='reload')c.playGesture('reload-rifle');actor.lastState=e.state;
   c.update(paused?0:dt,{speed:e.speedNow,crouching:e.crouching,health:e.health/e.maxHealth,aiming:e.alert?'rifle':'none',firing:e.shotSerial!==actor.previousShot,grounded:true,moveX:e.moveX??0,moveZ:e.moveZ??1});actor.previousShot=e.shotSerial;
   c.placeCameraRelative(origin);c.object.updateMatrixWorld(true);actor.equipment.setRenderOrigin(origin);actor.equipment.holster(e.health<=0);
   if(e.alert&&e.health>0&&e.state!=='reload')actor.equipment.aimHeld(nav.position.clone().addScaledVector(V(site.up),-.25).sub(site.ground(e.x,e.z,1.45)).normalize());
   actor.equipment.update(paused?0:dt,{firing:false});actor.equipment.vfx.visible=false;
  }
  if(!paused&&nav.mode==='walk'&&!nav.insideShip){
   hud.hidden=false;const forward=new THREE.Vector3(0,0,-1).applyQuaternion(nav.orientation),aim=targetRay(nav.position,forward,100);const warning=active.squad.entities.find(e=>e.state==='aim'&&e.health>0),target=active.squad.entities.find(e=>e.id===aim?.id)??warning;
   hud.querySelector('strong').textContent=target?PIRATE_ROLES[target.model].name:site.name;hud.querySelector('meter').hidden=!target;if(target){hud.querySelector('meter').max=target.maxHealth;hud.querySelector('meter').value=target.health;}
   crouchButton.textContent=nav.crouching?'Stand':'Crouch';crouchButton.setAttribute('aria-pressed',String(Boolean(nav.crouching)));
   hud.dataset.warning=String(Boolean(warning));hud.querySelector('span').textContent=!active.ready?'Preparing pirate assets…':active.squad.state.cleared?`${nav.position.distanceTo(site.cache).toFixed(0)} m · Salvage cache unlocked`:warning?'INCOMING FIRE · MOVE OR TAKE COVER':`${active.squad.entities.filter(e=>e.health>0).length} pirates · ${nav.crouching?'CROUCHED':'STANDING'}`;
   lootButton.hidden=!nearCache();
  }
 }
 function disposeGLTF(g){g.scene.traverse(o=>{o.geometry?.dispose();for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){for(const v of Object.values(m))if(v?.isTexture)v.dispose();m.dispose();}});}
 return {sites,open,update,raycast:targetRay,weaponHit,coverRaycast:coverTarget,constrainWalker,interact,get interaction(){return !online()&&nearCache()?'F / X · Recover salvage cache':null;},get state(){return {playerHits:shotCount,active:active?.site.id??null,ready:Boolean(active?.ready),shots:shotCount,lastHit,site:active?{id:active.site.id,origin:active.site.origin,cache:active.site.cache.toArray(),approach:active.site.approach.toArray()}:null,...(active?.squad.state??{entities:[],cleared:false}),entities:active?.squad.entities.map(e=>({...e,position:active.site.ground(e.x,e.z).toArray(),normal:active.site.normal(e.x,e.z).toArray()}))??[],assets:Object.fromEntries([...assets].map(([id,s])=>[id,{status:s.status,error:s.error}]))};},dispose(){disposed=true;disposeTouch();hud.remove();dialog.remove();lootButton.remove();for(const a of actors.values()){a.equipment.dispose();a.character.dispose();}for(const c of camps.values())c.group.removeFromParent();for(const a of assets.values())if(a.gltf)disposeGLTF(a.gltf);}};
}
