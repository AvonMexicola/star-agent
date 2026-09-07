import { RADIUS, terrainHeight, surfaceColor } from './world.js';
import { MOON_RADIUS, moonSurface } from './moon-world.js';

const byte = value => Math.round(Math.max(0, Math.min(1, value)) * 255);
const srgb = value => value <= .0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - .055;

/** A filtered view of the canonical heightfield, never a second terrain source.
 * Longitude wraps, latitude does not. Normals describe physical metre slopes;
 * colour and relief therefore identify the same ridges from orbit and on foot. */
export function generateOrbitalSurface({ body = 'aeon', width = 512, height = width / 2 }) {
  if (!['aeon', 'selene'].includes(body) || !Number.isInteger(width) || !Number.isInteger(height)
      || width < 4 || width > 4096 || height < 2 || height > 2048) throw new Error('Invalid orbital surface request');
  const moon = body === 'selene', radius = moon ? MOON_RADIUS : RADIUS;
  const heights = new Float32Array(width * height), color = new Uint8Array(width * height * 4), normal = new Uint8Array(color.length);
  const longitudes = Array.from({length: width}, (_, x) => (x + .5) / width * Math.PI * 2 - Math.PI);
  for (let row = 0; row < height; row++) {
    const lat = ((row + .5) / height - .5) * Math.PI, y = Math.sin(lat), c = Math.cos(lat);
    for (let col = 0; col < width; col++) {
      const lon = longitudes[col], x = c * Math.sin(lon), z = c * Math.cos(lon), i = row * width + col;
      if (moon) {
        const sample = moonSurface(x, y, z); heights[i] = sample.height;
        for (let k = 0; k < 3; k++) color[i * 4 + k] = byte(srgb(sample.color[k]));
      } else heights[i] = terrainHeight(x, y, z);
      color[i * 4 + 3] = 255;
    }
  }
  for (let row = 0; row < height; row++) {
    const lat = ((row + .5) / height - .5) * Math.PI, sy = Math.sin(lat), cy = Math.cos(lat);
    const south = Math.max(0, row - 1), north = Math.min(height - 1, row + 1);
    const dx = Math.max(1, radius * cy * Math.PI * 2 / width * 2), dy = radius * Math.PI / height * (north - south);
    for (let col = 0; col < width; col++) {
      const i = row * width + col, k = i * 4, lon = longitudes[col], sl = Math.sin(lon), cl = Math.cos(lon);
      const eastSlope = (heights[row * width + (col + 1) % width] - heights[row * width + (col + width - 1) % width]) / dx;
      const northSlope = (heights[north * width + col] - heights[south * width + col]) / dy;
      const nx = cy * sl - cl * eastSlope + sy * sl * northSlope;
      const ny = sy - cy * northSlope;
      const nz = cy * cl + sl * eastSlope + sy * cl * northSlope;
      const length = Math.hypot(nx, ny, nz);
      normal[k] = byte(nx / length * .5 + .5); normal[k + 1] = byte(ny / length * .5 + .5); normal[k + 2] = byte(nz / length * .5 + .5);
      normal[k + 3] = byte(.5 + heights[i] / 256); // Signed coastal elevation, saturated beyond ±128m.
      if (!moon) {
        const rgb = surfaceColor(cy * sl, sy, cy * cl, heights[i], Math.atan(Math.hypot(eastSlope, northSlope)));
        for (let channel = 0; channel < 3; channel++) color[k + channel] = byte(srgb(rgb[channel]));
      }
    }
  }
  return {width, height, color, normal};
}
