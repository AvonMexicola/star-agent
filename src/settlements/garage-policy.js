/** One existing solo vehicle; relocation never clones or resets its inventory. */
export function garageRetrievalStatus(state) {
  if (!state?.ready) return {ok: false, message: state?.error ? `Burrow unavailable: ${state.error}` : 'Preparing Burrow…'};
  if (state.occupied || state.busy) return {ok: false, message: 'Leave the rover and let its cabin close before retrieval.'};
  if (state.aboard) return {ok: false, message: 'Unload Burrow from its carrier before garage retrieval.'};
  if (Math.abs(state.speed ?? 0) > .1) return {ok: false, message: 'Park Burrow before requesting retrieval.'};
  return {ok: true, message: state.spawned ? 'Retrieve your parked Burrow. Its ore and cutter charge stay with it.' : 'Deploy Burrow in this garage. Board through the port-side door.'};
}
