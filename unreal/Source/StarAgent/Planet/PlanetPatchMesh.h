// Converts engine-free PatchBuffers (metres, browser frame) into a centimetre
// FDynamicMesh3 in the Unreal frame. Safe to run on a worker thread: it only
// touches the plain FDynamicMesh3 value, never a UObject.
#pragma once
#include "CoreMinimal.h"
#include "DynamicMesh/DynamicMesh3.h"
#include "PatchBuilder.h"

namespace StarAgent {

// Vertex colour = linear albedo. UV0 = (terrain height m, rock relief m) so a
// material can shade by altitude and outcrop exactly as the browser shader did.
// UV1 = (dir.x, dir.y), UV2 = (dir.z, 0): unit direction in the browser frame.
void BuildPatchDynamicMesh(const Aeon::PatchBuffers& Buffers, UE::Geometry::FDynamicMesh3& OutMesh);

// Sea-level surface for the same patch (water.js): positions at radius R with
// skirts, radial normals. UV0 = (terrain height m, parent terrain height m) for
// shore depth, UV1/UV2 = unit direction, UV3/UV4.x = parent sea-level offset
// (cm) for the geomorph, UV5/UV6.x = stable wave coordinates in metres
// (surface position modulo 256 m, continuous across patches and levels).
void BuildWaterDynamicMesh(const Aeon::PatchBuffers& Buffers, UE::Geometry::FDynamicMesh3& OutMesh);

// True when the browser would give this patch a water mesh: any vertex below 50 m.
bool PatchNeedsWater(const Aeon::PatchBuffers& Buffers);

} // namespace StarAgent
