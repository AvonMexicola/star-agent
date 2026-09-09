import test from 'node:test';
import assert from 'node:assert/strict';
import {PlayerGuide,playerGuideStep} from '../src/player-guide.js';
import {createHUDDisplay} from '../src/hud-display.js';

const base={shipId:'nomad',shipName:'Nomad',mode:'walk',input:'keyboard',dockedAtStation:true,stationDistance:20,
  insideShip:false,doorOpen:false,doorProgress:0,powered:true,gearDeployed:true,gearProgress:1,altitude:500000,speed:0};
test('onboarding advances only when the hatch, chair, launch and gear actually change',()=>{
  const guide=new PlayerGuide(),s={...base};const step=()=>guide.update(s).id;
  assert.equal(step(),'find-hatch');assert.equal(step(),'find-hatch');
  s.hit='door';assert.equal(step(),'open-hatch');
  s.doorOpen=true;s.nearHatch=true;assert.equal(step(),'ramp-wait');
  s.doorProgress=1;assert.equal(step(),'board-ramp');
  s.insideShip=true;assert.equal(step(),'close-hatch');
  s.doorOpen=false;assert.equal(step(),'hatch-wait');
  s.doorProgress=0;s.hit=null;assert.equal(step(),'find-seat');
  s.hit='seat';assert.equal(step(),'sit');
  s.mode='landed';assert.equal(step(),'launch');
  s.mode='flight';s.dockedAtStation=false;s.stationLift=true;assert.equal(step(),'lift');
  s.stationLift=false;assert.equal(step(),'retract-gear');
  s.gearDeployed=false;assert.equal(step(),'gear-wait');
  s.gearProgress=0;assert.equal(step(),'leave-bay');
  s.stationDistance=550;assert.equal(step(),'choose');
});
test('departing over a dockable pad never tells the new pilot to dock again',()=>{
  const guide=new PlayerGuide();guide.update({...base,mode:'landed'});
  const step=guide.update({...base,mode:'flight',dockedAtStation:false,gearDeployed:false,gearProgress:0,canDock:true});
  assert.equal(step.id,'leave-bay');assert.equal(step.departing,true);
  guide.update({...base,mode:'flight',dockedAtStation:false,stationDistance:3500});
  assert.equal(guide.update({...base,mode:'flight',dockedAtStation:false,canDock:true}).id,'dock');
});
test('returning from landing guides disembarkation, then reboarding through the real hatch state',()=>{
  const guide=new PlayerGuide();guide.update({...base,mode:'flight',dockedAtStation:false,stationDistance:9000});
  const s={...base,mode:'landed',dockedAtStation:false,stationDistance:9000};assert.equal(guide.update(s).id,'landed');
  s.mode='walk';s.insideShip=true;assert.equal(guide.update(s).id,'exit-hatch');
  s.doorOpen=true;s.doorProgress=.4;assert.equal(guide.update(s).id,'exit-ramp-wait');
  s.doorProgress=1;assert.equal(guide.update(s).id,'leave-ship');
  s.insideShip=false;s.shipDistance=15;assert.equal(guide.update(s).id,'explore');
  s.shipDistance=8;s.nearHatch=true;assert.equal(guide.update(s).id,'board-ramp');
  s.insideShip=true;s.hit='door';assert.equal(guide.update(s).id,'close-hatch');
});
test('a selected destination guides aiming, clearance, charge and engagement without choosing another target',()=>{
  const s={...base,mode:'flight',dockedAtStation:false,stationDistance:9000,gearDeployed:false,gearProgress:0,
    target:{id:'settlement-aeon',name:'Greenbank',surface:true},targetDistance:800000,bodyId:'aeon',atmosphereFraction:0};
  assert.equal(playerGuideStep(s).id,'aim');s.aimedId=s.target.id;s.routeReason='Aeon Orbital exclusion zone';
  assert.equal(playerGuideStep(s).id,'clear-route');s.routeReason='';assert.equal(playerGuideStep(s).id,'charge');
  s.driveReady=true;assert.equal(playerGuideStep(s).id,'engage');
  assert.match(playerGuideStep(s).title,/Greenbank/);
  s.travel={targetName:'Greenbank'};assert.equal(playerGuideStep(s).id,'travel');
});
test('surface and world arrival prompts lower gear, descend, brake and land in that order',()=>{
  const s={...base,mode:'flight',dockedAtStation:false,stationDistance:9000,gearDeployed:false,gearProgress:0,
    target:{id:'settlement-aeon',name:'Greenbank',surface:true},targetDistance:35000,altitude:35000,bodyId:'aeon',speed:50,dryGround:true};
  assert.equal(playerGuideStep(s).id,'landing-gear');s.gearDeployed=true;assert.equal(playerGuideStep(s).id,'descend');
  s.altitude=11000;assert.equal(playerGuideStep(s).id,'land-brake');s.speed=0;assert.equal(playerGuideStep(s).id,'land');
  s.target={id:'aeon',name:'Aeon',category:'bodies'};assert.equal(playerGuideStep(s).id,'land');
  s.dryGround=false;assert.equal(playerGuideStep(s).id,'dry-ground');s.autoland=true;assert.equal(playerGuideStep(s).id,'landing');
});
test('nearby contract signals use normal flight; patrols progress to combat and report filing',()=>{
  const s={...base,mode:'flight',dockedAtStation:false,stationDistance:9000,gearDeployed:false,gearProgress:0,
    target:{id:'mission-patrol',name:'Patrol signal',category:'missions'},targetDistance:3000};
  assert.equal(playerGuideStep(s).id,'manual-approach');s.combatPhase='engage';assert.equal(playerGuideStep(s).id,'combat-mode');
  s.combatMode=true;assert.equal(playerGuideStep(s).id,'combat');s.reinforcementIn=5;assert.equal(playerGuideStep(s).id,'reinforcements');
  s.combatPhase='complete';assert.equal(playerGuideStep(s).id,'report');assert.match(playerGuideStep(s).detail,/Tab/);
});
test('controller and touch steps name their actual controls, while specialist ship access is retained',()=>{
  assert.match(playerGuideStep({...base,input:'controller',hit:'door'}).detail,/X \/ □/);
  assert.match(playerGuideStep({...base,input:'touch',hit:'door'}).detail,/Tap the interaction button/);
  assert.match(playerGuideStep({...base,input:'touch',mode:'landed'}).detail,/Tap Launch/);
  assert.match(playerGuideStep({...base,mode:'flight',input:'controller',stationDistance:9000}).detail,/LB \+ RB/);
  assert.match(playerGuideStep({...base,shipId:'atlas',accessHint:'Use the forward ramp and crew lift.'}).detail,/crew lift/);
});
test('plain Tab leaves HUD visibility alone; Shift+Tab cycles and modal/editable guards still apply',()=>{
  let handler,allowed=true,changes=0;const body={dataset:{},classList:{toggle(){}},ownerDocument:{addEventListener(type,fn){handler=fn;}}};
  const hud=createHUDDisplay({body,canvas:{addEventListener(){}},canChange:()=>allowed});
  const event={code:'Tab',target:{closest:()=>false},preventDefault(){changes++;}};
  handler(event);assert.equal(hud.mode,'full');
  handler({...event,shiftKey:true});assert.equal(hud.mode,'markers');
  handler({...event,shiftKey:true,repeat:true});assert.equal(hud.mode,'markers');
  allowed=false;handler({...event,shiftKey:true});assert.equal(hud.mode,'markers');
  allowed=true;handler({...event,shiftKey:true,target:{closest:()=>true}});assert.equal(hud.mode,'markers');
  handler({...event,shiftKey:true});assert.equal(hud.mode,'none');assert.equal(changes,2);
});

test('unsupported shared routes do not ask the pilot to charge or clear a physical obstruction',()=>{
  const s={...base,mode:'flight',stationDistance:8000,gearDeployed:false,gearProgress:0,target:{id:'selene',name:'Selene',category:'bodies'},targetDistance:25000000,aimedId:'selene',routeReason:'Shared targeted drive supports freight routes.',sharedDriveUnavailable:true};
  assert.equal(playerGuideStep(s).id,'shared-route');assert.match(playerGuideStep(s).detail,/normal flight/);
});
