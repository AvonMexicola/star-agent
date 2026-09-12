// C++ port of src/moon-world.js. Read SeleneSurface.h first.
#include "SeleneSurface.h"
#include "AeonSurface.h"
#include "JsMath.h"
#include <cmath>

using namespace StarAgent::Js;

namespace StarAgent { namespace Selene {
namespace {

// ---- Three.js Vector3 semantics ---------------------------------------------
struct V3 { double x, y, z; };
// normalize(): divideScalar(length() || 1) == multiplyScalar(1 / length()).
inline V3 Normalize(V3 v) {
  double len = ThreeLength(v.x, v.y, v.z);
  if (len == 0) len = 1;
  const double inv = 1 / len;
  return V3{v.x * inv, v.y * inv, v.z * inv};
}
inline V3 Cross(V3 a, V3 b) { return V3{a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x}; }
inline V3 AddScaled(V3 v, V3 d, double s) { return V3{v.x + d.x * s, v.y + d.y * s, v.z + d.z * s}; }

// ---- moon-local hash/noise (no seed) -------------------------------------------
inline double smooth(double a, double b, double x) {
  const double t = JsMax(0, JsMin(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
inline double hash(double x, double y, double z) {
  uint32_t h = (ToUint32(x) * 374761393u) ^ (ToUint32(y) * 668265263u) ^ (ToUint32(z) * 2147483647u);
  h = (h ^ (h >> 13)) * 1274126177u;
  return static_cast<double>(h ^ (h >> 16)) / 4294967295.0;
}
double noise(double x, double y, double z) {
  const double a = std::floor(x), b = std::floor(y), c = std::floor(z);
  const double u = smooth(0, 1, x - a), v = smooth(0, 1, y - b), w = smooth(0, 1, z - c);
  double sum = 0;
  for (int i = 0; i < 2; i++) for (int j = 0; j < 2; j++) for (int k = 0; k < 2; k++)
    sum += hash(a + i, b + j, c + k) * (i ? u : 1 - u) * (j ? v : 1 - v) * (k ? w : 1 - w);
  return sum;
}

// ---- startup tables ------------------------------------------------------------
struct Frame { double u[3]; double v[3]; double phase; };
struct World {
  double position[3], landing[3], east[3], north[3];
  Crater craters[CraterCount];
  Crater local[LocalCraterCount];
  Province provinces[ProvinceCount];
  Frame frames[ProvinceCount];
};

struct Lcg {
  uint32_t seed = Seed;
  // seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
  double operator()() { seed = seed * 1664525u + 1013904223u; return seed / 4294967296.0; }
};

const World& W() {
  static const World world = [] {
    World w{};
    Lcg random;
    const V3 position = Normalize(V3{-.1, 0, -1});
    w.position[0] = position.x * Distance; w.position[1] = position.y * Distance; w.position[2] = position.z * Distance;
    const V3 landing = Normalize(V3{.45, .22, .87});
    const V3 east = Normalize(Cross(V3{0, 1, 0}, landing));
    const V3 north = Normalize(Cross(landing, east));
    w.landing[0] = landing.x; w.landing[1] = landing.y; w.landing[2] = landing.z;
    w.east[0] = east.x; w.east[1] = east.y; w.east[2] = east.z;
    w.north[0] = north.x; w.north[1] = north.y; w.north[2] = north.z;
    // CRATERS: 96 entries, three random() calls each, in module order.
    for (int i = 0; i < CraterCount; i++) {
      const double y = random() * 2 - 1, angle = random() * JsPi * 2, r = std::sqrt(1 - y * y);
      const double t = random();
      const double radius = .012 + t * t * .13;   // random() ** 2 is t*t
      Crater& c = w.craters[i];
      c.direction[0] = r * std::cos(angle); c.direction[1] = y; c.direction[2] = r * std::sin(angle);
      c.radius = radius; c.depth = radius * Radius * .095;
    }
    auto localDirection = [&](double x, double z, double out[3]) {
      const V3 d = Normalize(AddScaled(AddScaled(landing, east, x / Radius), north, z / Radius));
      out[0] = d.x; out[1] = d.y; out[2] = d.z;
    };
    // RESOURCE_PROVINCES (module order; no random() calls).
    {
      const Place places[ProvinceCount] = {Place::FrostwallIceProvince, Place::CopperEjectaProvince, Place::NorthGlassFields, Place::FarCopperBasins, Place::SouthIceFields};
      const Resource resources[ProvinceCount] = {Resource::Ice, Resource::Copper, Resource::Ice, Resource::Copper, Resource::Ice};
      const double radii[ProvinceCount] = {145000, 150000, 120000, 135000, 95000};
      for (int i = 0; i < ProvinceCount; i++) { w.provinces[i].place = places[i]; w.provinces[i].resource = resources[i]; w.provinces[i].radius = radii[i]; }
      localDirection(65000, 135000, w.provinces[0].direction);
      localDirection(100000, -130000, w.provinces[1].direction);
      const V3 fixed[3] = {Normalize(V3{-.3, .83, -.46}), Normalize(V3{-.88, -.3, .3}), Normalize(V3{.1, -.97, .12})};
      for (int i = 0; i < 3; i++) { w.provinces[2 + i].direction[0] = fixed[i].x; w.provinces[2 + i].direction[1] = fixed[i].y; w.provinces[2 + i].direction[2] = fixed[i].z; }
      for (int i = 0; i < ProvinceCount; i++) {
        const V3 direction{w.provinces[i].direction[0], w.provinces[i].direction[1], w.provinces[i].direction[2]};
        const V3 u = Normalize(Cross(std::fabs(direction.y) < .9 ? V3{0, 1, 0} : V3{1, 0, 0}, direction));
        const V3 v = Normalize(Cross(direction, u));
        w.frames[i].u[0] = u.x; w.frames[i].u[1] = u.y; w.frames[i].u[2] = u.z;
        w.frames[i].v[0] = v.x; w.frames[i].v[1] = v.y; w.frames[i].v[2] = v.z;
        w.frames[i].phase = i * 1.73;
      }
    }
    // LOCAL_CRATERS: 8 authored, then 28 generated with two random() calls each.
    {
      double rows[LocalCraterCount][4] = {
        {-1350, 100, 1354, 1350}, {-3400, 1200, 1900, 1650}, {1800, 2300, 1250, 980},
        {-280, -480, 145, 43}, {-490, 570, 210, 78}, {460, -210, 95, 32},
        {-6000, -2500, 3100, 1100}, {2600, -3400, 2100, 760}};
      for (int i = 0; i < 28; i++) {
        const double angle = i * 2.39996, distance = 700 + random() * 6500;
        const double t = random();
        const double radius = 40 + t * t * 280;
        rows[8 + i][0] = std::cos(angle) * distance; rows[8 + i][1] = std::sin(angle) * distance; rows[8 + i][2] = radius; rows[8 + i][3] = radius * .24;
      }
      for (int i = 0; i < LocalCraterCount; i++) {
        localDirection(rows[i][0], rows[i][1], w.local[i].direction);
        w.local[i].radius = rows[i][2] / Radius;
        w.local[i].depth = rows[i][3];
      }
    }
    return w;
  }();
  return world;
}

const double PaletteBasalt[3] = {.025, .037, .057};
const double PaletteCopper[3] = {.38, .10, .025};
const double PaletteIce[3] = {.43, .68, .83};

struct Relief {
  double height, rockRelief, albedo, frost, color[3];
  Resources resources;
};

Relief relief(double x, double y, double z) {
  const World& w = W();
  const double broad = noise(x * 3.7 + 11, y * 3.7 - 4, z * 3.7 + 7), detail = noise(x * 24 + 7, y * 24 + 3, z * 24 - 6);
  const double maria = 1 - smooth(.33, .50, broad);
  auto ridge = [&](double f, double a, double b, double c) { return 1 - std::fabs(noise(x * f + a, y * f + b, z * f + c) * 2 - 1); };
  const double highlands = smooth(.30, .64, broad);
  double height = (broad - .5) * 6200 + (detail - .5) * 1150;
  height += highlands * (std::pow(ridge(62, 4, 7, -2), 3) * 2100 + std::pow(ridge(180, -3, 9, 5), 4) * 620);
  height += (noise(x * 720 + 13, y * 720 - 9, z * 720 + 3) - .5) * 165;
  height += (noise(x * 2500 - 2, y * 2500 + 5, z * 2500 + 8) - .5) * 18;
  height += (noise(x * 18000 + 6, y * 18000 - 2, z * 18000 + 8) - .5) * .9;
  double fresh = 0, rock = 0, glacier = 0, obsidian = 0, capIce = 0;
  auto crater = [&](const Crater& c, bool local) {
    const double dot = x * c.direction[0] + y * c.direction[1] + z * c.direction[2];
    if (dot < 1 - c.radius * c.radius * 1.45) return;
    const double r = std::sqrt(JsMax(0, 2 - 2 * dot)) / c.radius;
    const double broken = 1 + (noise(x * 110 + 7, y * 110 - 4, z * 110 + 2) - .5) * .24;
    const double bowl = -c.depth * (1 - smooth(.22, .98, r));
    const double tr = (r - 1.01) / .115;
    const double rim = c.depth * .46 * std::exp(-(tr * tr)) * broken;
    const double te = (r - 1.17) / .27;
    const double ejecta = c.depth * .055 * std::exp(-(te * te)) * (1 - smooth(1.35, 1.65, r));
    const double peak = local ? 0 : c.depth * .16 * std::exp(-r * r / .015);
    height += bowl + rim + ejecta + peak;
    const double tf = (r - 1.02) / .18;
    fresh += std::exp(-(tf * tf)) * .10;
  };
  for (int i = 0; i < CraterCount; i++) crater(w.craters[i], false);
  if (x * w.landing[0] + y * w.landing[1] + z * w.landing[2] > .997) {
    for (int i = 0; i < LocalCraterCount; i++) crater(w.local[i], true);
    const double u = (x * w.east[0] + y * w.east[1] + z * w.east[2]) * Radius, v = (x * w.north[0] + y * w.north[1] + z * w.north[2]) * Radius;
    const double cellX = std::floor(u / 45), cellZ = std::floor(v / 45);
    for (int dz = -1; dz <= 1; dz++) for (int dx = -1; dx <= 1; dx++) {
      const double cx = cellX + dx, cz = cellZ + dz;
      if (hash(cx, 37, cz) < .64) continue;
      const double px = (cx + .15 + hash(cx, 61, cz) * .7) * 45, pz = (cz + .15 + hash(cx, 89, cz) * .7) * 45;
      const double radius = 2.5 + hash(cx, 107, cz) * 6.5, dist = JsHypot2(u - px, (v - pz) * (.7 + hash(cx, 123, cz) * .6)) / radius;
      const double shape = 1 - smooth(.05, 1, dist);
      height += radius * .55 * shape; rock = JsMax(rock, shape);
    }
    const double regional = 1 - smooth(18000, 28000, JsHypot2(u, v));
    const double fault = u + 220 - std::sin(v / 900) * 380 - std::sin(v / 240) * 65;
    glacier = (1 - smooth(90, 260, std::fabs(fault))) * regional;
    height -= glacier * 180;
    // `ochre` is computed in the JavaScript but never used; omitted.
    obsidian = (1 - smooth(3000, 5000, JsHypot2(u + 7600, v + 5300))) * regional;
    capIce = (1 - smooth(3000, 5000, JsHypot2(u - 5400, v - 11500))) * regional;
    const double peaks[3][4] = {{-7600, -5300, 4800, 6800}, {-11000, 6500, 5200, 7600}, {5400, 11500, 5200, 6200}};
    for (const auto& p : peaks) {
      const double a = p[0], b = p[1], r = p[2], h = p[3];
      const double du = u - a, dv = v - b, angle = std::atan2(dv, du);
      const double distance = JsHypot2(du, dv) / (r * (1 + .16 * std::sin(angle * 5) + .08 * std::cos(angle * 9)));
      const double envelope = std::pow(JsMax(0, 1 - distance), 1.05);
      const double rg = ridge(460, 8, -3, 5);
      const double gullies = .73 + .27 * (rg * rg);   // Math.pow(x, 2) is x*x
      height += h * envelope * gullies;
    }
  }
  const double frost = JsMax(JsMax(glacier, capIce * .88), smooth(.50, .77, noise(x * 38 - 7, y * 38 + 2, z * 38 + 8) + fresh * .6) * .7) * (1 - rock * .7);
  // `basalt` is computed in the JavaScript but never used; omitted.
  const double veins = smooth(.47, .64, noise(x * 720 + 8, y * 720 - 5, z * 720 + 2));
  const double ice = JsMin(1, JsMax(capIce * .88, frost * (.55 + veins * .45) + veins * .15 * (1 - obsidian)));
  Relief out{};
  out.resources = MoonResources(x, y, z);
  const double* wt = out.resources.weights;
  for (int i = 0; i < 3; i++) out.color[i] = (PaletteBasalt[i] * wt[0] + PaletteCopper[i] * wt[1] + PaletteIce[i] * wt[2]) * (.80 + veins * .32) + fresh * .10;
  out.rockRelief = Aeon::RockFormationHeight(x, y, z, Radius, Seed);
  height += out.rockRelief;
  out.height = height;
  out.albedo = JsMax(.065, JsMin(.38, .145 - maria * .055 + (detail - .5) * .065 + fresh + frost * .075 - rock * .05));
  out.frost = JsMax(ice * .15, wt[2]);
  return out;
}

double LandingHeight() {
  static const double value = [] { const World& w = W(); return relief(w.landing[0], w.landing[1], w.landing[2]).height; }();
  return value;
}

} // namespace

const double* Position() { return W().position; }
const double* LandingDirection() { return W().landing; }
const double* LandingEast() { return W().east; }
const double* LandingNorth() { return W().north; }
const Crater* Craters() { return W().craters; }
const Crater* LocalCraters() { return W().local; }
const Province* Provinces() { return W().provinces; }
const double* ResourcePalette(Resource resource) { return resource == Resource::Basalt ? PaletteBasalt : resource == Resource::Copper ? PaletteCopper : PaletteIce; }

const char* ResourceName(Resource resource) {
  switch (resource) { case Resource::Basalt: return "basalt"; case Resource::Copper: return "copper"; default: return "ice"; }
}
const char* PlaceName(Place place) {
  static const char* names[] = {"BASALT HIGHLANDS", "FROSTWALL ICE PROVINCE", "COPPER EJECTA PROVINCE", "NORTH GLASS FIELDS", "FAR COPPER BASINS", "SOUTH ICE FIELDS",
    "FAR HIGHLANDS", "CRESCENT RIM", "OBSIDIAN CROWN", "TWIN SPIRES", "FROSTWALL", "COPPER EJECTA", "GLASS RIFT", "CRESCENT BASIN", "ASH HIGHLANDS"};
  return names[static_cast<int>(place)];
}

Place MoonRegion(double x, double y, double z) {
  const World& w = W();
  const double u = (x * w.east[0] + y * w.east[1] + z * w.east[2]) * Radius, v = (x * w.north[0] + y * w.north[1] + z * w.north[2]) * Radius;
  if (x * w.landing[0] + y * w.landing[1] + z * w.landing[2] < .997) return Place::FarHighlands;
  if (JsHypot2(u, v) < 180) return Place::CrescentRim;
  if (JsHypot2(u + 7600, v + 5300) < 2700) return Place::ObsidianCrown;
  if (JsHypot2(u + 11000, v - 6500) < 3000) return Place::TwinSpires;
  if (JsHypot2(u - 5400, v - 11500) < 3200) return Place::Frostwall;
  if (JsHypot2(u - 2600, v + 3400) < 2700) return Place::CopperEjecta;
  if (std::fabs(u + 220 - std::sin(v / 900) * 380 - std::sin(v / 240) * 65) < 300) return Place::GlassRift;
  if (JsHypot2(u + 1350, v - 100) < 1500) return Place::CrescentBasin;
  return Place::AshHighlands;
}

Resources MoonResources(double x, double y, double z) {
  const World& w = W();
  double copper = 0, ice = 0, strongest = 0, corePriority = 0;
  Place province = Place::BasaltHighlands;
  const Province* coreProvince = nullptr;
  bool haveStratigraphy = false; double stratigraphy = 0;
  const double landingDot = x * w.landing[0] + y * w.landing[1] + z * w.landing[2];
  const bool localOnly = landingDot > 0 && (1 - landingDot * landingDot) * Radius * Radius < 18000.0 * 18000.0;
  for (int index = 0; !localOnly && index < ProvinceCount; index++) {
    const Province& p = w.provinces[index]; const Frame& frame = w.frames[index];
    const double dot = x * p.direction[0] + y * p.direction[1] + z * p.direction[2], r = p.radius / Radius;
    if (dot < 1 - r * r * 2) continue;
    const double distance = std::sqrt(JsMax(0, 2 - 2 * dot)) * Radius;
    if (!haveStratigraphy) { stratigraphy = .38 + .62 * noise(x * 22 + 11, y * 22 - 4, z * 22 + 7); haveStratigraphy = true; }
    const double u = (x * frame.u[0] + y * frame.u[1] + z * frame.u[2]) / r, v = (x * frame.v[0] + y * frame.v[1] + z * frame.v[2]) / r;
    const double wu = u + .23 * std::sin(v * 6 + frame.phase) + .12 * std::sin(u * 11 - v * 8), wv = v + .19 * std::sin(u * 5 - v * 3) + .08 * std::sin(v * 14 + frame.phase);
    const double basin = 1 - smooth(.25, 1.08, JsHypot2(wu / 1.2, wv * 1.25));
    const double trunk = (1 - smooth(.80, 1.65, std::fabs(u))) * (1 - smooth(.06, .30, std::fabs(v + .30 * std::sin(u * 4 + frame.phase) + .14 * std::sin(u * 9))));
    const double branch = (1 - smooth(.75, 1.5, JsHypot2(u, v))) * (1 - smooth(.025, .19, std::fabs(v - .65 * u - .20 * std::sin(u * 6 + frame.phase))));
    const double core = 1 - smooth(40000, 65000, distance * (1 + .12 * std::sin(u * 7 + frame.phase) * std::sin(v * 6)));
    if (core > corePriority) { coreProvince = &p; corePriority = core; }
    const double strength = JsMax(JsMax(JsMax(core, basin * stratigraphy), trunk * .82 * stratigraphy), branch * .76 * stratigraphy);
    if (p.resource == Resource::Ice) ice = JsMax(ice, strength); else copper = JsMax(copper, strength);
    if (strength > strongest) { strongest = strength; province = p.place; }
  }
  if (coreProvince) {
    ice = ice * (1 - corePriority) + (coreProvince->resource == Resource::Ice ? 1.0 : 0.0) * corePriority;
    copper = copper * (1 - corePriority) + (coreProvince->resource == Resource::Copper ? 1.0 : 0.0) * corePriority;
    if (corePriority > .5) province = coreProvince->place;
  }
  const double dot = x * w.landing[0] + y * w.landing[1] + z * w.landing[2];
  if (dot > .997) {
    const double u = (x * w.east[0] + y * w.east[1] + z * w.east[2]) * Radius, v = (x * w.north[0] + y * w.north[1] + z * w.north[2]) * Radius;
    const double regional = 1 - smooth(18000, 28000, JsHypot2(u, v));
    copper *= 1 - regional; ice *= 1 - regional;
    const double fault = u + 220 - std::sin(v / 900) * 380 - std::sin(v / 240) * 65;
    const double localIce = JsMax(1 - smooth(90, 260, std::fabs(fault)), 1 - smooth(3000, 5000, JsHypot2(u - 5400, v - 11500))) * regional;
    const double localCopper = (1 - smooth(1000, 2700, JsHypot2(u - 2600, v + 3400))) * regional;
    const double obsidian = (1 - smooth(3000, 5000, JsHypot2(u + 7600, v + 5300))) * regional;
    copper = JsMax(copper, localCopper) * (1 - obsidian); ice = JsMax(ice, localIce) * (1 - obsidian);
    if (regional > .5) province = MoonRegion(x, y, z);
  }
  double c = .015 + copper * .92, i = .02 + ice * .94;
  if (c + i > .98) { const double scale = .98 / (c + i); c *= scale; i *= scale; }
  Resources out{};
  out.weights[0] = 1 - c - i; out.weights[1] = c; out.weights[2] = i;
  out.dominant = c > out.weights[0] && c >= i ? Resource::Copper : i > out.weights[0] ? Resource::Ice : Resource::Basalt;
  out.province = province;
  return out;
}

Sample MoonSurface(double x, double y, double z) {
  const World& w = W();
  Relief r = relief(x, y, z);
  const double dot = x * w.landing[0] + y * w.landing[1] + z * w.landing[2];
  if (dot > .9999998) {
    const double distance = std::sqrt(JsMax(0, 2 - 2 * dot)) * Radius;
    const double blend = smooth(35, 150, distance);
    const double landingHeight = LandingHeight();
    r.height = landingHeight + (r.height - landingHeight) * blend;
    r.rockRelief *= blend;
  }
  Sample s{};
  s.height = r.height; s.rockRelief = r.rockRelief; s.albedo = r.albedo; s.frost = r.frost;
  for (int i = 0; i < 3; i++) s.color[i] = r.color[i];
  s.resources = r.resources;
  return s;
}

bool IsTranscendentalFree(double x, double y, double z) {
  const World& w = W();
  if (x * w.landing[0] + y * w.landing[1] + z * w.landing[2] > .997) return false;
  for (int i = 0; i < CraterCount; i++) {
    const Crater& c = w.craters[i];
    if (!(x * c.direction[0] + y * c.direction[1] + z * c.direction[2] < 1 - c.radius * c.radius * 1.45)) return false;
  }
  for (int i = 0; i < ProvinceCount; i++) {
    const Province& p = w.provinces[i]; const double r = p.radius / Radius;
    if (!(x * p.direction[0] + y * p.direction[1] + z * p.direction[2] < 1 - r * r * 2)) return false;
  }
  const double broad = noise(x * 3.7 + 11, y * 3.7 - 4, z * 3.7 + 7);
  return smooth(.30, .64, broad) == 0;   // no ridge power terms
}

}} // namespace StarAgent::Selene
