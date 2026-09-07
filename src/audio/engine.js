const clamp = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

// Original procedural voices. Hull mass is expressed through pitch, turbine
// spacing and spool time; all three reuse the same bounded audio graph.
export const ENGINE_VOICES = Object.freeze({
  atlas: Object.freeze({ pitch: 46, rise: 54, boostPitch: 18, ratio: 1.505,
    tone: .027, toneLoad: .085, turbine: .008, turbineLoad: .025,
    exhaust: .019, exhaustLoad: .23, cutoff: 210, cutoffLoad: 940, spool: .48 }),
  kestrel: Object.freeze({ pitch: 104, rise: 122, boostPitch: 36, ratio: 3.015,
    tone: .014, toneLoad: .059, turbine: .01, turbineLoad: .037,
    exhaust: .012, exhaustLoad: .19, cutoff: 380, cutoffLoad: 1640, spool: .16 }),
  nomad: Object.freeze({ pitch: 72, rise: 83, boostPitch: 27, ratio: 2.505,
    tone: .02, toneLoad: .073, turbine: .007, turbineLoad: .028,
    exhaust: .016, exhaustLoad: .21, cutoff: 280, cutoffLoad: 1240, spool: .28 }),
});

/** Throttle is actual engine acceleration normalized by this hull's thrust,
 * including braking and controller input. Cruise velocity is never an input. */
export function engineMix({ shipId = 'nomad', mode = 'flight', powered = true,
  active: available = true, cabinFlight = false, insideShip = false,
  throttle = 0, forwardThrottle = throttle, boost = false } = {}) {
  const id = Object.hasOwn(ENGINE_VOICES, shipId) ? shipId : 'nomad';
  const voice = ENGINE_VOICES[id];
  const cabin = mode === 'walk' && insideShip;
  const flying = mode === 'flight' || (cabin && cabinFlight);
  const active = Boolean(available && powered && (flying || mode === 'landed' || cabin));
  const load = active && flying ? clamp(throttle) : 0;
  const afterburner = Boolean(active && boost && load > .05 && clamp(forwardThrottle) > .05 && !cabin);
  const volume = cabin ? .46 : 1;
  const pitch = voice.pitch + load * voice.rise + (afterburner ? voice.boostPitch : 0);
  return { shipId: id, mode, active, cabin, load, boost: afterburner,
    tone: active ? (voice.tone + load * voice.toneLoad + (afterburner ? .022 : 0)) * volume : 0,
    turbine: active ? (voice.turbine + load * voice.turbineLoad) * volume : 0,
    exhaust: active ? (voice.exhaust + load * voice.exhaustLoad + (afterburner ? .11 : 0)) * volume : 0,
    pitch, turbinePitch: pitch * voice.ratio,
    cutoff: (voice.cutoff + load * voice.cutoffLoad + (afterburner ? 620 : 0)) * (cabin ? .55 : 1),
    spool: voice.spool,
  };
}

export class EngineAudio {
  constructor(context, destination, noise) {
    this.context = context;
    this.state = engineMix({ powered: false });
    this.tone = context.createOscillator(); this.tone.type = 'triangle';
    this.turbine = context.createOscillator(); this.turbine.type = 'sine';
    this.toneGain = context.createGain(); this.turbineGain = context.createGain(); this.exhaustGain = context.createGain();
    for (const node of [this.toneGain, this.turbineGain, this.exhaustGain]) { node.gain.value = 0; node.connect(destination); }
    this.tone.connect(this.toneGain); this.turbine.connect(this.turbineGain);
    this.filter = context.createBiquadFilter(); this.filter.type = 'lowpass'; this.filter.Q.value = .65;
    this.noise = noise; noise.connect(this.filter); this.filter.connect(this.exhaustGain);
    this.tone.frequency.value = this.state.pitch; this.turbine.frequency.value = this.state.turbinePitch;
    this.tone.start(); this.turbine.start();
  }

  update(input) {
    if (this.disposed) return;
    this.state = engineMix(input);
    const p = this.state, time = this.context.currentTime;
    // The audio clock smooths spool-up even during slow render frames. Power
    // loss and pause silence promptly, without carrying the old hull's voice.
    const smooth = (param, value) => param.setTargetAtTime(value, time, p.active ? p.spool : .06);
    smooth(this.toneGain.gain, p.tone); smooth(this.turbineGain.gain, p.turbine); smooth(this.exhaustGain.gain, p.exhaust);
    smooth(this.tone.frequency, p.pitch); smooth(this.turbine.frequency, p.turbinePitch); smooth(this.filter.frequency, p.cutoff);
  }

  suspend() { this.update({ shipId: this.state.shipId, mode: this.state.mode, active: false }); }

  dispose() {
    if (this.disposed) return;
    this.suspend(); this.disposed = true;
    this.tone.stop(); this.turbine.stop(); this.noise.disconnect(this.filter);
    for (const node of [this.tone, this.turbine, this.toneGain, this.turbineGain, this.filter, this.exhaustGain]) node.disconnect();
  }
}
