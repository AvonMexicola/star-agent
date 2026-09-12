#include "PlanetActor.h"
#include "PlanetFrame.h"
#include "PlanetPatchMesh.h"
#include "PlanetAlbedo.h"
#include "AeonSurface.h"
#include "StarAgent.h"
#include "Components/DynamicMeshComponent.h"
#include "Components/InstancedStaticMeshComponent.h"
#include "Engine/StaticMesh.h"
#include "Components/SkyAtmosphereComponent.h"
#include "Components/PostProcessComponent.h"
#include "Camera/PlayerCameraManager.h"
#include "Engine/CollisionProfile.h"
#include "Kismet/GameplayStatics.h"
#include "Materials/MaterialInterface.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Engine/Texture2D.h"

using namespace StarAgent;

// terrain-lod.js
static constexpr double TERRAIN_SPLIT_RATIO = 1.8;
static constexpr double TERRAIN_MERGE_RATIO = 2.3;
static bool WantsTerrainSplit(int32 Level, int32 MaxLevel, double Distance, double Width, bool bWasSplit)
{
	return Level < MaxLevel && (Level < 3 || Distance < Width * (bWasSplit ? TERRAIN_MERGE_RATIO : TERRAIN_SPLIT_RATIO));
}
// Linear progress has no discontinuity on reversal; smoothstep only shapes the rendered value.
static float AdvanceTerrainMorph(float Progress, float Target, float DeltaSeconds, float MorphSeconds)
{
	const float Step = FMath::Max(0.f, DeltaSeconds) / FMath::Max(MorphSeconds, 0.001f);
	return Target > Progress ? FMath::Min(Target, Progress + Step) : FMath::Max(Target, Progress - Step);
}
static float TerrainMorphValue(float Progress) { return Progress * Progress * (3.f - 2.f * Progress); }

struct APlanetActor::FAlbedoJob
{
	int32 Width = 0, Height = 0;
	TArray<uint8> Bgra, Fields;
	UE::Tasks::FTask Task;
	double StartSeconds = 0, BakeSeconds = 0;
};

struct FPlanetPatchJob
{
	Aeon::PatchRequest Request;
	Aeon::PatchBuffers Buffers;
	UE::Geometry::FDynamicMesh3 Mesh;
	UE::Geometry::FDynamicMesh3 WaterMesh;  // empty unless the patch touches water
	bool bWater = false;
	FVegetationRules VegetationRules;
	bool bVegetation = false;
	FVegetationInstances Vegetation;
	UE::Tasks::FTask Task;
	FPlanetNode* Node = nullptr;  // only dereferenced on the game thread
};

APlanetActor::APlanetActor()
{
	PrimaryActorTick.bCanEverTick = true;
	RootComponent = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	SkyAtmosphere = CreateDefaultSubobject<USkyAtmosphereComponent>(TEXT("SkyAtmosphere"));
	SkyAtmosphere->SetupAttachment(RootComponent);
	// Planet-centred atmosphere in kilometres: Aeon 1592.75 km radius, 70 km deep.
	SkyAtmosphere->TransformMode = ESkyAtmosphereTransformMode::PlanetCenterAtComponentTransform;
	SkyAtmosphere->BottomRadius = static_cast<float>(Aeon::Radius / 1000.0);
	SkyAtmosphere->AtmosphereHeight = static_cast<float>(Aeon::AtmosphereHeight / 1000.0);
	SkyAtmosphere->GroundAlbedo = FColor(90, 110, 80);
	PostProcess = CreateDefaultSubobject<UPostProcessComponent>(TEXT("PostProcess"));
	PostProcess->SetupAttachment(RootComponent);
	PostProcess->bUnbound = true;
	PostProcess->Priority = 1.f;
}

