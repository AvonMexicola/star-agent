// Orbital albedo bake: a latitude/longitude map of surfaceColor() so distant
// patches, whose vertices are tens of kilometres apart, still show the real
// coastlines, forests and ice. Same role as the browser's 1024x512 bake.
//
// Row j is latitude 90 - 180*(j+0.5)/H, column i is longitude
// -180 + 360*(i+0.5)/W, in the browser frame (y up), so the material samples
// u = lon/360 + 0.5, v = 0.5 - lat/180 from the per-vertex unit direction.
#pragma once
#include "CoreMinimal.h"

class UTexture2D;

namespace StarAgent {

// Fills BGRA8 sRGB-encoded pixels for mip 0. Parallel over rows; ~1-2 s for
// 2048x1024 on 16 threads. Safe on a worker thread.
// Albedo: rgb = surfaceColor (sRGB), a = moisture. Fields (linear): r = colour
// noise, g = scree noise, b = 0. Both feed the per-pixel surface material.
void BakeAeonAlbedo(uint32 Seed, int32 Width, int32 Height, TArray<uint8>& OutAlbedoBgra, TArray<uint8>& OutFieldsBgra);

// Game thread only: builds a transient sRGB texture with a box-filtered mip chain.
UTexture2D* CreateAlbedoTexture(int32 Width, int32 Height, const TArray<uint8>& Bgra, const FName& Name, bool bSRGB);

} // namespace StarAgent
