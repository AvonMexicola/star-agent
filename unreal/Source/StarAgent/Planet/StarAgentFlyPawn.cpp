#include "StarAgentFlyPawn.h"
#include "PlanetActor.h"
#include "PlanetFrame.h"
#include "StarAgentCharacter.h"
#include "AeonSurface.h"
#include "GameFramework/PlayerController.h"
#include "Camera/CameraComponent.h"
#include "Components/InputComponent.h"
#include "GameFramework/FloatingPawnMovement.h"
#include "GameFramework/PlayerController.h"
#include "GameFramework/PlayerInput.h"
#include "Kismet/GameplayStatics.h"

static const FName RollAxisName(TEXT("StarAgent_Roll"));
static const FName WalkActionName(TEXT("StarAgent_Walk"));

AStarAgentFlyPawn::AStarAgentFlyPawn()
{
	PrimaryActorTick.bCanEverTick = true;
	bAddDefaultMovementBindings = true;
	// The pawn owns its orientation; the controller's rotation only mirrors it.
	bUseControllerRotationPitch = false;
	bUseControllerRotationYaw = false;
	bUseControllerRotationRoll = false;
	Camera = CreateDefaultSubobject<UCameraComponent>(TEXT("Camera"));
	Camera->SetupAttachment(GetRootComponent());
	Camera->bUsePawnControlRotation = false;
}

void AStarAgentFlyPawn::SetupPlayerInputComponent(UInputComponent* InInputComponent)
{
	Super::SetupPlayerInputComponent(InInputComponent);  // WASD, Space/C, mouse, gamepad
	static bool bRollMappingAdded = false;
	if (!bRollMappingAdded)
	{
		bRollMappingAdded = true;
		UPlayerInput::AddEngineDefinedAxisMapping(FInputAxisKeyMapping(RollAxisName, EKeys::E, 1.f));
		UPlayerInput::AddEngineDefinedAxisMapping(FInputAxisKeyMapping(RollAxisName, EKeys::Q, -1.f));
		UPlayerInput::AddEngineDefinedAxisMapping(FInputAxisKeyMapping(RollAxisName, EKeys::Gamepad_RightTrigger, 1.f));
		UPlayerInput::AddEngineDefinedAxisMapping(FInputAxisKeyMapping(RollAxisName, EKeys::Gamepad_LeftTrigger, -1.f));
		UPlayerInput::AddEngineDefinedActionMapping(FInputActionKeyMapping(WalkActionName, EKeys::F));
		UPlayerInput::AddEngineDefinedActionMapping(FInputActionKeyMapping(WalkActionName, EKeys::Gamepad_FaceButton_Top));
	}
	InInputComponent->BindAxis(RollAxisName, this, &AStarAgentFlyPawn::RollInput);
	InInputComponent->BindAction(WalkActionName, IE_Pressed, this, &AStarAgentFlyPawn::ToggleWalk);
}

void AStarAgentFlyPawn::BeginPlay()
{
	Super::BeginPlay();
	Orientation = GetActorQuat();
	if (!Planet)
	{
		Planet = Cast<APlanetActor>(UGameplayStatics::GetActorOfClass(this, APlanetActor::StaticClass()));
	}
}

// Movement in the pawn's own frame (ADefaultPawn uses the controller's view rotation).
void AStarAgentFlyPawn::MoveForward(float Val) { if (Val != 0.f) AddMovementInput(GetActorForwardVector(), Val); }
void AStarAgentFlyPawn::MoveRight(float Val) { if (Val != 0.f) AddMovementInput(GetActorRightVector(), Val); }
void AStarAgentFlyPawn::MoveUp_World(float Val) { if (Val != 0.f) AddMovementInput(GetActorUpVector(), Val); }

// Look input accumulates into local-axis rotations applied once per tick.
void AStarAgentFlyPawn::AddControllerYawInput(float Val) { PendingYaw += Val * LookSensitivity; }
void AStarAgentFlyPawn::AddControllerPitchInput(float Val) { PendingPitch += Val * LookSensitivity; }
void AStarAgentFlyPawn::AddControllerRollInput(float Val) { PendingRoll += Val; }
void AStarAgentFlyPawn::RollInput(float Val) { RollAxis = Val; }

