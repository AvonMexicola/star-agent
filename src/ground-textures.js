import * as THREE from 'three';

// Packed linear albedo + relief. Four deterministic, seamless material layers
// share physical scale (one tile = four metres), with mipmaps for low flight.
export function createGroundTextures() {
  const size = 512, data = new Uint8Array(size * size * 4 * 4);
  const hash = (x, y, salt = 0) => {
    let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(salt + 71, 1274126177);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  const noise = (u, v, cells, salt = 0) => {
    const x = u * cells, y = v * cells, ix = Math.floor(x), iy = Math.floor(y);
    const a = THREE.MathUtils.smoothstep(x - ix, 0, 1), b = THREE.MathUtils.smoothstep(y - iy, 0, 1);
    const sample = (dx, dy) => hash(((ix + dx) % cells + cells) % cells, ((iy + dy) % cells + cells) % cells, salt);
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(sample(0, 0), sample(1, 0), a), THREE.MathUtils.lerp(sample(0, 1), sample(1, 1), a), b);
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    const fine = noise(u, v, 128), medium = noise(u, v, 32), broad = noise(u, v, 8);
    // Cellular gravel and fractured rock: distance to the nearest two seeds.
    let first = 9, second = 9;
    const cells = 18, gx = u * cells, gy = v * cells, ix = Math.floor(gx), iy = Math.floor(gy);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const cx = ix + dx, cy = iy + dy, hx = (cx + cells) % cells, hy = (cy + cells) % cells;
      const d = Math.hypot(cx + hash(hx, hy, 1) - gx, cy + hash(hx, hy, 2) - gy);
      if (d < first) { second = first; first = d; } else if (d < second) second = d;
    }
    const cracks = THREE.MathUtils.smoothstep(second - first, .025, .12);
    const pebble = (1 - THREE.MathUtils.smoothstep(first + (medium-.5)*.18, .06, .27)) * THREE.MathUtils.smoothstep(broad,.42,.65);
    const moss = noise(u, v, 16, 8);
    const ripples = .5 + .5 * Math.sin((u * 32 + Math.sin(v * Math.PI * 8) * .22) * Math.PI * 2);
    const relief = [broad * .22 + medium * .2 + pebble * .22 + fine * .12,
      cracks * (.38 + broad * .32) + fine * .08,
      moss * .45 + medium * .25 + fine * .18,
      ripples * .15 + fine * .14 + broad * .22];
    const colors = [
      [.115, .077, .043].map(c => c * (.55 + broad * .6 + fine * .3) + pebble * .055),
      [.24, .245, .23].map(c => c * (.48 + broad * .55 + fine * .15) * (.45 + cracks * .55)),
      [.085, .12, .036].map(c => c * (.4 + moss * .85 + medium * .45) + pebble * .018),
      [.43, .34, .205].map(c => c * (.78 + ripples * .12 + fine * .2)),
    ];
    for (let layer = 0; layer < 4; layer++) {
      const k = ((layer * size + y) * size + x) * 4;
      for (let c = 0; c < 3; c++) data[k + c] = Math.round(255 * colors[layer][c]);
      data[k + 3] = Math.round(255 * relief[layer]);
    }
  }
  const texture = new THREE.DataArrayTexture(data, size, size, 4);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}
