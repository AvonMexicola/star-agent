// Gameplay response, not a cargo-mass simulation. Nomad preserves the existing
// baseline. Speed differences are deliberately much smaller than agility gaps.
export const SHIP_HANDLING = Object.freeze({
  kestrel: Object.freeze({speed:1.05, turn:1.55, steeringLag:0, assistResponse:5.5, thrust:58, rcs:30, torque:2.65}),
  nomad: Object.freeze({speed:1, turn:1, steeringLag:0, assistResponse:3.5, thrust:35, rcs:18, torque:1.6}),
  atlas: Object.freeze({speed:.95, turn:.42, steeringLag:.22, assistResponse:.85, thrust:14, rcs:7, torque:.55}),
});
export const shipHandling = id => SHIP_HANDLING[id] ?? SHIP_HANDLING.nomad;

// Exact first-order rate response and its integrated angle. This keeps the
// freighter's steering run-up/settling independent of simulation frame rate.
export function steeringStep(rate, target, dt, lag) {
  if(dt<=0)return {rate,angle:0};
  if(lag<=0)return {rate:target,angle:target*dt};
  const decay=Math.exp(-dt/lag);
  return {rate:target+(rate-target)*decay,angle:target*dt+(rate-target)*lag*(1-decay)};
}
