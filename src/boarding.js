/** Ship-local dimensions in metres. Navigation supplies eye positions. */
export const SHIP_LAYOUT = Object.freeze({
  // Closed ship envelope includes the six-metre wings and nose.
  flightBounds: Object.freeze({ min: Object.freeze([-6.05, 0, -6.82]), max: Object.freeze([6.05, 4.26, 4.25]) }),
  floorY: 1,
  eyeHeight: 1.75,
  capsuleRadius: 0.25,
  interior: Object.freeze({ minX: -1.65, maxX: 1.65, minZ: -4.5, maxZ: 3.8 }),
  hatch: Object.freeze({ x: 0, z: 4, width: 1.8 }),
  ramp: Object.freeze({ minX: -0.9, maxX: 0.9, minZ: 4, maxZ: 7.2, startY: 1, endY: 0 }),
  seat: Object.freeze([0, 1, -2.8]),
  seatEye: Object.freeze([0, 2.55, -2.8]),
  stand: Object.freeze([0, 2.75, -1.2]),
});

export function shipFloorAt(localX, localZ, doorOpen) {
  if (Math.abs(localX) <= 1.65 && localZ >= -4.5 && localZ <= 4) return 1;
  if (doorOpen && Math.abs(localX) <= 0.9 && localZ >= 4 && localZ <= 7.2) {
    return (7.2 - localZ) / 3.2;
  }
  return null;
}

const EPSILON = 1e-9;
const radius = SHIP_LAYOUT.capsuleRadius;
const expanded = (minX, maxX, minZ, maxZ) => [minX - radius, maxX + radius, minZ - radius, maxZ + radius];
// Walls are thin planes expanded by the walking capsule's horizontal radius.
// Rear jambs leave a 1.3 m corridor for the capsule centre when the door opens.
const walls = [
  expanded(-1.65, -1.65, -4.5, 4),
  expanded(1.65, 1.65, -4.5, 4),
  expanded(-1.65, 1.65, -4.5, -4.5),
  expanded(-1.65, -0.9, 4, 4),
  expanded(0.9, 1.65, 4, 4),
];
const closedDoor = expanded(-0.9, 0.9, 4, 4);

function crossesWall(previous, proposed, wall) {
  const [minX, maxX, minZ, maxZ] = wall;
  const dx = proposed.x - previous.x, dz = proposed.z - previous.z;
  const inside = previous.x > minX + EPSILON && previous.x < maxX - EPSILON
    && previous.z > minZ + EPSILON && previous.z < maxZ - EPSILON;
  if (inside) {
    // A door may close beside an outside walker. Let an existing overlap escape
    // through its nearest boundary, without permitting movement through the wall.
    const exits = [[previous.x - minX, -dx], [maxX - previous.x, dx],
      [previous.z - minZ, -dz], [maxZ - previous.z, dz]];
    const nearest = Math.min(...exits.map(([distance]) => distance));
    if (exits.some(([distance, movement]) => distance <= nearest + EPSILON && movement > EPSILON)) return false;
    return Math.abs(dx) > EPSILON || Math.abs(dz) > EPSILON;
  }
  let entry = 0, exit = 1;
  for (const [start, movement, minimum, maximum] of [
    [previous.x, dx, minX, maxX], [previous.z, dz, minZ, maxZ],
  ]) {
    if (Math.abs(movement) < EPSILON) {
      if (start <= minimum + EPSILON || start >= maximum - EPSILON) return false;
      continue;
    }
    const a = (minimum - start) / movement, b = (maximum - start) / movement;
    entry = Math.max(entry, Math.min(a, b));
    exit = Math.min(exit, Math.max(a, b));
    if (entry >= exit - EPSILON) return false;
  }
  return exit > EPSILON && entry < 1 - EPSILON;
}

/** Swept horizontal collision; preserves eye height and never mutates inputs. */
export function constrainShipStep(previousLocal, proposedLocal, doorOpen) {
  for (const wall of walls) {
    if (crossesWall(previousLocal, proposedLocal, wall)) return previousLocal.clone();
  }
  if (!doorOpen && crossesWall(previousLocal, proposedLocal, closedDoor)) return previousLocal.clone();
  return proposedLocal.clone();
}

export function interactionAt(localPosition, doorOpen) {
  const { x, z } = localPosition;
  const inside = Math.abs(x) < 1.65 && z > -4.5 && z < 4;
  if (inside && Math.hypot(x, z + 2.8) <= 1.6) return 'seat';
  if (Math.abs(x) < 2 && Math.abs(z - 4) < 2.2) return 'door';
  return null;
}
