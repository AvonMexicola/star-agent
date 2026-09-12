#include "StarAgentCharacter.h"
#include "PlanetActor.h"
#include "PlanetFrame.h"
#include "PlanetGravityComponent.h"
#include "AeonSurface.h"
#include "Camera/CameraComponent.h"
#include "Components/CapsuleComponent.h"
#include "Components/InputComponent.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "GameFramework/PlayerController.h"
#include "GameFramework/PlayerInput.h"
#include "Kismet/GameplayStatics.h"

static const FName WalkForwardAxis(TEXT("StarAgent_WalkForward")), WalkRightAxis(TEXT("StarAgent_WalkRight"));
static const FName WalkTurnAxis(TEXT("StarAgent_WalkTurn")), WalkLookAxis(TEXT("StarAgent_WalkLookUp")), WalkJumpAxis(TEXT("StarAgent_WalkJump"));
static const FName WalkToggleAction(TEXT("StarAgent_Walk"));

AStarAgentCharacter::AStarAgentCharacter()
{
	PrimaryActorTick.bCanEverTick = true;
	bUseControllerRotationPitch = bUseControllerRotationYaw = bUseControllerRotationRoll = false;
	GetCharacterMovement()->bOrientRotationToMovement = false;
	GetCharacterMovement()->MaxWalkSpeed = 500.f;   // 5 m/s
	GetCharacterMovement()->JumpZVelocity = 450.f;
	GetCharacterMovement()->AirControl = 0.3f;
	BaseEyeHeight = 70.f;
	Camera = CreateDefaultSubobject<UCameraComponent>(TEXT("Camera"));
	Camera->SetupAttachment(GetCapsuleComponent());
	Camera->SetRelativeLocation(FVector(0, 0, BaseEyeHeight));
	Camera->bUsePawnControlRotation = false;
	Gravity = CreateDefaultSubobject<UPlanetGravityComponent>(TEXT("Gravity"));
}

void AStarAgentCharacter::SetupPlayerInputComponent(UInputComponent* InInputComponent)
{
	Super::SetupPlayerInputComponent(InInputComponent);
	static bool bMappingsAdded = false;
	if (!bMappingsAdded)
	{
		bMappingsAdded = true;
		UPlayerInput::AddEngineDefinedAxisMapping(FInputAxisKeyMapping(WalkForwardAxis, EKeys::W, 1.f));
		UPlayerInput::AddEngineDefinedAxisMapping(FInputAxisKeyMapping(WalkForwardAxis, EKeys::S, -1.f));
		UPlayerInput::AddEngineDefinedAxisMapping(FInputAxisKeyMapping(WalkForwardAxis, EKeys::Gamepad_LeftY, 1.f));
		UPlayerInput::AddEngineDefinedAxisMapping(FInputAxisKeyMapping(WalkRightAxis, EKeys::D, 1.f));
		UPlayerInput::AddEngineDefinedAxisMapping(FInputAxisKeyMapping(WalkRightAxis, EKeys::A, -1.f));
		UPlayerInput::AddEngineDefinedAxisMapping(FInputAxisKeyMapping(WalkRightAxis, EKeys::Gamepad_LeftX, 1.f));
		UPlayerInput::AddEngineDefinedAxisMapping(FInputAxisKeyMapping(WalkTurnAxis, EKeys::MouseX, 1.f));
		UPlayerInput::AddEngineDefinedAxisMapping(FInputAxisKeyMapping(WalkLookAxis, EKeys::MouseY, -1.f));
		UPlayerInput::AddEngineDefinedAxisMapping(FInputAxisKeyMapping(WalkJumpAxis, EKeys::SpaceBar, 1.f));
		UPlayerInput::AddEngineDefinedAxisMapping(FInputAxisKeyMapping(WalkJumpAxis, EKeys::Gamepad_FaceButton_Bottom, 1.f));
		UPlayerInput::AddEngineDefinedActionMapping(FInputActionKeyMapping(WalkToggleAction, EKeys::F));
		UPlayerInput::AddEngineDefinedActionMapping(FInputActionKeyMapping(WalkToggleAction, EKeys::Gamepad_FaceButton_Top));
	}
	InInputComponent->BindAxis(WalkForwardAxis, this, &AStarAgentCharacter::MoveForwardInput);
	InInputComponent->BindAxis(WalkRightAxis, this, &AStarAgentCharacter::MoveRightInput);
	InInputComponent->BindAxis(WalkTurnAxis, this, &AStarAgentCharacter::AddControllerYawInput);
	InInputComponent->BindAxis(WalkLookAxis, this, &AStarAgentCharacter::AddControllerPitchInput);
	InInputComponent->BindAxis(WalkJumpAxis, this, &AStarAgentCharacter::JumpInput);
	InInputComponent->BindAction(WalkToggleAction, IE_Pressed, this, &AStarAgentCharacter::ReturnToFlight);
}

