/** Browser fixture only: inertial EVA feedback emits ordinary standard pad
 * intent. Positions/velocities are observations; no navigation state is edited. */
export function evaWaypointInput(delta, velocity, reach = .32) {
  const distance = Math.hypot(...delta), speed = Math.hypot(...velocity);
  if (distance < reach && speed < .03) return {axes: [0,0,0,0], up: false, down: false, brake: false, done: true};
  const brake = distance < reach || speed > .15 && distance < speed / 6 + .2;
  if (brake) return {axes: [0,0,0,0], up: false, down: false, brake: true, done: false};
  const desiredSpeed = Math.min(3, distance * .6);
  const error = delta.map((value, i) => value * desiredSpeed / Math.max(distance, 1e-6) - velocity[i]);
  const planar = [error[0] * .55, error[2] * .55];
  const magnitude = Math.hypot(...planar);
  // Invert the shared standard-pad radial deadzone for the requested thrust.
  const scale = magnitude > .0001 ? (.16 + .84 * Math.min(.7, magnitude)) / magnitude : 0;
  return {axes: [planar[0] * scale, planar[1] * scale, 0, 0], up: error[1] > .05, down: error[1] < -.05, brake: false, done: false};
}