void APlanetActor::ApplyLook()
{
	// Push a value only when the actor property changed since the last push;
	// otherwise a value edited on the component itself would be reset each tick.
	if (PostProcess && (ExposureMinEV100 != AppliedExposureMin || ExposureMaxEV100 != AppliedExposureMax || ExposureBias != AppliedExposureBias))
	{
		FPostProcessSettings& S = PostProcess->Settings;
		S.bOverride_AutoExposureMethod = true;
		S.AutoExposureMethod = AEM_Histogram;
		S.bOverride_AutoExposureMinBrightness = true;
		S.AutoExposureMinBrightness = ExposureMinEV100;
		S.bOverride_AutoExposureMaxBrightness = true;
		S.AutoExposureMaxBrightness = FMath::Max(ExposureMaxEV100, ExposureMinEV100);
		S.bOverride_AutoExposureBias = true;
		S.AutoExposureBias = ExposureBias;
		AppliedExposureMin = ExposureMinEV100; AppliedExposureMax = ExposureMaxEV100; AppliedExposureBias = ExposureBias;
	}
	if (SkyAtmosphere)
	{
		if (AerialPerspectiveScale != AppliedAerialPerspectiveScale)
		{
			SkyAtmosphere->SetAerialPespectiveViewDistanceScale(AerialPerspectiveScale);
			AppliedAerialPerspectiveScale = AerialPerspectiveScale;
		}
		if (MultiScattering != AppliedMultiScattering)
		{
			SkyAtmosphere->SetMultiScatteringFactor(MultiScattering);
			AppliedMultiScattering = MultiScattering;
		}
	}
	if (AlbedoFadeNearKm != AppliedFadeNear || AlbedoFadeFarKm != AppliedFadeFar)
	{
		AppliedFadeNear = AlbedoFadeNearKm; AppliedFadeFar = AlbedoFadeFarKm;
		for (auto& Pair : Nodes) if (Pair.Value->Material) ApplyPatchMaterialParameters(Pair.Value.Get());
	}
}

double APlanetActor::GetRadiusMetres() const { return Aeon::Radius; }

double APlanetActor::GetTerrainHeightMetres(const double D[3]) const
{
	return Aeon::TerrainHeight(D[0], D[1], D[2], static_cast<uint32_t>(Seed));
}

void APlanetActor::GetBodyDirection(const FVector& WorldLocation, double Out[3]) const
{
	double P[3];
	FromUnreal(WorldLocation - GetActorLocation(), P);
	const double L = FMath::Sqrt(P[0] * P[0] + P[1] * P[1] + P[2] * P[2]);
	if (L <= 0.0) { Out[0] = 0; Out[1] = 1; Out[2] = 0; return; }
	Out[0] = P[0] / L; Out[1] = P[1] / L; Out[2] = P[2] / L;
}

double APlanetActor::GetAltitudeMetres(const FVector& WorldLocation) const
{
	double P[3];
	FromUnreal(WorldLocation - GetActorLocation(), P);
	const double L = FMath::Sqrt(P[0] * P[0] + P[1] * P[1] + P[2] * P[2]);
	if (L <= 0.0) return -Aeon::Radius;
	const double D[3] = {P[0] / L, P[1] / L, P[2] / L};
	// celestial.js AEON: water body, height clamped to sea level.
	return L - Aeon::Radius - FMath::Max(0.0, GetTerrainHeightMetres(D));
}

uint64 APlanetActor::NodeKey(int32 Face, int32 Level, int32 Ix, int32 Iy)
{
	return (static_cast<uint64>(Face) << 58) | (static_cast<uint64>(Level) << 52) | (static_cast<uint64>(Ix) << 26) | static_cast<uint64>(Iy);
}

