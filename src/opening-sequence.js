import * as THREE from 'three';
import { Character, CharacterCamera } from './character.js';
import { PLAYER_AVATAR } from './player-avatar.js';
import { SHIP_LAYOUT } from './boarding.js';
import { SUN_DIRECTION } from './world.js';
import { defaultStationDirection } from './station.js';
import './opening-sequence.css';

export const OPENING = Object.freeze({duration:10,blendSeconds:.9,hintSeconds:6});
const UP=new THREE.Vector3(0,1,0),FORWARD=new THREE.Vector3(0,0,-1);
function openingUI(active){
  document.body.classList.toggle('opening-active',active);
  for(const selector of ['#hud','.top-actions','.wordmark']){
    const element=document.querySelector(selector);if(element)element.inert=active;
  }
}
const MOVE_KEYS=new Set(['KeyW','KeyA','KeyS','KeyD','Space','KeyC']);

/** A deterministic twilight berth: sun 5 degrees above the radial horizon and
 * the door axis 20 degrees below it, exposing the planet limb in the aperture. */
export function openingStationOptions(){
  const sun=new THREE.Vector3(...SUN_DIRECTION),side=defaultStationDirection().projectOnPlane(sun).normalize();
  const direction=side.multiplyScalar(Math.cos(THREE.MathUtils.degToRad(5))).addScaledVector(sun,Math.sin(THREE.MathUtils.degToRad(5))).normalize();
  const forward=sun.clone().projectOnPlane(direction).normalize().multiplyScalar(Math.cos(Math.PI/9)).addScaledVector(direction,-Math.sin(Math.PI/9));
  const orientation=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(new THREE.Vector3(),forward,direction));
  return {direction,orientation};
}

