import {Vector3} from 'three';
import {STRATUM_FLIGHT_PARTS} from './stratum-flight-parts.js';
import {STRATUM_LAYOUT as S, stratumRampFloor} from './stratum-layout.js';
import {GANNET_LAYOUT as G, GANNET_LIFT as P, GANNET_VESTIBULE as V, gannetCollisionParts} from './gannet-layout.js';
import {GannetSystems} from './gannet-systems.js';
import {constrainShipAttachments} from './ship-attachment-collision.js';

const UP = new Vector3(0, 1, 0), eyeHeight = 1.75, radius = .25;
const close = (a, b, e = .001) => Math.abs(a - b) <= e;
const inside = (p, b, margin = 0) => p && p.x >= b.minX + margin && p.x <= b.maxX - margin
  && p.z >= b.minZ + margin && p.z <= b.maxZ - margin;
const box = (min, max) => ({min, max});
function outsideRoom(part, space) {
  const min = part.min.map((n,i) => Math.max(n,space.min[i]));
  const max = part.max.map((n,i) => Math.min(n,space.max[i]));
  if (min.some((n,i) => n >= max[i])) return [part];
  const rest = {...part,min:[...part.min],max:[...part.max]}, pieces = [];
  for (let axis=0;axis<3;axis++) {
    if (rest.min[axis]<min[axis]) {
      const edge=[...rest.max];edge[axis]=min[axis];
      pieces.push({...part,min:[...rest.min],max:edge});rest.min[axis]=min[axis];
    }
    if (rest.max[axis]>max[axis]) {
      const edge=[...rest.min];edge[axis]=max[axis];
      pieces.push({...part,min:edge,max:[...rest.max]});rest.max[axis]=max[axis];
    }
  }
  return pieces;
}
const near = (p, q, r = 1.4) => p && p.distanceTo(new Vector3(...q)) <= r;
const room = (b, floor, ceiling) => [
  box([b.minX - .15, floor, b.minZ], [b.minX, ceiling, b.maxZ]),
  box([b.maxX, floor, b.minZ], [b.maxX + .15, ceiling, b.maxZ]),
  box([b.minX, ceiling, b.minZ], [b.maxX, ceiling + .15, b.maxZ]),
];
function sweep(owner, previous, proposed, eva = false) {
  // Deck thickness blocks an approach from underneath. A supported walker uses
  // the authored floor query, avoiding numerical contact with its own floor.
  const floors = eva ? owner.floorParts : owner.floorParts.filter(part => previous.y - eyeHeight < part.max[1] - .3);
  return constrainShipAttachments(previous, proposed, [...owner.colliders, ...floors, ...(eva ? owner.exteriorParts : [])], {eva, eyeHeight});
}

export const STRATUM_GAMEPLAY_LAYOUT = Object.freeze({...S,
  eyeHeight, capsuleRadius: radius, floorY: S.interior.floorY, flightParts: STRATUM_FLIGHT_PARTS,
  seat: [S.interior.pilotEye[0], S.interior.floorY, S.interior.pilotEye[2]],
  seatEye: S.interior.pilotEye, stand: S.interior.standingEye,
  gearSeconds: S.gear.duration, landingClearance: S.interior.pilotEye[1] + .35,
});
export const GANNET_GAMEPLAY_LAYOUT = Object.freeze({...G,
  gearSeconds: G.gear.seconds, landingClearance: G.seatEye[1] + .35,
});

