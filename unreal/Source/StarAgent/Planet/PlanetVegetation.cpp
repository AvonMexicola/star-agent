#include "PlanetVegetation.h"
#include "AeonSurface.h"
#include "PlanetFrame.h"
#include "DynamicMesh/DynamicMesh3.h"
#include "DynamicMesh/DynamicMeshAttributeSet.h"
#include "DynamicMesh/DynamicMeshOverlay.h"
#include "DynamicMeshToMeshDescription.h"
#include "Engine/StaticMesh.h"
#include "Materials/MaterialInterface.h"
#include "MeshDescription.h"
#include "StaticMeshAttributes.h"

using namespace UE::Geometry;

namespace StarAgent {

// ---------------------------------------------------------------- scatter

static constexpr int32 CELL_LEVEL = 17;

static FTransform PlaceOnSurface(const double Dir[3], double Height, const double PatchCenter[3], double YawDeg, double Scale)
{
	double P[3];
	for (int a = 0; a < 3; a++) P[a] = Dir[a] * (Aeon::Radius + Height) - PatchCenter[a];
	const FVector Up = ToUnrealDirection(Dir);
	FQuat Q = FQuat(FRotationMatrix::MakeFromZ(Up)) * FQuat(FVector::UpVector, FMath::DegreesToRadians(YawDeg));
	return FTransform(Q, ToUnreal(P), FVector(Scale));
}

void ScatterPatchVegetation(const Aeon::PatchRequest& R, const double PatchCenter[3], const FVegetationRules& Rules, FVegetationInstances& Out)
{
	Out.Trees.SetNum(FMath::Max(1, Rules.TreeSpecies)); Out.Grass.SetNum(FMath::Max(1, Rules.GrassSpecies));
	for (auto& a : Out.Trees) a.Reset();
	for (auto& a : Out.Grass) a.Reset();
	const bool bTrees = R.level >= Rules.TreeLevel, bGrass = R.level >= Rules.GrassLevel;
	if (!bTrees && !bGrass) return;
	if (R.level > CELL_LEVEL) return;
	const int32 CellsPerAxis = 1 << (CELL_LEVEL - R.level);
	const double CellSize = 2.0 / (1 << CELL_LEVEL);
	const uint32 Seed = R.seed;
	const int32 GrassCount = FMath::Clamp(FMath::RoundToInt(Rules.GrassPerCell * Rules.GrassDensity), 0, 512);

	for (int32 cy = 0; cy < CellsPerAxis; cy++) for (int32 cx = 0; cx < CellsPerAxis; cx++)
	{
		const double CellX = static_cast<double>(R.ix) * CellsPerAxis + cx, CellY = static_cast<double>(R.iy) * CellsPerAxis + cy;
		const double FaceSalt = R.face * 1000003.0;
		// Cell centre decides the biome for everything in the cell (cheap).
		double D[3];
		Aeon::CubeDirection(R.face, -1 + (CellX + .5) * CellSize, -1 + (CellY + .5) * CellSize, D);
		const double H = Aeon::TerrainHeight(D[0], D[1], D[2], Seed);
		if (H < 2.0 || H > 2200.0 || FMath::Abs(D[1]) > 0.86) continue;
		const double M = Aeon::Moisture(D[0], D[1], D[2], Seed);

		if (bTrees)
		{
			double P = 0.0;
			if (H >= 85.0) P = M > 0.46 ? 0.7 : 0.06;          // temperate forest / grassland
			else if (H >= 4.0) P = M > 0.40 ? 0.25 : 0.05;     // coastland
			P *= Rules.TreeDensity;
			if (Aeon::Hash(CellX, CellY, FaceSalt + 1, Seed ^ 0x7ee5u) < P)
			{
				const double U = -1 + (CellX + 0.15 + 0.7 * Aeon::Hash(CellX, CellY, FaceSalt + 2, Seed ^ 0x7ee5u)) * CellSize;
				const double V = -1 + (CellY + 0.15 + 0.7 * Aeon::Hash(CellX, CellY, FaceSalt + 3, Seed ^ 0x7ee5u)) * CellSize;
				double TD[3];
				Aeon::CubeDirection(R.face, U, V, TD);
				const double TH = Aeon::TerrainHeight(TD[0], TD[1], TD[2], Seed);
				const double Slope = Aeon::SlopeAt(TD[0], TD[1], TD[2], TH, Seed);
				if (TH > 3.0 && Slope < 0.5)
				{
					const double Yaw = 360.0 * Aeon::Hash(CellX, CellY, FaceSalt + 4, Seed ^ 0x7ee5u);
					const double Scale = (0.8 + 0.6 * Aeon::Hash(CellX, CellY, FaceSalt + 5, Seed ^ 0x7ee5u)) * Rules.TreeScale;
					const int32 Species = FMath::Min(Out.Trees.Num() - 1, static_cast<int32>(Aeon::Hash(CellX, CellY, FaceSalt + 6, Seed ^ 0x7ee5u) * Out.Trees.Num()));
					Out.Trees[Species].Add(PlaceOnSurface(TD, TH, PatchCenter, Yaw, Scale));
				}
			}
		}

		if (bGrass && M > 0.25)
		{
			const int32 Count = FMath::RoundToInt(GrassCount * FMath::Clamp((M - 0.2) * 1.6, 0.2, 1.0));
			for (int32 k = 0; k < Count; k++)
			{
				const double Salt = FaceSalt + 100 + k * 7.0;
				const double U = -1 + (CellX + Aeon::Hash(CellX, CellY, Salt, Seed ^ 0x6a55u)) * CellSize;
				const double V = -1 + (CellY + Aeon::Hash(CellX, CellY, Salt + 1, Seed ^ 0x6a55u)) * CellSize;
				double GD[3];
				Aeon::CubeDirection(R.face, U, V, GD);
				const double GH = Aeon::TerrainHeight(GD[0], GD[1], GD[2], Seed);
				if (GH < 2.5) continue;
				const double Yaw = 360.0 * Aeon::Hash(CellX, CellY, Salt + 2, Seed ^ 0x6a55u);
				const double Scale = (0.7 + 0.6 * Aeon::Hash(CellX, CellY, Salt + 3, Seed ^ 0x6a55u)) * Rules.GrassScale;
				const int32 Species = FMath::Min(Out.Grass.Num() - 1, static_cast<int32>(Aeon::Hash(CellX, CellY, Salt + 4, Seed ^ 0x6a55u) * Out.Grass.Num()));
				Out.Grass[Species].Add(PlaceOnSurface(GD, GH, PatchCenter, Yaw, Scale));
			}
		}
	}
}

// ---------------------------------------------------------- placeholder meshes

namespace {

struct FMeshBuild
{
	FDynamicMesh3 Mesh;
	FDynamicMeshNormalOverlay* Normals = nullptr;
	FDynamicMeshColorOverlay* Colors = nullptr;
	FDynamicMeshUVOverlay* UVs = nullptr;
	FMeshBuild()
	{
		Mesh.EnableAttributes();
		Mesh.Attributes()->EnablePrimaryColors();
		Mesh.Attributes()->SetNumUVLayers(1);
		Normals = Mesh.Attributes()->PrimaryNormals();
		Colors = Mesh.Attributes()->PrimaryColors();
		UVs = Mesh.Attributes()->GetUVLayer(0);
	}
	int32 Vertex(const FVector3d& P, const FVector3f& N, const FVector3f& C, const FVector2f& UV)
	{
		const int32 V = Mesh.AppendVertex(P);
		Normals->AppendElement(N); Colors->AppendElement(FVector4f(C.X, C.Y, C.Z, 1.f)); UVs->AppendElement(UV);
		return V;
	}
	void Triangle(int32 A, int32 B, int32 C)
	{
		// Unreal front face: reversed cross product, see PlanetPatchMesh.cpp.
		const FIndex3i Tri(A, B, C);
		const int32 Tid = Mesh.AppendTriangle(Tri);
		if (Tid < 0) return;
		Normals->SetTriangle(Tid, Tri); Colors->SetTriangle(Tid, Tri); UVs->SetTriangle(Tid, Tri);
	}
	// Revolve a profile of (radius, height) pairs (cm) around Z, colour per ring.
	void Lathe(const TArray<FVector2D>& Profile, const TArray<FVector3f>& RingColors, int32 Segments)
	{
		TArray<int32> Rings;
		for (int32 i = 0; i < Profile.Num(); i++)
		{
			const FVector2D Prev = Profile[FMath::Max(0, i - 1)], Next = Profile[FMath::Min(Profile.Num() - 1, i + 1)];
			const FVector2D Tangent = (Next - Prev).GetSafeNormal();
			for (int32 s = 0; s < Segments; s++)
			{
				const double Angle = 2 * PI * s / Segments;
				const double Cs = FMath::Cos(Angle), Sn = FMath::Sin(Angle);
				const FVector3d P(Profile[i].X * Cs, Profile[i].Y * 0 + Profile[i].X * Sn, Profile[i].Y);
				FVector3f N(static_cast<float>(Tangent.Y * Cs), static_cast<float>(Tangent.Y * Sn), static_cast<float>(-Tangent.X));
				if (N.IsNearlyZero()) N = FVector3f(0, 0, 1);
				Rings.Add(Vertex(P, N.GetSafeNormal(), RingColors[i], FVector2f(static_cast<float>(s) / Segments, static_cast<float>(i) / (Profile.Num() - 1))));
			}
		}
		for (int32 i = 0; i + 1 < Profile.Num(); i++) for (int32 s = 0; s < Segments; s++)
		{
			const int32 A = Rings[i * Segments + s], B = Rings[i * Segments + (s + 1) % Segments];
			const int32 C = Rings[(i + 1) * Segments + s], D = Rings[(i + 1) * Segments + (s + 1) % Segments];
			// Outward faces in Unreal's left-handed convention.
			Triangle(A, C, B); Triangle(B, C, D);
		}
	}
	UStaticMesh* ToStaticMesh(UObject* Outer, UMaterialInterface* Material, const TCHAR* Name)
	{
		FMeshDescription MD;
		FStaticMeshAttributes Attributes(MD);
		Attributes.Register();
		FDynamicMeshToMeshDescription Converter;
		Converter.Convert(&Mesh, MD, false);
		UStaticMesh* SM = NewObject<UStaticMesh>(Outer, Name, RF_Transient);
		SM->GetStaticMaterials().Add(FStaticMaterial(Material));
		UStaticMesh::FBuildMeshDescriptionsParams Params;
		Params.bBuildSimpleCollision = false;
		Params.bFastBuild = true;
		Params.bAllowCpuAccess = false;
		SM->BuildFromMeshDescriptions({ &MD }, Params);
		return SM;
	}
};

} // namespace

UStaticMesh* BuildPlaceholderTreeMesh(UObject* Outer, UMaterialInterface* Material)
{
	FMeshBuild B;
	const FVector3f Bark(0.22f, 0.15f, 0.09f), BarkTop(0.28f, 0.2f, 0.12f);
	B.Lathe({ FVector2D(28, 0), FVector2D(22, 120), FVector2D(16, 300), FVector2D(10, 520) }, { Bark, Bark, BarkTop, BarkTop }, 10);
	const FVector3f Leaf(0.05f, 0.14f, 0.045f), LeafLight(0.09f, 0.2f, 0.06f);
	// Three stacked, slightly offset canopy lobes read as a conifer from afar.
	B.Lathe({ FVector2D(0, 250), FVector2D(300, 330), FVector2D(220, 520), FVector2D(0, 560) }, { Leaf, Leaf, LeafLight, LeafLight }, 12);
	B.Lathe({ FVector2D(0, 480), FVector2D(230, 560), FVector2D(160, 760), FVector2D(0, 800) }, { Leaf, Leaf, LeafLight, LeafLight }, 12);
	B.Lathe({ FVector2D(0, 720), FVector2D(150, 800), FVector2D(90, 960), FVector2D(0, 1040) }, { Leaf, LeafLight, LeafLight, LeafLight }, 10);
	return B.ToStaticMesh(Outer, Material, TEXT("PlaceholderTree"));
}

UStaticMesh* BuildPlaceholderGrassMesh(UObject* Outer, UMaterialInterface* Material)
{
	FMeshBuild B;
	const FVector3f Base(0.16f, 0.24f, 0.06f), Tip(0.34f, 0.42f, 0.12f);
	// Six leaning blades, each one triangle, 45-60 cm tall.
	for (int32 i = 0; i < 6; i++)
	{
		const double Angle = 2 * PI * i / 6 + 0.4, Lean = 0.35 + 0.1 * (i % 3);
		const FVector3d Root(6 * FMath::Cos(Angle), 6 * FMath::Sin(Angle), 0);
		const FVector3d Side(-FMath::Sin(Angle) * 2.5, FMath::Cos(Angle) * 2.5, 0);
		const FVector3d TipP = Root + FVector3d(FMath::Cos(Angle) * Lean * 30, FMath::Sin(Angle) * Lean * 30, 45 + 5 * (i % 4));
		const FVector3f N(static_cast<float>(FMath::Cos(Angle)), static_cast<float>(FMath::Sin(Angle)), 0.5f);
		const int32 A = B.Vertex(Root - Side, N.GetSafeNormal(), Base, FVector2f(0, 0));
		const int32 Bv = B.Vertex(Root + Side, N.GetSafeNormal(), Base, FVector2f(1, 0));
		const int32 C = B.Vertex(TipP, N.GetSafeNormal(), Tip, FVector2f(0.5f, 1));
		B.Triangle(A, Bv, C);
	}
	return B.ToStaticMesh(Outer, Material, TEXT("PlaceholderGrass"));
}

} // namespace StarAgent
