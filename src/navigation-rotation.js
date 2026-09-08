import { Vector3 } from 'three';
import { betweenFrames, frameRotation, rotationFrameAt, toInertial,
  velocityBetweenFrames } from './planet-rotation.js';

/** Change a navigation chart only at the disjoint spherical boundary. Terrain,
 * stationary bases and ship-local cabin coordinates retain their existing data. */
export function reframeNavigation(nav, from, seconds) {
  const to = rotationFrameAt(toInertial(nav.position, from, seconds));
  if (from === to) return false;
  const rotation = frameRotation(from, to, seconds);
  const previous = nav.position.clone();
  velocityBetweenFrames(nav.velocity, previous, from, to, seconds, nav.velocity);
  betweenFrames(previous, from, to, seconds, nav.position);
  nav.orientation.premultiply(rotation).normalize();
  nav.engineAcceleration?.applyQuaternion(rotation);
  nav.cruiseVelocity?.applyQuaternion(rotation);
  // A moving cabin and its pilot change chart together. A distant parked ship
  // remains in its own chart; its recovery beacon transforms independently.
  if (nav.shipPosition && (nav.cabinFlight)) {
    const ship = nav.shipPosition.clone();
    velocityBetweenFrames(nav.shipVelocity, ship, from, to, seconds, nav.shipVelocity);
    betweenFrames(ship, from, to, seconds, nav.shipPosition);
    nav.shipOrientation.premultiply(rotation).normalize();
  }
  nav.rotationFrameChanges = (nav.rotationFrameChanges ?? 0) + 1;
  return true;
}

export function rotationEnvironment(environment, position, enabled) {
  const body = enabled ? rotationFrameAt(position) : null;
  if (!body) return environment;
  return {...environment, rotationOffset:position.clone().sub(new Vector3(...body.center))};
}
