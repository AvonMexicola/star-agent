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
static constexpr int32 GROUND_PER_CELL = 96;

int32 FVegetationLayer::EffectiveLevel() const
{
	if (MinLevel > 0) return MinLevel;
	return Kind == EVegetationKind::Tree ? 12 : Kind == EVegetationKind::Shrub ? 13 : 15;
}
float FVegetationLayer::EffectiveCullMetres() const
{
	if (CullMetres > 0) return CullMetres;
	return Kind == EVegetationKind::Tree ? 2500.f : Kind == EVegetationKind::Shrub ? 800.f : 220.f;
}

FVegetationLayerRule MakeRule(const FVegetationLayer& L)
{
	FVegetationLayerRule R;
	R.Kind = static_cast<int32>(L.Kind); R.Biomes = L.Biomes; R.MeshCount = L.MeshCount(); R.MinLevel = L.EffectiveLevel();
	R.Density = L.Density; R.ScaleMin = L.ScaleMin; R.ScaleMax = L.ScaleMax; R.MinHeight = L.MinHeightMetres; R.MaxHeight = L.MaxHeightMetres; R.MaxSlope = L.MaxSlopeRadians;
	return R;
}

static FTransform PlaceOnSurface(const double Dir[3], double Height, const double PatchCenter[3], double YawDeg, double Scale)
{
	double P[3];
	for (int a = 0; a < 3; a++) P[a] = Dir[a] * (Aeon::Radius + Height) - PatchCenter[a];
	const FVector Up = ToUnrealDirection(Dir);
	FQuat Q = FQuat(FRotationMatrix::MakeFromZ(Up)) * FQuat(FVector::UpVector, FMath::DegreesToRadians(YawDeg));
	return FTransform(Q, ToUnreal(P), FVector(Scale));
}

static int32 BiomeFlags(double H, double M, double AbsY)
{
	if (H < 2.0 || AbsY > 0.86) return 0;
	int32 F = 0;
	if (H < 85.0) F |= static_cast<int32>(EVegetationBiome::Coast);
	else if (H < 2200.0) F |= static_cast<int32>(M > 0.46 ? EVegetationBiome::Forest : EVegetationBiome::Grassland);
	if (H >= 1600.0 && H < 2600.0) F |= static_cast<int32>(EVegetationBiome::Alpine);
	if (AbsY > 0.70 && H < 2600.0) F |= static_cast<int32>(EVegetationBiome::Tundra);
	if (M < 0.30) F |= static_cast<int32>(EVegetationBiome::Dry);
	if (M > 0.60) F |= static_cast<int32>(EVegetationBiome::Wet);
	return F;
}

void ScatterPatchVegetation(const Aeon::PatchRequest& R, const double PatchCenter[3], const TArray<FVegetationLayerRule>& Rules, FVegetationInstances& Out)
{
	Out.Instances.SetNum(Rules.Num());
	for (int32 i = 0; i < Rules.Num(); i++) { Out.Instances[i].SetNum(FMath::Max(1, Rules[i].MeshCount)); for (auto& a : Out.Instances[i]) a.Reset(); }
	if (R.level > CELL_LEVEL) return;
	bool bAny = false;
	for (const FVegetationLayerRule& Rule : Rules) if (Rule.MeshCount > 0 && R.level >= Rule.MinLevel) bAny = true;
	if (!bAny) return;

	const int32 CellsPerAxis = 1 << (CELL_LEVEL - R.level);
	const double CellSize = 2.0 / (1 << CELL_LEVEL);
	const uint32 Seed = R.seed;

	for (int32 cy = 0; cy < CellsPerAxis; cy++) for (int32 cx = 0; cx < CellsPerAxis; cx++)
	{
		const double CellX = static_cast<double>(R.ix) * CellsPerAxis + cx, CellY = static_cast<double>(R.iy) * CellsPerAxis + cy;
		const double FaceSalt = R.face * 1000003.0;
		double D[3];
		Aeon::CubeDirection(R.face, -1 + (CellX + .5) * CellSize, -1 + (CellY + .5) * CellSize, D);
		const double H = Aeon::TerrainHeight(D[0], D[1], D[2], Seed);
		const double M = Aeon::Moisture(D[0], D[1], D[2], Seed);
		const int32 Flags = BiomeFlags(H, M, FMath::Abs(D[1]));
		if (Flags == 0) continue;

		for (int32 li = 0; li < Rules.Num(); li++)
		{
			const FVegetationLayerRule& Rule = Rules[li];
			if (Rule.MeshCount == 0 || R.level < Rule.MinLevel || (Rule.Biomes & Flags) == 0) continue;
			const uint32 LayerSeed = Seed ^ (0x7ee5u + 977u * li);
			const bool bGround = Rule.Kind == 2;
			const int32 Candidates = bGround ? FMath::Clamp(FMath::RoundToInt(GROUND_PER_CELL * Rule.Density), 0, 512) : (Rule.Kind == 1 ? 2 : 1);
			for (int32 k = 0; k < Candidates; k++)
			{
				const double Salt = FaceSalt + 10.0 + k * 7.0;
				if (!bGround && Aeon::Hash(CellX, CellY, Salt, LayerSeed) >= Rule.Density) continue;
				const double U = -1 + (CellX + Aeon::Hash(CellX, CellY, Salt + 1, LayerSeed)) * CellSize;
				const double V = -1 + (CellY + Aeon::Hash(CellX, CellY, Salt + 2, LayerSeed)) * CellSize;
				double PD[3];
				Aeon::CubeDirection(R.face, U, V, PD);
				const double PH = Aeon::TerrainHeight(PD[0], PD[1], PD[2], Seed);
				if (PH < Rule.MinHeight || PH > Rule.MaxHeight) continue;
				if (!bGround && Aeon::SlopeAt(PD[0], PD[1], PD[2], PH, Seed) > Rule.MaxSlope) continue;
				const double Yaw = 360.0 * Aeon::Hash(CellX, CellY, Salt + 3, LayerSeed);
				const double Scale = Rule.ScaleMin + (Rule.ScaleMax - Rule.ScaleMin) * Aeon::Hash(CellX, CellY, Salt + 4, LayerSeed);
				const int32 Mesh = FMath::Min(Rule.MeshCount - 1, static_cast<int32>(Aeon::Hash(CellX, CellY, Salt + 5, LayerSeed) * Rule.MeshCount));
				Out.Instances[li][Mesh].Add(PlaceOnSurface(PD, PH, PatchCenter, Yaw, Scale));
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
