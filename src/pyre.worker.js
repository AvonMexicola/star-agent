import { generatePyrePatch } from './pyre-terrain.js';
import { setPyreEpoch, bakePyreMaps } from './pyre-world.js';

// The page's orbital epoch arrives with every request so the worker's body
// frame matches the main thread's (workers cannot read the page URL).
self.onmessage = ({ data }) => {
  try {
    setPyreEpoch(data.epoch);
    if (data.type === 'maps') {
      const maps = bakePyreMaps(1024, 512);
      self.postMessage({ id: data.id, type: 'maps', ...maps }, [maps.data.buffer,maps.color.buffer,maps.normal.buffer]);
      return;
    }
    const patch = generatePyrePatch(data);
    self.postMessage({ id: data.id, type: 'patch', ...patch }, [patch.positions.buffer, patch.normals.buffer, patch.directions.buffer, patch.points.buffer, patch.colors.buffer, patch.data.buffer, patch.indices.buffer,...(patch.field?[patch.field.color.buffer,patch.field.normal.buffer]:[])]);
  } catch (error) { self.postMessage({ id: data.id, type: data.type, error: String(error) }); }
};
