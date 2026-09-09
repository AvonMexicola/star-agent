import {PlayerGuide} from './player-guide.js';
import './player-guide.css';

export function createPlayerGuide({nav,opening,targeting,combat,shipName}){
  const guide=new PlayerGuide(),root=document.createElement('aside');
  root.id='player-guide';root.hidden=true;root.setAttribute('aria-label','Flight guide');
  root.innerHTML='<small></small><div role="status" aria-live="polite" aria-atomic="true"><strong></strong><p></p></div>';
  document.body.append(root);
  let enabled=true,input='keyboard',current=null;
  try{enabled=localStorage.getItem('star-agent-flight-guide')!=='off';}catch{}
  nav.playerGuideEnabled=enabled;
  document.addEventListener('pointerdown',event=>{input=event.pointerType==='touch'?'touch':'keyboard';},{passive:true});
  document.addEventListener('keydown',()=>{input='keyboard';},{passive:true});
  const observer=new ResizeObserver(()=>document.body.style.setProperty('--player-guide-bottom',`${root.getBoundingClientRect().bottom}px`));observer.observe(root);
  const buttons=new Set();
  function refreshButtons(){for(const button of buttons){button.textContent=`Flight guide · ${enabled?'On':'Off'}`;button.setAttribute('aria-pressed',String(enabled));}}
  function update(){
    const state=targeting.state,mission=combat.state,selected=targeting.selected;
    const objectives=new Set(nav.navigationObjectiveIds?.()??[]);
    if(!nav.recoveryActive?.()&&['transit','engage'].includes(mission.phase))objectives.add('mission-patrol');
    const target=selected??state.targets.find(t=>objectives.has(t.id))??null;
    const local=nav.shipPosition?nav.toShipLocal():null;
    const hit=local?nav.shipInteraction(local):null;
    const point=target?nav.viewPoint(nav.position.clone().fromArray(target.center)):null;
    const s={mode:nav.mode,shipId:nav.shipId,shipName:shipName(),input:nav.controllerActive?'controller':input,
      openingActive:Boolean(opening?.active),dockedAtStation:nav.dockedAtStation,stationDistance:nav.stationDistance,stationLift:nav.stationLift,
      insideShip:nav.insideShip,shipDistance:local?.length(),nearHatch:local?Math.abs(local.x)<2.3&&local.z>1.5&&local.z<10:false,
      hit,doorOpen:nav.doorOpen,doorProgress:nav.doorProgress,berthRest:nav.berthRest,cabinFlight:nav.cabinFlight,spaceParked:nav.spaceParked,
      service:nav.mode==='walk'&&!nav.insideShip?nav.cargoInteraction?.():null,accessHint:nav.freighter?.boardingHint,
      buildActive:nav.buildActive,roverOccupied:nav.roverOccupied,travel:nav.travelState,powered:nav.powered,autoland:nav.autoland,
      gearDeployed:nav.gearDeployed,gearProgress:nav.gearProgress,canDock:nav.canDock,speed:nav.speed,altitude:nav.altitude,
      dryGround:nav.mode==='flight'&&nav.altitude<12000?nav.dryGround():true,bodyId:nav.body.id,bodyStar:nav.body.star,atmosphereFraction:nav.flightEnvironment.atmosphereFraction,
      target,targetDistance:point?nav.position.distanceTo(point)-(target.radius||0):Infinity,objective:objectives.has(target?.id),
      aimedId:state.aimedId,driveReady:state.ready,routeReason:state.aimedId===target?.id?state.reason:'',
      sharedDriveUnavailable:state.reason?.startsWith('Shared targeted drive'),
      combatPhase:mission.phase,combatMode:nav.combatMode,reinforcementIn:mission.reinforcementIn};
    current=guide.update(s);
    root.hidden=!enabled||!current||s.openingActive||!nav.enabled||!nav.focused||Boolean(document.querySelector('dialog[open]'));
    if(current){
      root.dataset.step=current.id;
      for(const [selector,value] of [['small',current.section],['strong',current.title],['p',current.detail]]){
        const node=root.querySelector(selector);if(node.textContent!==value)node.textContent=value;
      }
    }
    return current;
  }
  return {update,get enabled(){return enabled;},get state(){return current?{...current,enabled,visible:!root.hidden}:null;},
    bind(button){buttons.add(button);button.addEventListener('click',()=>{enabled=!enabled;nav.playerGuideEnabled=enabled;try{localStorage.setItem('star-agent-flight-guide',enabled?'on':'off');}catch{}refreshButtons();update();});refreshButtons();}};
}
