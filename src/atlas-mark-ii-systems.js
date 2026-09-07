import * as THREE from 'three';
import layout from '../assets/atlas-mark-ii/layout.json' with { type: 'json' };
import interiorColliderData from '../assets/atlas-mark-ii/interior-colliders.json' with { type: 'json' };
import { crossesWall } from './boarding.js';

export const ATLAS_MARK_II_LAYOUT = Object.freeze(layout);
export const ATLAS_MARK_II_INTERIOR_COLLIDERS = Object.freeze(interiorColliderData);
export const RAMP_ANGULAR_SPEED = 0.7;
export const GATE_CLOSED_Z = -4;
export const GATE_OPEN_Z = -2.25;
export const GATE_SPEED = 2.5;
export const LIFT_RAILS = Object.freeze({
  minX: 4.2, maxX: 6.8, minZ: -5.6, maxZ: -2.4,
  portOpeningMinZ: -4.75, portOpeningMaxZ: -3.25,
});
const EPSILON = 1e-6;
const SUPPORT_TOLERANCE = 0.45;
const INTERACTION_RADIUS = 1.35;

/** Deployed=1. Doors open before the load leg leaves its enclosed pocket. */
export function atlasGearPose(progress, foldSign) {
  const p = THREE.MathUtils.clamp(progress, 0, 1);
  const doors = THREE.MathUtils.smoothstep(p, 0, .18);
  const deployed = THREE.MathUtils.smoothstep(p, .18, 1);
  const angle = -foldSign * (1 - deployed) * Math.PI / 2;
  return { angle, padAngle: -angle, doors };
}

const finiteDt = dt => Math.max(0, Math.min(Number.isFinite(dt) ? dt : 0, 0.1));
const near = (a, b, tolerance = EPSILON) => Math.abs(a - b) <= tolerance;
const advance = (value, target, maximum) => Math.abs(target - value) <= maximum
  ? target : value + Math.sign(target - value) * maximum;
const inside = (point, bounds, margin = 0) => point.x >= bounds.minX + margin
  && point.x <= bounds.maxX - margin && point.z >= bounds.minZ + margin
  && point.z <= bounds.maxZ - margin;
const wall = (minX, maxX, minZ, maxZ, radius) => [
  minX - radius, maxX + radius, minZ - radius, maxZ + radius,
];

function bridgeHalfWidthAt(footprint, z) {
  const progress = THREE.MathUtils.clamp(
    (z - footprint.frontZ) / (footprint.aftZ - footprint.frontZ),
    0,
    1,
  );
  return THREE.MathUtils.lerp(footprint.frontHalfWidth, footprint.aftHalfWidth, progress);
}

function insideBridgeFootprint(point, footprint, margin = 0) {
  if (!footprint || point.z < footprint.frontZ || point.z > footprint.aftZ) return false;
  return Math.abs(point.x) <= bridgeHalfWidthAt(footprint, point.z) - margin + EPSILON;
}

function crossesBridgeCheek(from, to, footprint, radius) {
  if (!footprint) return false;
  const dz = to.z - from.z;
  let start = 0, end = 1;
  if (Math.abs(dz) <= EPSILON) {
    if (from.z < footprint.frontZ || from.z > footprint.aftZ) return false;
  } else {
    const atFront = (footprint.frontZ - from.z) / dz;
    const atAft = (footprint.aftZ - from.z) / dz;
    start = Math.max(0, Math.min(atFront, atAft));
    end = Math.min(1, Math.max(atFront, atAft));
    if (start > end + EPSILON) return false;
  }
  const sample = t => ({
    x: THREE.MathUtils.lerp(from.x, to.x, t),
    z: THREE.MathUtils.lerp(from.z, to.z, t),
  });
  const a = sample(start), b = sample(end);
  const slope = (footprint.aftHalfWidth - footprint.frontHalfWidth)
    / (footprint.aftZ - footprint.frontZ);
  const perpendicularMargin = radius * Math.hypot(1, slope);
  for (const side of [-1, 1]) {
    const signed = point => side * point.x - bridgeHalfWidthAt(footprint, point.z) + perpendicularMargin;
    const atStart = signed(a), atEnd = signed(b);
    if ((atStart <= EPSILON && atEnd > EPSILON) || (atStart > EPSILON && atEnd <= EPSILON)) return true;
  }
  return false;
}

