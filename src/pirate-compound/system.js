import {Vector3,Quaternion} from 'three';
import {createWeaponTarget} from '../effects/weapon-target.js';
import {BuildSystem} from '../build/system.js';
import {emptyBuild} from '../build/state.js';
import {segmentSphere,SHIP_STATS} from '../combat/simulation.js';
import {PIRATE_MARKET,PERIMETER as P} from './catalog.js';
import {PiratePerimeter} from './perimeter.js';
import {PirateProps} from './props.js';
import {PirateTower} from './tower.js';
import {pirateLayout} from './layout.js';
import './style.css';
const v=a=>new Vector3(...a);
export function createPirateCompound({scene,nav,mining,getCombat,enabled=()=>!nav.multiplayer?.connected}){
 const layout=pirateLayout(),q=new Quaternion(...layout.claim.quaternion),claims=[layout.claim,layout.outerClaim],point=p=>v(p).applyQuaternion(q).add(v(layout.claim.origin)),local=p=>p.clone().sub(v(layout.claim.origin)).applyQuaternion(q.clone().invert());
 const store={state:{build:emptyBuild()},container:()=>null},collisionStore={state:{build:{...emptyBuild(),claims}},container:()=>null};
 const buildings=new BuildSystem({scene,nav,store}),collision=new BuildSystem({scene,nav,store:collisionStore,render:false});
 const props=new PirateProps(scene,layout);props.readyPromise.catch(error=>nav.notify(`Crimson props unavailable: ${error.message}`));
 const tower=new PirateTower(scene,layout);tower.readyPromise.catch(error=>nav.notify(`Hush tower unavailable: ${error.message}`));let visible=false,discovered=false;
 const cameraOrigin=new Vector3(),obstruction=createWeaponTarget({nav:{get body(){return nav.body;},get normal(){return nav.normal;},buildingRaycast:(...args)=>nav.buildingRaycast?.(...args)},mining});let clearAge=0,lineClear=true;
 const policy=new PiratePerimeter({onWarning:()=>nav.notify('HUSH PERIMETER · Aircraft prohibited within180m. Leave beyond220m. Land at the outer amber pad and approach on foot.'),onShot:({damage,barrel})=>{
  const start=tower.muzzle(barrel),direction=tower.direction(),end=start.clone().addScaledVector(direction,P.disengage),position=nav.mode==='flight'?nav.position:nav.shipPosition??nav.position;
  const radius=SHIP_STATS[nav.shipId]?.radius??SHIP_STATS.nomad.radius,t=segmentSphere(start,end,position,radius);
  const wall=obstruction(start,direction,cameraOrigin,P.disengage);let hit=t!==null&&(!wall||wall.distance>=start.distanceTo(end)*t);
  if(hit)end.copy(start).lerp(start.clone().addScaledVector(direction,P.disengage),t);else if(wall)end.copy(wall.point);
  tower.shot(barrel,end);if(hit)getCombat().receiveExternalHit(damage,end,direction);
 }});
 const dialog=document.createElement('dialog');dialog.id='pirate-service';dialog.setAttribute('aria-labelledby','pirate-service-title');dialog.innerHTML='<button data-close aria-label="Close Hush service panel">×</button><p class="eyebrow">HUSH / PERIMETER CONTROL</p><h2 id="pirate-service-title">Tower isolator</h2><p data-status></p><button data-isolate data-controller-focus data-controller-key="hush-isolate">Isolate tower and unlock exchange</button><p class="pirate-service-hint">D-pad / stick: choose · A: confirm · B: close</p>';document.body.append(dialog);
 const panelPoint=point(layout.panel),nearPanel=()=>enabled()&&nav.mode==='walk'&&!nav.insideShip&&!nav.buildActive&&tower.ready&&props.ready&&nav.position.distanceTo(panelPoint)<2.8;
 function render(){dialog.querySelector('[data-status]').textContent=policy.disabled?'Tower isolated. Hush Exchange is open. The terminal is inside the building to your right; cargo uses the outer landing apron.':'Cut the battery feed to silence the anti-ship perimeter. The salvage dealer then releases the trade terminal.';dialog.querySelector('[data-isolate]').disabled=policy.disabled;}
 const open=()=>{if(!nearPanel()||document.querySelector('dialog[open]'))return false;nav.keys.clear();nav.gamepad.suspend();nav.enabled=false;if(document.pointerLockElement)document.exitPointerLock();render();dialog.showModal();return true;};
 dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.querySelector('[data-isolate]').onclick=()=>{if(!nearPanel()||policy.disabled)return;policy.isolate();render();nav.notify('Perimeter isolated. Hush Exchange unlocked for this visit.');};dialog.addEventListener('close',()=>{nav.keys.clear();nav.gamepad.suspend();nav.enabled=!document.querySelector('dialog[open]');nav.canvas.focus({preventScroll:true});});
 const touch=document.createElement('button');touch.className='pirate-service-action';touch.textContent='Tower isolator · F / X';touch.onclick=open;touch.hidden=true;document.body.append(touch);
 const warning=document.createElement('div');warning.className='pirate-perimeter';warning.setAttribute('role','status');warning.hidden=true;document.body.append(warning);
 const api={layout,tower,policy,buildings,nav,get layouts(){return [layout];},get claims(){return enabled()?claims:[];},get grounded(){return enabled()&&collision.grounded;},
  attachInteractions(){const action=nav.baseAction,hint=nav.baseInteraction;nav.baseAction=()=>open()||action?.();nav.baseInteraction=()=>nearPanel()?'F / X · Tower isolator':hint?.();},
  terminalStatus(id){return id===PIRATE_MARKET.id?{status:policy.disabled?'Ready to connect':'Isolate perimeter tower',available:policy.disabled}:undefined;},
  terminalPosition(id){return enabled()&&policy.disabled&&id===PIRATE_MARKET.id?point(layout.terminalPiece.position).add(new Vector3(0,1.2,0).applyQuaternion(q)):null;},
  docked(id,pose){if(!enabled()||!policy.disabled||id!==PIRATE_MARKET.id||!pose)return false;const p=local(pose.position);return collision.landingSurface(pose)&&Math.abs(p.y-layout.padDeck)<.6&&Math.abs(p.x)<24&&Math.abs(p.z-260)<36;},
  beacons(){if(!enabled())return [];return discovered?[{id:PIRATE_MARKET.id,name:PIRATE_MARKET.name,kind:'Secret salvage exchange · Outer landing area',category:'trade',parent:'selene',body:'selene',surface:true,center:point(layout.pad.position).toArray(),radius:0}]:[{id:'hush-signal',name:'Weak lunar relay',kind:'Unidentified signal · Approach to resolve',category:'trade',parent:'selene',body:'selene',surface:true,center:point([0,layout.padDeck,860]).toArray(),radius:0}];},
  constrainWalker(a,b){if(!enabled())return {point:b,hit:false,grounded:false};const initial=collision.constrainWalker(a,b),d=initial.point.clone().sub(a),distance=d.length();if(distance<1e-8)return initial;d.normalize();const envelope={min:[-.28,-nav.layout.eyeHeight,-.28],max:[.28,.2,.28],orientation:q};const hit=[tower.raycast(a,d,distance,envelope),props.raycast(a,d,distance,envelope)].filter(Boolean).sort((a,b)=>a.distance-b.distance)[0];return hit?{...initial,point:a.clone().addScaledVector(d,Math.max(0,hit.distance-.005)),hit:true}:initial;},
  raycast(...args){if(!enabled())return null;return [collision.raycast(...args),tower.raycast(...args),props.raycast(...args)].filter(Boolean).sort((a,b)=>a.distance-b.distance)[0]??null;},landingSurface(pose){return enabled()?collision.landingSurface(pose):null;},
  approach(){if(!enabled())return false;nav.orbit();nav.position.copy(point(layout.approach));nav.orientation.copy(q);nav.velocity.set(0,0,0);nav.angularVelocity.set(0,0,0);nav.keys.clear();nav.gamepad.suspend();nav.resetSteering();return true;},
  update(dt,origin){cameraOrigin.copy(origin);const on=enabled(),near=on&&nav.position.distanceTo(v(layout.claim.origin))<2400;if(near!==visible){visible=near;store.state.build={...emptyBuild(),claims:near?claims:[]};}buildings.update(dt,origin);
   if(on&&nav.position.distanceTo(v(layout.claim.origin))<1000&&!discovered){discovered=true;nav.notify('Hidden signal resolved · Hush Exchange. Amber outer pad is clear; isolate the tower on foot to trade.');}
   const suspended=!on||!nav.enabled||!nav.focused||document.hidden||Boolean(document.querySelector('dialog[open]'))||Boolean(nav.travel)||!tower.ready;
   const aircraft=['flight','landed'].includes(nav.mode)||nav.mode==='walk'&&nav.insideShip,ship=nav.mode==='flight'?nav.position:nav.shipPosition??nav.position,targetLocal=local(ship),distance=ship.distanceTo(tower.origin),aligned=!suspended&&aircraft?tower.aim(ship,Math.min(.1,dt)):false;
   const start=tower.ready?tower.muzzle(0):tower.origin,delta=ship.clone().sub(start);clearAge-=Math.min(.1,dt);if(!suspended&&near&&aircraft&&distance<P.engage&&delta.length()>1e-6&&clearAge<=0){const wall=obstruction(start,delta.clone().normalize(),origin,delta.length());lineClear=!wall||wall.distance>delta.length()-12;clearAge=.15;}else if(suspended||!aircraft||distance>=P.engage){lineClear=true;clearAge=0;}
   props.update(nav.position,origin,on);
   policy.update(dt,{distance,altitude:targetLocal.y-layout.deck,ship:aircraft,active:!suspended,clear:lineClear,aligned});tower.update(Math.min(.1,dt),origin,{enabled:on,phase:policy.phase});
   warning.hidden=suspended||!aircraft||!['warning','charge','burst','rest'].includes(policy.phase);warning.textContent=policy.phase==='warning'?`HUSH AIRSPACE · ${Math.ceil(distance)}m · NO SHIPS WITHIN180m\nLand at outer apron; approach on foot. ${policy.timer>0?`Weapons arm in ${Math.ceil(policy.timer)}s.`:''}`:policy.phase==='charge'?`TOWER CHARGING · ${policy.timer.toFixed(1)}s · RETREAT BEYOND220m`:`PERIMETER ACTIVE · RETREAT BEYOND220m · SHIELD ${Math.ceil(nav.combat?.player?.shield??0)}`;
   touch.hidden=!nearPanel()||!nav.enabled||Boolean(document.querySelector('dialog[open]'));
  },get state(){return {available:enabled(),discovered,unlocked:policy.disabled,...policy.state,ready:tower.ready&&props.ready&&[...buildings.models.values()].every(m=>m.ready),rendered:buildings.models.size,error:[buildings.error,tower.error,props.error].filter(Boolean).join(' '),site:{id:layout.id,origin:layout.claim.origin,quaternion:layout.claim.quaternion,deck:layout.deck,padDeck:layout.padDeck,pad:point(layout.pad.position).toArray(),terminal:point(layout.terminalPiece.position).toArray(),panel:panelPoint.toArray(),tower:tower.origin.toArray()},props:props.placements,assets:{tower:'/models/pirate-tower.glb',battery:'/models/station-defense.glb'}};},
  dispose(){props.dispose();tower.dispose();buildings.dispose();collision.dispose();dialog.remove();touch.remove();warning.remove();}};return api;
}
/** Combine collision and commerce adapters without changing regular layouts. */
export function withPirateCompound(settlements,pirate){return {
 nav:settlements.nav,buildings:settlements.buildings,get layouts(){return [...settlements.layouts,...pirate.layouts];},get claims(){return [...settlements.claims,...pirate.claims];},get grounded(){return settlements.grounded||pirate.grounded;},
 terminalStatus:id=>pirate.terminalStatus(id)??settlements.terminalStatus?.(id),terminalPosition:id=>pirate.terminalPosition(id)??settlements.terminalPosition(id),docked:(id,pose)=>id===PIRATE_MARKET.id?pirate.docked(id,pose):settlements.docked(id,pose),beacons:()=>[...settlements.beacons(),...pirate.beacons()],
 constrainWalker(a,b){const first=settlements.constrainWalker(a,b),second=pirate.constrainWalker(a,first.point);return {...second,hit:first.hit||second.hit,grounded:first.grounded||second.grounded};},
 raycast:(...args)=>[settlements.raycast(...args),pirate.raycast(...args)].filter(Boolean).sort((a,b)=>a.distance-b.distance)[0]??null,landingSurface:pose=>settlements.landingSurface(pose)??pirate.landingSurface(pose),
 update(dt,origin){settlements.update(dt,origin);pirate.update(dt,origin);},approach:id=>id==='pirate-hush'?pirate.approach():settlements.approach(id),get state(){return settlements.state;},dispose(){settlements.dispose();pirate.dispose();}};}
