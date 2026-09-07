import { Vector3 } from 'three';
import { BODIES } from './celestial.js';
import { staticNavigationTargets, NAV_FILTERS, NavigationLock, aimedNavigationTarget, planNavigationTravel } from './navigation-targets.js';
import { projectShipMarker, markerDistance } from './ship-marker-projection.js';
import './navigation-targeting.css';

export function createNavigationTargeting({nav,camera,destinations,station,build,multiplayer,combat,parent=document.body}) {
  const fixed=staticNavigationTargets(destinations),lock=new NavigationLock();
  let selectedId=null,aimed=null,reason='',lastTargets=fixed,activeTarget=null,lastController=nav.gamepad.id;
  let lastConnected=nav.gamepad.connected;
  let filters=Object.fromEntries(Object.keys(NAV_FILTERS).map(id=>[id,['bodies','stations','missions'].includes(id)]));
  try{const saved=JSON.parse(localStorage.getItem('star-agent-nav-filters'));for(const key of Object.keys(filters))if(typeof saved?.[key]==='boolean')filters[key]=saved[key];}catch{}
  document.body.classList.add('navigation-beacons');
  const markers=document.createElement('div');markers.id='navigation-markers';markers.setAttribute('aria-label','Navigation beacons');parent.append(markers);
  const ring=document.createElement('div');ring.id='navigation-lock';ring.hidden=true;
  ring.innerHTML='<svg viewBox="0 0 100 100" aria-hidden="true"><circle class="nav-ring-track" cx="50" cy="50" r="46"/><circle class="nav-ring-fill" cx="50" cy="50" r="46" pathLength="1"/></svg><div><strong></strong><span></span><small></small></div>';
  parent.append(ring);const nodes=new Map(),fill=ring.querySelector('.nav-ring-fill');
  // Touch players can use the same command without synthesizing keyboard events.
  const engageButton=document.createElement('button');engageButton.id='navigation-engage';engageButton.textContent='Engage relativistic drive';engageButton.hidden=true;parent.append(engageButton);
  function targets(){
    const values=[...fixed,...(nav.tradeBeacons?.()??[])];
    if(station.ready)values.push({id:'station-aeon',name:'Aeon Orbital',kind:'Space station',category:'stations',parent:'aeon',body:'aeon',center:(station.centre??station.worldPosition).toArray(),radius:2000});
    if(nav.shipPosition&&['walk','eva'].includes(nav.mode))values.push({id:'your-ship',name:'Your ship',kind:'Recovery beacon',category:'ships',parent:nav.body.id,center:nav.shipPosition.toArray(),radius:0});
    for(const claim of build.claims??[])values.push({id:`base-${claim.id}`,name:claim.name||'Your base',kind:'Surface base',category:'bases',parent:claim.body,body:claim.body,surface:true,center:[...claim.origin],radius:0});
    for(const peer of multiplayer.state.players??[])if(peer.id!==multiplayer.state.ownId){
      values.push({id:`pilot-${peer.id}`,name:peer.callsign||peer.name||'Shared pilot',kind:'Comms contact',category:'friends',parent:peer.body??'aeon',center:[...peer.position],radius:0});
      if(peer.mode==='flight'||peer.shipPosition)values.push({id:`ship-${peer.id}`,name:`${peer.callsign||peer.name||'Pilot'} · ship`,kind:'Shared ship',category:'ships',parent:peer.body??'aeon',center:[...(peer.shipPosition??peer.position)],radius:0});
    }
    const mission=combat.state;
    if(mission.phase==='engage')for(const enemy of mission.enemies.filter(e=>e.hull>0))values.push({id:`hostile-${enemy.id}`,name:`${enemy.ship} raider`,kind:'Hostile ship',category:'ships',parent:'aeon',center:enemy.position,radius:0});
    if(mission.point&&['transit','engage'].includes(mission.phase))values.push({id:'mission-patrol',name:'Patrol signal',kind:'Attack contract',category:'missions',parent:'aeon',center:mission.point,radius:0});
    return values;
  }
  const obstacles=()=>station.ready?[{id:'station-aeon',name:'Aeon Orbital',center:(station.centre??station.worldPosition).toArray(),radius:2000}]:[];
  function route(target){
    if(multiplayer.connected)return {ok:false,reason:'Targeted drive is available in solo flight. Shared pilots remain trackable.',plan:null};
    if(nav.mode!=='flight'||!nav.powered||nav.autoland||nav.stationLift)return {ok:false,reason:'Launch with main power on and leave landing assist.',plan:null};
    if(nav.gearLimited)return {ok:false,reason:'Retract landing gear before charging.',plan:null};
    if(nav.altitude<19_990&&nav.flightEnvironment.atmosphereFraction>0)return {ok:false,reason:'Climb to 20 km before charging the drive.',plan:null};
    return planNavigationTravel(nav.position,target,{obstacles:obstacles()});
  }
  function select(id){
    const target=targets().find(t=>t.id===id);if(!target||nav.travel)return false;
    selectedId=id;nav.travelTarget=id;lock.reset();nav.notify(`${target.name} tracked. Aim your nose at the marker to charge the relativistic drive.`);return true;
  }
  function reset(){lock.reset();aimed=null;}
  function engage(){
    if(!nav.enabled||!nav.focused||document.hidden||document.querySelector('dialog[open]')||nav.travel)return false;
    const current=aimedNavigationTarget(nav.position,nav.orientation,targets().filter(t=>t.category==='bodies'||filters[t.category]||t.id===selectedId),selectedId);
    if(!current||!lock.ready||lock.id!==current.id){nav.notify('Aim at a destination and hold until the relativistic drive ring is full.');return false;}
    const planned=route(current);if(!planned.ok){reset();nav.notify(planned.reason);return false;}
    activeTarget=current;selectedId=current.id;nav.travelTarget=current.id;
    nav.travel={plan:planned.plan,elapsed:planned.plan.spoolSeconds,targetId:current.id,targetName:current.name,targeted:true};
    nav.keys.clear();nav.velocity.set(0,0,0);nav.angularVelocity.set(0,0,0);nav.boost=false;nav.flightAssist=true;nav.combatMode=false;reset();
    nav.notify(`Relativistic drive engaged · ${current.name}. Automatic arrival braking; LT / X aborts.`);return true;
  }
  engageButton.addEventListener('click',engage);
  function update(dt,{width=innerWidth,height=innerHeight,origin=nav.position,orientation=camera.quaternion}={}){
    lastTargets=targets();
    if(lastConnected!==nav.gamepad.connected||lastController!==nav.gamepad.id){reset();lastConnected=nav.gamepad.connected;lastController=nav.gamepad.id;}
    if(selectedId&&!lastTargets.some(t=>t.id===selectedId)){selectedId=null;nav.travelTarget=null;reset();}
    const modal=Boolean(document.querySelector('dialog[open]'));
    const enabled=nav.enabled&&nav.focused&&!document.hidden&&!modal&&!nav.travel&&nav.mode==='flight';
    aimed=enabled?aimedNavigationTarget(nav.position,nav.orientation,lastTargets.filter(t=>t.category==='bodies'||filters[t.category]||t.id===selectedId),selectedId):null;
    const planned=aimed?route(aimed):null;reason=planned?.reason??'';
    lock.update(dt,aimed,enabled&&planned?.ok);
    document.body.classList.toggle('navigation-acquired',Boolean(aimed));
    ring.hidden=!aimed;ring.dataset.ready=String(lock.ready);fill.style.strokeDashoffset=String(1-lock.charge);
    const nose=origin.clone().addScaledVector(new Vector3(0,0,-1).applyQuaternion(nav.orientation),100_000);
    const p=projectShipMarker(origin,orientation,nose,{width,height,fov:camera.getEffectiveFOV()});ring.style.left=`${p.x}px`;ring.style.top=`${p.y}px`;
    if(aimed){ring.querySelector('strong').textContent=`${aimed.name} · ${markerDistance(nav.position.distanceTo(new Vector3(...aimed.center))-(aimed.radius||0))}`;
      ring.querySelector('span').textContent=reason|| (lock.ready?'Relativistic drive ready':'Powering relativistic drive');
      ring.querySelector('small').textContent=reason?(reason.startsWith('Within')||reason.startsWith('At stellar')?'Arrival zone · manual flight':'Keep flying to a clear approach'):lock.ready?(nav.controllerActive?'LB + RB + ↑ · Engage':'N / J · Engage'):`Hold nose on target · ${Math.floor(lock.charge*100)}%`;}
    engageButton.hidden=!lock.ready||!enabled;
    markers.hidden=modal||Boolean(nav.travel)||!['flight','walk','eva'].includes(nav.mode);
    const shown=lastTargets.filter(t=>t.id!=='your-ship'&&!t.id.startsWith('hostile-')&&(filters[t.category]||t.id===selectedId)).sort((a,b)=>(b.id===selectedId)-(a.id===selectedId)||nav.position.distanceTo(new Vector3(...a.center))-nav.position.distanceTo(new Vector3(...b.center))).slice(0,16);
    const ids=new Set(shown.map(t=>t.id));for(const [id,node] of nodes)if(!ids.has(id)){node.remove();nodes.delete(id);}
    const placed=[];
    for(const target of shown){
      let node=nodes.get(target.id);if(!node){node=document.createElement('div');node.className='navigation-marker';node.innerHTML='<i></i><strong></strong>';markers.append(node);nodes.set(target.id,node);}
      const projected=projectShipMarker(origin,orientation,new Vector3(...target.center),{width,height,fov:camera.getEffectiveFOV(),bounds:{left:Math.min(350,width*.26),right:width-Math.min(350,width*.26),top:height*.25,bottom:height*.65}});
      let y=projected.y;for(const prev of placed)if(Math.abs(projected.x-prev.x)<155&&Math.abs(y-prev.y)<28)y=Math.min(height*.72,prev.y+29);placed.push({x:projected.x,y});
      node.dataset.id=target.id;node.dataset.edge=String(!projected.onScreen);node.dataset.selected=String(target.id===selectedId);node.dataset.category=target.category;
      node.style.left=`${projected.x}px`;node.style.top=`${y}px`;node.querySelector('i').textContent=projected.onScreen?'◇':'➤';node.querySelector('i').style.transform=projected.onScreen?'':`rotate(${projected.angle}deg)`;
      node.querySelector('strong').textContent=`${target.name} · ${markerDistance(projected.distance-(target.radius||0))}`;
      node.hidden=aimed?.id===target.id;
    }
  }
  nav.targeting={engage,get hasTarget(){return Boolean(aimed||selectedId);},route:()=>route(targets().find(t=>t.id===selectedId)),reset};
  window.addEventListener('blur',reset);document.addEventListener('visibilitychange',reset);
  return {targets,select,route,update,engage,reset,clear(){selectedId=null;nav.travelTarget=null;reset();},
    setFilter(id,value){if(!(id in filters))return;filters[id]=Boolean(value);try{localStorage.setItem('star-agent-nav-filters',JSON.stringify(filters));}catch{}},
    get course(){const target=targets().find(t=>t.id===selectedId)??aimed;return target?{name:target.name,point:new Vector3(...target.center)}:null;},
    get filters(){return {...filters};},get selected(){return targets().find(t=>t.id===selectedId)??null;},
    get state(){return {selectedId,aimedId:aimed?.id??null,charge:lock.charge,ready:lock.ready,reason,filters:{...filters},targets:lastTargets.map(t=>({...t})),arrivalTarget:activeTarget?.id??null};}};
}
