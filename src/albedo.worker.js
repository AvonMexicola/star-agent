import { terrainHeight, surfaceColor, latLonDirection } from './world.js';
import { setPlanetSeed } from './generation.js';

// Rows run south to north, matching v = asin(direction.y) / PI + 0.5.
// Bytes encode linear RGB; consumers should leave the texture in linear space.
self.onmessage = ({ data: request }) => {
  try {
    setPlanetSeed(request.seed);
    const width = request?.width ?? 1024;
    const height = request?.height ?? 512;
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 8192 || height > 4096) {
      throw new Error('Albedo dimensions must be positive integers, at most 8192 × 4096.');
    }
    const data = new Uint8Array(width * height * 4);
    for (let row = 0; row < height; row++) {
      const latitude = ((row + .5) / height - .5) * 180;
      for (let column = 0; column < width; column++) {
        const longitude = ((column + .5) / width - .5) * 360;
        const [x, y, z] = latLonDirection(latitude, longitude);
        const elevation = terrainHeight(x, y, z);
        const color = surfaceColor(x, y, z, elevation, 0);
        const offset = (row * width + column) * 4;
        for (let channel = 0; channel < 3; channel++) {
          data[offset + channel] = Math.round(Math.max(0, Math.min(1, color[channel])) * 255);
        }
        data[offset + 3] = 255;
      }
    }
    self.postMessage({ width, height, data }, [data.buffer]);
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : String(error) });
  }
};