/** Authored ramp is the only walking connection between the cabin and ground. */
export class StratumGameplaySystems {
  constructor() {
    this.layout = STRATUM_GAMEPLAY_LAYOUT; this.eyeHeight = eyeHeight;
    this.reset();
    this.accessLabel = 'REAR BOARDING RAMP';
    this.entry = [0, eyeHeight, S.ramp.endZ];
    this.boardingHint = 'Walk aft to the ramp control. Open it fully before walking outside.';
    this.secureHint = 'Close the boarding ramp before changing gear or launching.';
  }
  reset({gearProgress = 1} = {}) { this.progress = this.target = 0; this.gearProgress = gearProgress; }
  setGear(progress) { this.gearProgress = progress; }
  get secured() { return this.progress === 0 && this.target === 0; }
  get moving() { return this.progress !== this.target; }
  get accessStatus() { return this.moving ? 'WAIT FOR RAMP' : this.progress === 1 && this.target === 1 ? 'APPROACH SLOWLY' : 'CLOSED'; }
  get snapshot() { return {id: 'stratum', ramp: this.progress, target: this.target, secured: this.secured}; }
  get exteriorParts() {
    const p = STRATUM_FLIGHT_PARTS.find(part => part.id === 'pressure-body'), b = S.interior;
    return [...STRATUM_FLIGHT_PARTS.filter(part => !['pressure-body','access-stowed'].includes(part.id)),
      box(p.min, [p.max[0], p.max[1], b.minZ]),
      box([p.min[0], p.min[1], b.minZ], [b.minX, p.max[1], p.max[2]]),
      box([b.maxX, p.min[1], b.minZ], p.max),
      box([b.minX, b.ceilingY, b.minZ], [b.maxX, p.max[1], p.max[2]]),
      box([b.minX, p.min[1], b.minZ], [b.maxX, b.floorY, b.maxZ])];
  }
  get floorParts() {
    const b = S.interior, y = b.floorY;
    return [box([b.minX, y - .18, b.minZ], [b.maxX, y, b.maxZ])];
  }
  get colliders() {
    const b = S.interior, y = b.floorY, r = S.ramp;
    const parts = [...S.collisionParts, ...room(b, y, b.ceilingY),
      box([b.minX, y, b.minZ - .15], [b.maxX, b.ceilingY, b.minZ]),
      box([b.minX, y, b.maxZ], [-r.halfWidth, b.ceilingY, b.maxZ + .15]),
      box([r.halfWidth, y, b.maxZ], [b.maxX, b.ceilingY, b.maxZ + .15]),
      box([-r.halfWidth, y + r.portalHeight, b.maxZ], [r.halfWidth, b.ceilingY, b.maxZ + .15]),
    ];
    if (this.progress !== 1 || this.target !== 1) parts.push(box([-r.halfWidth, 0, b.maxZ - .12], [r.halfWidth, y + r.portalHeight, b.maxZ + .15]));
    return parts;
  }
  surfaceAt(p) {
    if (!p) return null;
    const foot = p.y - eyeHeight, b = S.interior;
    if (inside(p, b) && close(foot, b.floorY, .55)) return {y: b.floorY, normal: UP.clone(), source: 'stratum-deck'};
    const y = stratumRampFloor(p.z);
    if (this.progress === 1 && this.target === 1 && Math.abs(p.x) <= S.ramp.halfWidth && y !== null && close(foot, y, .55))
      return {y, normal: new Vector3(0, 1, b.floorY / S.ramp.run).normalize(), source: 'stratum-ramp:aft'};
    return null;
  }
  floorAt(p) { return this.surfaceAt(p)?.y ?? null; }
  contains(p) { return inside(p, S.interior) && this.floorAt(p) !== null; }
  constrain(a, b) { return sweep(this, a, b); }
  constrainEVA(a, b) { const point = sweep(this, a, b, true); return {point, hit: !point.equals(b)}; }
  canAttachRamp(p, speed) { return speed <= 4 && this.surfaceAt(p)?.source === 'stratum-ramp:aft'; }
  interaction(p) {
    if (!p) return null;
    if (near(p, S.interior.standingEye, 1.25)) return 'seat';
    if (close(p.y, S.interior.standingEye[1], .5) && Math.abs(p.z - 3.7) < 1)
      return p.x < 0 ? 'storage:stratum-ore' : 'storage';
    if (near(p, [0, S.interior.standingEye[1], 5.75], 1.05) || near(p, [1.35, eyeHeight, 7.7], 1.3)) return 'ramp:aft';
    return null;
  }
  controlPrompt(id, {powered = true, inFlight = false, controller = false} = {}) {
    if (id !== 'ramp:aft') return '';
    return !powered ? 'BOARDING RAMP · MAIN POWER OFF' : inFlight ? 'BOARDING RAMP · SECURED IN FLIGHT'
      : `${controller ? 'X' : 'F'} · BOARDING RAMP · ${this.moving ? 'MOVING' : this.secured ? 'OPEN' : 'CLOSE'}`;
  }
  operate(id, rider, {powered = true, inFlight = false} = {}) {
    if (id !== 'ramp:aft') return {ok: false, reason: 'Unknown boarding control.'};
    if (!powered || inFlight || this.gearProgress < .999) return {ok: false, reason: 'Park with gear down and main power on to use the boarding ramp.'};
    if (this.moving) return {ok: false, reason: 'Boarding ramp is moving.'};
    if (rider && Math.abs(rider.x) < S.ramp.halfWidth + radius && rider.z > 6.65 && rider.z < 12.55)
      return {ok: false, reason: 'Step clear of the boarding ramp before moving it.'};
    this.target = 1 - this.target;
    return {ok: true, reason: this.target ? 'Boarding ramp opening. Wait until fully extended.' : 'Boarding ramp closing.'};
  }
  update(dt) {
    if (!Number.isFinite(dt) || dt <= 0) return 0;
    this.progress += Math.sign(this.target - this.progress) * Math.min(Math.abs(this.target - this.progress), Math.min(dt, .25) / S.ramp.duration);
    if (close(this.progress, this.target, 1e-9)) this.progress = this.target;
    return 0;
  }
}

