import * as THREE from 'three';
import { AtlasMarkIISystems, ATLAS_MARK_II_LAYOUT, GATE_OPEN_Z, GATE_CLOSED_Z } from './atlas-mark-ii-systems.js';
import { constrainShipAttachments } from './ship-attachment-collision.js';

const source = ATLAS_MARK_II_LAYOUT;
const close = (a, b, tolerance = .001) => Math.abs(a - b) < tolerance;
const inside = (p, b, margin = 0) => p.x >= b.minX + margin && p.x <= b.maxX - margin
  && p.z >= b.minZ + margin && p.z <= b.maxZ - margin;
const box = (min, max) => ({ min, max });

export const ATLAS_MODEL_URL = 'models/atlas-mark-ii/atlas-mark-ii.glb';
export const ATLAS_RAMP_CALLS = Object.freeze(source.ramps.map(ramp => Object.freeze({
  id: ramp.id, anchor: [6.65, 1.25, ramp.pivot[2] + ramp.outward * .32],
  approach: [6.65, source.eyeHeight, ramp.pivot[2] + ramp.outward * 1.3],
})));
export const ATLAS_STORAGE = Object.freeze({ anchor: [-4.31, 3.7, -15], approach: [-3.25, 4.35, -15] });
const elevator = source.elevator, [liftX, liftZ] = elevator.centre;
export const ATLAS_LIFTS = Object.freeze([Object.freeze({ ...elevator, name: 'Crew lift',
  minX: liftX - elevator.width / 2, maxX: liftX + elevator.width / 2,
  minZ: liftZ - elevator.length / 2, maxZ: liftZ + elevator.length / 2,
  control: [...elevator.centre],
})]);

// Separate pressure body, drive pods and six deployed feet retain the open
// underbody; a solid 64 m box would catch the pad during a landing sweep.
export const ATLAS_LAYOUT = Object.freeze({
  ...source, id: 'atlas', flightBounds: source.hull,
  flightParts: [
    box([-7.8, 1.45, -31.9], [7.8, 14.95, 27.6]),
    ...[-1, 1].map(side => box([side < 0 ? -17.9 : 7.8, 3.65, -31.9], [side < 0 ? -7.8 : 17.9, 14.95, 30.92])),
    // Low chassis/pocket parts stop inboard of the raised outer nacelles.
    // Extending those nacelles to the floor falsely catches bay service rails.
    ...[-1, 1].map(side => box([side < 0 ? -13 : 7.8, 1.45, -31.9], [side < 0 ? -7.8 : 13, 3.65, 30.92])),
    ...source.landingGear.legs.map(leg => box([leg.pivot[0] - 1.4, 0, leg.pivot[2] - 5.5],
      [leg.pivot[0] + 1.4, 4.9, leg.pivot[2] + 5.5])),
  ],
  floorY: source.cargo.floor, interior: { ...source.cargo, floorY: source.cargo.floor },
  seat: [source.pilotEye[0], source.upper.floor, source.pilotEye[2]], seatEye: source.pilotEye,
  landingClearance: source.pilotEye[1] + .35, gearSeconds: source.landingGear.duration,
});

/** Playable Atlas retains its saved fleet ID. Authored systems own the visible
 * ramps and crew lift; there is no legacy or invisible belly elevator.
 */
