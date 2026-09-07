const clamp=value=>Math.max(0,Math.min(1,Number.isFinite(value)?value:0));

/** Sound follows the shared flight simulation, including controller thrust and
 * automatic braking/landing. Velocity alone must not sound like full thrust. */
export function engineMix({mode='flight',powered=true,throttle=0,boost=false}={}){
  const active=powered!==false&&(mode==='flight'||mode==='landed');
  const load=active&&mode==='flight'?clamp(throttle):0;
  const afterburner=Boolean(active&&boost&&load>.05);
  return {active,load,boost:afterburner,
    tone:active?.018+load*.085+(afterburner?.028:0):0,
    turbine:active?.006+load*.021:0,
    exhaust:active?.025+load*.24+(afterburner?.14:0):0,
    pitch:78+load*85+(afterburner?28:0),cutoff:260+load*1200+(afterburner?700:0)};
}

export class EngineAudio {
  constructor(context,destination,noise){
    this.context=context;this.state=engineMix({powered:false});
    this.tone=context.createOscillator();this.tone.type='triangle';
    this.turbine=context.createOscillator();this.turbine.type='sine';
    this.toneGain=context.createGain();this.turbineGain=context.createGain();this.exhaustGain=context.createGain();
    for(const node of [this.toneGain,this.turbineGain,this.exhaustGain]){node.gain.value=0;node.connect(destination);}
    this.tone.connect(this.toneGain);this.turbine.connect(this.turbineGain);
    this.filter=context.createBiquadFilter();this.filter.type='lowpass';this.filter.Q.value=.65;
    this.noise=noise;noise.connect(this.filter);this.filter.connect(this.exhaustGain);
    this.tone.frequency.value=78;this.turbine.frequency.value=234;
    this.tone.start();this.turbine.start();
  }
  update(input){
    if(this.disposed)return;
    this.state=engineMix(input);const p=this.state,t=this.context.currentTime;
    // The audio clock smooths spool-up/down even during slow render frames.
    const smooth=(param,value)=>param.setTargetAtTime(value,t,.28);
    smooth(this.toneGain.gain,p.tone);smooth(this.turbineGain.gain,p.turbine);smooth(this.exhaustGain.gain,p.exhaust);
    smooth(this.tone.frequency,p.pitch);smooth(this.turbine.frequency,p.pitch*3.015);smooth(this.filter.frequency,p.cutoff);
  }
  dispose(){
    if(this.disposed)return;this.disposed=true;
    this.tone.stop();this.turbine.stop();this.noise.disconnect(this.filter);
    for(const node of [this.tone,this.turbine,this.toneGain,this.turbineGain,this.filter,this.exhaustGain])node.disconnect();
  }
}
