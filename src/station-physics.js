import * as THREE from 'three';

export const STATION_GRAVITY = 9.81;

/** Station physics uses authored local volumes, independently of berth ownership
 * or the renderer's selected pod. World transforms remain JavaScript doubles. */
export function stationPhysicsAt(station, position) {
  if (!station?.ready) return null;
  const frames = station.pods ?? [station];
  for (const frame of frames) {
    const local = frame.toLocal(position, new THREE.Vector3());
    if (!frame.interiorBox.containsPoint(local)) continue;
    return { id: `hangar:${frame.id ?? 1}`, frame, local, up: frame.up, gravity: STATION_GRAVITY };
  }
  if (station.location === 'hub' && station.hub?.deckPoint(position, 0)) {
    const frame = station.hub;
    return { id: 'station:hub', frame, local: frame.toLocal(position, new THREE.Vector3()), up: station.up, gravity: STATION_GRAVITY };
  }
  return null;
}

/** Support extends to the authored deck edge; collision keeps walls/closed doors
 * solid. Beyond that edge there is no floor and the suit must return to EVA. */
export function stationDeckPoint(grid, position, eyeHeight) {
  if (grid.id === 'station:hub') return grid.frame.deckPoint(position, eyeHeight);
  const local = grid.frame.toLocal(position, new THREE.Vector3()), box = grid.frame.interiorBox;
  if (local.x < box.min.x || local.x > box.max.x || local.z < box.min.z || local.z > box.max.z) return null;
  local.y = box.min.y + eyeHeight;
  return grid.frame.toWorld(local, local);
}
