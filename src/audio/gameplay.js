import { FootstepTracker } from './footsteps.js';
import { walkingAudioState, walkingSurface } from './ground-state.js';
import { SOUND_KINDS, synthesize } from './synthesis.js';

const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const weaponSound=id=>({'rifle-laser':'carbine','sidearm-pistol':'sidearm'}[id]??id);

/** Shared effects mixer; context is supplied by FlightAudio only after a gesture. */
export class GameplayAudio {
  constructor(context,destination){
    this.context=context;this.enabled=false;this.disposed=false;this.cache=new Map();this.voices=new Set();
    this.steps=new FootstepTracker();this.serial=0;this.counts={steps:0,shots:0,impacts:0};this.last=null;this.mining=false;this.hot=false;
    this.bus=context.createGain();this.bus.gain.value=1;this.bus.connect(destination);
  }
  setEnabled(enabled){
    if(this.disposed)return;
    this.enabled=enabled;
    if(!enabled){this.suspend();for(const voice of [...this.voices])voice.stop();}
  }
  suspend(){this.steps.reset();this.setMining(false);}
  buffer(kind,variant){
    const key=`${kind}:${variant}`;
    if(!this.cache.has(key)){
      const data=synthesize(kind,variant,this.context.sampleRate),buffer=this.context.createBuffer(1,data.length,this.context.sampleRate);
      buffer.copyToChannel(data,0);this.cache.set(key,buffer);
    }
    return this.cache.get(key);
  }
  play(kind,{gain=.1,pan=0,pitch=1}={}){
    if(!this.enabled||this.disposed||this.context.state!=='running'||!SOUND_KINDS.includes(kind)||gain<.0005)return false;
    if(this.voices.size>=24)return false;
    const source=this.context.createBufferSource(),volume=this.context.createGain(),panner=this.context.createStereoPanner();
    source.buffer=this.buffer(kind,this.serial++%4);volume.gain.value=gain;panner.pan.value=clamp(pan,-1,1);
    if(source.playbackRate)source.playbackRate.value=clamp(pitch,.5,1.5);
    source.connect(volume);volume.connect(panner);panner.connect(this.bus);
    const voice={stop:()=>{try{source.stop();}catch{}source.disconnect();volume.disconnect();panner.disconnect();this.voices.delete(voice);}};
    source.onended=voice.stop;this.voices.add(voice);source.start();this.last=kind;return true;
  }
  event(event,nav){
    if(!this.enabled||!nav.focused||globalThis.document?.hidden||nav.mode==='crashed'||nav.mode==='destroyed')return;
    const kind=event.type==='shot'?weaponSound(event.sound??event.weapon):event.type;
    let gain=event.type==='shot'?.115:event.type==='impact'?.065:.045,pan=0;
    if(event.type==='shot')gain*=1+.18*(clamp(event.size??1,1,3)-1);
    if(event.point&&nav.position){
      const delta=event.point.clone().sub(nav.position),distance=delta.length();
      if(distance>300)return;
      gain*=1/(1+Math.pow(distance/18,1.5));
      if(distance>1&&nav.orientation){delta.applyQuaternion(nav.orientation.clone().invert());pan=delta.x/Math.max(1,Math.hypot(delta.x,delta.z));}
    }
    if(this.play(kind,{gain,pan,pitch:event.pitch??1})){
      if(event.type==='shot')this.counts.shots++;
      if(event.type==='impact')this.counts.impacts++;
    }
  }
  createMining(){
    const c=this.context,gain=c.createGain(),scratchGain=c.createGain(),filter=c.createBiquadFilter();
    gain.gain.value=0;scratchGain.gain.value=0;filter.type='bandpass';filter.frequency.value=1600;filter.Q.value=.65;
    const motor=c.createOscillator(),overtone=c.createOscillator(),scratch=c.createBufferSource();
    motor.type='triangle';motor.frequency.value=145;overtone.type='sine';overtone.frequency.value=435;
    const overtoneGain=c.createGain();overtoneGain.gain.value=.2;
    motor.connect(gain);overtone.connect(overtoneGain);overtoneGain.connect(gain);
    scratch.buffer=this.buffer('grass',0);scratch.loop=true;scratch.connect(filter);filter.connect(scratchGain);scratchGain.connect(this.bus);gain.connect(this.bus);
    motor.start();overtone.start();scratch.start();
    this.cutter={gain,scratchGain,filter,motor,overtone,overtoneGain,scratch};
  }
  setMining(active,contact=false,heat=0){
    active=Boolean(active&&this.enabled&&!this.disposed);
    if(active&&!this.cutter)this.createMining();
    this.mining=active;
    if(!this.cutter)return;
    const c=this.cutter,t=this.context.currentTime;
    c.gain.gain.setTargetAtTime(active?.028:0,t,.035);
    c.scratchGain.gain.setTargetAtTime(active&&contact?.085:0,t,.025);
    c.motor.frequency.setTargetAtTime(145+clamp(heat,0,1)*110,t,.08);
    c.overtone.frequency.setTargetAtTime(435+clamp(heat,0,1)*180,t,.08);
  }
  update(nav,dt,{active=true,mining=null,heat=0,overheated=false}={}){
    if(!this.enabled||!active){this.suspend();return;}
    const state=walkingAudioState(nav,active),step=this.steps.update(state,dt);
    this.walkState={active:state.active,grounded:state.grounded,metal:state.metal,dt,distance:this.steps.distance};
    if(step){const surface=walkingSurface(nav,state.metal);if(this.play(surface,{gain:step.running?.12:.085,pan:step.side*.13})){this.counts.steps++;}}
    this.setMining(Boolean(mining?.active),Boolean(mining?.hit),heat);
    if(overheated&&!this.hot)this.play('overheat',{gain:.08});
    this.hot=overheated;
  }
  get state(){return {...this.counts,last:this.last,voices:this.voices.size,mining:this.mining,buffers:this.cache.size,walking:this.walkState??null};}
  dispose(){
    if(this.disposed)return;this.setEnabled(false);this.disposed=true;
    if(this.cutter){for(const source of [this.cutter.motor,this.cutter.overtone,this.cutter.scratch]){source.stop();}for(const node of Object.values(this.cutter))node.disconnect();}
    this.bus.disconnect();this.cache.clear();
  }
}