FPlanetNode* APlanetActor::GetNode(int32 Face, int32 Level, int32 Ix, int32 Iy)
{
	const uint64 Key = NodeKey(Face, Level, Ix, Iy);
	if (TUniquePtr<FPlanetNode>* Found = Nodes.Find(Key)) return Found->Get();
	TUniquePtr<FPlanetNode> Node = MakeUnique<FPlanetNode>();
	Node->Face = Face; Node->Level = Level; Node->Ix = Ix; Node->Iy = Iy;
	Node->Size = 2.0 / FMath::Pow(2.0, static_cast<double>(Level));
	Aeon::CubeDirection(Face, -1 + (Ix + .5) * Node->Size, -1 + (Iy + .5) * Node->Size, Node->Normal);
	const double H = FMath::Max(0.0, GetTerrainHeightMetres(Node->Normal));
	for (int a = 0; a < 3; a++)
	{
		Node->Center[a] = Node->Normal[a] * Aeon::Radius;
		Node->SurfaceCenter[a] = Node->Normal[a] * (Aeon::Radius + H);
	}
	Node->LastUsed = FPlatformTime::Seconds();
	FPlanetNode* Raw = Node.Get();
	Nodes.Add(Key, MoveTemp(Node));
	return Raw;
}

void APlanetActor::BeginPlay()
{
	Super::BeginPlay();
	if (!bCreateSkyAtmosphere && SkyAtmosphere)
	{
		SkyAtmosphere->SetVisibility(false);
		SkyAtmosphere->Deactivate();
	}
	// Scripts/create_materials.py makes this asset. Loaded here rather than in
	// the constructor: a constructor-time load runs during engine start-up and
	// roots the asset, which later crashes the material editing library.
	if (!LandMaterial)
	{
		LandMaterial = LoadObject<UMaterialInterface>(nullptr, TEXT("/Game/StarAgent/Materials/M_AeonLand.M_AeonLand"));
	}
	if (!WaterMaterial)
	{
		WaterMaterial = LoadObject<UMaterialInterface>(nullptr, TEXT("/Game/StarAgent/Materials/M_AeonWater.M_AeonWater"));
	}
	if (!VegetationMaterial)
	{
		VegetationMaterial = LoadObject<UMaterialInterface>(nullptr, TEXT("/Game/StarAgent/Materials/M_Vegetation.M_Vegetation"));
	}
	if (bVegetation)
	{
		TreeMeshes.RemoveAll([](const TObjectPtr<UStaticMesh>& M) { return M == nullptr; });
		GrassMeshes.RemoveAll([](const TObjectPtr<UStaticMesh>& M) { return M == nullptr; });
		if (TreeMeshes.Num() == 0) TreeMeshes.Add(BuildPlaceholderTreeMesh(this, VegetationMaterial));
		if (GrassMeshes.Num() == 0) GrassMeshes.Add(BuildPlaceholderGrassMesh(this, VegetationMaterial));
	}
	UE_LOG(LogStarAgent, Log, TEXT("PlanetActor: seed %lld, land material %s, water material %s, %d tree meshes (%s), %d grass meshes (%s)"), Seed,
		LandMaterial ? *LandMaterial->GetPathName() : TEXT("NONE (vertex-colour debug material)"),
		WaterMaterial ? *WaterMaterial->GetPathName() : TEXT("NONE (no water)"),
		TreeMeshes.Num(), TreeMeshes.Num() ? *TreeMeshes[0]->GetName() : TEXT("-"), GrassMeshes.Num(), GrassMeshes.Num() ? *GrassMeshes[0]->GetName() : TEXT("-"));
	if (LandMaterial) StartAlbedoBake();
	ApplyLook();
	for (int32 Face = 0; Face < 6; Face++) Roots[Face] = GetNode(Face, 0, 0, 0);
	CameraBody[0] = 0; CameraBody[1] = 0; CameraBody[2] = Aeon::Radius * 2;  // planet.js initial observer
	Select();
}

