// Deterministic vegetation for a terrain patch, and placeholder meshes.
//
// Placement is seeded per level-17 cube cell, so a tree or grass tuft has the
// same position at every LOD level and nothing moves when patches split. Trees
// appear on patches at TreeLevel and above (about 2 km from the camera), grass
// at GrassLevel and above (about 250 m). The browser lays trees on rows of
// latitude (forest-distribution.js, vegetation.js); this is the same idea on
// cube cells, so groves do not yet match the browser build tree for tree.
#pragma once
#include "CoreMinimal.h"
#include "PatchBuilder.h"

class UStaticMesh;
class UMaterialInterface;

namespace StarAgent {

struct FVegetationRules
{
	int32 TreeLevel = 12;
	int32 GrassLevel = 15;
	float TreeDensity = 1.f;    // scales the per-cell tree probability
	float GrassDensity = 1.f;   // scales tufts per cell
	int32 GrassPerCell = 96;    // tufts per level-17 cell (~24 m) at density 1
	int32 TreeSpecies = 1;      // number of tree meshes to choose from (per cell, seeded)
	int32 GrassSpecies = 1;
	float TreeScale = 1.f;      // multiplies the 0.8..1.4 random scale
	float GrassScale = 1.f;
};

struct FVegetationInstances
{
	// One transform list per species; patch-local, centimetres, Unreal frame.
	TArray<TArray<FTransform>> Trees, Grass;
	int32 TreeCount() const { int32 n = 0; for (const auto& a : Trees) n += a.Num(); return n; }
	int32 GrassCount() const { int32 n = 0; for (const auto& a : Grass) n += a.Num(); return n; }
};

// Safe on worker threads; costs a few milliseconds per patch.
void ScatterPatchVegetation(const Aeon::PatchRequest& Request, const double PatchCenter[3], const FVegetationRules& Rules, FVegetationInstances& Out);

// Vertex-coloured stand-ins built at start-up until real assets are assigned.
// Game thread only. About 10 m tall for the tree, 50 cm for the grass tuft.
UStaticMesh* BuildPlaceholderTreeMesh(UObject* Outer, UMaterialInterface* Material);
UStaticMesh* BuildPlaceholderGrassMesh(UObject* Outer, UMaterialInterface* Material);

} // namespace StarAgent
