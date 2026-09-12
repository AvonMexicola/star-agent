// C++ port of src/miasma-world.js. Read MiasmaSurface.h first. Expression
// order follows the JavaScript; Math.exp and ** use the fdlibm ports in JsLibm.h.
#include "MiasmaSurface.h"
#include "AeonSurface.h"
#include "JsMath.h"
#include "JsLibm.h"
#include <cmath>
#include <cstring>

using namespace StarAgent::Js;

namespace StarAgent { namespace Miasma {
namespace {

int g_powUlpAdjust = 0;
inline double adjustUlps(double v, int ulps) {
  if (ulps == 0 || v == 0) return v;
  int64_t bits; std::memcpy(&bits, &v, 8);
  bits += (v > 0) ? ulps : -ulps;
  double r; std::memcpy(&r, &bits, 8); return r;
}

inline double clamp(double v, double a = 0, double b = 1) { return JsMax(a, JsMin(b, v)); }
inline double smooth(double a, double b, double v) { const double t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); }
inline double hash(double x, double y, double z) {
  uint32_t n = (ToUint32(x) * 374761393u) ^ (ToUint32(y) * 668265263u) ^ (ToUint32(z) * 1442695041u) ^ Seed;
  n = (n ^ (n >> 13)) * 1274126177u;
  return static_cast<double>(n ^ (n >> 16)) / 4294967295.0;
}
inline double mix(double a, double b, double t) { return a + (b - a) * t; }
double noise(double x, double y, double z) {
  const double a = std::floor(x), b = std::floor(y), c = std::floor(z), u = smooth(0, 1, x - a), v = smooth(0, 1, y - b), w = smooth(0, 1, z - c);
  return mix(mix(mix(hash(a, b, c), hash(a + 1, b, c), u), mix(hash(a, b + 1, c), hash(a + 1, b + 1, c), u), v),
             mix(mix(hash(a, b, c + 1), hash(a + 1, b, c + 1), u), mix(hash(a, b + 1, c + 1), hash(a + 1, b + 1, c + 1), u), v), w);
}
double fbm(double x, double y, double z, int n = 4) {
  double sum = 0, weight = .55, total = 0;
  for (int i = 0; i < n; i++) {
    sum += weight * noise(x, y, z); total += weight; weight *= .5;
    const double nx = y * 1.73 + z * .9 + 13, ny = z * 1.79 - x * .8 + 7, nz = x * 1.81 + y * .85 - 11;
    x = nx; y = ny; z = nz;
  }
  return sum / total;
}
void direction(double lat, double lon, double out[3]) {
  const double a = lat * JsPi / 180, b = lon * JsPi / 180;
  out[0] = std::cos(a) * std::sin(b); out[1] = std::sin(a); out[2] = std::cos(a) * std::cos(b);
}
struct SiteTable { Site s[SiteCount]; };
SiteTable makeSites() {
  struct Def { const char* name; double lat, lon, radius, depth; };
  const Def defs[SiteCount] = {{"VITRIOL BASIN", 18, -65, .37, 2100}, {"THE PALE EYE", -24, 28, .24, 1700}, {"VERDIGRIS SEA", 42, 126, .43, 2400}, {"BRIMSTONE CROWN", -43, -142, .2, 1300}};
  SiteTable a;
  for (int i = 0; i < SiteCount; i++) { a.s[i].name = defs[i].name; direction(defs[i].lat, defs[i].lon, a.s[i].direction); a.s[i].radius = defs[i].radius; a.s[i].depth = defs[i].depth; }
  return a;
}
const Site* sites() {
  static const SiteTable table = makeSites();
  return table.s;
}

} // namespace

void SetPowUlpAdjustForTesting(int ulps) { g_powUlpAdjust = ulps; }
const Site* Sites() { return sites(); }
const char* RegionName(Region region) {
  static const char* names[] = {"SULPHUR UPLANDS", "VITRIOL BASIN", "THE PALE EYE", "VERDIGRIS SEA", "BRIMSTONE CROWN"};
  return names[static_cast<int>(region)];
}

Sample Surface(double x, double y, double z) {
  const double warp = fbm(x * 3 + 9, y * 3 - 4, z * 3 + 2, 3), a = x * 4 + warp * 2, b = y * 4 + warp, c = z * 4 - warp;
  const double continent = fbm(a, b, c), ridge = 1 - std::fabs(fbm(x * 23 + warp, y * 23, z * 23 - warp) * 2 - 1);
  const double fracture = 1 - smooth(.009, .042, std::fabs(fbm(x * 55, y * 55, z * 55, 3) - .5));
  double height = 250 + continent * 2100 + adjustUlps(Pow(ridge, 6), g_powUlpAdjust) * 1100, basin = 0, rim = 0;
  Region region = Region::SulphurUplands;
  const Site* s = sites();
  for (int i = 0; i < SiteCount; i++) {
    const Site& site = s[i];
    const double distance = std::sqrt(JsMax(0, 2 - 2 * (x * site.direction[0] + y * site.direction[1] + z * site.direction[2])));
    const double r = distance / site.radius + (fbm(x * 31 + 5, y * 31, z * 31, 3) - .5) * .16;
    const double et = (r - 1.04) / .105;
    const double bowl = 1 - smooth(.66, 1.04, r), edge = Exp(-(et * et));
    height -= site.depth * bowl; height += site.depth * .35 * edge;
    if (bowl > .2) region = static_cast<Region>(1 + i);
    basin = JsMax(basin, bowl); rim = JsMax(rim, edge);
  }
  height += (fbm(x * 160, y * 160, z * 160, 3) - .5) * 150 - fracture * 70 + (noise(x * 2200, y * 2200, z * 2200) - .5) * 3;
  const double rocks = Aeon::RockFormationHeight(x, y, z, Radius, Seed);
  height += rocks;
  const double sulphur = clamp(.24 + continent * .75 + rim * .3 - basin * .75), copper = basin * .92;
  const double abundances[3] = {sulphur, JsMax(.06, 1 - sulphur - copper), copper};
  Sample out;
  out.resources = Resource::MakeProfile(abundances, 3);
  double rc[3]; Resource::ProfileColor(out.resources, ResourcePalette, rc);
  for (int i = 0; i < 3; i++) out.color[i] = rc[i] * (.8 + continent * .3) * (1 - fracture * .24) * (1 - smooth(.3, 3, rocks) * .34);
  out.height = height; out.rockRelief = rocks; out.sulphur = sulphur; out.basin = basin; out.region = region;
  out.exact = rocks == 0;
  return out;
}

void Position(const Pyre::Frame& f, double out[3]) {
  // north = pyreFrame().y; towardAeon = new Vector3(...PYRE_POSITION).negate().normalize()
  const double* north = f.y;
  double towardAeon[3] = {-f.position[0], -f.position[1], -f.position[2]};
  Pyre::ThreeNormalize(towardAeon);
  // right = crossVectors(towardAeon.clone().negate(), north).normalize()
  const double neg[3] = {-towardAeon[0], -towardAeon[1], -towardAeon[2]};
  double right[3]; Pyre::ThreeCross(neg, north, right); Pyre::ThreeNormalize(right);
  for (int i = 0; i < 3; i++) out[i] = f.position[i];
  const double s1 = OrbitRadius * .58, s2 = OrbitRadius * .25, s3 = -OrbitRadius * std::sqrt(1 - .58 * .58 - .25 * .25);
  for (int i = 0; i < 3; i++) out[i] += right[i] * s1;
  for (int i = 0; i < 3; i++) out[i] += north[i] * s2;
  for (int i = 0; i < 3; i++) out[i] += towardAeon[i] * s3;
}

}} // namespace StarAgent::Miasma
