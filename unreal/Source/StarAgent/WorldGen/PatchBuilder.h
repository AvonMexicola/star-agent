// Aeon terrain patch builder — C++ port of world.js generatePatch (without the
// optional surface-detail halo, which the Unreal material replaces).
//
// Engine-free: produces the same buffers the browser worker transfers, with the
// same float32 rounding, so unreal/tools/patch-crosscheck.cpp can compare them
// against the JavaScript output. The Unreal side converts these metres into a
// centimetre FDynamicMesh3 whose component sits at `center`.
#pragma once
#include <cstdint>
#include <vector>
#include "AeonSurface.h"

namespace StarAgent { namespace Aeon {

struct PatchRequest {
  int face = 0, level = 0, ix = 0, iy = 0;
  int grid = 16;        // terrain-resolution.js terrainGridForLevel(level)
  int parentGrid = 16;  // terrainGridForLevel(max(0, level-1))
  uint32_t seed = DefaultSeed;
};

// terrain-resolution.js
inline int TerrainGridForLevel(int level) { return level >= 4 && level <= 13 ? 32 : 16; }

struct PatchBuffers {
  double center[3];   // double-precision patch centre on the base sphere, metres
  int vertexCount;    // (grid+1)^2 grid vertices followed by 4*(grid+1) skirt vertices
  // Fine geometry, float32, patch-local metres.
  std::vector<float> positions, normals, colors, directions, waterPositions;  // 3 per vertex
  std::vector<float> heights, rockReliefs;                                     // 1 per vertex
  // Where each vertex starts on the parent's triangles, for the LOD morph.
  std::vector<float> parentPositions, parentWaterPositions, parentNormals, parentColors;
  std::vector<float> parentHeights;
  std::vector<uint16_t> indices;
};

// Deterministic and pure; safe to call from any thread.
void BuildPatch(const PatchRequest& request, PatchBuffers& out);

}} // namespace StarAgent::Aeon
