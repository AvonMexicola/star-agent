import { Group } from 'three';

/** Shared client/server station configuration for the full-size playable fleet. */
export const PLAYABLE_STATION_OPTIONS = Object.freeze({ exteriorRefresh: true, largeHangars: true });
export const FLEET_HANGAR = Object.freeze({
  scale: Object.freeze([1, 1.6, 2.6]),
  anchor: Object.freeze([0, -8, 26]),
  deckMin: Object.freeze([-21, -8, -98.8]),
  deckMax: Object.freeze([21, -8, 26]),
  pad: Object.freeze([0, -8, -36.4]),
});

/** Enlarge only the authored bay shell and deck. Keep the floor and service
 * wall fixed, then attach ordinary human-scale furniture/terminals outside this
 * frame. Animation tracks remain on their original named door nodes. Geometry
 * is immutable and shared; both collision and LOD see the same local transform.
 */
export function fleetHangarAsset(gltf) {
  const source = gltf?.scene ?? gltf?.scenes?.[0];
  if (!source) throw new Error('Fleet hangar requires an authored scene');
  const root = new Group(); root.name = 'Fleet hangar';
  const frame = new Group(); frame.name = 'Fleet hangar shell frame';
  frame.scale.fromArray(FLEET_HANGAR.scale);
  frame.position.fromArray(FLEET_HANGAR.anchor);
  frame.position.sub(frame.position.clone().multiply(frame.scale));
  frame.add(source.clone(true)); root.add(frame);
  return { ...gltf, scene: root, scenes: [root] };
}
