/** Read-only guidance: observed actions advance the journey, never a timer or
 * a simulated interaction. The same state works for keyboard, pad and touch. */
export class PlayerGuide {
  constructor(){this.reset();}
  reset(){this.previous=null;this.departing=false;this.hasFlown=false;this.disembarking=false;this.leftShip=false;}
  update(s){
    let previous=this.previous;
    if(previous&&s.shipId!==previous.shipId){this.reset();previous=null;}
    if(s.stationLift||(previous?.dockedAtStation&&s.mode==='flight'&&!s.dockedAtStation))this.departing=true;
    if(this.departing&&(s.stationDistance>3000||s.mode==='landed'||s.travel))this.departing=false;
    if(s.mode==='flight')this.hasFlown=true;
    if(s.mode==='walk'&&['landed','flight'].includes(previous?.mode)){
      this.disembarking=this.hasFlown||!s.dockedAtStation;this.leftShip=false;
    }
    if(this.disembarking&&!s.insideShip&&(s.shipDistance??0)>10)this.leftShip=true;
    if(this.leftShip&&s.insideShip){this.disembarking=false;this.leftShip=false;}
    if(s.mode==='landed'&&previous?.mode==='walk')this.disembarking=false;
    this.previous={mode:s.mode,shipId:s.shipId,dockedAtStation:s.dockedAtStation};
    return playerGuideStep(s,this);
  }
}