void APlanetActor::StartAlbedoBake()
{
	TSharedPtr<FAlbedoJob> Job = MakeShared<FAlbedoJob>();
	Job->Width = FMath::Max(256, AlbedoWidth); Job->Height = Job->Width / 2;
	const uint32 BakeSeed = static_cast<uint32>(Seed);
	Job->StartSeconds = FPlatformTime::Seconds();
	Job->Task = UE::Tasks::Launch(TEXT("StarAgentAlbedoBake"), [Job, BakeSeed]()
	{
		const double T0 = FPlatformTime::Seconds();
		BakeAeonAlbedo(BakeSeed, Job->Width, Job->Height, Job->Bgra, Job->Fields);
		Job->BakeSeconds = FPlatformTime::Seconds() - T0;
	}, UE::Tasks::ETaskPriority::BackgroundNormal);
	AlbedoJob = Job;
	UE_LOG(LogStarAgent, Log, TEXT("PlanetActor: baking %dx%d orbital albedo on worker threads"), Job->Width, Job->Height);
}

void APlanetActor::FinishAlbedoBake()
{
	if (!AlbedoJob.IsValid() || !AlbedoJob->Task.IsCompleted()) return;
	const double BakeSeconds = AlbedoJob->BakeSeconds, WaitedSeconds = FPlatformTime::Seconds() - AlbedoJob->StartSeconds;
	OrbitalAlbedo = CreateAlbedoTexture(AlbedoJob->Width, AlbedoJob->Height, AlbedoJob->Bgra, TEXT("AeonOrbitalAlbedo"), true);
	OrbitalFields = CreateAlbedoTexture(AlbedoJob->Width, AlbedoJob->Height, AlbedoJob->Fields, TEXT("AeonOrbitalFields"), false);
	AlbedoJob.Reset();
	if (!OrbitalAlbedo || !OrbitalFields)
	{
		UE_LOG(LogStarAgent, Error, TEXT("PlanetActor: orbital albedo bake finished in %.1f s but CreateAlbedoTexture returned null"), BakeSeconds);
		return;
	}
	if (!LandMaterial) return;
	bAlbedoReady = true;
	int32 Updated = 0;
	for (auto& Pair : Nodes)
	{
		if (Pair.Value->Material) { ApplyPatchMaterialParameters(Pair.Value.Get()); Updated++; }
	}
	UE_LOG(LogStarAgent, Log, TEXT("PlanetActor: orbital albedo %dx%d ready (bake %.1f s, %.1f s after start), applied to %d patches"), OrbitalAlbedo->GetSizeX(), OrbitalAlbedo->GetSizeY(), BakeSeconds, WaitedSeconds, Updated);
}

void APlanetActor::ApplyPatchMaterialParameters(FPlanetNode* Node)
{
	if (!Node->Material) return;
	Node->Material->SetScalarParameterValue(TEXT("AlbedoFadeNearKm"), AlbedoFadeNearKm);
	Node->Material->SetScalarParameterValue(TEXT("AlbedoFadeFarKm"), FMath::Max(AlbedoFadeFarKm, AlbedoFadeNearKm + 1.f));
	Node->Material->SetScalarParameterValue(TEXT("AlbedoReady"), bAlbedoReady ? 1.f : 0.f);
	if (bAlbedoReady && OrbitalAlbedo) Node->Material->SetTextureParameterValue(TEXT("OrbitalAlbedo"), OrbitalAlbedo);
	if (bAlbedoReady && OrbitalFields) Node->Material->SetTextureParameterValue(TEXT("OrbitalFields"), OrbitalFields);
	Node->Material->SetScalarParameterValue(TEXT("TerrainMorph"), Node->Morph);
	Node->AppliedMorph = Node->Morph;
}

