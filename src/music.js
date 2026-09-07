/** Optional, locally hosted score. Nothing is loaded before Sound is enabled. */
export const SCORE = Object.freeze({
  travel: ['between-worlds-1.mp3', 'between-worlds-2.mp3'],
  orbit: ['blue-horizon-1.mp3', 'blue-horizon-2.mp3'],
  descent: ['atmospheric-descent-1.mp3', 'atmospheric-descent-2.mp3'],
});

// Sea-level altitude and radial velocity come from navigation, not frame-to-frame
// position differences: quick transit must never masquerade as a rapid descent.
export function musicScene({ altitude = 0, verticalSpeed = 0, mode = 'flight', airless = false } = {}, previous = null) {
  if (mode === 'crashed' || mode === 'destroyed') return null;
  if (mode !== 'flight') return 'orbit';
  const height = Number.isFinite(altitude) ? Math.max(0, altitude) : 0;
  if (!airless && height < (previous === 'descent' ? 80000 : 70000)
      && verticalSpeed < (previous === 'descent' ? 5 : -5)) return 'descent';
  const orbitLimit = airless ? 600000 : 4000000;
  const margin = airless ? 50000 : 200000;
  return height > orbitLimit + (previous === 'travel' ? -margin : margin) ? 'travel' : 'orbit';
}

export class FlightMusic {
  constructor(context, destination, { mediaFactory = () => new Audio(), baseURL = `${import.meta.env?.BASE_URL || '/'}audio/music/` } = {}) {
    this.context = context;
    this.baseURL = baseURL;
    this.enabled = false;
    this.disposed = false;
    this.scene = null;
    this.candidate = undefined;
    this.candidateSince = 0;
    this.active = null;
    this.transition = null;
    this.pending = null;
    this.next = { travel: 0, orbit: 0, descent: 0 };
    this.failed = new Set();
    this.pausedAt = 0;
    this.volume = context.createGain();
    this.volume.gain.value = 0.5;
    this.volume.connect(destination);
    this.decks = Array.from({ length: 2 }, () => {
      const media = mediaFactory();
      media.preload = 'none';
      const source = context.createMediaElementSource(media);
      const gain = context.createGain();
      gain.gain.value = 0;
      source.connect(gain);
      gain.connect(this.volume);
      return { media, source, gain, file: null, scene: null };
    });
  }

  setEnabled(enabled) {
    if (this.disposed || this.enabled === enabled) return;
    this.enabled = enabled;
    if (!enabled) {
      this.pausedAt = this.context.currentTime;
      this.cancelPending();
      for (const deck of this.decks) deck.media.pause();
      return;
    }
    if (this.transition) this.transition.start += this.context.currentTime - this.pausedAt;
    // Resume existing tracks, retaining their position and the paused fade.
    for (const deck of this.decks.filter(deck => deck.file)) {
      Promise.resolve(deck.media.play()).then(() => {
        if (!this.enabled || this.disposed) deck.media.pause();
      }).catch(() => {
        this.failed.add(deck.file);
        this.clear(deck);
        if (this.active === deck) this.active = null;
      });
    }
  }

  clear(deck) {
    deck.media.pause();
    deck.media.removeAttribute('src');
    deck.media.load();
    deck.gain.gain.cancelScheduledValues(this.context.currentTime);
    deck.gain.gain.value = 0;
    deck.file = null;
    deck.scene = null;
  }

  cancelPending() {
    if (!this.pending) return;
    const pending = this.pending;
    this.pending = null;
    clearTimeout(pending.timer);
    this.clear(pending.deck);
  }

  start(scene) {
    const files = SCORE[scene];
    let index = this.next[scene] % files.length;
    if (this.failed.has(files[index])) index = (index + 1) % files.length;
    const file = files[index];
    if (this.failed.has(file)) return; // Missing music never blocks procedural audio or flight.
    const deck = this.decks.find(item => item !== this.active);
    this.clear(deck);
    deck.file = file;
    deck.scene = scene;
    deck.media.src = this.baseURL + file;
    const pending = { deck, timer: null };
    this.pending = pending;
    const fail = () => {
      if (this.pending !== pending) return;
      this.failed.add(file);
      this.cancelPending();
    };
    pending.timer = setTimeout(fail, 15000);
    Promise.resolve(deck.media.play()).then(() => {
      if (this.pending !== pending) return;
      clearTimeout(pending.timer);
      this.pending = null;
      if (!this.enabled || this.disposed) { this.clear(deck); return; }
      this.next[scene] = (index + 1) % files.length;
      this.transition = { from: this.active, to: deck, start: this.context.currentTime };
      this.active = deck;
    }).catch(fail);
  }

  update(state) {
    if (!this.enabled || this.disposed) return;
    const time = this.context.currentTime;
    this.volume.gain.setTargetAtTime(state.mode === 'flight' ? 0.5 : 0.3, time, 1);
    const candidate = musicScene(state, this.scene);
    if (candidate !== this.candidate) { this.candidate = candidate; this.candidateSince = time; }
    // Two seconds of stability plus altitude hysteresis avoids boundary chatter.
    // A crash silences the score promptly, leaving the separate impact effect.
    if (candidate === null || this.scene === null || time - this.candidateSince >= 2) this.scene = candidate;
    if (this.pending && this.pending.deck.scene !== this.scene) this.cancelPending();
    if (this.scene === null) {
      for (const deck of this.decks) if (deck.file) this.clear(deck);
      this.active = null;
      this.transition = null;
      return;
    }
    if (this.transition) {
      const fade = this.transition;
      const amount = Math.min(1, Math.max(0, (time - fade.start) / 6));
      fade.to.gain.gain.setTargetAtTime(Math.sin(amount * Math.PI / 2), time, 0.05);
      fade.from?.gain.gain.setTargetAtTime(Math.cos(amount * Math.PI / 2), time, 0.05);
      if (amount < 1) return;
      if (fade.from) this.clear(fade.from);
      this.transition = null;
    }
    if (this.pending) return;
    const media = this.active?.media;
    const ending = media && Number.isFinite(media.duration) && media.duration - media.currentTime <= 7;
    if (!this.active || this.active.scene !== this.scene || media.error || media.ended || ending) {
      if (media?.error) this.failed.add(this.active.file);
      this.start(this.scene);
    }
  }

  get state() {
    return { enabled: this.enabled, scene: this.scene, file: this.active?.file ?? null,
      pending: this.pending?.deck.file ?? null, crossfading: Boolean(this.transition),
      failed: [...this.failed], time: this.active?.media.currentTime ?? 0 };
  }

  dispose() {
    if (this.disposed) return;
    this.setEnabled(false);
    this.disposed = true;
    for (const deck of this.decks) { this.clear(deck); deck.source.disconnect(); deck.gain.disconnect(); }
    this.volume.disconnect();
  }
}