/** Navigation adapter for the authored hatch and full-width vehicle elevator. */
export class GannetGameplaySystems extends GannetSystems {
  constructor() {
    super(); this.layout = GANNET_GAMEPLAY_LAYOUT; this.eyeHeight = eyeHeight;
    this.queued = null; this.rider = null; this.gearProgress = 1;
    this.accessLabel = 'REAR VEHICLE ELEVATOR'; this.entry = [0, eyeHeight, 11.3];
    this.boardingHint = 'Walk aft to the vehicle elevator control. X / F opens and lowers it; press again to raise and secure.';
    this.secureHint = 'Raise the vehicle elevator and close its hatch before changing gear or launching.';
    this.carrier = {id: 'gannet', liftId: P.id, park: G.rover.park, heading: G.rover.heading,
      control: 'elevator:vehicle', controlLabel: 'Gannet vehicle elevator', ceiling: P.ceiling};
    this.canMove = (mechanism, rider) => this.riderClear(mechanism, rider ?? this.rider);
  }
  reset({gearProgress = 1} = {}) {
    this.lift.y = this.lift.target = P.high; this.hatch.progress = this.hatch.target = 0;
    this.queued = null; this.rider = null; this.gearProgress = gearProgress;
  }
  setGear(progress) { this.gearProgress = progress; }
  setPowered(powered) { this.powered = Boolean(powered); }
  get accessStatus() {
    if (this.moving || this.queued) return 'WAIT FOR ELEVATOR';
    if (this.hatch.progress === 1 && this.hatch.target === 1 && this.lift.y <= .001 && this.lift.target === P.low) return 'APPROACH SLOWLY';
    return this.secured ? 'CLOSED' : 'LOWER ELEVATOR';
  }
  get exteriorParts() {
    let parts = gannetCollisionParts(this.mechanismPose(this.gearProgress)).filter(part => part.node === 'OuterHull' || part.node.startsWith('Gear_'));
    // A tapered fairing's enclosing box crosses the actual empty aft aisle.
    // Remove only the authored clear room volumes already checked against the
    // exported triangles; canonical walls, decks and moving gates remain solid.
    for (const [bounds,floor,ceiling] of [[G.interior,G.floorY,G.interior.ceiling],[V,G.floorY,P.ceiling],[P,0,P.ceiling]]) {
      const space=box([bounds.minX,floor,bounds.minZ],[bounds.maxX,ceiling,bounds.maxZ]);
      parts=parts.flatMap(part=>outsideRoom(part,space));
    }
    return parts;
  }
  get snapshot() { return {id: 'gannet', lift: {...this.lift}, hatch: {...this.hatch}, secured: this.secured, queued: this.queued}; }
  get floorParts() {
    return [box([G.interior.minX, G.floorY - .18, G.interior.minZ], [G.interior.maxX, G.floorY, G.interior.maxZ]),
      box([V.minX, G.floorY - .18, V.minZ], [V.maxX, G.floorY, V.maxZ]),
      box([P.minX, this.lift.y - P.thickness, P.minZ], [P.maxX, this.lift.y, P.maxZ])];
  }
  get colliders() {
    const b = G.interior, c = G.cabinPortal;
    const parts = [...G.obstacles, ...room(b, G.floorY, b.ceiling), ...room(V, 0, P.ceiling), ...room(P, 0, P.ceiling),
      box([b.minX, G.floorY, b.minZ - .15], [b.maxX, b.ceiling, b.minZ]),
      box([b.minX, G.floorY, c.z - .07], [c.minX, b.ceiling, c.z + .07]),
      box([c.maxX, G.floorY, c.z - .07], [b.maxX, b.ceiling, c.z + .07]),
    ];
    if (!close(this.lift.y, P.high) || !close(this.lift.target, P.high))
      parts.push(box([P.minX, this.lift.y, P.minZ - .08], [P.maxX, G.floorY, P.minZ + .08]));
    if (this.hatch.progress < 1 || this.hatch.target !== 1 || this.moving || this.lift.y > .001)
      parts.push(box([P.minX, 0, P.maxZ - .07], [P.maxX, P.ceiling, P.maxZ + .12]));
    return parts;
  }
  surfaceAt(p) {
    const surface = super.floorAt(p); return surface ? {...surface, normal: UP.clone()} : null;
  }
  floorAt(p) { return this.surfaceAt(p)?.y ?? null; }
  contains(p) { return Boolean(this.surfaceAt(p)); }
  constrain(a, b) { return sweep(this, a, b); }
  constrainEVA(a, b) { const point = sweep(this, a, b, true); return {point, hit: !point.equals(b)}; }
  canAttachRamp(p, speed) { return speed <= 4 && this.floorAt(p) !== null && inside(p, P) && this.hatch.progress === 1; }
  interaction(p) {
    if (!p) return null;
    if (near(p, G.stand, 1.25)) return 'seat';
    if (close(p.y, G.stand[1], .5) && Math.abs(p.z - .5) < 1.1) return 'storage';
    if (near(p, [P.control[0], this.lift.y + eyeHeight, P.control[2]], 1.4)
      || near(p, [2.1, G.stand[1], 4.0], 1.1) || G.controls.some(control => near(p, control.standingEye, 1.5))) return 'elevator:vehicle';
    return null;
  }
  riderClear(mechanism, p) {
    if (!p) return true;
    const foot = p.y - eyeHeight;
    if (mechanism.kind === 'hatch') return !(Math.abs(p.z - P.maxZ) < .45 && p.x > P.minX - radius && p.x < P.maxX + radius);
    const overlap = inside(p, {minX:P.minX-radius,maxX:P.maxX+radius,minZ:P.minZ-radius,maxZ:P.maxZ+radius});
    return !overlap || inside(p, P, radius) && close(foot, this.lift.y, .2);
  }
  controlPrompt(id, {powered = true, inFlight = false, controller = false} = {}) {
    if (id !== 'elevator:vehicle') return '';
    return !powered ? 'VEHICLE ELEVATOR · MAIN POWER OFF' : inFlight ? 'VEHICLE ELEVATOR · SECURED IN FLIGHT'
      : `${controller ? 'X' : 'F'} · VEHICLE ELEVATOR · ${this.moving || this.queued ? 'MOVING' : this.secured ? 'OPEN / LOWER' : this.lift.y < .001 ? 'RAISE / SECURE' : 'LOWER'}`;
  }
  operate(id, rider, {powered = true, inFlight = false} = {}) {
    if (id !== 'elevator:vehicle') return {ok: false, reason: 'Unknown vehicle control.'};
    this.rider = rider;
    if (!powered || inFlight || this.gearProgress < .999) return {ok: false, reason: 'Park with gear down and main power on to use the vehicle elevator.'};
    this.powered = powered;
    if (this.moving || this.queued) return {ok: false, reason: 'Vehicle access is moving. Stay clear or fully aboard.'};
    let action;
    if (this.secured) { action = 'open'; this.queued = 'lower'; }
    else if (this.lift.y < .001) { action = 'raise'; this.queued = 'close'; }
    else action = 'lower';
    const result = this.command(action, {occupant: rider});
    if (!result.ok) this.queued = null;
    return {...result, reason: result.ok ? 'Vehicle access moving. Parking brake engaged; remain fully aboard or clear.' : result.reason};
  }
  update(dt, rider) {
    this.rider = rider;
    const y = this.lift.y, carried = inside(rider, P, radius) && close(rider.y - eyeHeight, y, .2);
    super.update(dt);
    if (!this.moving && this.queued) {
      const result = this.command(this.queued, {occupant: rider});
      if (result.ok) this.queued = null;
    }
    return carried ? this.lift.y - y : 0;
  }
}