void AStarAgentFlyPawn::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	// Yaw about local up, pitch about local right, roll about local forward.
	// Mouse pitch is inverted here so pushing forward pitches the nose down, as
	// in the browser's flight controls. Rotations compose on the right (local frame).
	const float RollDeg = PendingRoll + RollAxis * RollDegreesPerSecond * DeltaSeconds;
	if (PendingYaw != 0.f || PendingPitch != 0.f || RollDeg != 0.f)
	{
		Orientation = Orientation
			* FQuat(FVector::UpVector, FMath::DegreesToRadians(PendingYaw))
			* FQuat(FVector::RightVector, FMath::DegreesToRadians(bInvertMousePitch ? PendingPitch : -PendingPitch))
			* FQuat(FVector::ForwardVector, FMath::DegreesToRadians(RollDeg));
		Orientation.Normalize();
		SetActorRotation(Orientation);
		if (Controller) Controller->SetControlRotation(Orientation.Rotator());
	}
	PendingYaw = PendingPitch = PendingRoll = 0.f;

	UFloatingPawnMovement* Movement = Cast<UFloatingPawnMovement>(GetMovementComponent());
	if (!Planet || !Movement) return;
	AltitudeMetres = static_cast<float>(Planet->GetAltitudeMetres(GetActorLocation()));
	const float Speed = FMath::Clamp(FMath::Abs(AltitudeMetres) * SpeedPerMetreOfAltitude, MinSpeedMetres, MaxSpeedMetres);
	Movement->MaxSpeed = Speed * 100.f;
	Movement->Acceleration = Speed * 200.f;
	Movement->Deceleration = Speed * 400.f;
}

void AStarAgentFlyPawn::ToggleWalk()
{
	APlayerController* PC = Cast<APlayerController>(GetController());
	if (!PC || !Planet) return;
	// Ground point straight below: analytic surface height, sea level on water.
	double D[3];
	Planet->GetBodyDirection(GetActorLocation(), D);
	const double H = FMath::Max(0.0, Planet->GetTerrainHeightMetres(D)) + 1.5;
	const FVector Up = StarAgent::ToUnrealDirection(D);
	const FVector Location = Planet->GetActorLocation() + StarAgent::ToUnreal(D[0] * (StarAgent::Aeon::Radius + H), D[1] * (StarAgent::Aeon::Radius + H), D[2] * (StarAgent::Aeon::Radius + H));
	FVector Forward = GetActorForwardVector();
	Forward = (Forward - Up * FVector::DotProduct(Forward, Up)).GetSafeNormal();
	if (Forward.IsNearlyZero()) Forward = FVector::CrossProduct(Up, FVector::RightVector).GetSafeNormal();
	FActorSpawnParameters Params;
	Params.SpawnCollisionHandlingOverride = ESpawnActorCollisionHandlingMethod::AlwaysSpawn;
	AStarAgentCharacter* Walker = GetWorld()->SpawnActor<AStarAgentCharacter>(AStarAgentCharacter::StaticClass(), FTransform(FRotationMatrix::MakeFromZX(Up, Forward).ToQuat(), Location), Params);
	if (!Walker) return;
	Walker->Planet = Planet;
	Walker->ReturnPawn = this;
	SetActorHiddenInGame(true);
	PC->Possess(Walker);
}

void AStarAgentFlyPawn::SA_Goto(float LatDeg, float LonDeg, float AltitudeMetres)
{
	if (!Planet) return;
	double D[3];
	StarAgent::Aeon::LatLonDirection(LatDeg, LonDeg, D);
	const double H = FMath::Max(0.0, Planet->GetTerrainHeightMetres(D)) + FMath::Max(0.5f, AltitudeMetres);
	const FVector Location = Planet->GetActorLocation() + StarAgent::ToUnreal(D[0] * (StarAgent::Aeon::Radius + H), D[1] * (StarAgent::Aeon::Radius + H), D[2] * (StarAgent::Aeon::Radius + H));
	SetActorLocation(Location, false, nullptr, ETeleportType::TeleportPhysics);
	if (UFloatingPawnMovement* Movement = Cast<UFloatingPawnMovement>(GetMovementComponent())) Movement->Velocity = FVector::ZeroVector;
	SA_Look(0.f, -30.f);
}

void AStarAgentFlyPawn::SA_Look(float YawDeg, float PitchDeg)
{
	if (!Planet) return;
	double D[3];
	Planet->GetBodyDirection(GetActorLocation(), D);
	const FVector Up = StarAgent::ToUnrealDirection(D);
	// Local north: the direction of increasing latitude, i.e. the browser +Y axis projected onto the tangent plane.
	FVector North = StarAgent::ToUnrealDirection(0.0, 1.0, 0.0);
	North = (North - Up * FVector::DotProduct(North, Up)).GetSafeNormal();
	if (North.IsNearlyZero()) North = FVector::CrossProduct(Up, FVector::RightVector).GetSafeNormal();
	const FVector Forward = North.RotateAngleAxis(YawDeg, Up);
	Orientation = FRotationMatrix::MakeFromZX(Up, Forward).ToQuat() * FQuat(FVector::RightVector, FMath::DegreesToRadians(-PitchDeg));
	Orientation.Normalize();
	SetActorRotation(Orientation);
	if (Controller) Controller->SetControlRotation(Orientation.Rotator());
}

void AStarAgentFlyPawn::SA_Walk() { ToggleWalk(); }
