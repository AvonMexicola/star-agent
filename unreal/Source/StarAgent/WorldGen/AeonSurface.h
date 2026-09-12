// Aeon surface function — C++ port of src/world.js + src/terrain-v2.js +
// src/rock-formations.js (terrain generator version 3).
//
// Engine-free on purpose: only <cstdint>. The same two files compile inside the
// Unreal module and in tools/aeon-crosscheck.cpp, which checks them against the
// JavaScript output. Keep the arithmetic order identical to the JavaScript; the
// integer-hash value noise then reproduces bit-for-bit (see tools/README).
//
// Units: directions are unit vectors in the Aeon body frame (Y up, same axes as
// the browser game). Heights are METRES above the reference sphere. Unreal works
// in centimetres; convert at the mesh/actor boundary, never inside this file.
#pragma once
#include <cstdint>

#if defined(__clang__)
// Contracted a*b+c changes the last bit and breaks seed compatibility with the
// browser build. Unreal's Linux toolchain is clang; keep this pragma.
#pragma clang fp contract(off)
#endif

namespace StarAgent { namespace Aeon {

// src/world.js constants (metres).
constexpr double Radius = 6371000.0 / 4.0;      // 1,592,750 m
constexpr double AtmosphereHeight = 70000.0;
constexpr double SunDistance = 25000000000.0;
constexpr double SunRadius = 240000000.0;
constexpr int MaxLevel = 17;
constexpr int Grid = 16;

// src/generation.js
constexpr uint32_t DefaultSeed = 7291u;
constexpr int GeneratorVersion = 3;
// src/terrain-v2.js
constexpr int TerrainVersion = 3;

struct Sample {
  double height;      // metres above sea level, including rock relief
  double rockRelief;  // exposed outcrop contribution already included in height
};

// Order matches the strings returned by terrain-v2.js biomeAt.
enum class Biome : uint8_t { PolarIce = 0, OpenOcean, Coastland, AlpineHighlands, TemperateForest, Grassland };
const char* BiomeName(Biome biome);

// world.js cubeDirection(face,u,v): u,v in [-1,1], six faces, unit vector out.
void CubeDirection(int face, double u, double v, double out[3]);
// world.js latLonDirection(latDeg, lonDeg).
void LatLonDirection(double latDeg, double lonDeg, double out[3]);

// terrain-v2.js terrainSample / terrainHeight. Deterministic and pure.
Sample TerrainSample(double x, double y, double z, uint32_t seed = DefaultSeed);
double TerrainHeight(double x, double y, double z, uint32_t seed = DefaultSeed);

// terrain-v2.js moisture (0..1), biomeAt, slopeAt (radians), surfaceColor (linear RGB 0..1).
double Moisture(double x, double y, double z, uint32_t seed = DefaultSeed);
Biome BiomeAt(double x, double y, double z, double height, uint32_t seed = DefaultSeed);
double SlopeAt(double x, double y, double z, double height, uint32_t seed = DefaultSeed, double step = 9.0);
void SurfaceColor(double x, double y, double z, double height, double slope, uint32_t seed, double outRgb[3]);
// The low-frequency inputs of SurfaceColor (moisture, colour noise, scree noise),
// so a material can evaluate the colour per pixel from baked maps.
void SurfaceFields(double x, double y, double z, uint32_t seed, double& moisture, double& noise, double& fine);

// world.js building blocks, exported for other body generators and tests.
double Hash(double x, double y, double z, uint32_t seed);
double Noise(double x, double y, double z, uint32_t seed);
double Fbm(double x, double y, double z, int octaves, uint32_t seed);
double Smoothstep(double a, double b, double x);
double Clamp(double x, double a, double b);

// rock-formations.js rockFormationHeight(x,y,z,radius,seed).
double RockFormationHeight(double x, double y, double z, double radius, uint32_t seed);

}} // namespace StarAgent::Aeon
