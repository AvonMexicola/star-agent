/** Stop immediately at an input boundary. Both simulation and presentation may
 * observe the same blocked frame; only the first observation sends a neutral.
 * The ordinary multiplayer input clock continues sending its bounded heartbeat. */
export function createSentryInputSuspension(stop) {
  let suspended = false;
  return {
    suspend() {
      if (suspended) return;
      suspended = true;
      stop();
    },
    resume() { suspended = false; },
  };
}