void AStarAgentCharacter::BeginPlay()
{
	Super::BeginPlay();
	if (!Planet) Planet = Cast<APlanetActor>(UGameplayStatics::GetActorOfClass(this, APlanetActor::StaticClass()));
	if (Gravity && Planet) Gravity->Planet = Planet;
}

void AStarAgentCharacter::MoveForwardInput(float Val) { if (Val != 0.f) AddMovementInput(GetActorForwardVector(), Val); }
void AStarAgentCharacter::MoveRightInput(float Val) { if (Val != 0.f) AddMovementInput(GetActorRightVector(), Val); }
void AStarAgentCharacter::JumpInput(float Val) { if (Val > 0.5f) Jump(); else StopJumping(); }
void AStarAgentCharacter::AddControllerYawInput(float Val) { PendingYaw += Val * LookSensitivity; }
void AStarAgentCharacter::AddControllerPitchInput(float Val) { Pitch = FMath::Clamp(Pitch + Val * LookSensitivity, -85.f, 85.f); }

void AStarAgentCharacter::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	if (!Planet) return;
	// Local up from the planet, forward kept tangent to the ground, yaw about up.
	double D[3];
	Planet->GetBodyDirection(GetActorLocation(), D);
	const FVector Up = ToUnrealDirection(D);
	FVector Forward = GetActorForwardVector();
	Forward = (Forward - Up * FVector::DotProduct(Forward, Up)).GetSafeNormal();
	if (Forward.IsNearlyZero()) Forward = FVector::CrossProduct(Up, FVector::RightVector).GetSafeNormal();
	if (PendingYaw != 0.f) { Forward = Forward.RotateAngleAxis(PendingYaw, Up); PendingYaw = 0.f; }
	SetActorRotation(FRotationMatrix::MakeFromZX(Up, Forward).ToQuat());
	if (Camera) Camera->SetRelativeRotation(FRotator(Pitch, 0.f, 0.f));
	if (Controller) Controller->SetControlRotation(GetActorRotation());

	// Safety net while collision patches stream in: never sink below the analytic surface.
	const double Altitude = Planet->GetAltitudeMetres(GetActorLocation());
	const double HalfHeight = GetCapsuleComponent()->GetScaledCapsuleHalfHeight() / 100.0;
	if (Altitude < HalfHeight - 0.5)
	{
		SetActorLocation(GetActorLocation() + Up * static_cast<float>((HalfHeight + 0.2 - Altitude) * 100.0), false, nullptr, ETeleportType::TeleportPhysics);
		GetCharacterMovement()->Velocity = FVector::ZeroVector;
	}
}

void AStarAgentCharacter::ReturnToFlight()
{
	APlayerController* PC = Cast<APlayerController>(Controller);
	if (!PC || !ReturnPawn) return;
	double D[3];
	if (Planet) Planet->GetBodyDirection(GetActorLocation(), D); else { D[0] = 0; D[1] = 1; D[2] = 0; }
	const FVector Up = ToUnrealDirection(D);
	ReturnPawn->SetActorLocation(GetActorLocation() + Up * 300.f, false, nullptr, ETeleportType::TeleportPhysics);
	ReturnPawn->SetActorRotation(GetActorRotation());
	ReturnPawn->SetActorHiddenInGame(false);
	PC->Possess(ReturnPawn);
	Destroy();
}
