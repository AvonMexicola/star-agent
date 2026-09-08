/** Original twin-head outdoor mast. Game metres/Y-up, mounting surface at y=0. */
export const FLOODLIGHT = Object.freeze({
  id: 'floodlight', label: 'Outdoor floodlight · 600 W', category: 'utility',
  light: 'flood', lightName: 'floodlight', powerKW: .6,
  cost: {'metal-stock': 8, conductor: 3, glass: 2},
  footprint: [2.8, 1.4], height: 6,
  interactionOffset: [0, 1.2, .40],
  emitter: [0, 5.55, -.45], target: [0, 0, -18],
  colliders: [
    {min: [-.58, 0, -.58], max: [.58, .18, .58]},
    {min: [-.20, .18, -.20], max: [.20, 5.58, .20]},
    {min: [-.28, .78, .12], max: [.28, 1.58, .46]},
    {min: [-1.34, 5.18, -.61], max: [1.34, 5.85, .54]},
  ],
});
