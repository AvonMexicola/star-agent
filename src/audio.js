import { FlightMusic } from './music.js';

/** Quiet, asset-free flight and surface ambience. Created only on user gesture. */
export class FlightAudio {
  constructor() {
    this.context = null;
    this.enabled = false;
    this.disposed = false;
    this.sources = [];
    this.suspended = false;
  }

  create() {
    const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContext) return false;
    const context = new AudioContext();
    this.context = context;
    this.master = context.createGain();
    this.master.gain.value = 0;
    this.master.connect(context.destination);

    this.hum = context.createGain();
    this.hum.gain.value = 0;
    this.hum.connect(this.master);
    this.engine = context.createOscillator();
    this.engine.type = 'sine';
    this.engine.frequency.value = 42;
    this.engine.connect(this.hum);
    this.engine.start();
    this.sources.push(this.engine);

    this.overtoneGain = context.createGain();
    this.overtoneGain.gain.value = 0;
    this.overtoneGain.connect(this.master);
    this.overtone = context.createOscillator();
    this.overtone.type = 'sine';
    this.overtone.frequency.value = 63;
    this.overtone.connect(this.overtoneGain);
    this.overtone.start();
    this.sources.push(this.overtone);

    const buffer = context.createBuffer(1, context.sampleRate * 3, context.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    this.noise = context.createBufferSource();
    this.noise.buffer = buffer;
    this.noise.loop = true;
    this.windFilter = context.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.value = 350;
    this.windFilter.Q.value = 0.4;
    this.wind = context.createGain();
    this.wind.gain.value = 0;
    this.noise.connect(this.windFilter);
    this.windFilter.connect(this.wind);
    this.wind.connect(this.master);
    this.noise.start();
    this.sources.push(this.noise);
    try { this.music = new FlightMusic(context, this.master); } catch { this.music = null; }
    return true;
  }

  async toggle() {
    if (this.disposed) return false;
    try {
      if (!this.context && !this.create()) return false;
      if (this.enabled) {
        this.enabled = false;
        this.music?.setEnabled(false);
        this.master.gain.setTargetAtTime(0, this.context.currentTime, 0.08);
        return false;
      }
      await this.context.resume();
      if (this.disposed || this.context.state !== 'running') return false;
      this.enabled = true;
      this.master.gain.setTargetAtTime(this.suspended ? 0 : 0.7, this.context.currentTime, 0.2);
      this.music?.setEnabled(!this.suspended);
      return true;
    } catch {
      this.enabled = false;
      return false;
    }
  }

  setSuspended(suspended) {
    this.suspended = suspended;
    if (!this.context || this.disposed) return;
    this.master.gain.setTargetAtTime(this.enabled && !suspended ? 0.7 : 0, this.context.currentTime, 0.08);
    this.music?.setEnabled(this.enabled && !suspended);
  }

  update({ speed = 0, altitude = 0, musicAltitude = altitude, verticalSpeed = 0, mode = 'flight', boost = false, airless = false,
    inHangar = false, doorMotion = 0, powered = true } = {}, dt = 0) {
    if (!this.context || this.disposed || !this.enabled || this.suspended) return;
    this.music?.update({ altitude: musicAltitude, verticalSpeed, mode, airless });
    const time = this.context.currentTime;
    const velocity = Number.isFinite(speed) ? Math.abs(speed) : 0;
    const height = Number.isFinite(altitude) ? Math.max(0, altitude) : 0;
    const motion = Math.min(1, Math.log1p(velocity) / Math.log(10001));
    const air = airless ? 0 : Math.exp(-height / 18000);
    const flying = mode === 'flight';
    const propulsion = flying && powered !== false;
    const thrust = propulsion ? 0.3 + motion * 0.5 + (boost ? 0.2 : 0) : 0;
    const hangar = inHangar ? 1 : 0;
    const motor = Math.max(0, Math.min(1, Number.isFinite(doorMotion) ? doorMotion : 0));
    const engineGain = (propulsion ? 0.018 + thrust * 0.026 : 0) + hangar * 0.009 + motor * 0.018;
    const overtoneGain = (propulsion ? 0.005 + thrust * 0.009 : 0) + hangar * 0.002 + motor * 0.012;
    const ambientNoise = hangar * 0.002 + motor * 0.008;
    // Smoothing is on the audio clock, independent of frame rate and tab stalls.
    const smooth = (parameter, target) => parameter.setTargetAtTime(target, time, 0.18);
    smooth(this.hum.gain, engineGain);
    smooth(this.overtoneGain.gain, overtoneGain);
    smooth(this.engine.frequency, motor > 0 ? 27 + motor * 5 : 36 + thrust * 30);
    smooth(this.overtone.frequency, motor > 0 ? 41 + motor * 7 : 54 + thrust * 45.2);
    smooth(this.wind.gain, ambientNoise + air * (flying ? 0.004 + motion * 0.035 : 0.012));
    smooth(this.windFilter.frequency, motor > 0 ? 150 + motor * 90 : flying ? 220 + motion * 1600 : 450);
  }

  dispose() {
    this.music?.dispose();
    this.disposed = true;
    this.enabled = false;
    for (const source of this.sources) {
      try { source.stop(); } catch { /* Already stopped or context closed. */ }
      source.disconnect();
    }
    this.sources.length = 0;
    for (const node of [this.hum, this.overtoneGain, this.windFilter, this.wind, this.master]) {
      node?.disconnect();
    }
    if (this.context && this.context.state !== 'closed') {
      this.context.close().catch(() => {});
    }
  }
}
