// Selene (moon) surface function — C++ port of src/moon-world.js
// (lunar generator version 5). Engine-free: only <cstdint>.
//
// Selene is independently seeded (LCG seed 0x53454c45 for the crater tables,
// the same constant for rock formations) and never reads the Aeon seed, so no
// seed parameter exists. Keep expression order identical to the JavaScript;
// see tools/selene-crosscheck.cpp.
//
// Units: unit directions in the Selene body frame (Y up), heights in METRES
// above the 434,350 m reference sphere. Negative heights are valid land.
#pragma once
#include <cstdint>

#if defined(__clang__)
#pragma clang fp contract(off)
#endif

namespace StarAgent { namespace Selene {

constexpr double Radius = 434350.0;
constexpr double Distance = 24000000.0;      // from Aeon's centre
constexpr double MaxHeight = 16000.0;         // broad-phase bound, not a barrier
constexpr double Gravity = 1.62;
constexpr int GeneratorVersion = 5;
constexpr int ResourceVersion = 1;
constexpr uint32_t Seed = 0x53454c45u;
constexpr int CraterCount = 96;
constexpr int LocalCraterCount = 36;
constexpr int ProvinceCount = 5;

// MOON_POSITION, MOON_LANDING_DIRECTION and LANDING_FRAME (computed with
// Three.js Vector3 semantics at startup).
const double* Position();
const double* LandingDirection();
const double* LandingEast();
const double* LandingNorth();

struct Crater { double direction[3]; double radius; double depth; };
const Crater* Craters();       // CRATERS, radius in unit-sphere chord units
const Crater* LocalCraters();  // LOCAL_CRATERS

enum class Resource : uint8_t { Basalt = 0, Copper, Ice };
// Every string moonResources().province / moonRegion() can return, fixed order.
enum class Place : uint8_t {
  BasaltHighlands = 0,
  FrostwallIceProvince, CopperEjectaProvince, NorthGlassFields, FarCopperBasins, SouthIceFields,
  FarHighlands, CrescentRim, ObsidianCrown, TwinSpires, Frostwall, CopperEjecta, GlassRift, CrescentBasin, AshHighlands
};
const char* ResourceName(Resource resource);
const char* PlaceName(Place place);

struct Province { Place place; Resource resource; double direction[3]; double radius; };
const Province* Provinces();   // RESOURCE_PROVINCES

struct Resources { double weights[3]; Resource dominant; Place province; };
struct Sample {
  double height;      // metres, includes rockRelief and the landing-shelf blend
  double rockRelief;
  double albedo;      // linear, 0.065..0.38
  double frost;       // 0..1 ice mask for the material
  double color[3];    // linear RGB
  Resources resources;
};

// moon-world.js MOON_RESOURCE_PALETTE: basalt, copper, ice.
const double* ResourcePalette(Resource resource);

Resources MoonResources(double x, double y, double z);
Sample MoonSurface(double x, double y, double z);
Place MoonRegion(double x, double y, double z);

// Cross-check support: true when the height, albedo, colour and resource
// weights at this direction involve no exp/pow/sin/cos/atan2 term (outside
// every crater apron and province, no ridge highlands, outside the landing cap).
bool IsTranscendentalFree(double x, double y, double z);

}} // namespace StarAgent::Selene
