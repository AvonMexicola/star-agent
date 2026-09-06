import { generateOrbitalSurface } from './orbital-surface-data.js';
import { setPlanetSeed } from './generation.js';

self.onmessage = ({data}) => {
  try {
    setPlanetSeed(data.seed);
    for (const width of data.body === 'selene' ? [512, 2048] : [512, 2048, 4096]) {
      const maps = generateOrbitalSurface({body: data.body, width});
      self.postMessage(maps, [maps.color.buffer, maps.normal.buffer]);
    }
    self.postMessage({done: true});
  } catch (error) { self.postMessage({error: String(error)}); }
};
