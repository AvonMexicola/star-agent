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
class UInstancedStaticMeshComponent;

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
	TArray<TObjectPtr<UInstancedStaticMeshComponent>> Trees, Grass;  // one per species, attached to Mesh
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

	/** Tree meshes (species/variations, chosen per cell by seed). Empty = vertex-coloured placeholder built at start. Origin at the base, Z up. */
	UPROPERTY(EditAnywhere, Category = "Vegetation")
	TArray<TObjectPtr<UStaticMesh>> TreeMeshes;

	/** Grass tuft meshes; empty = placeholder. */
	UPROPERTY(EditAnywhere, Category = "Vegetation")
	TArray<TObjectPtr<UStaticMesh>> GrassMeshes;

	/** Multiplies the random 0.8..1.4 scale; 1 for real-scale assets, the placeholder is 10 m at 1. */
	UPROPERTY(EditAnywhere, Category = "Vegetation", meta = (ClampMin = 0.05, ClampMax = 10))
	float TreeScale = 1.f;

	UPROPERTY(EditAnywhere, Category = "Vegetation", meta = (ClampMin = 0.05, ClampMax = 10))
	float GrassScale = 1.f;

	/** Material for the placeholder meshes (Scripts/create_materials.py makes M_Vegetation). */
	UPROPERTY(EditAnywhere, Category = "Vegetation")
	TObjectPtr<UMaterialInterface> VegetationMaterial;

	/** Patch level from which trees are placed (12: patches of ~1.2 km, visible within ~2.2 km). */
	UPROPERTY(EditAnywhere, Category = "Vegetation", meta = (ClampMin = 8, ClampMax = 17))
	int32 TreeLevel = 12;

	/** Patch level from which grass is placed (15: patches of ~150 m, visible within ~270 m). */
	UPROPERTY(EditAnywhere, Category = "Vegetation", meta = (ClampMin = 10, ClampMax = 17))
	int32 GrassLevel = 15;

	UPROPERTY(EditAnywhere, Category = "Vegetation", meta = (ClampMin = 0, ClampMax = 4))
	float TreeDensity = 1.f;

	UPROPERTY(EditAnywhere, Category = "Vegetation", meta = (ClampMin = 0, ClampMax = 4))
	float GrassDensity = 1.f;

	/** Instances fade out at these camera distances (metres). */
	UPROPERTY(EditAnywhere, Category = "Vegetation")
	float TreeCullMetres = 2500.f;

	UPROPERTY(EditAnywhere, Category = "Vegetation")
	float GrassCullMetres = 220.f;

	UPROPERTY(EditAnywhere, Category = "Planet")
	bool bCreateSkyAtmosphere = true;

	/** Width of the baked orbital albedo map (height is half). 2048 is ~4.9 km per texel at the equator. */
	UPROPERTY(EditAnywhere, Category = "Planet", meta = (ClampMin = 256, ClampMax = 8192))
	int32 AlbedoWidth = 2048;

	/** Baked lat/long albedo (rgb) and moisture (a), material parameter "OrbitalAlbedo". */
	UPROPERTY(VisibleAnywhere, Category = "Planet")
	TObjectPtr<UTexture2D> OrbitalAlbedo;

	/** Baked colour/scree noise fields, material parameter "OrbitalFields". */
	UPROPERTY(VisibleAnywhere, Category = "Planet")
	TObjectPtr<UTexture2D> OrbitalFields;

	/** Seconds for a split or merge to morph between parent and child surfaces (terrain-lod.js: 0.6). */
	UPROPERTY(EditAnywhere, Category = "Planet", meta = (ClampMin = 0.0, ClampMax = 5.0))
	float MorphSeconds = 0.6f;

	UPROPERTY(VisibleAnywhere, Category = "Planet")
	TObjectPtr<USkyAtmosphereComponent> SkyAtmosphere;

	/** Unbound post-process volume carrying the exposure settings below. */
	UPROPERTY(VisibleAnywhere, Category = "Planet")
	TObjectPtr<UPostProcessComponent> PostProcess;

	// Look tuning. All of these are re-applied every tick, so they can be edited
	// live on the spawned actor during Play-in-Editor.

	/** Darkest scene EV100 the eye adapts to. Twilight is about 7; raising this keeps dusk and the night side dark. */
	UPROPERTY(EditAnywhere, Category = "Look", meta = (UIMin = -10, UIMax = 20))
	float ExposureMinEV100 = 8.f;

	/** Brightest scene EV100 the eye adapts to. Sunlit ground under a 100,000 lux sun is about 16. */
	UPROPERTY(EditAnywhere, Category = "Look", meta = (UIMin = -10, UIMax = 20))
	float ExposureMaxEV100 = 17.f;

	/** Exposure compensation in stops. */
	UPROPERTY(EditAnywhere, Category = "Look", meta = (UIMin = -5, UIMax = 5))
	float ExposureBias = -0.5f;

	/** Scales aerial-perspective distance; below 1 thins the haze so continents read from orbit. */
	UPROPERTY(EditAnywhere, Category = "Look", meta = (UIMin = 0.05, UIMax = 2))
	float AerialPerspectiveScale = 0.4f;

	/** Atmosphere multiple-scattering strength; lowers the milky blue on the day side when reduced. */
	UPROPERTY(EditAnywhere, Category = "Look", meta = (UIMin = 0, UIMax = 2))
	float MultiScattering = 0.6f;

	/** Camera distance (km) at which the baked albedo map starts replacing vertex colour. */
	UPROPERTY(EditAnywhere, Category = "Look", meta = (UIMin = 1, UIMax = 500))
	float AlbedoFadeNearKm = 40.f;

	/** Camera distance (km) beyond which only the baked albedo map is used. */
	UPROPERTY(EditAnywhere, Category = "Look", meta = (UIMin = 1, UIMax = 1000))
	float AlbedoFadeFarKm = 150.f;

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