function elevatorBounds(definition) {
  const [x, z] = definition.centre;
  return {
    minX: x - definition.width / 2,
    maxX: x + definition.width / 2,
    minZ: z - definition.length / 2,
    maxZ: z + definition.length / 2,
  };
}

function rectangleWalls(bounds, radius) {
  return [
    wall(bounds.minX, bounds.minX, bounds.minZ, bounds.maxZ, radius),
    wall(bounds.maxX, bounds.maxX, bounds.minZ, bounds.maxZ, radius),
    wall(bounds.minX, bounds.maxX, bounds.minZ, bounds.minZ, radius),
    wall(bounds.minX, bounds.maxX, bounds.maxZ, bounds.maxZ, radius),
  ];
}

function liftRailWalls(radius) {
  const rail = LIFT_RAILS;
  return [
    wall(rail.maxX, rail.maxX, rail.minZ, rail.maxZ, radius),
    wall(rail.minX, rail.maxX, rail.minZ, rail.minZ, radius),
    wall(rail.minX, rail.maxX, rail.maxZ, rail.maxZ, radius),
    wall(rail.minX, rail.minX, rail.minZ, rail.portOpeningMinZ, radius),
    wall(rail.minX, rail.minX, rail.portOpeningMaxZ, rail.maxZ, radius),
  ];
}

function rampProgress(ramp) {
  const distance = ramp.openAngle - ramp.closedAngle;
  return distance === 0 ? 0 : THREE.MathUtils.clamp((ramp.angle - ramp.closedAngle) / distance, 0, 1);
}

/** Animation and ship-local walking support for the Atlas Mark II asset. */
export class AtlasMarkIISystems {
  constructor(source = ATLAS_MARK_II_LAYOUT, { colliders = ATLAS_MARK_II_INTERIOR_COLLIDERS.colliders } = {}) {
    this.layout = source;
    this.eyeHeight = source.eyeHeight;
    this.capsuleRadius = source.capsuleRadius;
    this.ramps = source.ramps.map(definition => ({
      ...definition,
      pivot: [...definition.pivot],
      control: [...definition.control],
      angle: definition.closedAngle,
      target: definition.closedAngle,
      moving: false,
      waitingForGates: false,
      nodeObject: null,
      tipNodeObject: null,
      sealNodeObject: null,
      tipAngle: Math.PI,
    }));
    this.elevator = {
      ...source.elevator,
      centre: [...source.elevator.centre],
      gateNodes: [...source.elevator.gateNodes],
      y: source.elevator.low,
      target: source.elevator.low,
      moving: false,
      nodeObject: null,
      gateObjects: [],
    };
    this.elevatorBounds = elevatorBounds(source.elevator);
    this.colliders = colliders.map(collider => ({
      ...collider,
      min: [...collider.min],
      max: [...collider.max],
    }));
    // The visible call panels live outside the clear lane. Keep their fixed
    // collision boxes and interaction anchor tied to the authoring layout.
    const [px, pz] = source.elevator.callPanel.centre;
    for (const floor of [source.elevator.low, source.elevator.high]) {
      this.colliders.push({ id: `lift-call-panel-${floor}`,
        min: [px - .225, floor, pz - .14],
        max: [px + .225, floor + 1.54, pz + .14] });
    }
    this.gear = { progress: 1, target: 1, moving: false,
      duration: source.landingGear.duration,
      legs: source.landingGear.legs.map(leg => ({ ...leg,
        nodeObject: null, footObject: null,
        doors: leg.doors.map(door => ({ ...door, nodeObject: null })),
      })),
    };
    this.gates = source.elevator.gateNodes.map((node, index) => ({
      node,
      deck: index === 0 ? source.elevator.low : source.elevator.high,
      z: GATE_CLOSED_Z,
      target: index === 0 ? GATE_OPEN_Z : GATE_CLOSED_Z,
      moving: index === 0,
      nodeObject: null,
    }));
    this.root = null;
  }

