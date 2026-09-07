export const SHIP_CARGO_RANGE = 50;

const finitePoint = point => point && ['x', 'y', 'z'].every(axis => Number.isFinite(point[axis]));

/** Query the current physical ship position in double-precision world metres.
 * Dialogs pause navigation, so access deliberately does not depend on enabled. */
export function shipCargoAccess(nav) {
  const result = {available: false, aboard: false, distance: null, range: SHIP_CARGO_RANGE};
  if (!nav || nav.mode === 'crashed') return result;
  if (nav.insideShip || nav.mode === 'landed' || nav.mode === 'flight') {
    return {...result, available: true, aboard: true, distance: 0};
  }
  if (!['walk', 'eva'].includes(nav.mode) || !finitePoint(nav.position) || !finitePoint(nav.shipPosition)) return result;
  const distance = Math.hypot(...['x', 'y', 'z'].map(axis => nav.position[axis] - nav.shipPosition[axis]));
  return {...result, distance, available: distance <= SHIP_CARGO_RANGE};
}

export function shipCargoLabel(access) {
  if (access.aboard) return `Nomad cargo connected · ${access.range} m access outside`;
  const distance = access.distance === null ? '' : ` · ${Math.ceil(access.distance)} m away`;
  return access.available
    ? `Nomad cargo connected${distance} · ${access.range} m range`
    : `Nomad cargo out of reach${distance} · approach within ${access.range} m`;
}
