// Biome-driven vegetation layers for terrain patches, and placeholder meshes.
//
// Each layer names a set of meshes (static, or skeletal for Quixel Megaplants
// with Nanite foliage and wind bones), the biomes it grows in, and its density.
// Placement is seeded per level-17 cube cell, so an instance has the same
// position at every LOD level and nothing moves when patches split. Trees
// appear on patches at level 12 (about 2 km from the camera), shrubs at 13,
// ground cover at 15 (about 250 m). The browser lays trees on rows of latitude
// (forest-distribution.js, vegetation.js); this is the same idea on cube cells,
// so groves do not yet match the browser build tree for tree.
#pragma once
#include "CoreMinimal.h"
#include "PatchBuilder.h"
#include "PlanetVegetation.generated.h"

class UStaticMesh;
class USkeletalMesh;
class UMaterialInterface;

UENUM(meta = (Bitflags, UseEnumValuesAsMaskValuesInEditor = "true"))
enum class EVegetationBiome : uint8
{
	None      = 0,
	Coast     = 1 << 0,  // 2..85 m above sea level
	Grassland = 1 << 1,  // 85..2200 m, moisture <= 0.46 (terrain-v2.js biomeAt)
	Forest    = 1 << 2,  // 85..2200 m, moisture > 0.46
	Alpine    = 1 << 3,  // 1600..2600 m
	Tundra    = 1 << 4,  // latitude beyond 44 deg, below the polar ice
	Dry       = 1 << 5,  // moisture < 0.30
	Wet       = 1 << 6,  // moisture > 0.60
};
ENUM_CLASS_FLAGS(EVegetationBiome)

UENUM()
enum class EVegetationKind : uint8
{
	Tree,    // level 12+, 1 candidate per cell, shadows, 2.5 km cull
	Shrub,   // level 13+, 2 candidates per cell, shadows, 800 m cull
	Ground,  // level 15+, many per cell, no shadows, 220 m cull
};

USTRUCT(BlueprintType)
struct FVegetationLayer
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, Category = "Layer")
	FString Name;

	UPROPERTY(EditAnywhere, Category = "Layer")
	EVegetationKind Kind = EVegetationKind::Tree;

	/** Biomes this layer grows in (any match). */
	UPROPERTY(EditAnywhere, Category = "Layer", meta = (Bitmask, BitmaskEnum = "/Script/StarAgent.EVegetationBiome"))
	int32 Biomes = 0;

	/** Variations chosen per instance by the seed. Origin at the base, Z up, real size. */
	UPROPERTY(EditAnywhere, Category = "Layer")
	TArray<TObjectPtr<UStaticMesh>> StaticMeshes;

	/** Skeletal variations (Megaplants), instanced with UInstancedSkinnedMeshComponent. */
	UPROPERTY(EditAnywhere, Category = "Layer")
	TArray<TObjectPtr<USkeletalMesh>> SkeletalMeshes;

	/** Trees/shrubs: probability per candidate. Ground: fraction of 96 tufts per ~24 m cell. */
	UPROPERTY(EditAnywhere, Category = "Layer", meta = (ClampMin = 0, ClampMax = 4))
	float Density = 0.5f;

	UPROPERTY(EditAnywhere, Category = "Layer")
	float ScaleMin = 0.8f;

	UPROPERTY(EditAnywhere, Category = "Layer")
	float ScaleMax = 1.3f;

	UPROPERTY(EditAnywhere, Category = "Layer")
	float MinHeightMetres = 3.f;

	UPROPERTY(EditAnywhere, Category = "Layer")
	float MaxHeightMetres = 2400.f;

	/** Trees and shrubs skip ground steeper than this (radians). */
	UPROPERTY(EditAnywhere, Category = "Layer")
	float MaxSlopeRadians = 0.5f;

	/** 0 = by Kind. */
	UPROPERTY(EditAnywhere, Category = "Layer")
	int32 MinLevel = 0;

	/** 0 = by Kind. Metres. */
	UPROPERTY(EditAnywhere, Category = "Layer")
	float CullMetres = 0.f;

	UPROPERTY(EditAnywhere, Category = "Layer")
	bool bCastShadow = true;

	int32 MeshCount() const { return StaticMeshes.Num() + SkeletalMeshes.Num(); }
	int32 EffectiveLevel() const;
	float EffectiveCullMetres() const;
};

namespace StarAgent {

// Plain snapshot of a layer for worker threads (no UObject access).
struct FVegetationLayerRule
{
	int32 Kind = 0, Biomes = 0, MeshCount = 0, MinLevel = 12;
	float Density = 0.5f, ScaleMin = 0.8f, ScaleMax = 1.3f, MinHeight = 3.f, MaxHeight = 2400.f, MaxSlope = 0.5f;
};

struct FVegetationInstances
{
	// [layer][mesh] -> transforms, patch-local, centimetres, Unreal frame.
	TArray<TArray<TArray<FTransform>>> Instances;
};

FVegetationLayerRule MakeRule(const FVegetationLayer& Layer);

// Safe on worker threads; a few milliseconds per patch.
void ScatterPatchVegetation(const Aeon::PatchRequest& Request, const double PatchCenter[3], const TArray<FVegetationLayerRule>& Rules, FVegetationInstances& Out);

// Vertex-coloured stand-ins used when a layer set has no real meshes. Game thread only.
UStaticMesh* BuildPlaceholderTreeMesh(UObject* Outer, UMaterialInterface* Material);
UStaticMesh* BuildPlaceholderGrassMesh(UObject* Outer, UMaterialInterface* Material);

} // namespace StarAgent