  /** Bind authoritative layout node names to an exported asset. */
  bind(root) {
    if (!root?.getObjectByName) throw new TypeError('Atlas Mark II asset root must support getObjectByName()');
    const missing = [];
    for (const ramp of this.ramps) {
      ramp.nodeObject = root.getObjectByName(ramp.node);
      if (!ramp.nodeObject) missing.push(ramp.node);
      ramp.tipNodeObject = ramp.tipNode ? root.getObjectByName(ramp.tipNode) : null;
      ramp.sealNodeObject = root.getObjectByName(ramp.headerSeal.node);
      if (!ramp.sealNodeObject) missing.push(ramp.headerSeal.node);
    }
    this.elevator.nodeObject = root.getObjectByName(this.elevator.node);
    if (!this.elevator.nodeObject) missing.push(this.elevator.node);
    for (const gate of this.gates) gate.nodeObject = root.getObjectByName(gate.node);
    this.elevator.gateObjects = this.gates.map(gate => gate.nodeObject).filter(Boolean);
    for (const leg of this.gear.legs) {
      leg.nodeObject = root.getObjectByName(leg.node);
      leg.footObject = root.getObjectByName(leg.footNode);
      if (!leg.nodeObject) missing.push(leg.node);
      if (!leg.footObject) missing.push(leg.footNode);
      for (const door of leg.doors) {
        door.nodeObject = root.getObjectByName(door.node);
        if (!door.nodeObject) missing.push(door.node);
      }
    }
    if (missing.length) {
      this.root = null;
      for (const ramp of this.ramps) ramp.nodeObject = null;
      for (const ramp of this.ramps) ramp.tipNodeObject = null;
      for (const ramp of this.ramps) ramp.sealNodeObject = null;
      this.elevator.nodeObject = null;
      for (const gate of this.gates) gate.nodeObject = null;
      for (const leg of this.gear.legs) {
        leg.nodeObject = null;leg.footObject = null;
        for (const door of leg.doors) door.nodeObject = null;
      }
      throw new Error(`Atlas Mark II asset is missing systems nodes: ${missing.join(', ')}`);
    }
    this.root = root;
    this.applyTransforms();
    return this;
  }

  applyTransforms() {
    for (const ramp of this.ramps) {
      if (ramp.nodeObject) ramp.nodeObject.rotation.x = ramp.angle;
      if (ramp.tipNodeObject) ramp.tipNodeObject.rotation.x = ramp.tipAngle;
      if (ramp.sealNodeObject) ramp.sealNodeObject.position.y = THREE.MathUtils.lerp(
        ramp.headerSeal.closedY, ramp.headerSeal.openY,
        THREE.MathUtils.smoothstep(rampProgress(ramp), 0, .2),
      );
    }
    if (this.elevator.nodeObject) this.elevator.nodeObject.position.y = this.elevator.y;
    for (const gate of this.gates) if (gate.nodeObject) gate.nodeObject.position.z = gate.z;
    for (const leg of this.gear.legs) {
      const pose = atlasGearPose(this.gear.progress, leg.foldSign);
      if (leg.nodeObject) leg.nodeObject.rotation.x = pose.angle;
      if (leg.footObject) leg.footObject.rotation.x = pose.padAngle;
      for (const door of leg.doors) {
        if (door.nodeObject) door.nodeObject.rotation.z = door.openAngle * pose.doors;
      }
    }
    this.root?.updateMatrixWorld?.(true);
  }

  get snapshot() {
    return {
      gear: { progress: this.gear.progress, target: this.gear.target, moving: this.gear.moving },
      ramps: this.ramps.map(ramp => ({
        id: ramp.id,
        node: ramp.node,
        pivot: [...ramp.pivot],
        angle: ramp.angle,
        target: ramp.target,
        progress: rampProgress(ramp),
        moving: ramp.moving,
        tipAngle: ramp.tipAngle,
      })),
      elevator: {
        id: this.elevator.id,
        node: this.elevator.node,
        centre: [...this.elevator.centre],
        y: this.elevator.y,
        target: this.elevator.target,
        moving: this.elevator.moving,
        waitingForGates: this.elevator.waitingForGates,
        gates: this.gates.map(gate => ({
          node: gate.node,
          deck: gate.deck,
          z: gate.z,
          target: gate.target,
          moving: gate.moving,
        })),
      },
    };
  }

