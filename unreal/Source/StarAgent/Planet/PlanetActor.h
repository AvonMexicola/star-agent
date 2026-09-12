// Aeon as an Unreal actor: six cubed-sphere roots, a quadtree of streamed
// DynamicMesh patches built on worker threads, optional SkyAtmosphere.
//
// Port of src/planet.js select()/dispatch()/receive() minus the geomorph (a
// parent is swapped for its four children once all four are resident, which
// keeps the surface hole-free; the 0.6 s vertex morph is a later material step).
//
// Contract, same as the browser: positions are doubles in metres in the body
// frame; each patch component sits at its double-precision centre and holds
// float vertices local to it. The actor must not be rotated; planetary rotation
// is applied to everything else (ADR SA-WORLD-004).
#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Tasks/Task.h"
#include "DynamicMesh/DynamicMesh3.h"
#include "PatchBuilder.h"
#include "PlanetVegetation.h"
#include "PlanetActor.generated.h"

class UDynamicMeshComponent;
class USkyAtmosphereComponent;
class UPostProcessComponent;
class UMaterialInterface;
class UMaterialInstanceDynamic;
class UTexture2D;
class UStaticMesh;
class UPrimitiveComponent;

struct FPlanetPatchJob;

struct FPlanetNode
{
	int32 Face = 0, Level = 0, Ix = 0, Iy = 0;
	double Size = 2.0;                 // cube-face extent, 2 / 2^Level
	double Normal[3] = {0, 0, 0};      // unit direction of the cell centre
	double Center[3] = {0, 0, 0};      // on the base sphere, metres
	double SurfaceCenter[3] = {0, 0, 0}; // on the terrain (sea-level clamped), metres
	FPlanetNode* Children[4] = {nullptr, nullptr, nullptr, nullptr};
	TObjectPtr<UDynamicMeshComponent> Mesh = nullptr;
	TObjectPtr<UMaterialInstanceDynamic> Material = nullptr;  // per patch: TerrainMorph and albedo parameters
	TObjectPtr<UDynamicMeshComponent> Water = nullptr;        // sea-level surface, only for patches that touch water
	TObjectPtr<UMaterialInstanceDynamic> WaterMaterialInstance = nullptr;
	TArray<TObjectPtr<UPrimitiveComponent>> Vegetation;  // instanced static or skinned components, attached to Mesh
	TSharedPtr<FPlanetPatchJob> Job;
	bool bQueued = false, bRefined = false, bWantsSplit = false, bVisible = false;
	// terrain-lod.js: Progress/Target drive this node's CHILDREN from the parent
	// surface (0) to their own (1); Morph is the value applied to this node's mesh.
	float Progress = 0.f, Target = 0.f, ChildMorph = 0.f, Morph = 1.f, AppliedMorph = -1.f;
	double LastUsed = 0;
	int64 ResidentFrame = 0;
	bool HasChildren() const { return Children[0] != nullptr; }
};

UCLASS()
class STARAGENT_API APlanetActor : public AActor
{
	GENERATED_BODY()

public:
	APlanetActor();

	/** Planet seed; must match the browser build for the same world. */
	UPROPERTY(EditAnywhere, Category = "Planet")
	int64 Seed = 7291;

	/** Deepest quadtree level. The browser uses 17 (about 1.2 m vertex spacing). */
	UPROPERTY(EditAnywhere, Category = "Planet", meta = (ClampMin = 3, ClampMax = 22))
	int32 MaxLevel = 17;

	/** Patches at this level and above within CollisionRangeMetres get Chaos collision. */
	UPROPERTY(EditAnywhere, Category = "Planet")
	int32 CollisionLevel = 13;

	UPROPERTY(EditAnywhere, Category = "Planet")
	float CollisionRangeMetres = 1500.f;

	UPROPERTY(EditAnywhere, Category = "Planet", meta = (ClampMin = 1, ClampMax = 32))
	int32 MaxConcurrentBuilds = 6;

	UPROPERTY(EditAnywhere, Category = "Planet")
	float SelectIntervalSeconds = 0.1f;

