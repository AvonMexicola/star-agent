// On-foot player for the first milestone: a capsule character whose gravity
// points at the planet centre. F returns to the fly pawn it was dropped from.
//
// The Character Movement Component walks along an arbitrary gravity direction
// (set each tick by UPlanetGravityComponent); this class keeps the capsule's up
// aligned with local up and applies mouse yaw around it, mouse pitch on the
// camera only. If the ground collision has not streamed in yet and the capsule
// sinks below the analytic surface, it is lifted back onto it.
#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Character.h"
#include "StarAgentCharacter.generated.h"

class APlanetActor;
class UCameraComponent;
class UPlanetGravityComponent;

UCLASS()
class STARAGENT_API AStarAgentCharacter : public ACharacter
{
	GENERATED_BODY()

public:
	AStarAgentCharacter();

	UPROPERTY(VisibleAnywhere, Category = "Walk")
	TObjectPtr<UCameraComponent> Camera;

	UPROPERTY(VisibleAnywhere, Category = "Walk")
	TObjectPtr<UPlanetGravityComponent> Gravity;

	UPROPERTY(EditAnywhere, Category = "Walk")
	TObjectPtr<APlanetActor> Planet;

	/** Pawn to possess again on F (the fly pawn that spawned this character). */
	UPROPERTY(VisibleAnywhere, Category = "Walk")
	TObjectPtr<APawn> ReturnPawn;

	UPROPERTY(EditAnywhere, Category = "Walk")
	float LookSensitivity = 0.12f;

	virtual void SetupPlayerInputComponent(UInputComponent* InInputComponent) override;
	virtual void AddControllerYawInput(float Val) override;
	virtual void AddControllerPitchInput(float Val) override;

	void MoveForwardInput(float Val);
	void MoveRightInput(float Val);
	void JumpInput(float Val);
	void ReturnToFlight();

protected:
	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;

private:
	float PendingYaw = 0.f, Pitch = 0.f;
};
