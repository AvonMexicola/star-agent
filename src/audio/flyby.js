import { Quaternion, Vector3 } from 'three';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const RANGE=400,MAX_VOICES=4;

/** Relative motion keeps formation flight quiet; positions remain JS doubles. */
export function flybyMix(relative,velocity,orientation=new Quaternion()){
  const distance=relative.length(),speed=velocity.length();
  if(!Number.isFinite(distance+speed)||distance>=RANGE||speed<20)return null;
  const radial=distance>1?velocity.dot(relative)/distance:0;
  const doppler=clamp(343/(343+clamp(radial,-180,280)),.55,1.8);
  const local=relative.clone().applyQuaternion(orientation.clone().invert());
  const proximity=(1-distance/RANGE)**2/(1+(distance/65)**2);
  const gain=.24*clamp((speed-20)/180,0,1)*proximity;
  return {distance,speed,radial,doppler,gain,pan:clamp(local.x/Math.max(12,distance),-1,1),
    pitch:110*doppler,cutoff:(450+1800*proximity)*doppler};
}

export class FlybyTracker {
  constructor(){this.previous=new Map();}
  reset(){this.previous.clear();}
  update(sources,listener,orientation,dt){
    if(!(dt>0&&dt<=.25)){this.reset();return [];}
    const next=new Map(),audible=[];
    for(const {id,position} of sources){
      const relative=position.clone().sub(listener),prior=this.previous.get(id);
      next.set(id,{relative,position:position.clone()});
      if(!prior)continue;
      const delta=relative.clone().sub(prior.relative);
      // Spawn, camera cuts and network warps must not become loud flybys.
      if(delta.length()>1000||position.distanceTo(prior.position)>1000)continue;
      const mix=flybyMix(relative,delta.divideScalar(dt),orientation);
      if(mix&&mix.gain>.0001)audible.push({id,...mix});
    }
    this.previous=next;
    return audible.sort((a,b)=>b.gain-a.gain).slice(0,MAX_VOICES);
  }
}

export class FlybyAudio {
  constructor(context,destination,noise){
    this.context=context;this.destination=destination;this.noise=noise;
    this.tracker=new FlybyTracker();this.voices=[];this.enabled=false;this.state={voices:0,passes:[]};
  }
  setEnabled(enabled){this.enabled=enabled&&!this.disposed;if(!this.enabled)this.suspend();}
  createVoice(){
    const c=this.context,tone=c.createOscillator(),filter=c.createBiquadFilter();
    const toneGain=c.createGain(),noiseGain=c.createGain(),pan=c.createStereoPanner();
    tone.type='triangle';filter.type='lowpass';filter.Q.value=.5;
    toneGain.gain.value=0;noiseGain.gain.value=0;
    tone.connect(toneGain);toneGain.connect(pan);this.noise.connect(filter);filter.connect(noiseGain);noiseGain.connect(pan);pan.connect(this.destination);tone.start();
    const voice={id:null,tone,filter,toneGain,noiseGain,pan};this.voices.push(voice);return voice;
  }
  update(sources,listener,orientation,dt,{active=true}={}){
    if(!this.enabled||this.disposed||!active||this.context.state!=='running'){this.suspend();return;}
    const passes=this.tracker.update(sources,listener,orientation,dt),ids=new Set(passes.map(p=>p.id));
    const smooth=(param,value)=>param.setTargetAtTime(value,this.context.currentTime,.045);
    for(const voice of this.voices)if(!ids.has(voice.id)){voice.id=null;smooth(voice.toneGain.gain,0);smooth(voice.noiseGain.gain,0);}
    for(const pass of passes){
      const voice=this.voices.find(v=>v.id===pass.id)||this.voices.find(v=>v.id===null)||this.createVoice();
      voice.id=pass.id;smooth(voice.toneGain.gain,pass.gain*.28);smooth(voice.noiseGain.gain,pass.gain);
      smooth(voice.tone.frequency,pass.pitch);smooth(voice.filter.frequency,pass.cutoff);smooth(voice.pan.pan,pass.pan);
    }
    this.state={voices:passes.length,passes};
  }
  suspend(){
    this.tracker.reset();this.state={voices:0,passes:[]};
    for(const voice of this.voices){voice.id=null;for(const gain of [voice.toneGain,voice.noiseGain])gain.gain.setTargetAtTime(0,this.context.currentTime,.025);}
  }
  dispose(){
    if(this.disposed)return;this.setEnabled(false);this.disposed=true;
    for(const v of this.voices){v.tone.stop();this.noise.disconnect(v.filter);for(const node of [v.tone,v.filter,v.toneGain,v.noiseGain,v.pan])node.disconnect();}
    this.voices=[];
  }
}