void APlanetActor::AdvanceMorphs(float DeltaSeconds)
{
	for (auto& Pair : Nodes)
	{
		FPlanetNode* Node = Pair.Value.Get();
		Node->Progress = AdvanceTerrainMorph(Node->Progress, Node->Target, DeltaSeconds, MorphSeconds);
		Node->ChildMorph = TerrainMorphValue(Node->Progress);
		if (Node->HasChildren()) for (FPlanetNode* Child : Node->Children) Child->Morph = Node->ChildMorph;
	}
	for (auto& Pair : Nodes)
	{
		FPlanetNode* Node = Pair.Value.Get();
		if (Node->Material && Node->Morph != Node->AppliedMorph)
		{
			Node->Material->SetScalarParameterValue(TEXT("TerrainMorph"), Node->Morph);
			if (Node->WaterMaterialInstance) Node->WaterMaterialInstance->SetScalarParameterValue(TEXT("TerrainMorph"), Node->Morph);
			Node->AppliedMorph = Node->Morph;
		}
	}
}

void APlanetActor::EndPlay(const EEndPlayReason::Type EndPlayReason)
{
	if (AlbedoJob.IsValid()) { AlbedoJob->Task.Wait(); AlbedoJob.Reset(); }
	for (TSharedPtr<FPlanetPatchJob>& Job : ActiveJobs)
	{
		Job->Task.Wait();
		Job->Node = nullptr;
	}
	ActiveJobs.Empty();
	Queue.Empty();
	Super::EndPlay(EndPlayReason);
}

void APlanetActor::Request(FPlanetNode* Node)
{
	if (Node->Mesh || Node->bQueued || Node->Job.IsValid()) return;
	Node->bQueued = true;
	Queue.Add(Node);
}

void APlanetActor::Dispatch()
{
	auto Priority = [this](const FPlanetNode& N)
	{
		const double dx = N.Center[0] - CameraBody[0], dy = N.Center[1] - CameraBody[1], dz = N.Center[2] - CameraBody[2];
		return FMath::Sqrt(dx * dx + dy * dy + dz * dz) / (N.Size * Aeon::Radius);
	};
	Queue.Sort([&](const FPlanetNode& A, const FPlanetNode& B) { return Priority(A) < Priority(B); });
	while (ActiveJobs.Num() < MaxConcurrentBuilds && Queue.Num() > 0)
	{
		FPlanetNode* Node = Queue[0];
		Queue.RemoveAt(0);
		Node->bQueued = false;
		TSharedPtr<FPlanetPatchJob> Job = MakeShared<FPlanetPatchJob>();
		Job->Node = Node;
		Job->Request.face = Node->Face; Job->Request.level = Node->Level; Job->Request.ix = Node->Ix; Job->Request.iy = Node->Iy;
		Job->Request.grid = Aeon::TerrainGridForLevel(Node->Level);
		Job->Request.parentGrid = Aeon::TerrainGridForLevel(FMath::Max(0, Node->Level - 1));
		Job->Request.seed = static_cast<uint32_t>(Seed);
		Node->Job = Job;
		// The task owns a reference; it never touches the actor or the node.
		const bool bWantWater = bWater;
		Job->VegetationRules.TreeLevel = TreeLevel; Job->VegetationRules.GrassLevel = GrassLevel;
		Job->VegetationRules.TreeDensity = TreeDensity; Job->VegetationRules.GrassDensity = GrassDensity;
		Job->VegetationRules.TreeSpecies = FMath::Max(1, TreeMeshes.Num()); Job->VegetationRules.GrassSpecies = FMath::Max(1, GrassMeshes.Num());
		Job->VegetationRules.TreeScale = TreeScale; Job->VegetationRules.GrassScale = GrassScale;
		Job->bVegetation = bVegetation && Node->Level >= FMath::Min(TreeLevel, GrassLevel);
		Job->Task = UE::Tasks::Launch(TEXT("StarAgentPatch"), [Job, bWantWater]()
		{
			Aeon::BuildPatch(Job->Request, Job->Buffers);
			BuildPatchDynamicMesh(Job->Buffers, Job->Mesh);
			if (bWantWater && PatchNeedsWater(Job->Buffers))
			{
				Job->bWater = true;
				BuildWaterDynamicMesh(Job->Buffers, Job->WaterMesh);
			}
			if (Job->bVegetation) ScatterPatchVegetation(Job->Request, Job->Buffers.center, Job->VegetationRules, Job->Vegetation);
		}, UE::Tasks::ETaskPriority::BackgroundNormal);
		ActiveJobs.Add(Job);
	}
	PendingCount = Queue.Num() + ActiveJobs.Num();
}

