// C++ port of src/world.js, src/terrain-v2.js and src/rock-formations.js.
// Read AeonSurface.h first. Every expression keeps the JavaScript evaluation
// order so IEEE-754 doubles round identically; see tools/aeon-crosscheck.cpp.
#include "AeonSurface.h"
#include "JsMath.h"
#include <cmath>

using namespace StarAgent::Js;

namespace StarAgent { namespace Aeon {
namespace {

// ---- src/world.js -----------------------------------------------------------

inline uint32_t Hash32(double x, double y, double z, uint32_t seed) {
  uint32_t h = (ToUint32(x) * 374761393u) ^ (ToUint32(y) * 668265263u) ^ (ToUint32(z) * 2147483647u) ^ seed;
  h = (h ^ (h >> 13)) * 1274126177u;
  return h ^ (h >> 16);
}

// ---- src/terrain-v2.js -------------------------------------------------------

constexpr double SEA = 0.5075;
constexpr double MOUNTAIN_AMP = 3900;

inline double snoise(double x, double y, double z, uint32_t seed) { return Noise(x, y, z, seed) * 2 - 1; }

double qnoise(double x, double y, double z, uint32_t seed) {
  const double ix = std::floor(x), iy = std::floor(y), iz = std::floor(z);
  double fx = x - ix, fy = y - iy, fz = z - iz;
  fx = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  fy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  fz = fz * fz * fz * (fz * (fz * 6 - 15) + 10);
  const double a = Hash(ix, iy, iz, seed), b = Hash(ix + 1, iy, iz, seed), c = Hash(ix, iy + 1, iz, seed), d = Hash(ix + 1, iy + 1, iz, seed);
  const double e = Hash(ix, iy, iz + 1, seed), f = Hash(ix + 1, iy, iz + 1, seed), g = Hash(ix, iy + 1, iz + 1, seed), k = Hash(ix + 1, iy + 1, iz + 1, seed);
  return ((a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy) * (1 - fz)
       + ((e + (f - e) * fx) * (1 - fy) + (g + (k - g) * fx) * fy) * fz;
}

constexpr double R0 = 0.00, R1 = 0.80, R2 = 0.60;
constexpr double R3 = -0.80, R4 = 0.36, R5 = -0.48;
constexpr double R6 = -0.60, R7 = -0.48, R8 = 0.64;

double fbmR(double x, double y, double z, int octaves, uint32_t seed, double lacunarity = 2.03, double gain = 0.5) {
  double sum = 0, norm = 0, amp = 1;
  for (int i = 0; i < octaves; i++) {
    sum += amp * (qnoise(x, y, z, seed) - 0.5);
    norm += amp;
    amp *= gain;
    const double px = x * lacunarity + 17.1, py = y * lacunarity + 9.2, pz = z * lacunarity - 13.7;
    x = R0 * px + R1 * py + R2 * pz;
    y = R3 * px + R4 * py + R5 * pz;
    z = R6 * px + R7 * py + R8 * pz;
  }
  return sum / norm;
}

double ridged(double x, double y, double z, int octaves, uint32_t seed, double lacunarity = 2.09, double gain = 0.53, double sharpness = 2.2) {
  double sum = 0, norm = 0, amp = 1, weight = 1;
  for (int i = 0; i < octaves; i++) {
    double n = 1 - std::fabs(qnoise(x, y, z, seed) * 2 - 1);
    n *= n;
    n *= weight;
    weight = Clamp(n * sharpness, 0, 1);
    sum += n * amp;
    norm += amp;
    amp *= gain;
    const double px = x * lacunarity + 19.31, py = y * lacunarity - 7.77, pz = z * lacunarity + 31.13;
    x = R0 * px + R1 * py + R2 * pz;
    y = R3 * px + R4 * py + R5 * pz;
    z = R6 * px + R7 * py + R8 * pz;
  }
  return sum / norm;
}

double rot1(double x, double y, double z, double freq, double ox, double oy, double oz, uint32_t seed) {
  const double px = x * freq + ox, py = y * freq + oy, pz = z * freq + oz;
  return qnoise(R0 * px + R1 * py + R2 * pz, R3 * px + R4 * py + R5 * pz, R6 * px + R7 * py + R8 * pz, seed) * 2 - 1;
}

double terrace(double h, double size, double amount) {
  if (amount <= 0) return h;
  const double p = h / size, i = std::floor(p), f = p - i;
  const double stepped = (i + Smoothstep(0.28, 0.72, f)) * size;
  return h + (stepped - h) * amount;
}

// ---- src/rock-formations.js --------------------------------------------------

inline double rfSmooth(double a, double b, double x) {
  const double t = JsMax(0, JsMin(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
inline double rfHash(double x, double y, double z, uint32_t seed) {
  uint32_t h = (ToUint32(x) * 374761393u) ^ (ToUint32(y) * 668265263u) ^ (ToUint32(z) * 1442695041u) ^ seed;
  h = (h ^ (h >> 13)) * 1274126177u;
  return static_cast<double>(h ^ (h >> 16)) / 4294967296.0;
}
double weathering(double x, double y, uint32_t seed) {
  const double ix = std::floor(x), iy = std::floor(y), u = rfSmooth(0, 1, x - ix), v = rfSmooth(0, 1, y - iy);
  const double a = rfHash(ix, iy, 0, seed), b = rfHash(ix + 1, iy, 0, seed), c = rfHash(ix, iy + 1, 0, seed), d = rfHash(ix + 1, iy + 1, 0, seed);
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}

double layer(double x, double y, double z, double radius, double spacing, uint32_t seed, bool small) {
  const double px = x * radius, py = y * radius, pz = z * radius;
  const double gx = std::floor(px / spacing), gy = std::floor(py / spacing), gz = std::floor(pz / spacing);
  double result = 0;
  for (double ix = gx - 1; ix <= gx + 1; ix++) for (double iy = gy - 1; iy <= gy + 1; iy++) for (double iz = gz - 1; iz <= gz + 1; iz++) {
    const double pick = rfHash(ix, iy, iz, seed);
    const double colony = rfHash(std::floor(ix / 7), std::floor(iy / 7), std::floor(iz / 7), seed ^ 9127u);
    if (pick > .35 + colony * .55) continue;
    const double a = rfHash(ix, iy, iz, seed ^ 137u), b = rfHash(ix, iy, iz, seed ^ 391u), c = rfHash(ix, iy, iz, seed ^ 719u);
    const double cx = (ix + .2 + a * .6) * spacing, cy = (iy + .2 + b * .6) * spacing, cz = (iz + .2 + c * .6) * spacing;
    // JavaScript `** 2` is x*x (fdlibm special case), so plain products match.
    const double dpx = px - cx, dpy = py - cy, dpz = pz - cz, reach = spacing * .7;
    if (dpx * dpx + dpy * dpy + dpz * dpz > reach * reach) continue;
    const double length = JsHypot3(cx, cy, cz);
    if (std::fabs(length - radius) > spacing * .35) continue;
    const double nx = cx / length, ny = cy / length, nz = cz / length;
    const double e = JsHypot2(nx, nz), ex = e > .01 ? nz / e : 1, ez = e > .01 ? -nx / e : 0;
    const double bx = ny * ez, by = nz * ex - nx * ez, bz = -ny * ex;
    const double dx = px - nx * radius, dy = py - ny * radius, dz = pz - nz * radius;
    const double u = dx * ex + dz * ez, v = dx * bx + dy * by + dz * bz;
    const double angle = a * JsPi * 2, co = std::cos(angle), si = std::sin(angle);
    const double rx = u * co + v * si, rz = v * co - u * si;
    const double width = spacing * (.14 + b * .13), height = width * (small ? .28 + c * .45 : .4 + c * .5);
    if (JsHypot2(rx, rz) > width * 1.55) continue;
    const int blocks = small ? 1 : 2 + static_cast<int>(std::floor(a * 3));
    for (int block = 0; block < blocks; block++) {
      // (int32 ^ ...) + block*911 then ToInt32 again inside hash: uint32 wrap-add.
      const uint32_t salt = (seed ^ (ToUint32(ix) * 139u) ^ (ToUint32(iy) * 571u) ^ (ToUint32(iz) * 997u)) + static_cast<uint32_t>(block * 911);
      const double f = rfHash(ix, iy, iz, salt), g = rfHash(ix, iy, iz, salt ^ 3917u), k = rfHash(ix, iy, iz, salt ^ 7111u);
      const double size = block == 0 ? 1 : .35 + f * .3, turn = g * JsPi * 2, bco = std::cos(turn), bsi = std::sin(turn);
      const double ox = block == 0 ? 0 : std::cos(block * 2.4 + a * 6) * width * .62;
      const double oz = block == 0 ? 0 : std::sin(block * 2.4 + a * 6) * width * .62;
      const double sx = ((rx - ox) * bco + (rz - oz) * bsi) / (width * size), sz = ((rz - oz) * bco - (rx - ox) * bsi) / (width * size * (.6 + g * .35));
      const double power = 2.3 + f * 3.7;
      const double erosion = weathering(sx * 3 + f * 9, sz * 3 + g * 9, salt);
      const double q = std::pow(std::pow(std::fabs(sx), power) + std::pow(std::fabs(sz), power), 1 / power) + (erosion - .5) * .16;
      if (q >= 1) continue;
      const double cap = .8 + erosion * .22 - sx * (f - .5) * .3 - sz * (g - .5) * .3;
      const double cut = std::fabs(sx * (.4 + g) + sz * (k - .5) * 2 - (f - .5));
      const double fracture = 1 - (k > .6 ? .13 : 0) * (1 - rfSmooth(.015, .1, cut));
      const double profile = (1 - rfSmooth(.4 + f * .2, 1, q)) * cap * fracture;
      result = JsMax(result, height * size * profile);
    }
  }
  return result;
}

} // namespace

// ---- public API ----------------------------------------------------------------

double Clamp(double x, double a, double b) { return JsMax(a, JsMin(b, x)); }
double Smoothstep(double a, double b, double x) { const double t = Clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
double Hash(double x, double y, double z, uint32_t seed) { return static_cast<double>(Hash32(x, y, z, seed)) / 4294967295.0; }

double Noise(double x, double y, double z, uint32_t seed) {
  const double ix = std::floor(x), iy = std::floor(y), iz = std::floor(z);
  double fx = x - ix, fy = y - iy, fz = z - iz;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); fz = fz * fz * (3 - 2 * fz);
  const double a = Hash(ix, iy, iz, seed), b = Hash(ix + 1, iy, iz, seed), c = Hash(ix, iy + 1, iz, seed), d = Hash(ix + 1, iy + 1, iz, seed);
  const double e = Hash(ix, iy, iz + 1, seed), f = Hash(ix + 1, iy, iz + 1, seed), g = Hash(ix, iy + 1, iz + 1, seed), h = Hash(ix + 1, iy + 1, iz + 1, seed);
  return ((a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy) * (1 - fz) + ((e + (f - e) * fx) * (1 - fy) + (g + (h - g) * fx) * fy) * fz;
}

double Fbm(double x, double y, double z, int octaves, uint32_t seed) {
  double sum = 0, amp = .5, norm = 0;
  for (int i = 0; i < octaves; i++) { sum += amp * Noise(x, y, z, seed); norm += amp; x = x * 2.03 + 17.1; y = y * 2.03 + 9.2; z = z * 2.03 - 13.7; amp *= .5; }
  return sum / norm;
}

void CubeDirection(int face, double u, double v, double out[3]) {
  double x, y, z;
  if (face == 0) { x = 1; y = v; z = -u; } else if (face == 1) { x = -1; y = v; z = u; }
  else if (face == 2) { x = u; y = 1; z = -v; } else if (face == 3) { x = u; y = -1; z = v; }
  else if (face == 4) { x = u; y = v; z = 1; } else { x = -u; y = v; z = -1; }
  const double inv = 1 / JsHypot3(x, y, z);
  out[0] = x * inv; out[1] = y * inv; out[2] = z * inv;
}

void LatLonDirection(double latDeg, double lonDeg, double out[3]) {
  const double a = latDeg * JsPi / 180, b = lonDeg * JsPi / 180;
  out[0] = std::cos(a) * std::sin(b); out[1] = std::sin(a); out[2] = std::cos(a) * std::cos(b);
}

double RockFormationHeight(double x, double y, double z, double radius, uint32_t seed) {
  return layer(x, y, z, radius, 115, seed, false)
       + layer(x, y, z, radius, 23, seed ^ 0x726f636bu, true);
}

Sample TerrainSample(double x, double y, double z, uint32_t seed) {
  // ---- continents: domain-warped fbm ----
  const double wx = snoise(x * 2.1 + 11.3, y * 2.1 - 4.7, z * 2.1 + 8.9, seed);
  const double wy = snoise(x * 2.1 - 21.7, y * 2.1 + 13.1, z * 2.1 - 3.3, seed);
  const double wz = snoise(x * 2.1 + 5.5, y * 2.1 + 27.9, z * 2.1 + 19.4, seed);
  const double W = 0.15;
  const double continent = Fbm((x + wx * W) * 3.05 + 8, (y + wy * W) * 3.05, (z + wz * W) * 3.05 + 3, 5, seed);
  const double q = continent - SEA;

  // ---- large-scale hypsometry ----
  const double coastalPlain = Smoothstep(0, 0.055, q);
  const double interior = Smoothstep(0.030, 0.200, q);
  const double shelf = Smoothstep(0, 0.016, -q);
  const double abyss = Smoothstep(0.012, 0.080, -q);
  const double landMask = Smoothstep(-0.004, 0.030, q);

  // ---- mountain belts ----
  const double beltRaw = ridged(x * 9.2 + 31.7, y * 9.2 - 12.3, z * 9.2 + 7.1, 2, seed, 2.11, 0.5);
  const double belt = Smoothstep(0.60, 0.94, beltRaw);
  const double uplift = belt * landMask;
  const double mr = ridged(x * 145 + 3.7, y * 145 + 21.3, z * 145 - 9.1, 6, seed);
  const double relief = Smoothstep(0.10, 0.88, mr);

  // ---- rolling hills and mid detail ----
  const double hills = fbmR(x * 560 + 5.3, y * 560 - 3.1, z * 560 + 9.7, 4, seed);
  const double mid = fbmR(x * 4200 + 2.7, y * 4200 + 8.3, z * 4200 - 4.9, 3, seed, 2.17);

  double land = coastalPlain * 230 + interior * 640
    + Smoothstep(0.22, 0.66, beltRaw) * landMask * 340
    + uplift * relief * MOUNTAIN_AMP
    + landMask * relief * (150 + 260 * interior);
  const double carve = 1 - relief;
  land *= 1 - (0.34 + 0.42 * uplift) * carve * carve;
  land += hills * (170 + 520 * uplift + 120 * interior) * landMask;
  land += mid * (85 + 260 * uplift) * landMask;
  // ---- highland terracing ----
  land = terrace(land, 130, uplift * Smoothstep(1100, 2500, land) * 0.42);
  land = JsMax(land, coastalPlain * 6);

  double h = land - shelf * 190 - abyss * 3800;
  h += (Noise(x * 26 + 3.1, y * 26 - 9.4, z * 26 + 17.2, seed) - 0.42) * 900 * abyss;

  // ---- coasts ----
  const double coastType = Noise(x * 7.3 + 55.1, y * 7.3 - 21.6, z * 7.3 + 13.4, seed);
  const double cliffiness = Smoothstep(0.40, 0.70, coastType);
  const double cq = q + hills * 0.0016;
  const double shoreBand = 1 - Smoothstep(0, 0.0045, std::fabs(cq));
  h -= cliffiness * (25 + 95 * coastType) * (1 - Smoothstep(-0.00035, 0.00035, cq)) * shoreBand;
  h *= 1 - 0.55 * shoreBand * (1 - cliffiness);

  // ---- metre-scale roughness ----
  const double micro = fbmR(x * 17000 + 1.3, y * 17000 + 7.7, z * 17000 - 2.1, 5, seed, 2.31);
  const double dry = Smoothstep(-30, 4, h);
  const double rough = 0.8 + 1.5 * uplift + 0.45 * Smoothstep(150, 1300, h);
  h += micro * 15 * rough * dry;

  const double duneW = shoreBand * (1 - cliffiness) * Smoothstep(0.4, 3, h) * (1 - Smoothstep(8, 17, h));
  if (duneW > 0) h += duneW * fbmR(x * 90000 - 5.1, y * 90000 + 2.9, z * 90000 + 11.3, 3, seed, 2.41) * 5;

  // ---- polar ice sheets ----
  const double polar = Smoothstep(0.79, 0.90, std::fabs(y));
  if (polar > 0) {
    const double iceMask = polar * Smoothstep(-0.004, 0.014, q);
    const double ice = 780 + hills * 340 + mid * 90;
    h = h * (1 - iceMask) + iceMask * JsMax(h * 0.35 + ice, 45);
  }

  const double rockRelief = RockFormationHeight(x, y, z, 1592750, seed) * Smoothstep(10, 70, h) * (1 - polar);
  return Sample{h + rockRelief, rockRelief};
}

double TerrainHeight(double x, double y, double z, uint32_t seed) { return TerrainSample(x, y, z, seed).height; }

double Moisture(double x, double y, double z, uint32_t seed) {
  const double base = Fbm(x * 11 + 60, y * 11, z * 11, 3, seed);
  const double detail = Fbm(x * 95 + 7.1, y * 95 - 3.4, z * 95 + 5.6, 2, seed) - 0.5;
  const double a = std::fabs(y);
  const double bands = 0.085 * std::cos((a - 0.05) * 11.5) - 0.17 * Smoothstep(0.70, 0.95, a);
  return Clamp(base * 1.06 + detail * 0.13 + bands - 0.015, 0, 1);
}

Biome BiomeAt(double x, double y, double z, double height, uint32_t seed) {
  if (std::fabs(y) > 0.86 || height > 4200) return Biome::PolarIce;
  if (height < 0) return Biome::OpenOcean;
  if (height < 85) return Biome::Coastland;
  if (height > 2200) return Biome::AlpineHighlands;
  if (Moisture(x, y, z, seed) > 0.46) return Biome::TemperateForest;
  return Biome::Grassland;
}

const char* BiomeName(Biome biome) {
  switch (biome) {
    case Biome::PolarIce: return "POLAR ICE";
    case Biome::OpenOcean: return "OPEN OCEAN";
    case Biome::Coastland: return "COASTLAND";
    case Biome::AlpineHighlands: return "ALPINE HIGHLANDS";
    case Biome::TemperateForest: return "TEMPERATE FOREST";
    default: return "GRASSLAND";
  }
}

double SlopeAt(double x, double y, double z, double h, uint32_t seed, double step) {
  const double RAD = 6371000.0 / 4;
  double tx = z, tz = -x;
  double len = JsHypot2(tx, tz);
  if (len < 0.01) { tx = 1; tz = 0; len = 1; }
  tx /= len; tz /= len;
  const double bx = y * tz, by = z * tx - x * tz, bz = -y * tx;
  const double e = step / RAD;
  auto sample = [&](double ax, double ay, double az) {
    const double nx = x + ax * e, ny = y + ay * e, nz = z + az * e;
    const double l = JsHypot3(nx, ny, nz);
    return TerrainHeight(nx / l, ny / l, nz / l, seed);
  };
  const double dt = (sample(tx, 0, tz) - h) / step;
  const double db = (sample(bx, by, bz) - h) / step;
  return std::atan(JsHypot2(dt, db));
}

void SurfaceFields(double x, double y, double z, uint32_t seed, double& m, double& n, double& fine) {
  m = Moisture(x, y, z, seed);
  n = Noise(x * 350, y * 350, z * 350, seed);
  fine = rot1(x, y, z, 9000, 4.4, -1.2, 6.6, seed) * 0.5 + 0.5;
}

void SurfaceColor(double x, double y, double z, double h, double slope, uint32_t seed, double c[3]) {
  const double m = Moisture(x, y, z, seed);
  const double n = Noise(x * 350, y * 350, z * 350, seed);
  const double fine = rot1(x, y, z, 9000, 4.4, -1.2, 6.6, seed) * 0.5 + 0.5;
  const double a = std::fabs(y);

  if (h < 0) {
    const double deep = Smoothstep(-40, -2, h);
    c[0] = 0.055 + 0.20 * deep; c[1] = 0.095 + 0.19 * deep; c[2] = 0.105 + 0.11 * deep;
  } else if (h < 4) {
    const double wet = 1 - Smoothstep(0.2, 1.5, h);
    c[0] = 0.44 - 0.19 * wet; c[1] = 0.395 - 0.185 * wet; c[2] = 0.255 - 0.115 * wet;
  } else {
    const double green = Smoothstep(0.39, 0.60, m);
    const double dryland[3] = {0.235, 0.225, 0.105};
    const double forest[3] = {0.055, 0.115, 0.045};
    for (int i = 0; i < 3; i++) c[i] = dryland[i] + (forest[i] - dryland[i]) * green;
    const double sandy = (1 - Smoothstep(4, 22, h)) * (1 - green * 0.7);
    const double sand[3] = {0.44, 0.395, 0.255};
    for (int i = 0; i < 3; i++) c[i] = c[i] + (sand[i] - c[i]) * sandy;
    const double alpine = Smoothstep(1900, 3100, h);
    const double alp[3] = {0.27, 0.255, 0.225};
    for (int i = 0; i < 3; i++) c[i] = c[i] + (alp[i] - c[i]) * alpine;
  }

  const double rock = Smoothstep(0.52, 0.72, slope) * (h > -6 ? 1 : 0);
  const double warm = (n - 0.5) * 2;
  const double rockColor[3] = {0.235 + warm * 0.045, 0.222 + warm * 0.018, 0.212 - warm * 0.03};
  const double scree = Smoothstep(0.34, 0.50, slope) * (1 - Smoothstep(0.52, 0.66, slope)) * Smoothstep(0.45, 0.75, fine);
  const double screeColor[3] = {0.30, 0.285, 0.255};
  for (int i = 0; i < 3; i++) {
    const double v = c[i] + (screeColor[i] - c[i]) * scree * 0.75;
    c[i] = v + (rockColor[i] - v) * rock;
  }

  const double snowline = 3500 - 3900 * Smoothstep(0.25, 0.94, a);
  const double snow = Smoothstep(snowline, snowline + 550 + (n - 0.5) * 260, h) * (1 - Smoothstep(0.62, 0.86, slope)) * (h > 0 ? 1 : 0);
  const double ice = JsMax(snow, Smoothstep(0.815, 0.885, a + (n - 0.5) * 0.02) * (h > -1 ? 1 : 0));
  const double variation = 0.88 + n * 0.24;
  const double iceColor[3] = {0.79, 0.86, 0.90};
  for (int i = 0; i < 3; i++) c[i] = Clamp(c[i] * variation * (1 - ice) + iceColor[i] * ice, 0, 1);
}

}} // namespace StarAgent::Aeon
