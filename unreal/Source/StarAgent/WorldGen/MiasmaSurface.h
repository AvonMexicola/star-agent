// Miasma surface function — C++ port of src/miasma-world.js (generator version 2).
//
// Engine-free like AeonSurface.h. Miasma is independently seeded (0x4d494153,
// "MIAS"); it never reads Aeon's ?seed. Directions are unit vectors, heights
// are METRES. Miasma's position is derived from Pyre's time-dependent frame,
// so it is a function of that frame here rather than a baked constant.
#pragma once
#include <cstdint>
#include "PyreSurface.h"
#include "ResourceProfile.h"

namespace StarAgent { namespace Miasma {

constexpr double Radius = 340000.0;
constexpr double OrbitRadius = 6400000.0;
constexpr double MaxHeight = 6500.0;
constexpr double ArrivalAltitude = 650000.0;
constexpr int GeneratorVersion = 2;
constexpr uint32_t Seed = 0x4d494153u;  // independent of Aeon's seed

struct Atmosphere { double height, planeHeight, seaLevelDensity, scaleHeight, mieScaleHeight; double betaR[3], betaM[3]; double g, gain; };
constexpr Atmosphere AtmosphereParams = {18000, 6500, .065, 2800, 1400, {3.0e-6, 4.2e-6, 1.2e-6}, {8e-6, 10e-6, 2.8e-6}, .68, 8};

// MIASMA_RESOURCE_IDS order: sulphur, silicate, copper.
enum class ResourceId : uint8_t { Sulphur = 0, Silicate, Copper };
constexpr double ResourcePalette[3][3] = {{.62, .51, .13}, {.18, .21, .12}, {.026, .12, .095}};

struct Site { const char* name; double direction[3]; double radius, depth; };
constexpr int SiteCount = 4;
const Site* Sites();

enum class Region : uint8_t { SulphurUplands = 0, VitriolBasin, ThePaleEye, VerdigrisSea, BrimstoneCrown };  // 1 + site index
const char* RegionName(Region region);

struct Sample {
  double height;      // metres above the reference sphere, rock relief included
  double rockRelief;
  double color[3];    // linear RGB
  double sulphur;
  double basin;       // reported as `fresh` by the JavaScript sample
  Region region;
  Resource::Profile resources;  // weights in ResourceId order; dominant index
  bool exact;         // no rock outcrop contributed (see AeonSurface.h on residuals)
};

// miasmaSurface(x, y, z). `activity` and `oxide` are always 0 and omitted.
Sample Surface(double x, double y, double z);

// MIASMA_POSITION for a given Pyre frame (Aeon-centred metres).
void Position(const Pyre::Frame& pyreFrame, double out[3]);

// Cross-check aid: offset the `ridge ** 6` result by this many ulps. V8's pow
// differs from any libm on this machine in the last bit for a few percent of
// inputs; the cross-check uses this to prove a mismatch is that and nothing else.
void SetPowUlpAdjustForTesting(int ulps);

}} // namespace StarAgent::Miasma