  toggleRamp(id, { occupied = false } = {}) {
    const ramp = this.ramps.find(item => item.id === id);
    if (!ramp || ramp.moving || occupied) return false;
    ramp.target = near(ramp.angle, ramp.closedAngle) ? ramp.openAngle : ramp.closedAngle;
    ramp.moving = true;
    return true;
  }

  /** Inspection actuator. Flight integration must supply its landed interlock. */
  toggleGear({ occupied = false } = {}) {
    if (occupied || this.gear.moving) return false;
    this.gear.target = this.gear.progress === 1 ? 0 : 1;
    this.gear.moving = true;
    return true;
  }

  elevatorCallFloor(point) {
    if (!point) return null;
    const foot = point.y - this.eyeHeight;
    const [panelX, panelZ] = this.elevator.callPanel.centre;
    if (Math.hypot(point.x - panelX, point.z - panelZ) > INTERACTION_RADIUS) return null;
    if (near(foot, this.elevator.low, SUPPORT_TOLERANCE)) return this.elevator.low;
    if (near(foot, this.elevator.high, SUPPORT_TOLERANCE)) return this.elevator.high;
    return null;
  }

  toggleElevator(localWalker) {
    const lift = this.elevator;
    if (lift.moving) return false;
    if (localWalker) {
      const foot = localWalker.y - this.eyeHeight;
      const overlaps = inside(localWalker, this.elevatorBounds, -this.capsuleRadius);
      const fullyOn = inside(localWalker, this.elevatorBounds, this.capsuleRadius)
        && near(foot, lift.y, SUPPORT_TOLERANCE);
      const atLanding = near(foot, lift.low, SUPPORT_TOLERANCE)
        || near(foot, lift.high, SUPPORT_TOLERANCE);
      if (overlaps && !fullyOn && atLanding) return false;
      if (fullyOn) {
        lift.target = near(lift.y, lift.low) ? lift.high : lift.low;
      } else {
        const callFloor = this.elevatorCallFloor(localWalker);
        if (callFloor === null || near(lift.y, callFloor)) return false;
        lift.target = callFloor;
      }
    } else {
      lift.target = near(lift.y, lift.low) ? lift.high : lift.low;
    }
    lift.waitingForGates = this.gates.some(gate => gate.z !== GATE_CLOSED_Z);
    lift.moving = true;
    return true;
  }

  update(dt, localWalker) {
    const step = finiteDt(dt);
    this.gear.progress = advance(this.gear.progress, this.gear.target, step / this.gear.duration);
    this.gear.moving = this.gear.progress !== this.gear.target;
    for (const ramp of this.ramps) {
      ramp.angle = advance(ramp.angle, ramp.target, RAMP_ANGULAR_SPEED * step);
      ramp.moving = ramp.angle !== ramp.target;
      ramp.tipAngle = Math.PI * (1 - rampProgress(ramp));
    }

    const lift = this.elevator;
    const previous = lift.y;
    const wantsLiftMotion = lift.y !== lift.target;
    for (const gate of this.gates) {
      gate.target = !wantsLiftMotion && near(lift.y, gate.deck) ? GATE_OPEN_Z : GATE_CLOSED_Z;
      gate.z = advance(gate.z, gate.target, GATE_SPEED * step);
      gate.moving = gate.z !== gate.target;
    }
    const wasWaitingForGates = lift.waitingForGates;
    if (wasWaitingForGates && this.gates.every(gate => gate.z === GATE_CLOSED_Z)) {
      lift.waitingForGates = false;
    } else if (!wasWaitingForGates && wantsLiftMotion) {
      lift.y = advance(previous, lift.target, lift.speed * step);
    }
    lift.moving = lift.waitingForGates || lift.y !== lift.target;
    if (!lift.moving) {
      // Arrival makes opening the destination gate part of the same system
      // transition, even though its slider advances on the following frame.
      for (const gate of this.gates) {
        gate.target = near(lift.y, gate.deck) ? GATE_OPEN_Z : GATE_CLOSED_Z;
        gate.moving = gate.z !== gate.target;
      }
    }
    let carry = 0;
    if (localWalker && inside(localWalker, this.elevatorBounds, this.capsuleRadius)
      && near(localWalker.y - this.eyeHeight, previous, 0.12)) carry = lift.y - previous;
    this.applyTransforms();
    return carry;
  }

