/** One existing solo vehicle; relocation never clones or resets its inventory. */
export function garageRetrievalStatus(state) {
  if (!state?.ready) return {ok: false, message: state?.error ? `Burrow unavailable: ${state.error}` : 'Preparing Burrow…'};
  if (state.occupied || state.busy) return {ok: false, message: 'Leave the rover and let its cabin close before retrieval.'};
  if (state.aboard) return {ok: false, message: 'Unload Burrow from its carrier before garage retrieval.'};
  if (Math.abs(state.speed ?? 0) > .1) return {ok: false, message: 'Park Burrow before requesting retrieval.'};
  return {ok: true, message: state.spawned ? 'Retrieve your parked Burrow. Its ore and cutter charge stay with it.' : 'Deploy Burrow in this garage. Board through the port-side door.'};
}

/** Sentry retrieval preserves its condition; it is not a free repair action. */
export function sentryRetrievalStatus(state) {
  if (!state) return {ok: true, message: 'Deploy Burrow Sentry in this garage. Two crew seats with twin lasers.'};
  if (state.busy || Object.values(state.seats ?? {}).some(seat => seat.id)) return {ok: false, message: 'Leave both Sentry seats and let the doors close before retrieval.'};
  if (state.carrier) return {ok: false, message: 'Unload Sentry from its carrier before garage retrieval.'};
  if (Math.abs(state.speed ?? 0) > .1) return {ok: false, message: 'Park Sentry before requesting retrieval.'};
  if (state.destroyed || state.health <= 0) return {ok: false, message: 'This Sentry is destroyed and cannot be retrieved.'};
  return {ok: true, message: 'Retrieve your parked Sentry. Its hull condition and laser charge stay with it.'};
}

/** The shared bay includes room to walk around either rover. Body-frame double
 * positions are compared before any rendering origin or float conversion. */
export function garageBayAvailable(position, other) {
  return !other?.position || other.spawned === false || Math.hypot(...other.position.map((n, i) => n - position[i])) >= 7;
}
