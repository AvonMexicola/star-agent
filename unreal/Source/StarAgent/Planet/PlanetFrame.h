// Frame conversion between the browser/glTF world frame and Unreal.
//
// Browser and glTF: metres, Y up, right-handed (Three.js). Unreal: centimetres,
// Z up, left-handed. Interchange's glTF importer maps (X, Y, Z) -> (X, Z, Y)
// (GLTFCore ConversionUtilities.h), so the same swap here keeps imported ships
// and stations in the frame the terrain samplers use. The swap is a reflection:
// triangle winding flips, which PlanetPatchMesh corrects per triangle.
#pragma once
#include "CoreMinimal.h"

namespace StarAgent {

inline FVector ToUnreal(double x, double y, double z) { return FVector(x * 100.0, z * 100.0, y * 100.0); }
inline FVector ToUnreal(const double v[3]) { return ToUnreal(v[0], v[1], v[2]); }
inline FVector ToUnrealDirection(double x, double y, double z) { return FVector(x, z, y); }
inline FVector ToUnrealDirection(const double v[3]) { return ToUnrealDirection(v[0], v[1], v[2]); }
inline void FromUnreal(const FVector& v, double out[3]) { out[0] = v.X / 100.0; out[1] = v.Z / 100.0; out[2] = v.Y / 100.0; }
inline void FromUnrealDirection(const FVector& v, double out[3]) { out[0] = v.X; out[1] = v.Z; out[2] = v.Y; }

} // namespace StarAgent