  openRampAt(point) {
    for (const ramp of this.ramps) {
      if (ramp.moving || !near(ramp.angle, ramp.openAngle)) continue;
      const outwardDistance = (point.z - ramp.pivot[2]) * ramp.outward;
      const horizontalLength = ramp.length * Math.cos(ramp.openAngle);
      if (outwardDistance >= -EPSILON && outwardDistance <= horizontalLength + EPSILON
        && Math.abs(point.x - ramp.pivot[0]) <= ramp.width / 2) return ramp;
    }
    return null;
  }

  floorAt(localPoint) {
    if (!localPoint) return null;
    const foot = localPoint.y - this.eyeHeight;
    if (inside(localPoint, this.elevatorBounds)) {
      return near(foot, this.elevator.y, SUPPORT_TOLERANCE) ? this.elevator.y : null;
    }
    const ramp = this.openRampAt(localPoint);
    if (ramp) {
      const distance = (localPoint.z - ramp.pivot[2]) * ramp.outward;
      const floor = ramp.pivot[1] - ramp.outward * distance * Math.tan(ramp.openAngle);
      return near(foot, floor, SUPPORT_TOLERANCE) ? floor : null;
    }
    const bridgeFootprint = this.layout.bridge?.pressureFootprint;
    const outsideBridge = bridgeFootprint && localPoint.z < bridgeFootprint.aftZ
      && !insideBridgeFootprint(localPoint, bridgeFootprint);
    if (inside(localPoint, this.layout.upper) && !outsideBridge
      && near(foot, this.layout.upper.floor, SUPPORT_TOLERANCE)) {
      return this.layout.upper.floor;
    }
    if (inside(localPoint, this.layout.cargo) && near(foot, this.layout.cargo.floor, SUPPORT_TOLERANCE)) {
      return this.layout.cargo.floor;
    }
    return null;
  }

  rampBoundaryWalls(ramp) {
    if (ramp.moving || !near(ramp.angle, ramp.openAngle)) return [];
    const halfWidth = ramp.width / 2;
    const endZ = ramp.pivot[2] + ramp.outward * ramp.length * Math.cos(ramp.openAngle);
    const minZ = Math.min(ramp.pivot[2], endZ);
    const maxZ = Math.max(ramp.pivot[2], endZ);
    return [
      wall(ramp.pivot[0] - halfWidth, ramp.pivot[0] - halfWidth, minZ, maxZ, this.capsuleRadius),
      wall(ramp.pivot[0] + halfWidth, ramp.pivot[0] + halfWidth, minZ, maxZ, this.capsuleRadius),
    ];
  }

  deckBoundaryWalls(deck, includeRampOpenings = false) {
    const radius = this.capsuleRadius;
    const walls = [
      wall(deck.minX, deck.minX, deck.minZ, deck.maxZ, radius),
      wall(deck.maxX, deck.maxX, deck.minZ, deck.maxZ, radius),
    ];
    for (const [z, id] of [[deck.minZ, 'front'], [deck.maxZ, 'aft']]) {
      const ramp = includeRampOpenings && this.ramps.find(item => item.id === id);
      const open = ramp && !ramp.moving && near(ramp.angle, ramp.openAngle);
      if (!open) walls.push(wall(deck.minX, deck.maxX, z, z, radius));
      else {
        const halfWidth = ramp.width / 2;
        walls.push(wall(deck.minX, -halfWidth, z, z, radius));
        walls.push(wall(halfWidth, deck.maxX, z, z, radius));
      }
    }
    return walls;
  }

