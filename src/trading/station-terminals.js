import { Vector3 } from 'three';

export const AEON_MARKET_ID = 'aeon-orbital';
export const STATION_TERMINAL_REACH = 2.8;
const terminal = definition => Object.freeze({ ...definition, marketId: AEON_MARKET_ID,
  point: Object.freeze(definition.point), ...(definition.approach ? { approach: Object.freeze(definition.approach) } : {}) });

// Existing authored directory screens; the armory and component retailers keep
// their own interactions. Hub points are screen centres in the physical frame.
export const HUB_COMMODITY_TERMINALS = Object.freeze([
  terminal({ id: 'station:hub:exchange-north', key: 'exchange-north', label: 'North commodity exchange',
    frame: 'hub', node: 'DirectoryNorth', point: [-5.5, -6.59, -11.792], approach: [-5.5, -6.25, -10.2] }),
  terminal({ id: 'station:hub:exchange-south', key: 'exchange-south', label: 'South commodity exchange',
    frame: 'hub', node: 'DirectorySouth', point: [5.5, -6.59, -11.792], approach: [5.5, -6.25, -10.2] }),
]);
export const AEON_STATION_TERMINALS = Object.freeze([
  ...Array.from({ length: 20 }, (_, index) => terminal({ id: `station:${index + 1}`,
    key: `berth-${index + 1}`, label: `Berth ${String(index + 1).padStart(2, '0')} freight exchange`,
    frame: 'hangar', hangarId: index + 1, point: [-12, 1.75, 20.7] })),
  ...HUB_COMMODITY_TERMINALS,
]);
const terminals = new Map(AEON_STATION_TERMINALS.map(entry => [entry.id, entry]));
export const stationTerminal = id => terminals.get(id) ?? null;
export const stationTerminalMarket = id => stationTerminal(id)?.marketId ?? null;

/** Convert a registered screen point to double-precision world metres. Berth Y
 * is relative to its floor; hub Y is the authored concourse coordinate. */
export function stationTerminalPoint(station, id, out = new Vector3()) {
  const entry = stationTerminal(id);
  if (!entry) return null;
  const frame = entry.frame === 'hub' ? station.hub : station.pods.find(pod => pod.id === entry.hangarId);
  if (!frame) return null;
  out.fromArray(entry.point);
  if (entry.frame === 'hangar') out.y += frame.interiorBox.min.y;
  return frame.toWorld(out, out);
}

/** Character walking speed is unrelated to delivery. The ship must still be
 * parked in its owned lease, including while its pilot visits a hub exchange. */
export function stationedForTrade({ nav, hangarId, station }, terminalId) {
  const entry = stationTerminal(terminalId), pod = station.pods.find(candidate => candidate.id === hangarId);
  return Boolean(entry && pod && (entry.frame === 'hub' || entry.hangarId === hangarId)
    && nav.dockedAtStation && nav.shipPosition && !nav.cabinFlight && !nav.travel
    && nav.shipVelocity?.length() < 1 && pod.isInsideHangar(nav.shipPosition));
}
