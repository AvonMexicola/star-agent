import { setPlanetSeed } from './generation.js';
import { buildForestTile } from './forest-distribution.js';

self.onmessage = ({data}) => {
  try {
    setPlanetSeed(data.seed);
    const tile = buildForestTile(data.tile);
    self.postMessage({id:data.id,...tile},[tile.records.buffer]);
  } catch(error) { self.postMessage({id:data.id,error:error.message}); }
};
