#include "StarAgentFlyPawn.h"
#include "PlanetActor.h"
#include "Camera/CameraComponent.h"
#include "Components/InputComponent.h"
#include "GameFramework/FloatingPawnMovement.h"
#include "GameFramework/PlayerController.h"
#include "GameFramework/PlayerInput.h"
#include "Kismet/GameplayStatics.h"

static const FName RollAxisName(TEXT("StarAgent_Roll"));

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
	}
	InInputComponent->BindAxis(RollAxisName, this, &AStarAgentFlyPawn::RollInput);
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
