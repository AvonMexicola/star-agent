import {Vector3,Quaternion} from 'three';
import {createWeaponTarget} from '../effects/weapon-target.js';
import {BuildSystem} from '../build/system.js';
import {emptyBuild} from '../build/state.js';
import {segmentSphere,SHIP_STATS} from '../combat/simulation.js';
import {occupiesShip} from '../combat/ship-occupancy.js';
import {PERIMETER as P} from './catalog.js';
import {PiratePerimeter} from './perimeter.js';
import {PirateProps} from './props.js';
import {PirateTower} from './tower.js';
import {PirateStaticKit} from './static-kit.js';
import {createPirateCollision} from './world-collision.js';
import {PirateAirlock} from './airlock.js';
import {BODIES,bodySurfacePoint} from '../celestial.js';
import './style.css';
const v=a=>new Vector3(...a);
export function createPirateSite({scene,nav,mining,getCombat,layout:source,enabled=()=>!nav.multiplayer?.connected}){
 const layout=structuredClone(source),label=layout.id.slice(7).toUpperCase(),q=new Quaternion(...layout.claim.quaternion),claims=[layout.claim,layout.outerClaim],point=p=>v(p).applyQuaternion(q).add(v(layout.claim.origin)),local=p=>p.clone().sub(v(layout.claim.origin)).applyQuaternion(q.clone().invert());
 const store={state:{build:emptyBuild()},container:()=>null};
 const buildings=new BuildSystem({scene,nav,store}),collision=createPirateCollision(scene,nav,claims);
 const staticKit=new PirateStaticKit(buildings),airlock=new PirateAirlock(layout,nav,buildings,collision,enabled);
 const props=new PirateProps(scene,layout);props.readyPromise.catch(error=>nav.notify(`Crimson props unavailable: ${error.message}`));
 const tower=new PirateTower(scene,layout);tower.readyPromise.catch(error=>nav.notify(`${layout.name} tower unavailable: ${error.message}`));let visible=false,discovered=false,routeIndex=0;
 const cameraOrigin=new Vector3(),obstruction=createWeaponTarget({nav:{get body(){return nav.body;},get normal(){return nav.normal;},buildingRaycast:(...args)=>nav.buildingRaycast?.(...args)},mining});let clearAge=0,lineClear=true;
 const policy=new PiratePerimeter({onWarning:()=>nav.notify(`${label} PERIMETER · Aircraft prohibited within 180 m. Leave beyond 220 m. Land at the outer amber pad and approach on foot.`),onShot:({damage,barrel})=>{
  const start=tower.muzzle(barrel),direction=tower.direction(),end=start.clone().addScaledVector(direction,P.disengage),position=nav.mode==='flight'?nav.position:nav.shipPosition??nav.position;
  const radius=SHIP_STATS[nav.shipId]?.radius??SHIP_STATS.nomad.radius,t=segmentSphere(start,end,position,radius);
  const wall=obstruction(start,direction,cameraOrigin,P.disengage);let hit=t!==null&&(!wall||wall.distance>=start.distanceTo(end)*t);
  if(hit)end.copy(start).lerp(start.clone().addScaledVector(direction,P.disengage),t);else if(wall)end.copy(wall.point);
  tower.shot(barrel,end);if(hit)getCombat().receiveExternalHit(damage,end,direction);
 }});
 const dialog=document.createElement('dialog');dialog.id=layout.id==='pirate-hush'?'pirate-service':`pirate-service-${layout.id}`;dialog.className='pirate-service';dialog.setAttribute('aria-labelledby',`${dialog.id}-title`);dialog.innerHTML=`<button data-close aria-label="Close ${layout.name} service panel">×</button><p class="eyebrow">${label} / PERIMETER CONTROL</p><h2 id="${dialog.id}-title">Tower isolator</h2><p data-status></p><button data-isolate data-controller-focus data-controller-key="${layout.id.slice(7)}-isolate">Isolate tower and unlock exchange</button><p class="pirate-service-hint">D-pad / stick: choose · A: confirm · B: close</p>`;document.body.append(dialog);
 const panelPoint=point(layout.panel),nearPanel=()=>enabled()&&nav.mode==='walk'&&!nav.insideShip&&!nav.buildActive&&tower.ready&&props.ready&&!collision.blocked&&nav.position.distanceTo(panelPoint)<2.8;
 function render(){dialog.querySelector('[data-status]').textContent=policy.disabled?`Tower isolated. ${layout.name} is open. Enter the rigid habitat through its two-door airlock; cargo uses the outer landing apron.`:'Cut the battery feed to silence the anti-ship perimeter. The salvage dealer then releases the trade terminal.';dialog.querySelector('[data-isolate]').disabled=policy.disabled;}
 const open=()=>{if(!nearPanel()||document.querySelector('dialog[open]'))return false;nav.keys.clear();nav.gamepad.suspend();nav.enabled=false;if(document.pointerLockElement)document.exitPointerLock();render();dialog.showModal();return true;};
 dialog.querySelector('[data-close]').onclick=()=>dialog.close();dialog.querySelector('[data-isolate]').onclick=()=>{if(!nearPanel()||policy.disabled)return;policy.isolate();render();nav.notify(`Perimeter isolated. ${layout.name} unlocked for this visit.`);};dialog.addEventListener('close',()=>{nav.keys.clear();nav.gamepad.suspend();nav.enabled=!document.querySelector('dialog[open]');nav.canvas.focus({preventScroll:true});});
 const touch=document.createElement('button');touch.className='pirate-service-action';touch.textContent='Tower isolator · F / X';touch.onclick=()=>airlock.interact()||open();touch.hidden=true;document.body.append(touch);
 const warning=document.createElement('div');warning.className='pirate-perimeter';warning.setAttribute('role','status');warning.hidden=true;document.body.append(warning);
 const api={layout,tower,policy,buildings,airlock,nav,get discovered(){return discovered;},get layouts(){return [layout];},get claims(){return enabled()?claims:[];},get grounded(){return enabled()&&collision.grounded;},
  attachInteractions(){const action=nav.baseAction,hint=nav.baseInteraction;nav.baseAction=()=>airlock.interact()||open()||action?.();nav.baseInteraction=()=>airlock.hint||(nearPanel()?'F / X · Tower isolator':hint?.());},
  terminalStatus(id){return id===layout.id?{status:policy.disabled?'Ready to connect':'Isolate perimeter tower',available:policy.disabled}:undefined;},
  terminalPosition(id){return enabled()&&policy.disabled&&id===layout.id?point(layout.terminalPiece.position).add(new Vector3(0,1.2,0).applyQuaternion(q)):null;},
  docked(id,pose){if(!enabled()||!policy.disabled||id!==layout.id||!pose)return false;const p=local(pose.position);return collision.landingSurface({...pose,orientation:pose.orientation??pose.quaternion})&&Math.abs(p.y-layout.padDeck)<.6&&Math.abs(p.x)<24&&Math.abs(p.z-260)<36;},
  beacons(){if(!enabled())return [];const markers=discovered?[{id:layout.id,name:layout.name,kind:'Secret salvage exchange · Outer landing area',category:'trade',parent:layout.body,body:layout.body,surface:true,center:point(layout.pad.position).toArray(),radius:0}]:[{id:`${layout.id}-signal`,name:layout.body==='selene'?'Weak lunar relay':'Masked basin relay',kind:'Unidentified signal · Approach to resolve',category:'trade',parent:layout.body,body:layout.body,surface:true,center:point([0,layout.padDeck,860]).toArray(),radius:0}];
   if(discovered&&!policy.disabled&&nav.body.id===layout.body&&nav.mode==='walk'&&!nav.insideShip){const next=layout.groundRoute[routeIndex];let center=panelPoint;if(next){const body=BODIES.find(body=>body.id===layout.body);center=bodySurfacePoint(point([next[0],0,next[1]]).sub(v(body.center)).normalize(),body,1);}markers.push({id:`${layout.id}-foot-route`,name:next?`${label} · Ground approach`:'Tower isolator',kind:'Amber foot route · follow outside ship perimeter',category:'trade',parent:layout.body,body:layout.body,surface:true,center:center.toArray(),radius:0});}return markers;},
  constrainWalker(a,b){if(!enabled())return {point:b,hit:false,grounded:false};const initial=collision.constrainWalker(a,b),d=initial.point.clone().sub(a),distance=d.length();if(distance<1e-8)return initial;d.normalize();const envelope={min:[-.28,-nav.layout.eyeHeight,-.28],max:[.28,.2,.28],orientation:q};const hit=[tower.raycast(a,d,distance,envelope),props.raycast(a,d,distance,envelope)].filter(Boolean).sort((a,b)=>a.distance-b.distance)[0];return hit?{...initial,point:a.clone().addScaledVector(d,Math.max(0,hit.distance-.005)),hit:true}:initial;},
  raycast(...args){if(!enabled())return null;return [collision.raycast(...args),tower.raycast(...args),props.raycast(...args)].filter(Boolean).sort((a,b)=>a.distance-b.distance)[0]??null;},landingSurface(pose){return enabled()?collision.landingSurface(pose):null;},
  approach(){if(!enabled())return false;nav.orbit();nav.position.copy(point(layout.approach));nav.orientation.copy(q);nav.velocity.set(0,0,0);nav.angularVelocity.set(0,0,0);nav.keys.clear();nav.gamepad.suspend();nav.resetSteering();return true;},
  update(dt,origin){cameraOrigin.copy(origin);const on=enabled()&&nav.body.id===layout.body,near=on&&nav.position.distanceTo(v(layout.claim.origin))<2400;if(near!==visible){visible=near;store.state.build={...emptyBuild(),claims:near?claims:[]};}if(on&&nav.enabled&&nav.focused&&!document.hidden&&!document.querySelector('dialog[open]'))airlock.update();buildings.update(on&&nav.enabled&&nav.focused?Math.min(.1,dt):0,origin);staticKit.update();
   if(on&&nav.position.distanceTo(v(layout.claim.origin))<1000&&!discovered){discovered=true;nav.notify(`Hidden signal resolved · ${layout.name}. Amber outer pad is clear; isolate the tower on foot to trade.`);}
   const suspended=!on||!nav.enabled||!nav.focused||document.hidden||Boolean(document.querySelector('dialog[open]'))||Boolean(nav.travel)||!tower.ready||!props.ready||collision.blocked;
   const aircraft=occupiesShip(nav),ship=nav.mode==='flight'?nav.position:nav.shipPosition??nav.position,targetLocal=local(ship),distance=ship.distanceTo(tower.origin),aligned=!suspended&&aircraft?tower.aim(ship,Math.min(.1,dt)):false;
   const start=tower.ready?tower.muzzle(0):tower.origin,delta=ship.clone().sub(start);clearAge-=Math.min(.1,dt);if(!suspended&&near&&aircraft&&distance<P.engage&&delta.length()>1e-6&&clearAge<=0){const wall=obstruction(start,delta.clone().normalize(),origin,delta.length());lineClear=!wall||wall.distance>delta.length()-12;clearAge=.15;}else if(suspended||!aircraft||distance>=P.engage){lineClear=true;clearAge=0;}
   props.update(nav.position,origin,on);
   if(on&&aircraft)routeIndex=0;else if(on&&nav.mode==='walk'&&!nav.insideShip){const at=local(nav.position),next=layout.groundRoute[routeIndex];if(next&&Math.hypot(at.x-next[0],at.z-next[1])<3)routeIndex++;}
   policy.update(dt,{distance,altitude:targetLocal.y-layout.deck,ship:aircraft,active:!suspended,clear:lineClear,aligned});tower.update(Math.min(.1,dt),origin,{enabled:on,phase:policy.phase});
   warning.hidden=suspended||!aircraft||!['warning','charge','burst','rest'].includes(policy.phase);warning.textContent=policy.phase==='warning'?` ${label} AIRSPACE · ${Math.ceil(distance)}m · NO SHIPS WITHIN 180 m\nLand at outer apron; approach on foot. ${policy.timer>0?`Weapons arm in ${Math.ceil(policy.timer)}s.`:''}`:policy.phase==='charge'?`TOWER CHARGING · ${policy.timer.toFixed(1)}s · RETREAT BEYOND 220 m`:`PERIMETER ACTIVE · RETREAT BEYOND 220 m · SHIELD ${Math.ceil(nav.combat?.player?.shield??0)}`;
   touch.textContent=airlock.hint||'Tower isolator · F / X';touch.hidden=!(nearPanel()||airlock.nearby())||!nav.enabled||Boolean(document.querySelector('dialog[open]'));
  },get state(){return {available:enabled(),discovered,unlocked:policy.disabled,...policy.state,ready:!collision.blocked&&tower.ready&&props.ready&&[...buildings.models.values()].every(m=>m.ready),rendered:buildings.models.size,error:[buildings.error,collision.error,tower.error,props.error].filter(Boolean).join(' '),airlock:airlock.state,routeIndex,site:{id:layout.id,body:layout.body,groundRoute:layout.groundRoute,origin:layout.claim.origin,quaternion:layout.claim.quaternion,deck:layout.deck,padDeck:layout.padDeck,pad:point(layout.pad.position).toArray(),terminal:point(layout.terminalPiece.position).toArray(),panel:panelPoint.toArray(),tower:tower.origin.toArray()},props:props.placements,staticKit:staticKit.state,assets:{tower:'/models/pirate-tower.glb',battery:'/models/station-defense.glb'}};},
  dispose(){staticKit.dispose();props.dispose();tower.dispose();buildings.dispose();collision.dispose();dialog.remove();touch.remove();warning.remove();}};return api;
}
