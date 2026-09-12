#include "PlanetPatchMesh.h"
#include "PlanetFrame.h"
#include "DynamicMesh/DynamicMeshAttributeSet.h"
#include "DynamicMesh/DynamicMeshOverlay.h"
#include <cmath>

using namespace UE::Geometry;

namespace StarAgent {

void BuildPatchDynamicMesh(const Aeon::PatchBuffers& B, FDynamicMesh3& M)
{
	M.Clear();
	M.EnableAttributes();
	M.Attributes()->EnablePrimaryColors();
	// UV0 = (terrain height m, rock relief m); UV1/UV2 = unit direction in the
	// browser frame (x, y | z, 0) for the lat/long albedo lookup in the material.
	// UV3..UV7 = where this vertex sits on the PARENT patch's surface, for the
	// 0.6 s geomorph after a split (terrain-lod.js): UV3/UV4.x = parent offset
	// (cm, Unreal frame), UV4.y/UV5 = parent normal (Unreal frame),
	// UV6/UV7.x = parent linear colour. All eight layers are full float.
	M.Attributes()->SetNumUVLayers(8);
	FDynamicMeshNormalOverlay* Normals = M.Attributes()->PrimaryNormals();
	FDynamicMeshColorOverlay* Colors = M.Attributes()->PrimaryColors();
	FDynamicMeshUVOverlay* UV[8];
	for (int32 Layer = 0; Layer < 8; Layer++) UV[Layer] = M.Attributes()->GetUVLayer(Layer);
	FDynamicMeshUVOverlay* UV0 = UV[0];
	FDynamicMeshUVOverlay* UV1 = UV[1];
	FDynamicMeshUVOverlay* UV2 = UV[2];

	const int32 Count = B.vertexCount;
	TArray<FVector3f> VertexNormals;
	VertexNormals.Reserve(Count);
	for (int32 v = 0; v < Count; v++)
	{
		const int32 k = v * 3;
		M.AppendVertex(FVector3d(ToUnreal(B.positions[k], B.positions[k + 1], B.positions[k + 2])));
		const FVector3f N(ToUnrealDirection(B.normals[k], B.normals[k + 1], B.normals[k + 2]));
		VertexNormals.Add(N);
		Normals->AppendElement(N);
		Colors->AppendElement(FVector4f(B.colors[k], B.colors[k + 1], B.colors[k + 2], 1.0f));
		UV0->AppendElement(FVector2f(B.heights[v], B.rockReliefs[v]));
		UV1->AppendElement(FVector2f(B.directions[k], B.directions[k + 1]));
		UV2->AppendElement(FVector2f(B.directions[k + 2], 0.0f));
		const FVector ParentOffset = ToUnreal(B.parentPositions[k], B.parentPositions[k + 1], B.parentPositions[k + 2]) - ToUnreal(B.positions[k], B.positions[k + 1], B.positions[k + 2]);
		const FVector ParentNormal = ToUnrealDirection(B.parentNormals[k], B.parentNormals[k + 1], B.parentNormals[k + 2]);
		UV[3]->AppendElement(FVector2f(static_cast<float>(ParentOffset.X), static_cast<float>(ParentOffset.Y)));
		UV[4]->AppendElement(FVector2f(static_cast<float>(ParentOffset.Z), static_cast<float>(ParentNormal.X)));
		UV[5]->AppendElement(FVector2f(static_cast<float>(ParentNormal.Y), static_cast<float>(ParentNormal.Z)));
		UV[6]->AppendElement(FVector2f(B.parentColors[k], B.parentColors[k + 1]));
		UV[7]->AppendElement(FVector2f(B.parentColors[k + 2], 0.0f));
	}

	for (size_t t = 0; t + 2 < B.indices.size(); t += 3)
	{
		int32 i0 = B.indices[t], i1 = B.indices[t + 1], i2 = B.indices[t + 2];
		// The Y/Z swap is a reflection, so the browser's outward winding may now
		// face inward. Decide per triangle from the geometry itself: the face
		// normal must agree with the vertex normals. Unreal's front-face normal is
		// the REVERSED cross product, (P2-P0) x (P1-P0), because its coordinate
		// system is left-handed (GeometryCore VectorUtil::Normal).
		const FVector3d P0 = M.GetVertex(i0), P1 = M.GetVertex(i1), P2 = M.GetVertex(i2);
		const FVector3d FaceNormal = (P2 - P0).Cross(P1 - P0);
		const FVector3f Outward = VertexNormals[i0] + VertexNormals[i1] + VertexNormals[i2];
		if (FaceNormal.Dot(FVector3d(Outward)) < 0.0)
		{
			Swap(i1, i2);
		}
		const FIndex3i Tri(i0, i1, i2);
		const int32 Tid = M.AppendTriangle(Tri);
		if (Tid < 0)
		{
			continue;  // degenerate or non-manifold; skirts can produce a few at cube corners
		}
		Normals->SetTriangle(Tid, Tri);
		Colors->SetTriangle(Tid, Tri);
		for (int32 Layer = 0; Layer < 8; Layer++) UV[Layer]->SetTriangle(Tid, Tri);
	}
}

bool PatchNeedsWater(const Aeon::PatchBuffers& B)
{
	for (float h : B.heights) if (h < 50.f) return true;
	for (float h : B.parentHeights) if (h < 50.f) return true;
	return false;
}

void BuildWaterDynamicMesh(const Aeon::PatchBuffers& B, FDynamicMesh3& M)
{
	M.Clear();
	M.EnableAttributes();
	M.Attributes()->SetNumUVLayers(7);
	FDynamicMeshNormalOverlay* Normals = M.Attributes()->PrimaryNormals();
	FDynamicMeshUVOverlay* UV[7];
	for (int32 Layer = 0; Layer < 7; Layer++) UV[Layer] = M.Attributes()->GetUVLayer(Layer);

	// Whole 256 m periods of the patch centre are discarded in doubles, as in
	// planet.js, so the wave pattern does not crawl when the origin moves.
	double Stable[3];
	for (int a = 0; a < 3; a++) Stable[a] = std::fmod(std::fmod(B.center[a], 256.0) + 256.0, 256.0);

	const int32 Count = B.vertexCount;
	TArray<FVector3f> VertexNormals;
	VertexNormals.Reserve(Count);
	for (int32 v = 0; v < Count; v++)
	{
		const int32 k = v * 3;
		M.AppendVertex(FVector3d(ToUnreal(B.waterPositions[k], B.waterPositions[k + 1], B.waterPositions[k + 2])));
		const FVector3f N(ToUnrealDirection(B.directions[k], B.directions[k + 1], B.directions[k + 2]));
		VertexNormals.Add(N);
		Normals->AppendElement(N);
		UV[0]->AppendElement(FVector2f(B.heights[v], B.parentHeights[v]));
		UV[1]->AppendElement(FVector2f(B.directions[k], B.directions[k + 1]));
		UV[2]->AppendElement(FVector2f(B.directions[k + 2], 0.0f));
		const FVector ParentOffset = ToUnreal(B.parentWaterPositions[k], B.parentWaterPositions[k + 1], B.parentWaterPositions[k + 2]) - ToUnreal(B.waterPositions[k], B.waterPositions[k + 1], B.waterPositions[k + 2]);
		UV[3]->AppendElement(FVector2f(static_cast<float>(ParentOffset.X), static_cast<float>(ParentOffset.Y)));
		UV[4]->AppendElement(FVector2f(static_cast<float>(ParentOffset.Z), 0.0f));
		UV[5]->AppendElement(FVector2f(static_cast<float>(B.waterPositions[k] + Stable[0]), static_cast<float>(B.waterPositions[k + 1] + Stable[1])));
		UV[6]->AppendElement(FVector2f(static_cast<float>(B.waterPositions[k + 2] + Stable[2]), 0.0f));
	}
	for (size_t t = 0; t + 2 < B.indices.size(); t += 3)
	{
		int32 i0 = B.indices[t], i1 = B.indices[t + 1], i2 = B.indices[t + 2];
		const FVector3d P0 = M.GetVertex(i0), P1 = M.GetVertex(i1), P2 = M.GetVertex(i2);
		const FVector3d FaceNormal = (P2 - P0).Cross(P1 - P0);
		const FVector3f Outward = VertexNormals[i0] + VertexNormals[i1] + VertexNormals[i2];
		if (FaceNormal.Dot(FVector3d(Outward)) < 0.0) Swap(i1, i2);
		const FIndex3i Tri(i0, i1, i2);
		const int32 Tid = M.AppendTriangle(Tri);
		if (Tid < 0) continue;
		Normals->SetTriangle(Tid, Tri);
		for (int32 Layer = 0; Layer < 7; Layer++) UV[Layer]->SetTriangle(Tid, Tri);
	}
}

} // namespace StarAgent
