import { FlybyAudio } from './audio/flyby.js';
import { EngineAudio } from './audio/engine.js';
import { GameplayAudio } from './audio/gameplay.js';
import { FlightMusic } from './music.js';

/** Procedural flight/surface sounds and the bundled score. Created on a gesture. */
export class FlightAudio {
  constructor({ contextFactory, musicOptions } = {}) {
    this.context = null;
    this.contextFactory = contextFactory;
    this.musicOptions = musicOptions;
    this.enabled = false;
    this.userMuted = false;
    this.unlocked = false;
    this.disposed = false;
    this.sources = [];
    this.suspended = false;
    this.lastState = {};
    this.audible = false;
    this.resumePending = null;
  }

  create() {
    if (this.context) return true;
    const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContext && !this.contextFactory) return false;
    const context = this.contextFactory ? this.contextFactory() : new AudioContext();
    if (!context) return false;
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
    try { this.music = new FlightMusic(context, this.master, this.musicOptions); } catch { this.music = null; }
    this.gameplay = new GameplayAudio(context, this.master);
    this.engineAudio = new EngineAudio(context, this.master, this.noise);
    this.flyby = new FlybyAudio(context, this.master, this.noise);
    this.onContextStateChange = () => {
      if (context.state === 'running') this.unlocked = true;
      this.applyAvailability();
    };
    context.addEventListener?.('statechange', this.onContextStateChange);
    return true;
  }

  resumeContext() {
    if (!this.context || this.disposed) return Promise.resolve(false);
    if (this.context.state === 'running') return Promise.resolve(true);
    if (this.resumePending) return this.resumePending;
    const context = this.context;
    let result;
    try { result = context.resume(); } catch { return Promise.resolve(false); }
    const pending = Promise.resolve(result).then(() => {
      if (this.disposed || context.state !== 'running') return false;
      this.unlocked = true;
      this.applyAvailability();
      return true;
    }, () => false).finally(() => { if (this.resumePending === pending) this.resumePending = null; });
    this.resumePending = pending;
    return pending;
  }

  /** Idempotent input-gesture route. A later gesture may retry a blocked browser
   * context or media play, but may never undo the player's explicit mute. */
  async unlock(state) {
    if (state) this.lastState = state;
    if (this.disposed || this.userMuted) return false;
    try {
      if (!this.context && !this.create()) return false;
      this.enabled = true;
      const resumed = this.resumeContext();
      // Start/retry HTML media synchronously while this call still belongs to
      // the gesture, before the AudioContext resume promise consumes activation.
      this.applyAvailability({ gesture: true });
      await resumed;
      if (this.disposed || this.userMuted) return false;
      if (this.context.state === 'running') this.unlocked = true;
      this.applyAvailability();
      this.update(this.lastState);
      return this.enabled;
    } catch {
      this.enabled = false;
      this.applyAvailability();
      return false;
    }
  }

  async toggle() {
    if (this.disposed) return false;
    if (this.enabled) {
      this.userMuted = true;
      this.enabled = false;
      this.applyAvailability();
      return false;
    }
    this.userMuted = false;
    return this.unlock();
  }

  applyAvailability({ gesture = false } = {}) {
    if (!this.context || this.disposed) return;
    const available = this.enabled && !this.suspended && this.context.state === 'running';
    if (this.audible !== available) {
      this.audible = available;
      this.master.gain.setTargetAtTime(available ? .7 : 0, this.context.currentTime, .08);
      this.gameplay?.setEnabled(available);
      this.flyby?.setEnabled(available);
      if (!available) {
        this.engineAudio?.suspend();
        for (const gain of [this.hum, this.overtoneGain, this.wind]) gain.gain.setTargetAtTime(0, this.context.currentTime, .04);
      }
    }
    this.music?.setEnabled(Boolean(available || (gesture && this.enabled && !this.suspended)));
    if (gesture && this.enabled && !this.suspended) this.music?.unlock();
    if (this.music?.enabled) this.music.update(this.musicState(this.lastState));
  }

  setSuspended(suspended) {
    const changed = this.suspended !== Boolean(suspended);
    this.suspended = Boolean(suspended);
    if (!this.context || this.disposed) return;
    this.applyAvailability();
    if (changed && !this.suspended && this.enabled && this.unlocked) void this.resumeContext();
  }

  musicState({ altitude = 0, musicAltitude = altitude, verticalSpeed = 0, mode = 'flight', cabinFlight = false, airless = false } = {}) {
    return { altitude: musicAltitude, verticalSpeed, mode: cabinFlight && mode === 'walk' ? 'flight' : mode, airless };
  }

  update(state = {}, dt = 0) {
    this.lastState = state;
    if (!this.context || this.disposed) return;
    if (!this.enabled || this.suspended || this.context.state !== 'running') { this.applyAvailability(); return; }
    const { speed = 0, altitude = 0, mode = 'flight', cabinFlight = false, airless = false,
      inHangar = false, doorMotion = 0 } = state;
    this.engineAudio?.update(state);
    this.music?.update(this.musicState(state));
    const time = this.context.currentTime;
    const velocity = Number.isFinite(speed) ? Math.abs(speed) : 0;
    const height = Number.isFinite(altitude) ? Math.max(0, altitude) : 0;
    const motion = Math.min(1, Math.log1p(velocity) / Math.log(10001));
    const air = airless ? 0 : Math.exp(-height / 18000);
    const flying = mode === 'flight' || cabinFlight;
    const hangar = inHangar ? 1 : 0;
    const motor = Math.max(0, Math.min(1, Number.isFinite(doorMotion) ? doorMotion : 0));
    // These oscillators now serve station ventilation/doors only. Ship voices
    // above use actual thrust; unpowered or inertial drift cannot spool them up.
    const engineGain = hangar * 0.009 + motor * 0.018;
    const overtoneGain = hangar * 0.002 + motor * 0.012;
    const ambientNoise = hangar * 0.002 + motor * 0.008;
    // Smoothing is on the audio clock, independent of frame rate and tab stalls.
    const smooth = (parameter, target) => parameter.setTargetAtTime(target, time, 0.18);
    smooth(this.hum.gain, engineGain);
    smooth(this.overtoneGain.gain, overtoneGain);
    smooth(this.engine.frequency, 27 + motor * 5);
    smooth(this.overtone.frequency, 41 + motor * 7);
    smooth(this.wind.gain, ambientNoise + air * (flying ? 0.004 + motion * 0.035 : 0.012));
    smooth(this.windFilter.frequency, motor > 0 ? 150 + motor * 90 : flying ? 220 + motion * 1600 : 450);
  }

  get state() {
    return { created: Boolean(this.context), contextState: this.context?.state ?? null,
      enabled: this.enabled, userMuted: this.userMuted, unlocked: this.unlocked,
      suspended: this.suspended, audible: this.audible,
      music: this.music?.state ?? null, engine: this.engineAudio?.state ?? null,
      flyby: this.flyby?.state ?? null, effects: this.gameplay?.state ?? null };
  }

  dispose() {
    if (this.disposed) return;
    this.enabled = false;
    this.applyAvailability();
    this.flyby?.dispose();
    this.engineAudio?.dispose();
    this.music?.dispose();
    this.gameplay?.dispose();
    this.disposed = true;
    this.enabled = false;
    this.context?.removeEventListener?.('statechange', this.onContextStateChange);
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