  constrain(from, to) {
    if (!from?.clone || !to?.clone) throw new TypeError('constrain() requires Vector3-compatible eye positions');
    const foot = from.y - this.eyeHeight;
    const walls = [];
    const sweptBottom = Math.min(from.y, to.y) - this.eyeHeight;
    const sweptTop = Math.max(from.y, to.y);
    for (const collider of this.colliders) {
      if (sweptTop <= collider.min[1] + EPSILON || sweptBottom >= collider.max[1] - EPSILON) continue;
      walls.push(...rectangleWalls({
        minX: collider.min[0], maxX: collider.max[0],
        minZ: collider.min[2], maxZ: collider.max[2],
      }, this.capsuleRadius));
    }
    if (near(foot, this.layout.cargo.floor, SUPPORT_TOLERANCE)) {
      walls.push(...this.deckBoundaryWalls(this.layout.cargo, true));
    } else if (near(foot, this.layout.upper.floor, SUPPORT_TOLERANCE)) {
      if (crossesBridgeCheek(from, to, this.layout.bridge?.pressureFootprint, this.capsuleRadius)) {
        return from.clone();
      }
      walls.push(...this.deckBoundaryWalls(this.layout.upper));
    }
    for (const ramp of this.ramps) walls.push(...this.rampBoundaryWalls(ramp));
    // Exterior walkers also meet the hull and door planes before they have a
    // deck height. Do not key these barriers only from the starting floor.
    walls.push(
      wall(this.layout.cargo.minX, this.layout.cargo.minX, this.layout.cargo.minZ, this.layout.cargo.maxZ, this.capsuleRadius),
      wall(this.layout.cargo.maxX, this.layout.cargo.maxX, this.layout.cargo.minZ, this.layout.cargo.maxZ, this.capsuleRadius),
    );
    for (const ramp of this.ramps) {
      const open = !ramp.moving && near(ramp.angle, ramp.openAngle);
      if (!open) {
        walls.push(wall(
          this.layout.cargo.minX,
          this.layout.cargo.maxX,
          ramp.pivot[2],
          ramp.pivot[2],
          this.capsuleRadius,
        ));
      } else {
        const halfWidth = ramp.width / 2;
        walls.push(
          wall(this.layout.cargo.minX, -halfWidth, ramp.pivot[2], ramp.pivot[2], this.capsuleRadius),
          wall(halfWidth, this.layout.cargo.maxX, ramp.pivot[2], ramp.pivot[2], this.capsuleRadius),
        );
      }
    }

    const lift = this.elevator;
    const riderOnLift = inside(from, this.elevatorBounds, this.capsuleRadius)
      && near(foot, lift.y, SUPPORT_TOLERANCE);
    const atDeck = near(foot, lift.low, SUPPORT_TOLERANCE) || near(foot, lift.high, SUPPORT_TOLERANCE);
    const gate = this.gates.find(item => near(item.deck, foot, SUPPORT_TOLERANCE));
    const gateOpen = gate && !gate.moving && near(gate.z, GATE_OPEN_Z);
    const platformAtDeck = near(lift.y, foot, SUPPORT_TOLERANCE) && !lift.moving && gateOpen;
    if ((lift.moving && riderOnLift) || (atDeck && !platformAtDeck)) {
      walls.push(...rectangleWalls(lift.moving && riderOnLift ? this.elevatorBounds : LIFT_RAILS, this.capsuleRadius));
    } else if (atDeck && platformAtDeck) {
      walls.push(...liftRailWalls(this.capsuleRadius));
    }
    return walls.some(item => crossesWall(from, to, item)) ? from.clone() : to.clone();
  }

  interactionAt(localPoint) {
    if (!localPoint) return null;
    const stand = this.layout.stand;
    if (Math.abs(localPoint.y - stand[1]) < 0.5
      && Math.hypot(localPoint.x - stand[0], localPoint.z - stand[2]) < 1.8) return 'seat';
    const foot = localPoint.y - this.eyeHeight;
    for (const ramp of this.ramps) {
      const [x, y, z] = ramp.control;
      if (near(foot, y, SUPPORT_TOLERANCE) && Math.hypot(localPoint.x - x, localPoint.z - z) < INTERACTION_RADIUS) {
        return `ramp:${ramp.id}`;
      }
    }
    const onLift = inside(localPoint, this.elevatorBounds, this.capsuleRadius)
      && near(foot, this.elevator.y, SUPPORT_TOLERANCE) && !this.elevator.moving;
    if (onLift || this.elevatorCallFloor(localPoint) !== null) return `elevator:${this.elevator.id}`;
    return null;
  }
}
