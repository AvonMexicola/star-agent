// Pyre surface function — C++ port of src/pyre-world.js (generator version 4).
//
// Engine-free like AeonSurface.h. Pyre is independently seeded (0x50595245,
// "PYRE"); it never reads Aeon's ?seed. Directions are unit vectors, heights
// are METRES, positions are Aeon-centred metres. The surface is authored in
// the tidally locked BODY frame; the world-frame sampler applies the orbit
// frame for a given epoch. Convert to centimetres only at the Unreal boundary.
#pragma once
#include <cstdint>
#include "ResourceProfile.h"

namespace StarAgent { namespace Pyre {

constexpr double Radius = 1200000.0;
constexpr double OrbitRadius = 10000000000.0;
constexpr double Gravity = 7.6;
constexpr double MaxHeight = 9000.0;
constexpr int GeneratorVersion = 4;
constexpr int ResourceVersion = 1;
constexpr double DayTemperature = 400.0;
constexpr double ArrivalAltitude = 1800000.0;
constexpr uint32_t Seed = 0x50595245u;  // independent of Aeon's seed
/** Aeon's assumed year; Pyre's period follows from Kepler's third law. */
constexpr double AeonYearSeconds = 120.0 * 86400.0;
double PeriodSeconds();  // AeonYearSeconds * (OrbitRadius / SunDistance) ** 1.5

struct Atmosphere { double height, planeHeight, seaLevelDensity, scaleHeight, mieScaleHeight; double betaR[3], betaM[3]; double g, gain; };
constexpr Atmosphere AtmosphereParams = {45000, 12000, .09, 6000, 2600, {2.4e-6, 4.2e-6, 8.0e-6}, {1.7e-5, 1.15e-5, 6.2e-6}, .70, 11};

// PYRE_RESOURCE_IDS order: basalt, oxide, sulphur.
enum class ResourceId : uint8_t { Basalt = 0, Oxide, Sulphur };
constexpr double ResourcePalette[3][3] = {{.082, .076, .07}, {.28, .12, .048}, {.56, .43, .09}};

// Hero landmarks in the body frame (feature() in pyre-world.js).
struct Feature {
  const char* name;
  double lat, lon;
  double direction[3], east[3], north[3];
  double radius;   // angular, radiusKm * 1000 / Radius
  double height;   // volcano summit height, metres (0 for lava fields)
  bool active;
};
constexpr int VolcanoCount = 7;
constexpr int LavaFieldCount = 6;
constexpr int CraterCount = 56;
const Feature* Volcanoes();
const Feature* LavaFields();
struct Crater { double direction[3]; double radius, depth; };
const Crater* Craters();

// Region strings from pyreSurfaceBody, in the order the C++ enum uses.
enum class Region : uint8_t {
  BasaltPlains = 0, Caldera,
  CinderThrone, SulphurCrown, EmberDome, GreyShield, TwinFurnace, OldBasalt, DuskCaldera,   // 2 + volcano index
  NightfirePlain, ThroneFlows, FurnaceFlows, EmberField, FarScar, CrownFlows,             // 9 + lava field index
  BasaltHighlands, OxidisedPlains
};
const char* RegionName(Region region);

struct Sample {
  double height;       // metres above the reference sphere, rock relief included
  double rockRelief;
  double color[3];     // linear RGB
  double activity, fresh, sulphur, oxide;
  Region region;
  Resource::Profile resources;  // weights in ResourceId order; dominant index
  // True when no volcano, crater or lava field was within range and no rock
  // outcrop contributed: the value then depends only on hash/polynomial
  // arithmetic and must match the browser bit for bit (cross-check aid).
  bool exact;
};

// pyreSurfaceBody(x, y, z): body-frame unit direction.
Sample SurfaceBody(double x, double y, double z);

// Tidally locked body frame: +Z toward the star, +Y the orbit normal, +X east.
struct Frame { double position[3], x[3], y[3], z[3]; };
// pyreOrbitPosition(ms) for a session epoch (both in milliseconds since 1970).
void OrbitPosition(double ms, double epochMs, double out[3]);
Frame FrameAt(double ms, double epochMs);
void ToBody(const Frame& frame, double x, double y, double z, double out[3]);
void FromBody(const Frame& frame, double x, double y, double z, double out[3]);
// pyreSurface(x, y, z): world-frame direction through the frame.
Sample Surface(const Frame& frame, double x, double y, double z);

// pyreLatLon: longitude 0 is the sub-stellar point, -90 the dusk terminator.
void LatLon(double latDeg, double lonDeg, double out[3]);
void LandingBodyDirection(double out[3]);  // pyreLatLon(13.5, 94.5)

// Three.js Vector3 arithmetic used by the orbit constants (shared with Miasma).
void ThreeNormalize(double v[3]);                                   // divideScalar(length() || 1)
void ThreeCross(const double a[3], const double b[3], double out[3]);  // crossVectors(a, b)

}} // namespace StarAgent::Pyre
