/** Burrow uses walk + insideShip for its seated pilot. That ground-vehicle
 * contract must never classify the parked carrier as an occupied aircraft. */
export function occupiesShip(nav) {
  return !nav.roverOccupied && (nav.mode === 'flight' || nav.mode === 'landed' || nav.mode === 'walk' && nav.insideShip === true);
}
