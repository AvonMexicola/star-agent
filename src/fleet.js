export const FLEET_KEY = 'star-agent.fleet.v1';
export const SHIPS = Object.freeze({
  nomad: { name: 'Nomad', registry: '02 / UTILITY', capacity: 120, description: 'Starter surveyor · rear boarding ramp · 120 kg storage' },
  kestrel: { name: 'Kestrel', registry: '01 / INTERCEPTOR', capacity: 0, description: 'Single pilot · port boarding ladder · agile flight · 4 empty S2 mounts · no cargo hold' },
  atlas: { name: 'Atlas', registry: '03 / HEAVY LOGISTICS', capacity: 2400, description: '30 m freighter · 8 × 10 m belly elevator · twin cargo lifts · 2,400 kg storage' },
});

/** A first exploration milestone, deliberately independent of a future economy. */
export class Fleet {
  constructor(storage) {
    this.storage = storage; this.surfaceVisited = false; this.unlocked = false; this.active = 'nomad'; this.saved = Boolean(storage);
    try {
      const data = JSON.parse(storage?.getItem(FLEET_KEY) || 'null');
      if (data?.version === 1) {
        this.surfaceVisited = data.surfaceVisited === true;
        this.unlocked = this.surfaceVisited && data.unlocked === true;
        if (this.unlocked && data.active === 'atlas') this.active = 'atlas';
        if (data.active === 'kestrel') this.active = 'kestrel';
      }
    } catch { this.saved = false; }
  }
  record(event) {
    const before = this.unlocked;
    if (event === 'surface') this.surfaceVisited = true;
    if (event === 'dock' && this.surfaceVisited) this.unlocked = true;
    try {
      if (!this.storage) throw new Error('Storage unavailable');
      this.storage.setItem(FLEET_KEY, JSON.stringify({ version: 1, surfaceVisited: this.surfaceVisited, unlocked: this.unlocked, active: this.active }));
      this.saved = true;
    } catch { this.saved = false; }
    return !before && this.unlocked;
  }
  allows(id) { return id === 'nomad' || id === 'kestrel' || id === 'atlas' && this.unlocked; }
  get snapshot() { return { surfaceVisited: this.surfaceVisited, unlocked: this.unlocked, active: this.active, saved: this.saved }; }
}