void APlanetActor::CollectFinishedJobs()
{
	for (int32 i = ActiveJobs.Num() - 1; i >= 0; i--)
	{
		TSharedPtr<FPlanetPatchJob> Job = ActiveJobs[i];
		if (!Job->Task.IsCompleted()) continue;
		ActiveJobs.RemoveAt(i);
		if (Job->Node)
		{
			AttachPatch(Job->Node, *Job);
			Job->Node->Job.Reset();
		}
	}
}

void APlanetActor::AttachPatch(FPlanetNode* Node, FPlanetPatchJob& Job)
{
	UDynamicMeshComponent* Comp = NewObject<UDynamicMeshComponent>(this, NAME_None, RF_Transient);
	Comp->SetMesh(MoveTemp(Job.Mesh));
	Comp->SetRelativeLocation(ToUnreal(Job.Buffers.center));
	Comp->SetupAttachment(RootComponent);
	Comp->SetColorOverrideMode(LandMaterial ? EDynamicMeshComponentColorOverrideMode::None : EDynamicMeshComponentColorOverrideMode::VertexColors);
	if (LandMaterial)
	{
		Node->Material = UMaterialInstanceDynamic::Create(LandMaterial, this);
		Comp->SetMaterial(0, Node->Material);
		ApplyPatchMaterialParameters(Node);
	}
	Comp->SetCastShadow(Node->Level >= 12);
	Comp->SetEnableRaytracing(Node->Level >= 6);
	const double dx = Node->SurfaceCenter[0] - CameraBody[0], dy = Node->SurfaceCenter[1] - CameraBody[1], dz = Node->SurfaceCenter[2] - CameraBody[2];
	const bool bCollide = Node->Level >= CollisionLevel && FMath::Sqrt(dx * dx + dy * dy + dz * dz) < CollisionRangeMetres;
	if (bCollide)
	{
		Comp->SetCollisionProfileName(UCollisionProfile::BlockAll_ProfileName);
		Comp->EnableComplexAsSimpleCollision();
	}
	else
	{
		Comp->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	}
	Comp->SetVisibility(false);
	Comp->RegisterComponent();
	for (int a = 0; a < 3; a++) Node->Center[a] = Job.Buffers.center[a];
	Node->Mesh = Comp;
	Node->ResidentFrame = Frame;

	if (Job.bWater && WaterMaterial)
	{
		UDynamicMeshComponent* WaterComp = NewObject<UDynamicMeshComponent>(this, NAME_None, RF_Transient);
		WaterComp->SetMesh(MoveTemp(Job.WaterMesh));
		WaterComp->SetRelativeLocation(ToUnreal(Job.Buffers.center));
		WaterComp->SetupAttachment(RootComponent);
		Node->WaterMaterialInstance = UMaterialInstanceDynamic::Create(WaterMaterial, this);
		Node->WaterMaterialInstance->SetScalarParameterValue(TEXT("TerrainMorph"), Node->Morph);
		WaterComp->SetMaterial(0, Node->WaterMaterialInstance);
		WaterComp->SetCastShadow(false);
		WaterComp->SetEnableRaytracing(false);
		WaterComp->SetCollisionEnabled(ECollisionEnabled::NoCollision);
		WaterComp->SetVisibility(false);
		WaterComp->RegisterComponent();
		Node->Water = WaterComp;
	}

	auto MakeInstances = [&](UStaticMesh* StaticMesh, const TArray<FTransform>& Transforms, float CullMetres, bool bShadows) -> UInstancedStaticMeshComponent*
	{
		if (!StaticMesh || Transforms.Num() == 0) return nullptr;
		UInstancedStaticMeshComponent* ISM = NewObject<UInstancedStaticMeshComponent>(this, NAME_None, RF_Transient);
		ISM->SetStaticMesh(StaticMesh);
		ISM->SetupAttachment(Comp);
		ISM->SetCastShadow(bShadows);
		ISM->SetCollisionEnabled(ECollisionEnabled::NoCollision);
		ISM->SetCullDistances(FMath::RoundToInt(CullMetres * 70.f), FMath::RoundToInt(CullMetres * 100.f));
		ISM->RegisterComponent();
		ISM->AddInstances(Transforms, false, false, false);
		return ISM;
	};
	for (int32 i = 0; i < Job.Vegetation.Trees.Num() && i < TreeMeshes.Num(); i++)
		if (UInstancedStaticMeshComponent* ISM = MakeInstances(TreeMeshes[i], Job.Vegetation.Trees[i], TreeCullMetres, true)) Node->Trees.Add(ISM);
	for (int32 i = 0; i < Job.Vegetation.Grass.Num() && i < GrassMeshes.Num(); i++)
		if (UInstancedStaticMeshComponent* ISM = MakeInstances(GrassMeshes[i], Job.Vegetation.Grass[i], GrassCullMetres, false)) Node->Grass.Add(ISM);
}

