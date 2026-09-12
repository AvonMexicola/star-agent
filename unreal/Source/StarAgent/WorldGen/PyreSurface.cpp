// C++ port of src/pyre-world.js. Read PyreSurface.h first. Expression order
// follows the JavaScript so doubles round identically; Math.exp uses the
// fdlibm port in JsLibm.h, while sin/cos/atan2 stay std:: and may differ by one
// ulp on volcano flanks (Sample::exact is false there).
#include "PyreSurface.h"
#include "AeonSurface.h"
#include "JsMath.h"
#include "JsLibm.h"
#include <cmath>

using namespace StarAgent::Js;

namespace StarAgent { namespace Pyre {

void ThreeNormalize(double v[3]) {
  double len = std::sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
  if (len == 0) len = 1;  // this.length() || 1
  const double inv = 1 / len;   // divideScalar -> multiplyScalar(1 / scalar)
  v[0] *= inv; v[1] *= inv; v[2] *= inv;
}
void ThreeCross(const double a[3], const double b[3], double out[3]) {
  const double ax = a[0], ay = a[1], az = a[2], bx = b[0], by = b[1], bz = b[2];
  out[0] = ay * bz - az * by;
  out[1] = az * bx - ax * bz;
  out[2] = ax * by - ay * bx;
}

void LatLon(double lat, double lon, double out[3]) {
  const double a = lat * JsPi / 180, b = lon * JsPi / 180;
  out[0] = std::cos(a) * std::sin(b); out[1] = std::sin(a); out[2] = std::cos(a) * std::cos(b);
}
void LandingBodyDirection(double out[3]) { LatLon(13.5, 94.5, out); }

namespace {

// ---- deterministic noise, independent of Aeon's ?seed ----------------------
inline double hash(double x, double y, double z) {
  uint32_t h = (ToUint32(x) * 374761393u) ^ (ToUint32(y) * 668265263u) ^ (ToUint32(z) * 1442695041u) ^ Seed;
  h = (h ^ (h >> 13)) * 1274126177u;
  return static_cast<double>(h ^ (h >> 16)) / 4294967295.0;
}
inline double smooth(double a, double b, double x) { const double t = JsMax(0, JsMin(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
double qnoise(double x, double y, double z) {
  const double ix = std::floor(x), iy = std::floor(y), iz = std::floor(z);
  double fx = x - ix, fy = y - iy, fz = z - iz;
  fx = fx * fx * fx * (fx * (fx * 6 - 15) + 10); fy = fy * fy * fy * (fy * (fy * 6 - 15) + 10); fz = fz * fz * fz * (fz * (fz * 6 - 15) + 10);
  const double a = hash(ix, iy, iz), b = hash(ix + 1, iy, iz), c = hash(ix, iy + 1, iz), d = hash(ix + 1, iy + 1, iz);
  const double e = hash(ix, iy, iz + 1), f = hash(ix + 1, iy, iz + 1), g = hash(ix, iy + 1, iz + 1), k = hash(ix + 1, iy + 1, iz + 1);
  return ((a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy) * (1 - fz) + ((e + (f - e) * fx) * (1 - fy) + (g + (k - g) * fx) * fy) * fz;
}
constexpr double R[9] = {0, .8, .6, -.8, .36, -.48, -.6, -.48, .64};
inline void rotate(double x, double y, double z, double& ox, double& oy, double& oz) {
  ox = R[0] * x + R[1] * y + R[2] * z; oy = R[3] * x + R[4] * y + R[5] * z; oz = R[6] * x + R[7] * y + R[8] * z;
}
double fbm(double x, double y, double z, int octaves, double lacunarity = 2.03, double gain = .5) {
  double sum = 0, norm = 0, amp = 1;
  for (int i = 0; i < octaves; i++) {
    sum += amp * (qnoise(x, y, z) - .5); norm += amp; amp *= gain;
    double nx, ny, nz; rotate(x * lacunarity + 17.1, y * lacunarity + 9.2, z * lacunarity - 13.7, nx, ny, nz); x = nx; y = ny; z = nz;
  }
  return sum / norm;
}
double ridged(double x, double y, double z, int octaves, double lacunarity = 2.09, double gain = .53) {
  double sum = 0, norm = 0, amp = 1, weight = 1;
  for (int i = 0; i < octaves; i++) {
    double n = 1 - std::fabs(qnoise(x, y, z) * 2 - 1); n *= n; n *= weight; weight = JsMax(0, JsMin(1, n * 2.2));
    sum += n * amp; norm += amp; amp *= gain;
    double nx, ny, nz; rotate(x * lacunarity + 19.31, y * lacunarity - 7.77, z * lacunarity + 31.13, nx, ny, nz); x = nx; y = ny; z = nz;
  }
  return sum / norm;
}
inline double chord(double x, double y, double z, const double c[3]) {
  const double dot = x * c[0] + y * c[1] + z * c[2];
  return std::sqrt(JsMax(0, 2 - 2 * dot));
}

// ---- hero landmarks (body frame) -------------------------------------------
Feature MakeFeature(const char* name, double lat, double lon, double radiusKm, double height, bool active) {
  Feature f;
  f.name = name; f.lat = lat; f.lon = lon;
  LatLon(lat, lon, f.direction);
  const double* d = f.direction;
  double up[3];
  if (std::fabs(d[1]) < .9) { up[0] = 0; up[1] = 1; up[2] = 0; } else { up[0] = 1; up[1] = 0; up[2] = 0; }
  double e0 = up[1] * d[2] - up[2] * d[1], e1 = up[2] * d[0] - up[0] * d[2], e2 = up[0] * d[1] - up[1] * d[0];
  const double l = JsHypot3(e0, e1, e2); e0 /= l; e1 /= l; e2 /= l;
  f.east[0] = e0; f.east[1] = e1; f.east[2] = e2;
  f.north[0] = d[1] * e2 - d[2] * e1; f.north[1] = d[2] * e0 - d[0] * e2; f.north[2] = d[0] * e1 - d[1] * e0;
  f.radius = radiusKm * 1000 / Radius;
  f.height = height; f.active = active;
  return f;
}

struct Tables {
  Feature volcanoes[VolcanoCount];
  Feature fields[LavaFieldCount];
  Crater craters[CraterCount];
};
const Tables& tables() {
  static const Tables t = [] {
    Tables t;
    t.volcanoes[0] = MakeFeature("CINDER THRONE", 16, 90, 45, 5200, true);
    t.volcanoes[1] = MakeFeature("SULPHUR CROWN", 38, 30, 60, 6400, true);
    t.volcanoes[2] = MakeFeature("EMBER DOME", 8, -140, 30, 3200, true);
    t.volcanoes[3] = MakeFeature("GREY SHIELD", 55, -60, 24, 2400, false);
    t.volcanoes[4] = MakeFeature("TWIN FURNACE", -22, 112, 50, 5600, true);
    t.volcanoes[5] = MakeFeature("OLD BASALT", -48, -20, 36, 3000, false);
    t.volcanoes[6] = MakeFeature("DUSK CALDERA", -9, 72, 20, 2600, true);
    t.fields[0] = MakeFeature("NIGHTFIRE PLAIN", 4, 135, 260, 0, false);
    t.fields[1] = MakeFeature("THRONE FLOWS", 12, 96, 95, 0, false);
    t.fields[2] = MakeFeature("FURNACE FLOWS", -28, 140, 160, 0, false);
    t.fields[3] = MakeFeature("EMBER FIELD", 30, -160, 130, 0, false);
    t.fields[4] = MakeFeature("FAR SCAR", -14, -95, 150, 0, false);
    t.fields[5] = MakeFeature("CROWN FLOWS", 44, 22, 70, 0, false);
    // Impact craters from the module-level LCG: seed = (imul(seed, 1664525) + 1013904223) >>> 0.
    uint32_t seed = Seed;
    auto random = [&seed]() { seed = seed * 1664525u + 1013904223u; return static_cast<double>(seed) / 4294967296.0; };
    for (int i = 0; i < CraterCount; i++) {
      const double y = random() * 2 - 1, angle = random() * JsPi * 2, r = std::sqrt(1 - y * y);
      const double q = random();
      const double radius = .0028 + q * q * .032;  // random() ** 2 is x*x in V8
      Crater& c = t.craters[i];
      c.direction[0] = r * std::cos(angle); c.direction[1] = y; c.direction[2] = r * std::sin(angle);
      c.radius = radius; c.depth = radius * Radius * .07;
    }
    return t;
  }();
  return t;
}

struct OrbitConstants { double sunDir[3], star[3], normal[3], ox[3], oy[3]; double phase0, period; };
const OrbitConstants& orbit() {
  static const OrbitConstants o = [] {
    OrbitConstants c;
    // world.js SUN_DIRECTION = [.9,.35,.12].map(v => v / Math.hypot(.9,.35,.12))
    const double l = JsHypot3(.9, .35, .12);
    c.sunDir[0] = .9 / l; c.sunDir[1] = .35 / l; c.sunDir[2] = .12 / l;
    for (int i = 0; i < 3; i++) c.star[i] = c.sunDir[i] * Aeon::SunDistance;
    // new Vector3(0,1,0).addScaledVector(SUN_DIRECTION, -SUN_DIRECTION[1]).normalize()
    c.normal[0] = 0 + c.sunDir[0] * (-c.sunDir[1]);
    c.normal[1] = 1 + c.sunDir[1] * (-c.sunDir[1]);
    c.normal[2] = 0 + c.sunDir[2] * (-c.sunDir[1]);
    ThreeNormalize(c.normal);
    for (int i = 0; i < 3; i++) c.ox[i] = -c.sunDir[i];
    ThreeCross(c.normal, c.ox, c.oy);
    c.phase0 = std::acos(OrbitRadius / Aeon::SunDistance);
    c.period = AeonYearSeconds * Pow(OrbitRadius / Aeon::SunDistance, 1.5);
    return c;
  }();
  return o;
}

} // namespace

const Feature* Volcanoes() { return tables().volcanoes; }
const Feature* LavaFields() { return tables().fields; }
const Crater* Craters() { return tables().craters; }
double PeriodSeconds() { return orbit().period; }

const char* RegionName(Region region) {
  static const char* names[] = {"BASALT PLAINS", "CALDERA", "CINDER THRONE", "SULPHUR CROWN", "EMBER DOME", "GREY SHIELD", "TWIN FURNACE", "OLD BASALT", "DUSK CALDERA",
                                "NIGHTFIRE PLAIN", "THRONE FLOWS", "FURNACE FLOWS", "EMBER FIELD", "FAR SCAR", "CROWN FLOWS", "BASALT HIGHLANDS", "OXIDISED PLAINS"};
  return names[static_cast<int>(region)];
}

void OrbitPosition(double ms, double epochMs, double out[3]) {
  const OrbitConstants& o = orbit();
  const double phase = o.phase0 + 2 * JsPi * (((ms - epochMs) / 1000) / o.period);
  for (int i = 0; i < 3; i++) out[i] = o.star[i];
  const double sx = OrbitRadius * std::cos(phase);
  for (int i = 0; i < 3; i++) out[i] += o.ox[i] * sx;
  const double sy = OrbitRadius * std::sin(phase);
  for (int i = 0; i < 3; i++) out[i] += o.oy[i] * sy;
}

Frame FrameAt(double ms, double epochMs) {
  const OrbitConstants& o = orbit();
  Frame f;
  OrbitPosition(ms, epochMs, f.position);
  for (int i = 0; i < 3; i++) f.z[i] = o.star[i] - f.position[i];
  ThreeNormalize(f.z);
  for (int i = 0; i < 3; i++) f.y[i] = o.normal[i];
  ThreeCross(f.y, f.z, f.x);
  ThreeNormalize(f.x);
  return f;
}

void ToBody(const Frame& f, double x, double y, double z, double out[3]) {
  out[0] = x * f.x[0] + y * f.x[1] + z * f.x[2];
  out[1] = x * f.y[0] + y * f.y[1] + z * f.y[2];
  out[2] = x * f.z[0] + y * f.z[1] + z * f.z[2];
}
void FromBody(const Frame& f, double x, double y, double z, double out[3]) {
  out[0] = x * f.x[0] + y * f.y[0] + z * f.z[0];
  out[1] = x * f.x[1] + y * f.y[1] + z * f.z[1];
  out[2] = x * f.x[2] + y * f.y[2] + z * f.z[2];
}

Sample Surface(const Frame& frame, double x, double y, double z) {
  double b[3]; ToBody(frame, x, y, z, b);
  return SurfaceBody(b[0], b[1], b[2]);
}

// ---- the canonical surface ---------------------------------------------------
Sample SurfaceBody(double x, double y, double z) {
  const double broad = fbm(x * 3.3 + 5.1, y * 3.3 - 2.2, z * 3.3 + 7.9, 4);
  const double highland = smooth(-.02, .16, broad);
  const double plains = 1 - highland;
  const double ridge = ridged(x * 41 + 3.1, y * 41 - 8.7, z * 41 + 2.4, 4);
  double height = broad * 2600 + highland * ridge * 900 + (broad + .5) * 400 - 300;
  height += fbm(x * 700 + 1.3, y * 700 + 4.4, z * 700 - 9.1, 4) * (90 + 260 * highland);
  height += fbm(x * 5000 - 2.7, y * 5000 + 6.1, z * 5000 + 1.9, 3) * (35 + 60 * highland);
  // Wrinkle (pressure) ridges on the plains.
  const double wrinkle = ridged(x * 900 + 12.1, y * 900 - 3.3, z * 900 + 5.5, 3);
  height += smooth(.55, .95, wrinkle) * 26 * plains;
  // Sinuous rilles.
  const double rille = 1 - std::fabs(qnoise(x * 260 + 8.8, y * 260 + 1.2, z * 260 - 4.6) * 2 - 1);
  height -= smooth(.905, .985, rille) * 55 * plains;
  // Fault scarps.
  const double fault = qnoise(x * 14 + 21.3, y * 14 - 6.6, z * 14 + 9.9) - .5, faultMask = smooth(.42, .62, qnoise(x * 7.3 - 3.1, y * 7.3 + 2.9, z * 7.3 - 7.7));
  height += smooth(-.012, .012, fault) * 140 * faultMask;

  double activity = 0, fresh = 0, sulphur = 0, calderaHeat = 0;
  Region region = Region::BasaltPlains;
  bool transcendental = false;  // any std::sin/cos/atan2 or cos/sin-derived feature direction in play
  const Tables& t = tables();
  for (int vi = 0; vi < VolcanoCount; vi++) {
    const Feature& v = t.volcanoes[vi];
    const double dot = x * v.direction[0] + y * v.direction[1] + z * v.direction[2];
    if (dot < 1 - v.radius * v.radius * 1.2) continue;
    transcendental = true;
    const double u = (x * v.east[0] + y * v.east[1] + z * v.east[2]), w = (x * v.north[0] + y * v.north[1] + z * v.north[2]);
    const double angle = std::atan2(w, u);
    const double lobes = 1 + .14 * std::sin(angle * 5 + 1.7) + .07 * std::cos(angle * 11 + .4) + .05 * (qnoise(x * 400 + 3, y * 400, z * 400) - .5);
    const double r = chord(x, y, z, v.direction) / (v.radius * lobes);
    if (r > 1.25) continue;
    const double s = JsMax(0, 1 - r), shield = s * s * (3 - 2 * s) * (1 - .12 * ridged(x * 300 + 5, y * 300 - 2, z * 300 + 9, 2));
    const double ct = (r - .075) / .018;
    const double caldera = -(1 - smooth(.045, .085, r)) * .13 + Exp(-(ct * ct)) * .035;
    const double channel = smooth(.86, .99, 1 - std::fabs(std::sin(angle * 7 + qnoise(x * 900, y * 900, z * 900) * 3))) * smooth(.1, .3, r) * (1 - smooth(.8, 1.05, r));
    const double gullies = (1 - ridged(x * 1800 + 4, y * 1800 - 6, z * 1800 + 2, 2)) * smooth(.12, .5, r) * (1 - smooth(.8, 1.05, r));
    height += v.height * (shield + caldera - channel * .012 - gullies * .035 * shield);
    if (v.active) {
      calderaHeat = JsMax(calderaHeat, 1 - smooth(.03, .07, r));
      activity = JsMax(activity, channel * (1 - smooth(.45, .95, r)) * .9);
      fresh = JsMax(fresh, (1 - smooth(.35, 1.05, r)) * smooth(.35, .6, qnoise(x * 120 + 7, y * 120 - 3, z * 120 + 1)));
      sulphur = JsMax(sulphur, (1 - smooth(.05, .22, r)) * smooth(.52, .8, qnoise(x * 1500 + 2, y * 1500 + 4, z * 1500 - 3)) * .85);
    }
    if (r < .09) region = Region::Caldera; else if (r < 1.05) region = static_cast<Region>(2 + vi);
  }
  for (int ci = 0; ci < CraterCount; ci++) {
    const Crater& c = t.craters[ci];
    const double dot = x * c.direction[0] + y * c.direction[1] + z * c.direction[2];
    if (dot < 1 - c.radius * c.radius * 1.2) continue;
    transcendental = true;
    const double r = chord(x, y, z, c.direction) / c.radius;
    const double et = (r - .98) / .12;
    height += -c.depth * (1 - smooth(.15, .94, r)) + c.depth * .36 * Exp(-(et * et));
  }
  for (int fi = 0; fi < LavaFieldCount; fi++) {
    const Feature& f = t.fields[fi];
    const double dot = x * f.direction[0] + y * f.direction[1] + z * f.direction[2];
    if (dot < 1 - f.radius * f.radius * 1.4) continue;
    transcendental = true;
    const double r = chord(x, y, z, f.direction) / f.radius;
    const double edge = 1 + .35 * (qnoise(x * 60 + 4, y * 60 - 1, z * 60 + 6) - .5);
    const double field = (1 - smooth(.55, 1.05, r * edge)) * (1 - .6 * highland);
    if (field <= 0) continue;
    const double lakes = smooth(.5, .74, fbm(x * 230 + 1, y * 230 + 2, z * 230 + 3, 3) + .5);
    const double rivers = smooth(.62, .96, ridged(x * 760 + 9, y * 760 - 4, z * 760 + 7, 2));
    activity = JsMax(activity, field * JsMax(JsMax(rivers, lakes * .85), .16));
    fresh = JsMax(fresh, field * smooth(.3, .7, lakes + rivers * .5));
    if (field > .3) region = static_cast<Region>(9 + fi);
  }
  activity = JsMax(activity, calderaHeat);
  fresh = JsMax(fresh, calderaHeat);
  // Oxidised ochre plains.
  const double warp0 = fbm(x * 8 + 2, y * 8 - 7, z * 8 + 3, 3), warp1 = fbm(x * 8 - 13, y * 8 + 5, z * 8 - 11, 3), warp2 = fbm(x * 8 + 17, y * 8 + 19, z * 8 + 7, 3);
  const double oxideField = fbm(x * 11 + warp0 * 6 + 9.4, y * 11 + warp1 * 6 - 5.5, z * 11 + warp2 * 6 + 2.2, 4) + .5;
  const double oxide = smooth(.43, .62, oxideField + broad * .3) * plains * (1 - fresh);
  // Metre-scale relief.
  const double rough = 1 + 1.6 * fresh + .6 * highland;
  height += fbm(x * 40000 + 3.7, y * 40000 - 1.1, z * 40000 + 6.3, 3, 2.27) * 3.0 * rough;
  height += fbm(x * 150000 + 8.1, y * 150000 + 2.6, z * 150000 - 4.4, 2, 2.41) * .7 * rough;
  // Tumuli on a stable 60 m cell lattice.
  if (activity > .05 || fresh > .05) {
    const double gx = x * Radius / 60, gy = y * Radius / 60, gz = z * Radius / 60;
    const double cx = std::floor(gx), cy = std::floor(gy), cz = std::floor(gz);
    for (int i = 0; i < 27; i++) {
      const double ox = cx + i % 3 - 1, oy = cy + (i / 3) % 3 - 1, oz = cz + i / 9 - 1;
      if (hash(ox, oy + 71, oz) < .55) continue;
      const double dx = gx - ox - hash(ox, oy, oz + 3), dy = gy - oy - hash(ox + 5, oy, oz), dz = gz - oz - hash(ox, oy + 9, oz);
      const double radius = .12 + hash(ox + 11, oy, oz) * .25, dist = std::sqrt(dx * dx + dy * dy + dz * dz) / radius;
      if (dist < 1) height += (1 - dist * dist) * radius * 60 * .28 * JsMax(activity, fresh);
    }
  }
  const double rocks = Aeon::RockFormationHeight(x, y, z, Radius, 0x50595245u) * (1 - smooth(.1, .6, activity));
  height += rocks;
  if (region == Region::BasaltPlains && highland > .55) region = Region::BasaltHighlands;
  else if (region == Region::BasaltPlains && oxide > .5) region = Region::OxidisedPlains;
  const double tone = .8 + .4 * qnoise(x * 350 + 2, y * 350 + 7, z * 350 - 5);
  const double abundances[3] = {(1 - oxide) * (1 - sulphur), oxide * (1 - sulphur), sulphur};

  Sample s;
  s.resources = Resource::MakeProfile(abundances, 3);
  double rc[3]; Resource::ProfileColor(s.resources, ResourcePalette, rc);
  for (int i = 0; i < 3; i++) s.color[i] = rc[i] * tone * (1 + highland * .3) * (1 - fresh * .48) * (1 - smooth(.3, 3, rocks) * .28);
  s.height = height; s.rockRelief = rocks;
  s.activity = activity; s.fresh = fresh; s.sulphur = sulphur; s.oxide = oxide;
  s.region = region;
  s.exact = !transcendental && rocks == 0;
  return s;
}

}} // namespace StarAgent::Pyre