export class AtlasGameplaySystems extends AtlasMarkIISystems {
  constructor() {
    super();Object.assign(this.elevator, ATLAS_LIFTS[0]);this.lifts = [this.elevator];this.reset();
  }
  get secured() {
    return this.ramps.every(ramp => !ramp.moving && close(ramp.angle, ramp.closedAngle)
      && close(ramp.target, ramp.closedAngle)) && !this.elevator.moving;
  }
  reset({ gearProgress = 1 } = {}) {
    for (const ramp of this.ramps) { ramp.angle = ramp.target = ramp.closedAngle;ramp.tipAngle = Math.PI;ramp.moving = false; }
    this.elevator.y = this.elevator.target = this.elevator.low;
    this.elevator.moving = this.elevator.waitingForGates = false;
    for (const gate of this.gates) {
      gate.z = gate.target = close(gate.deck, this.elevator.low) ? GATE_OPEN_Z : GATE_CLOSED_Z;gate.moving = false;
    }
    this.setGear(gearProgress, gearProgress >= .5);this.applyTransforms();
  }
  setGear(progress, deployed) {
    progress = THREE.MathUtils.clamp(Number.isFinite(progress) ? progress : 1, 0, 1);
    if (this.gear.progress === progress && this.gear.target === Number(Boolean(deployed))) return;
    this.gear.progress = progress;
    this.gear.target = deployed ? 1 : 0;this.gear.moving = !close(this.gear.progress, this.gear.target, 1e-9);
    this.applyTransforms();
  }
  update(dt, rider) {
    if (!this.elevator.moving && !this.gates.some(gate => gate.moving) && !this.ramps.some(ramp => ramp.moving)) return 0;
    // Navigation owns the one 4.5 s flight-gear clock, including power loss and
    // emergency contact. Do not also advance the studio inspection clock.
    const gearTarget = this.gear.target;this.gear.target = this.gear.progress;
    const carry = super.update(dt, rider);
    this.gear.target = gearTarget;this.gear.moving = !close(this.gear.progress, gearTarget, 1e-9);
    return carry;
  }
  contains(point) {
    return Boolean(point && this.floorAt(point) !== null && (inside(point, this.layout.cargo) || inside(point, this.layout.upper)));
  }
  interactionAt(point) {
    if (!point) return null;
    const authored = super.interactionAt(point);if (authored) return authored;
    if (close(point.y - this.eyeHeight, 0, .45)) {
      for (const call of ATLAS_RAMP_CALLS) if (Math.hypot(point.x - call.approach[0], point.z - call.approach[2]) < 1.45) return `ramp:${call.id}`;
    }
    if (close(point.y, ATLAS_STORAGE.approach[1], .45)
      && Math.hypot(point.x - ATLAS_STORAGE.approach[0], point.z - ATLAS_STORAGE.approach[2]) < 1.3) return 'storage';
    return null;
  }
  interaction(point) { return this.interactionAt(point); }
  rampOccupied(id, point) {
    if (!point) return false;
    const ramp = this.ramps.find(item => item.id === id);if (!ramp) return false;
    const distance = (point.z - ramp.pivot[2]) * ramp.outward;
    return Math.abs(point.x - ramp.pivot[0]) < ramp.width / 2 + this.capsuleRadius
      && distance > -.45 && distance < ramp.length + .45 && point.y - this.eyeHeight < ramp.pivot[1] + .6;
  }
  toggleElevator(rider) {
    if (this.canMove && !this.canMove(this.elevator, rider)) return false;
    return super.toggleElevator(rider);
  }
  toggle(id, rider) { return (id === 'crew' || id === 'elevator:crew') && this.toggleElevator(rider); }
  operate(id, rider, { powered = true, inFlight = false } = {}) {
    if (!powered) return { ok: false, reason: 'Main power is required for the ramps and crew lift.' };
    if (id?.startsWith('ramp:')) {
      if (inFlight) return { ok: false, reason: 'Loading ramps secured in flight. Land or dock to open them.' };
      const rampId = id.slice(5), ramp = this.ramps.find(item => item.id === rampId);
      const occupied = this.rampOccupied(rampId, rider) || this.rampObstructed?.(rampId) === true;
      const ok = this.toggleRamp(rampId, { occupied });
      return { ok, reason: ok ? `${ramp.id === 'front' ? 'Forward' : 'Aft'} ramp ${close(ramp.target, ramp.openAngle) ? 'opening' : 'closing'}. Walk through when fully open.`
        : occupied ? 'Step clear of the loading ramp before moving it.' : 'Loading ramp is moving.' };
    }
    const ok = id === 'elevator:crew' && this.toggleElevator(rider);
    return { ok, reason: ok ? 'Crew lift moving. Stay inside the guard rails.'
      : 'Crew lift busy or already at this landing. Step fully onto the platform to change decks.' };
  }
  controlPrompt(id, { powered = true, inFlight = false, controller = false } = {}) {
    const key = controller ? 'X' : 'F';
    if (id?.startsWith('ramp:')) {
      const ramp = this.ramps.find(item => id === `ramp:${item.id}`);if (!ramp) return '';
      const name = `${ramp.id === 'front' ? 'FORWARD' : 'AFT'} LOADING RAMP`;
      return !powered ? `${name} · MAIN POWER OFF` : inFlight ? `${name} · SECURED IN FLIGHT`
        : `${key} · ${name} · ${ramp.moving ? 'MOVING' : close(ramp.angle, ramp.closedAngle) ? 'OPEN' : 'CLOSE'}`;
    }
    if (id === 'elevator:crew') return !powered ? 'CREW LIFT · MAIN POWER OFF'
      : `${key} · CREW LIFT · ${this.elevator.moving ? 'MOVING' : 'CALL / CHANGE DECK'}`;
    return '';
  }
  canAttachRamp(point, speed) { return speed <= 4 && Boolean(this.openRampAt(point)) && this.floorAt(point) !== null; }
  surfaceAt(point) {
    const y = this.floorAt(point);if (y === null) return null;
    const ramp = this.openRampAt(point), normal = new THREE.Vector3(0, 1, ramp ? Math.tan(ramp.openAngle) : 0).normalize();
    return { y, normal, source: ramp ? `atlas-ramp:${ramp.id}` : inside(point, this.elevatorBounds) ? 'atlas-lift:crew' : 'atlas-deck' };
  }
  get evaParts() {
    const cargo = this.layout.cargo, upper = this.layout.upper, lift = this.elevatorBounds, parts = [...this.colliders];
    for (const deck of [cargo, upper]) {
      // True shaft through both decks, supported only by the moving platform.
      const y = deck.floor;
      parts.push(box([deck.minX, y - .22, deck.minZ], [lift.minX, y, deck.maxZ]),
        box([lift.maxX, y - .22, deck.minZ], [deck.maxX, y, deck.maxZ]),
        box([lift.minX, y - .22, deck.minZ], [lift.maxX, y, lift.minZ]),
        box([lift.minX, y - .22, lift.maxZ], [lift.maxX, y, deck.maxZ]),
        box([deck.minX - .2, y, deck.minZ], [deck.minX, deck.ceiling, deck.maxZ]),
        box([deck.maxX, y, deck.minZ], [deck.maxX + .2, deck.ceiling, deck.maxZ]));
    }
    parts.push(box([upper.minX, upper.ceiling, upper.minZ], [upper.maxX, upper.ceiling + .25, upper.maxZ]),
      box([cargo.minX, cargo.ceiling, cargo.minZ], [cargo.maxX, cargo.ceiling + .2, cargo.maxZ]),
      box([upper.minX, upper.floor, upper.minZ - .2], [upper.maxX, upper.ceiling, upper.minZ]),
      box([upper.minX, upper.floor, upper.maxZ], [upper.maxX, upper.ceiling, upper.maxZ + .2]),
      box([lift.minX, this.elevator.y - .22, lift.minZ], [lift.maxX, this.elevator.y, lift.maxZ]));
    for (const ramp of this.ramps) {
      const z = ramp.pivot[2], half = ramp.width / 2;
      parts.push(box([cargo.minX, 0, z - .14], [-half, cargo.ceiling, z + .14]),
        box([half, 0, z - .14], [cargo.maxX, cargo.ceiling, z + .14]));
      if (ramp.moving || !close(ramp.angle, ramp.openAngle)) parts.push(box([-half, cargo.floor, z - .14], [half, cargo.ceiling, z + .14]));
    }
    // Nacelles and feet remain physical without making the cabin solid.
    parts.push(...ATLAS_LAYOUT.flightParts.slice(1));return parts;
  }
  constrainEVA(previous, proposed) {
    const point = constrainShipAttachments(previous, proposed, this.evaParts, { eva: true });
    return { point, hit: !point.equals(proposed) };
  }
  applySnapshot(state) {
    // Arrays belong to the retired hull, never to an invisible main platform.
    if (!state || Array.isArray(state)) return false;
    for (const ramp of this.ramps) {
      const value = state.ramps?.find(item => item.id === ramp.id);
      if (!value || !Number.isFinite(value.angle) || !Number.isFinite(value.target)) continue;
      ramp.angle = THREE.MathUtils.clamp(value.angle, Math.min(ramp.closedAngle, ramp.openAngle), Math.max(ramp.closedAngle, ramp.openAngle));
      ramp.target = close(value.target, ramp.openAngle) ? ramp.openAngle : ramp.closedAngle;ramp.moving = !close(ramp.angle, ramp.target, 1e-9);
      ramp.tipAngle = Math.PI * (1 - (ramp.angle - ramp.closedAngle) / (ramp.openAngle - ramp.closedAngle));
    }
    const value = state.elevator, liftState = this.elevator;
    if (Number.isFinite(value?.y) && Number.isFinite(value?.target)) {
      liftState.y = THREE.MathUtils.clamp(value.y, liftState.low, liftState.high);
      liftState.target = close(value.target, liftState.high) ? liftState.high : liftState.low;
      liftState.waitingForGates = Boolean(value.waitingForGates);liftState.moving = liftState.waitingForGates || !close(liftState.y, liftState.target, 1e-9);
      for (const gate of this.gates) {
        const saved = value.gates?.find(item => item.node === gate.node);if (!Number.isFinite(saved?.z)) continue;
        gate.z = THREE.MathUtils.clamp(saved.z, GATE_CLOSED_Z, GATE_OPEN_Z);
        gate.target = !liftState.moving && close(liftState.y, gate.deck) ? GATE_OPEN_Z : GATE_CLOSED_Z;gate.moving = !close(gate.z, gate.target, 1e-9);
      }
    }
    if (Number.isFinite(state.gear?.progress)) this.setGear(state.gear.progress, state.gear.target > .5);
    this.applyTransforms();return true;
  }
}