void APlanetActor::DisposeNode(FPlanetNode* Node)
{
	if (Node->Mesh)
	{
		Node->Mesh->DestroyComponent();
		Node->Mesh = nullptr;
	}
	if (Node->Water)
	{
		Node->Water->DestroyComponent();
		Node->Water = nullptr;
	}
	for (UInstancedStaticMeshComponent* ISM : Node->Trees) if (ISM) ISM->DestroyComponent();
	for (UInstancedStaticMeshComponent* ISM : Node->Grass) if (ISM) ISM->DestroyComponent();
	Node->Trees.Reset(); Node->Grass.Reset();
	Node->Material = nullptr;
	Node->WaterMaterialInstance = nullptr;
	Node->bRefined = false;
	Node->Progress = Node->Target = Node->ChildMorph = 0.f;
	Node->AppliedMorph = -1.f;
}

void APlanetActor::Visit(FPlanetNode* Node, bool bCollapse, double Now, double CameraLength, const double Radial[3])
{
	// Conservative horizon culling, as planet.js: keep cells whose centre could be
	// visible given their size and relief.
	if (!bCollapse && Node->Level > 1)
	{
		const double Dot = Node->Normal[0] * Radial[0] + Node->Normal[1] * Radial[1] + Node->Normal[2] * Radial[2];
		if (Dot < Aeon::Radius / FMath::Max(Aeon::Radius, CameraLength) - Node->Size * 1.5 - .035) return;
	}
	Node->LastUsed = Now;
	Request(Node);
	const double dx = Node->SurfaceCenter[0] - CameraBody[0], dy = Node->SurfaceCenter[1] - CameraBody[1], dz = Node->SurfaceCenter[2] - CameraBody[2];
	const double Distance = FMath::Max(3.0, FMath::Sqrt(dx * dx + dy * dy + dz * dz));
	Node->bWantsSplit = !bCollapse && WantsTerrainSplit(Node->Level, MaxLevel, Distance, Node->Size * Aeon::Radius, Node->bWantsSplit);
	if (Node->bWantsSplit && Node->Mesh && Node->Morph == 1.f)
	{
		if (!Node->HasChildren())
		{
			Node->Children[0] = GetNode(Node->Face, Node->Level + 1, Node->Ix * 2, Node->Iy * 2);
			Node->Children[1] = GetNode(Node->Face, Node->Level + 1, Node->Ix * 2 + 1, Node->Iy * 2);
			Node->Children[2] = GetNode(Node->Face, Node->Level + 1, Node->Ix * 2, Node->Iy * 2 + 1);
			Node->Children[3] = GetNode(Node->Face, Node->Level + 1, Node->Ix * 2 + 1, Node->Iy * 2 + 1);
		}
		bool bAllResident = true;
		for (FPlanetNode* Child : Node->Children)
		{
			Child->LastUsed = Now;
			Request(Child);
			if (!Child->Mesh || Frame - Child->ResidentFrame < 2) bAllResident = false;
		}
		// Retain the complete parent until every child has survived two frames,
		// then start the children on the parent surface as one level.
		if (!Node->bRefined && bAllResident)
		{
			for (FPlanetNode* Child : Node->Children) { Child->bRefined = false; Child->Progress = Child->Target = Child->ChildMorph = 0.f; }
			Node->bRefined = true;
		}
	}
	if (Node->bRefined)
	{
		const bool bMerging = !Node->bWantsSplit;
		bool bChildrenCollapsed = true;
		for (FPlanetNode* Child : Node->Children) if (Child->bRefined) bChildrenCollapsed = false;
		// Collapse descendants first, so only one complete level is ever replaced.
		Node->Target = (bMerging && bChildrenCollapsed) ? 0.f : 1.f;
		if (bMerging && Node->Progress == 0.f && bChildrenCollapsed)
		{
			Node->bRefined = false;
		}
		else
		{
			for (FPlanetNode* Child : Node->Children) { Child->Morph = Node->ChildMorph; Visit(Child, bMerging, Now, CameraLength, Radial); }
			return;
		}
	}
	if (Node->Mesh)
	{
		Node->bVisible = true;
		VisibleCount++;
		MaxVisibleLevel = FMath::Max(MaxVisibleLevel, Node->Level);
	}
}