export function playerGuideStep(s,journey={}){
  const pad=s.input==='controller',touch=s.input==='touch';
  const command=(keyboard,controller,touchLabel)=>touch?touchLabel:pad?controller:keyboard;
  const interact=command('Press F','Press X / □','Tap the interaction button');
  const move=command('Use W/A/S/D to walk; drag the view or use the arrow keys to look.','Use the left stick to walk and the right stick to look.','Hold the walking arrows; drag the view to look.');
  const forward=command('Hold W','Push the left stick forward','Hold the forward flight control');
  const brake=command('Hold X','Hold LT / L2','Hold Brake');
  const gear=command('Press G','Hold LB + RB and press D-pad down','Open Commands → Ship → Landing gear (use the page arrows if needed)');
  const contracts=command('Press Tab','Open Menu → Contracts','Open Commands → Contracts');
  const map=command('Press M','Press D-pad left','Open Commands → Map');
  const land=command('Press B','Press Y / △',s.mode==='landed'?'Tap Launch':'Tap Land');
  const aim=command('Drag the view or use the arrow keys','Use the right stick','Drag the view');
  const ship=s.shipName||'ship';
  const step=(id,title,detail,section='FLIGHT GUIDE')=>({id,title,detail,section,departing:Boolean(journey.departing)});
  if(s.openingActive)return step('start','Start walking',command('Press W to take control.','Move the left stick to take control.','Touch the view to begin.'),'WELCOME ABOARD');
  if(s.mode==='crashed'||s.mode==='destroyed')return step('recover','Recover your ship','Use the recovery screen to return to play.');
  if(s.buildActive||s.roverOccupied)return null; // Their contextual control panels own these activities.
  if(s.berthRest)return step('leave-berth','Get out of the berth',`${interact} to stand up, then return to the cabin aisle.`);
  if(s.travel)return step('travel',s.travel.aborting?'Wait for the ship to stop':`Travelling to ${s.travel.targetName||'your destination'}`,s.travel.aborting?'The drive is braking. You will regain manual flight when it stops.':touch?'Arrival braking is automatic. Wait for normal flight to resume.':`${brake} to abort if needed. Arrival braking is automatic.`,'EN ROUTE');

  if(s.mode==='walk'||s.mode==='eva'){
    if(s.cabinFlight&&!s.spaceParked)return step('return-seat','Return to the pilot chair',`${move} ${interact} when the chair prompt appears; your ship is still in flight.`);
    if(s.mode==='eva')return step('eva','Follow the mint ship marker home',`${move} ${command('Space / C moves up / down; X brakes.','A / B moves up / down; LT brakes.','Use a keyboard or controller for suit thrusters.')} Approach the open hatch to board.`);
    if(s.service)return step('service','Use the nearby terminal',`${interact} to open it. Follow the terminal's available actions, then return to your ship.`,'ON FOOT');
    if(s.shipId!=='nomad')return step('other-ship',s.insideShip?'Find the pilot controls':`Board your ${ship}`,s.accessHint||`${move} ${interact} at a highlighted ramp, ladder or lift.`,'BOARDING');
    const exiting=journey.disembarking&&!journey.leftShip;
    if(exiting){
      if(s.insideShip&&!s.doorOpen)return step('exit-hatch','Open the rear hatch',s.hit==='door'?`${interact} to open the hatch and lower the ramp.`:`Walk aft through the cabin aisle. ${interact} when the hatch prompt appears.`,'ON FOOT');
      if(s.doorOpen&&s.doorProgress<.98)return step('exit-ramp-wait','Wait for the ramp to lower','Stay clear of the moving hatch, then walk down the ramp.','ON FOOT');
      return step('leave-ship','Walk down the rear ramp',`${move} The mint ship marker will guide you back.`,'ON FOOT');
    }
    if(!s.insideShip){
      if(journey.leftShip&&!s.nearHatch)return step('explore','Explore on foot',`${move} ${interact} at a terminal or vehicle. Follow the mint ship marker when you want to return.`,'ON FOOT');
      if(s.hit==='door'&&!s.doorOpen)return step('open-hatch',`Open your ${ship}'s rear hatch`,`${interact} to open the hatch and lower the ramp.`,'BOARDING');
      if(s.doorOpen&&s.nearHatch)return s.doorProgress<.98?step('ramp-wait','Wait for the ramp to lower','Let the hatch finish opening before walking aboard.','BOARDING'):step('board-ramp','Walk up the rear ramp',`${move} Enter the cabin before closing the hatch.`,'BOARDING');
      return step('find-hatch',`Go to the back of your ${ship}`,`${move} Go around the outside of the hull to the rear ramp, behind the engines.`,'BOARDING');
    }
    if(s.doorOpen)return step('close-hatch','Close the hatch behind you',s.hit==='door'?`${interact} to close the hatch and raise the ramp.`:`Walk back to the rear hatch control. ${interact} when “Close hatch” appears.`,'BOARDING');
    if(s.doorProgress>.02)return step('hatch-wait','Wait for the hatch to close','The ramp is stowing. Stay inside the cabin.','BOARDING');
    if(s.hit==='seat')return step('sit','Sit in the pilot chair',`${interact} to take the controls.`,'BOARDING');
    return step('find-seat','Walk forward to the pilot chair',`${move} Follow the clear centre aisle to the front of the cabin.`,'BOARDING');
  }

  if(s.mode==='landed'){
    if(!s.powered)return step('power','Switch on main power',command('Press P to power the ship.','Open Menu → Ship → Toggle ship main power.','Use Commands → Ship → Toggle ship main power.'),'DEPARTURE');
    if(s.doorOpen)return step('secure-hatch','Secure the rear hatch before departure',`${interact} to leave the chair. Walk aft and close the hatch with the interaction control.`,'DEPARTURE');
    if(s.dockedAtStation&&!journey.hasFlown)return step('launch','Lift off from the station pad',`${land} to take off. Wait for the short automatic lift.`,'DEPARTURE');
    return step('landed',s.dockedAtStation?'Docking complete':'Touchdown',`${interact} to leave the pilot chair and explore. ${land} when you are ready to take off again.`,'ARRIVAL');
  }
  if(s.mode!=='flight')return null;
  if(s.stationLift)return step('lift','Wait for the ship to lift clear','The station is lifting your ship off the pad. Keep the controls neutral.','DEPARTURE');
  if(s.autoland)return step('landing',s.stationDistance<500?'Let docking assist settle the ship':'Let landing assist finish','Keep the controls neutral. Wait for touchdown before leaving your seat.','ARRIVAL');
  if(!s.powered)return step('power','Restore main power',command('Press P to restore propulsion.','Open Menu → Ship → Toggle ship main power.','Use Commands → Ship → Toggle ship main power.'));
  const returning=s.stationDistance<500&&!journey.departing;
  if(returning){
    if(!s.canDock)return step('station-approach','Fly over the station landing pad',`${forward} gently through the open hangar doors; line up over the central pad.`,'ARRIVAL');
    if(s.speed>=10)return step('dock-brake','Slow down above the pad',`${brake} until your speed is below 10 m/s.`,'ARRIVAL');
    return step('dock','Dock on the station pad',`${land} to start docking assist.`,'ARRIVAL');
  }
  const target=s.target;
  const localSurface=(target?.surface||target?.category==='bodies'&&target.id===s.bodyId&&!s.bodyStar)&&s.targetDistance<40000;
  if(localSurface){
    if(!s.gearDeployed)return step('landing-gear','Lower your landing gear',`${gear} to deploy the legs before your approach.`,'ARRIVAL');
    if(s.altitude>=12000)return step('descend',`Descend toward ${target.name}`,`${aim} to keep the marker ahead. ${s.atmosphereFraction>0?command('Hold C to descend.','Hold B / ○ to descend.','Hold the down flight control.'): `${forward} to descend toward the marker.`} Brake as you approach 12 km altitude.`,'ARRIVAL');
    if(!s.dryGround)return step('dry-ground','Find dry ground for landing','Move away from open water. Follow the destination marker toward land.','ARRIVAL');
    if(s.speed>=10)return step('land-brake','Brake for landing',`${brake} until speed falls below 10 m/s.`,'ARRIVAL');
    return step('land','Start landing assist',`${land} to land. The ship will lower itself to the surface.`,'ARRIVAL');
  }
  if(s.gearDeployed)return step('retract-gear','Retract your landing gear',`${gear} to stow the legs. Gear down limits you to maneuvering speed.`,'DEPARTURE');
  if(s.gearProgress>.02)return step('gear-wait','Wait for the landing gear to retract','The legs are folding into the hull.','DEPARTURE');
  if(journey.departing&&s.stationDistance<500)return step('leave-bay','Fly out through the hangar doors',`${forward} to move out of the bay. Keep the ship level until you are clear of the station.`,'DEPARTURE');
  if(s.combatPhase==='engage'){
    if(s.reinforcementIn>0)return step('reinforcements','Stay near the patrol beacon','The wave is clear. Let your shields recharge while reinforcements arrive.','CONTRACT');
    if(!s.combatMode)return step('combat-mode','Switch to combat mode',command('Press Z to enable ship weapons.','Use Menu → Ship → Combat / cruise.','Use Commands → Ship → Combat / cruise.'),'CONTRACT');
    return step('combat','Follow the hostile marker',`${aim} to line up the target. ${command('Hold T or the mouse button','Hold RT / R2','Use the Fire control')} to fire; stay close to the patrol beacon.`,'CONTRACT');
  }
  if(s.combatPhase==='complete')return step('report','File your combat report',`${contracts}, then choose File combat report to finish the patrol.`,'CONTRACT');
  if(!target)return step('choose','Choose what to do next',`${map} to select a destination, or ${contracts.replace(/^Press/, 'press').replace(/^Open/, 'open')} to choose a contract.`,'YOUR NEXT JOURNEY');
  if(s.targetDistance<21000&&!target.surface&&target.category!=='bodies')return step('manual-approach',`Fly toward ${target.name}`,`${aim} to centre its marker. ${forward} to approach; ${brake.replace(/^Hold/,'hold')} to slow down near it.`,'APPROACH');
  if(s.altitude<19990&&s.atmosphereFraction>0)return step('climb','Climb before engaging the drive',`${command('Hold Space','Hold A / ✕','Hold the up flight control')} to climb above 20 km. Keep the destination selected.`,'NAVIGATION');
  if(s.aimedId!==target.id)return step('aim',`Aim at ${target.name}`,`${aim} until the nose reticle lines up with its ${s.objective?'amber objective':'selected destination'} marker.`,'NAVIGATION');
  if(s.routeReason){
    if(s.sharedDriveUnavailable)return step('shared-route',`Fly toward ${target.name}`,`${forward} to travel in normal flight; ${brake.replace(/^Hold/,'hold')} to slow down. ${contracts} for freight routes that support the shared targeted drive.`,'NAVIGATION');
    return step('clear-route','Reach a clear drive approach',`${s.routeReason} ${s.stationDistance<3000?`${forward} to fly farther away from the station. `:''}Keep ${target.name} selected.`,'NAVIGATION');
  }
  if(!s.driveReady)return step('charge','Hold your nose on the marker','Keep the reticle steady until the drive ring fills.','NAVIGATION');
  return step('engage',`Engage the drive to ${target.name}`,`${command('Press N or J','Hold LB + RB and press D-pad up','Tap Engage relativistic drive')}. The ship will brake automatically on arrival.`,'NAVIGATION');
}
