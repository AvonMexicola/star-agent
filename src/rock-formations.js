// Seeded bedrock and detached-looking boulders, evaluated in body-local metres.
// These are heightfield features: the terrain mesh, normals, plants and swept
// contact all sample the same surface. They cannot form caves or overhangs.
const smooth = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const hash = (x, y, z, seed) => {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1442695041) ^ seed;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
function weathering(x, y, seed) {
  const ix=Math.floor(x),iy=Math.floor(y),u=smooth(0,1,x-ix),v=smooth(0,1,y-iy);
  const a=hash(ix,iy,0,seed),b=hash(ix+1,iy,0,seed),c=hash(ix,iy+1,0,seed),d=hash(ix+1,iy+1,0,seed);
  return (a+(b-a)*u)*(1-v)+(c+(d-c)*u)*v;
}

// Cells live in 3D, not cube faces or longitude rows. A narrow shell of seed
// points projects onto the sphere, so poles, face boundaries and longitude
// seams have exactly the same field. All neighbours whose support can reach
// the query are included; changing camera/LOD never changes a formation.
function layer(x, y, z, radius, spacing, seed, small) {
  const px = x * radius, py = y * radius, pz = z * radius;
  const gx = Math.floor(px / spacing), gy = Math.floor(py / spacing), gz = Math.floor(pz / spacing);
  let result = 0;
  for (let ix = gx - 1; ix <= gx + 1; ix++) for (let iy = gy - 1; iy <= gy + 1; iy++) for (let iz = gz - 1; iz <= gz + 1; iz++) {
    const pick = hash(ix, iy, iz, seed);
    const colony = hash(Math.floor(ix / 7), Math.floor(iy / 7), Math.floor(iz / 7), seed ^ 9127);
    if (pick > .35 + colony * .55) continue;
    const a = hash(ix, iy, iz, seed ^ 137), b = hash(ix, iy, iz, seed ^ 391), c = hash(ix, iy, iz, seed ^ 719);
    const cx = (ix + .2 + a * .6) * spacing, cy = (iy + .2 + b * .6) * spacing, cz = (iz + .2 + c * .6) * spacing;
    if ((px - cx) ** 2 + (py - cy) ** 2 + (pz - cz) ** 2 > (spacing * .7) ** 2) continue;
    const length = Math.hypot(cx, cy, cz);
    if (Math.abs(length - radius) > spacing * .35) continue;
    const nx = cx / length, ny = cy / length, nz = cz / length;
    // Tangent basis belongs to the seed point, not to the moving query.
    const e = Math.hypot(nx, nz), ex = e > .01 ? nz / e : 1, ez = e > .01 ? -nx / e : 0;
    const bx = ny * ez, by = nz * ex - nx * ez, bz = -ny * ex;
    const dx = px - nx * radius, dy = py - ny * radius, dz = pz - nz * radius;
    const u = dx * ex + dz * ez, v = dx * bx + dy * by + dz * bz;
    const angle = a * Math.PI * 2, co = Math.cos(angle), si = Math.sin(angle);
    const rx = u * co + v * si, rz = v * co - u * si;
    const width = spacing * (.14 + b * .13), height = width * (small ? .28 + c * .45 : .4 + c * .5);
    if (Math.hypot(rx, rz) > width * 1.55) continue;
    // Independently shaped and rotated blocks, with smaller shoulders around
    // the main outcrop. Cell-specific weathering breaks up the outline and cap.
    for (let block = 0; block < (small ? 1 : 2 + Math.floor(a * 3)); block++) {
      const salt=(seed ^ Math.imul(ix,139) ^ Math.imul(iy,571) ^ Math.imul(iz,997)) + block*911;
      const f=hash(ix,iy,iz,salt),g=hash(ix,iy,iz,salt^3917),k=hash(ix,iy,iz,salt^7111);
      const size=block===0?1:.35+f*.3,turn=g*Math.PI*2,co=Math.cos(turn),si=Math.sin(turn);
      const ox=block===0?0:Math.cos(block*2.4+a*6)*width*.62;
      const oz=block===0?0:Math.sin(block*2.4+a*6)*width*.62;
      const sx=((rx-ox)*co+(rz-oz)*si)/(width*size),sz=((rz-oz)*co-(rx-ox)*si)/(width*size*(.6+g*.35));
      const power=2.3+f*3.7;
      const erosion=weathering(sx*3+f*9,sz*3+g*9,salt);
      const q=Math.pow(Math.abs(sx)**power+Math.abs(sz)**power,1/power)+(erosion-.5)*.16;
      if (q >= 1) continue;
      const cap=.8+erosion*.22-sx*(f-.5)*.3-sz*(g-.5)*.3;
      const cut=Math.abs(sx*(.4+g)+sz*(k-.5)*2-(f-.5));
      const fracture=1-(k>.6?.13:0)*(1-smooth(.015,.1,cut));
      const profile=(1-smooth(.4+f*.2,1,q))*cap*fracture;
      result = Math.max(result, height * size * profile);
    }
  }
  return result;
}

/** Relief in metres. Seed is explicit; no time, camera, PRNG state or GPU input. */
export function rockFormationHeight(x, y, z, radius, seed) {
  return layer(x, y, z, radius, 115, seed, false)
    + layer(x, y, z, radius, 23, seed ^ 0x726f636b, true);
}