export class OpeningSequence {
  constructor({scene,nav,station,character:playerCharacter=null,onGesture=()=>{}}){
    this.nav=nav;this.station=station;this.onGesture=onGesture;
    this.phase='loading';this.elapsed=0;this.blendElapsed=0;this.bufferedKey=null;this.bufferRemaining=0;
    this.character=playerCharacter||new Character(scene,{...PLAYER_AVATAR,eyeHeight:SHIP_LAYOUT.eyeHeight});
    this.character.setVisible(false);
    // The physical navigation eye is authoritative. Using the animated head
    // directly here would cause a jump when the normal first-person loop resumes.
    const character=this.character;
    this.cameraRig=new CharacterCamera({
      get worldPosition(){return character.worldPosition;},
      get up(){return character.up;},eyeHeight:SHIP_LAYOUT.eyeHeight,
      forwardVector:out=>character.forwardVector(out),
      eyeWorldPosition:out=>out.copy(nav.position),
      setHeadHidden:hidden=>character.setHeadHidden(hidden),
    });
    this.hint=document.getElementById('opening-hint');
    nav.enabled=false;nav.openingActive=true;
    nav.onOpeningKey=event=>{
      if(!MOVE_KEYS.has(event.code)||event.repeat)return;
      event.preventDefault();this.requestControl(event.code,true);
    };
    nav.onOpeningInput=pad=>{
      if(Math.hypot(pad.strafe,pad.forward)>.1||Math.abs(pad.vertical)>.1){
        const code=Math.abs(pad.forward)>=Math.abs(pad.strafe)?(pad.forward>0?'KeyW':'KeyS'):(pad.strafe>0?'KeyD':'KeyA');
        this.requestControl(code);
      }
    };
    openingUI(true);
  }
  get active(){return this.phase==='loading'||this.phase==='cinematic'||this.phase==='blend';}
  get state(){return {phase:this.phase,elapsed:this.elapsed,blend:this.blendElapsed,characterReady:this.character.ready,characterError:this.character.error,
    clip:this.character.clipName,cameraPosition:this.cameraRig.worldPosition.toArray(),doors:this.station.doorsOpen};}
  start(){
    this.nav.startStation();
    this.station.beginOpening();
    this.syncCharacter(0);
    this.character.setVisible(true);
    // Offset the six-metre dolly sideways to clear the Nomad's wing. Aim
    // through the pilot so the ship stays at frame left and the pilot below centre.
    const at=this.nav.toShipLocal();
    const side=this.nav.shipId==='atlas'?Math.min(this.nav.layout.flightBounds.max[0]+1.2,this.station.interiorBox.max.x-at.x-.8):4;
    const from=this.nav.fromShipLocal(at.clone().add(new THREE.Vector3(side,2.6-SHIP_LAYOUT.eyeHeight,6)));
    const to=from.clone().addScaledVector(FORWARD.clone().applyQuaternion(this.nav.shipOrientation),1.5);
    const look=this.nav.fromShipLocal(at.clone().add(new THREE.Vector3(-4,.25,-6)));
    this.cameraRig.cinematic(from,to,OPENING.duration,look).update(0,this.nav.orientation);
    this.phase='cinematic';this.nav.enabled=true;
  }
  fail(){
    this.phase='skipped';this.nav.openingActive=false;this.nav.enabled=true;this.nav.orbit();
    this.character.setVisible(false);openingUI(false);
  }
  requestControl(code,fromGesture=false){
    if(this.phase!=='cinematic')return;
    this.nav.onTakeControl?.();
    this.bufferedKey=code;this.phase='blend';this.blendElapsed=0;
    this.cameraRig.blendTo('first',OPENING.blendSeconds);
    if(fromGesture)this.onGesture();
  }
  syncCharacter(dt){
    const nav=this.nav,up=nav.dockedAtStation?this.station.up:nav.normal;
    const feet=nav.position.clone().addScaledVector(up,-SHIP_LAYOUT.eyeHeight);
    const forward=FORWARD.clone().applyQuaternion(nav.orientation);
    this.character.alignToSurface(feet,up,forward);
    this.character.update(dt,{speed:this.phase==='blend'?1:nav.speed,grounded:true});
  }
  update(dt){
    if(this.phase==='loading'||this.phase==='skipped')return;
    if(!this.nav.enabled)return;
    this.elapsed+=dt;
    if(this.elapsed<OPENING.duration)this.station.setOpeningProgress(this.elapsed/OPENING.duration);
    else if(this.station.openingControlled){this.station.setOpeningProgress(1);this.station.endOpening();}
    if(this.active){
      this.syncCharacter(dt);this.cameraRig.update(dt,this.nav.orientation);
      if(this.phase==='blend'){
        this.blendElapsed+=dt;
        document.body.style.setProperty('--opening-hud',String(Math.min(1,this.blendElapsed/OPENING.blendSeconds)));
        if(this.blendElapsed>=OPENING.blendSeconds){
          this.nav.notify(this.nav.shipId==='atlas'?'Use the forward ramp call panel, then walk onto the cargo deck. F operates the crew lift to the bridge.':'Walk around to the rear hatch. F opens it; walk up the ramp to the pilot chair.');
          this.phase='playing';this.nav.openingActive=false;this.character.setVisible(false);
          this.nav.keys.add(this.bufferedKey);this.bufferRemaining=.12;
          openingUI(false);document.body.style.removeProperty('--opening-hud');
        }
      }
      this.hint.classList.toggle('visible',this.phase==='cinematic'&&this.elapsed>=OPENING.hintSeconds);
    }else if(this.bufferRemaining>0){
      this.bufferRemaining-=dt;
      if(this.bufferRemaining<=0&&!this.nav.physicalKeys.has(this.bufferedKey))this.nav.keys.delete(this.bufferedKey);
    }
  }
  placeCamera(camera,origin){
    if(!this.active||this.phase==='loading')return false;
    origin.copy(this.cameraRig.worldPosition);this.cameraRig.applyTo(camera,origin);
    this.character.placeCameraRelative(origin);return true;
  }
  leave(){
    if(this.phase==='loading')return;
    this.phase='skipped';this.nav.openingActive=false;this.character.setVisible(false);
    this.station.endOpening();this.hint.classList.remove('visible');
    openingUI(false);document.body.style.removeProperty('--opening-hud');
  }
}