	/** Land material; should read Vertex Color as albedo and UV0 = (height m, rock relief m). */
	UPROPERTY(EditAnywhere, Category = "Planet")
	TObjectPtr<UMaterialInterface> LandMaterial;

	/** Single Layer Water material for the sea-level surface (Scripts/create_materials.py makes M_AeonWater). */
	UPROPERTY(EditAnywhere, Category = "Planet")
	TObjectPtr<UMaterialInterface> WaterMaterial;

	UPROPERTY(EditAnywhere, Category = "Planet")
	bool bWater = true;

	UPROPERTY(EditAnywhere, Category = "Vegetation")
	bool bVegetation = true;

	/** Biome layers. Empty = built at start from the Megaplant library when present, else vertex-coloured placeholders. */
	UPROPERTY(EditAnywhere, Category = "Vegetation")
	TArray<FVegetationLayer> VegetationLayers;

	/** Material for the placeholder meshes (Scripts/create_materials.py makes M_Vegetation). */
	UPROPERTY(EditAnywhere, Category = "Vegetation")
	TObjectPtr<UMaterialInterface> VegetationMaterial;

	/** Multiplies every layer's density. */
	UPROPERTY(EditAnywhere, Category = "Vegetation", meta = (ClampMin = 0, ClampMax = 4))
	float VegetationDensity = 1.f;

	/** Radius of the base sphere in metres (Aeon: 1,592,750). */
	double GetRadiusMetres() const;
	/** Terrain height above the base sphere for a body-frame unit direction. */
	double GetTerrainHeightMetres(const double Direction[3]) const;
	/** Altitude above terrain (sea-level clamped) for a world position in centimetres. */
	double GetAltitudeMetres(const FVector& WorldLocation) const;
	/** Unit body-frame direction for a world position. */
	void GetBodyDirection(const FVector& WorldLocation, double OutDirection[3]) const;
	/** Surface gravity, m/s^2, at the base sphere. */
	double GetSurfaceGravity() const { return 9.81; }

	// Streaming statistics for HUD/debug.
	int32 VisibleCount = 0, MaxVisibleLevel = 0, PendingCount = 0;

protected:
	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;
	virtual void Tick(float DeltaSeconds) override;

private:
	TMap<uint64, TUniquePtr<FPlanetNode>> Nodes;
	FPlanetNode* Roots[6] = {nullptr, nullptr, nullptr, nullptr, nullptr, nullptr};
	TArray<FPlanetNode*> Queue;
	TArray<TSharedPtr<FPlanetPatchJob>> ActiveJobs;
	double CameraBody[3] = {0, 0, 0};  // observer position, metres, body frame
	int64 Frame = 0;
	double TimeSinceSelect = 0;

	static uint64 NodeKey(int32 Face, int32 Level, int32 Ix, int32 Iy);
	FPlanetNode* GetNode(int32 Face, int32 Level, int32 Ix, int32 Iy);
	void Request(FPlanetNode* Node);
	void Dispatch();
	void CollectFinishedJobs();
	void AttachPatch(FPlanetNode* Node, FPlanetPatchJob& Job);
	void Select();
	void Visit(FPlanetNode* Node, bool bCollapse, double Now, double CameraLength, const double Radial[3]);
	void DisposeNode(FPlanetNode* Node);
	void UpdateCamera();
	void ApplyLook();
	void StartAlbedoBake();
	void FinishAlbedoBake();
	void BuildDefaultVegetationLayers();
	void AdvanceMorphs(float DeltaSeconds);
	void ApplyPatchMaterialParameters(FPlanetNode* Node);
	bool bAlbedoReady = false;
	struct FAlbedoJob;
	TSharedPtr<FAlbedoJob> AlbedoJob;
	// Last values pushed to the components, so edits made directly on the
	// components in the editor are not overwritten every tick.
	float AppliedExposureMin = -1000.f, AppliedExposureMax = -1000.f, AppliedExposureBias = -1000.f;
	float AppliedAerialPerspectiveScale = -1.f, AppliedMultiScattering = -1.f;
	float AppliedFadeNear = -1.f, AppliedFadeFar = -1.f;
};