void APlanetActor::Select()
{
	VisibleCount = 0; MaxVisibleLevel = 0;
	const double Now = FPlatformTime::Seconds();
	const double CameraLength = FMath::Sqrt(CameraBody[0] * CameraBody[0] + CameraBody[1] * CameraBody[1] + CameraBody[2] * CameraBody[2]);
	double Radial[3] = {0, 0, 1};
	if (CameraLength > 0) for (int a = 0; a < 3; a++) Radial[a] = CameraBody[a] / CameraLength;
	for (auto& Pair : Nodes) Pair.Value->bVisible = false;
	for (FPlanetNode* N : Queue) N->bQueued = false;
	Queue.Reset();
	for (FPlanetNode* Root : Roots) Visit(Root, false, Now, CameraLength, Radial);
	for (auto& Pair : Nodes)
	{
		FPlanetNode* N = Pair.Value.Get();
		if (N->Mesh && N->Mesh->IsVisible() != N->bVisible) N->Mesh->SetVisibility(N->bVisible, true);
		if (N->Water && N->Water->IsVisible() != N->bVisible) N->Water->SetVisibility(N->bVisible);
	}
	if (Nodes.Num() > 1100)
	{
		for (auto& Pair : Nodes)
		{
			FPlanetNode* N = Pair.Value.Get();
			if (N->Level <= 3 || !N->Mesh || N->bVisible || N->bQueued || Now - N->LastUsed < 8.0) continue;
			DisposeNode(N);
		}
	}
	Dispatch();
}

void APlanetActor::UpdateCamera()
{
	if (const APlayerCameraManager* Camera = UGameplayStatics::GetPlayerCameraManager(this, 0))
	{
		FromUnreal(Camera->GetCameraLocation() - GetActorLocation(), CameraBody);
	}
}

void APlanetActor::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	Frame++;
	ApplyLook();
	FinishAlbedoBake();
	AdvanceMorphs(DeltaSeconds);
	UpdateCamera();
	CollectFinishedJobs();
	TimeSinceSelect += DeltaSeconds;
	if (TimeSinceSelect >= SelectIntervalSeconds)
	{
		TimeSinceSelect = 0;
		Select();
	}
	else
	{
		Dispatch();
	}
}
