// Assisted free flight for the first milestone: a six-degree-of-freedom pawn
// whose speed scales with altitude (src/navigation.js assisted mode).
//
// Mouse yaws and pitches, Q/E roll, WASD move in the pawn's own frame and
// Space/C move along its own up axis. Orientation is a quaternion owned by the
// pawn, not the controller, so there is no gimbal lock and no "world up".
#pragma once
#include "CoreMinimal.h"
#include "GameFramework/DefaultPawn.h"
#include "StarAgentFlyPawn.generated.h"

class APlanetActor;
class UCameraComponent;

UCLASS()
class STARAGENT_API AStarAgentFlyPawn : public ADefaultPawn
{
	GENERATED_BODY()

public:
	AStarAgentFlyPawn();

	UPROPERTY(VisibleAnywhere, Category = "Flight")
	TObjectPtr<UCameraComponent> Camera;

	UPROPERTY(EditAnywhere, Category = "Flight")
	TObjectPtr<APlanetActor> Planet;

	/** Metres per second at zero altitude. */
	UPROPERTY(EditAnywhere, Category = "Flight")
	float MinSpeedMetres = 3.f;

	/** Metres per second cap; 20 km/s crosses Aeon in minutes. */
	UPROPERTY(EditAnywhere, Category = "Flight")
	float MaxSpeedMetres = 20000.f;

	/** Speed = clamp(altitude * this, Min, Max). */
	UPROPERTY(EditAnywhere, Category = "Flight")
	float SpeedPerMetreOfAltitude = 0.5f;

	/** Degrees of yaw/pitch per mouse unit. */
	UPROPERTY(EditAnywhere, Category = "Flight")
	float LookSensitivity = 0.12f;

	/** Flip if pushing the mouse forward pitches the wrong way for you. */
	UPROPERTY(EditAnywhere, Category = "Flight")
	bool bInvertMousePitch = false;

	/** Degrees per second of roll while Q or E is held. */
	UPROPERTY(EditAnywhere, Category = "Flight")
	float RollDegreesPerSecond = 90.f;

	UPROPERTY(VisibleAnywhere, Category = "Flight")
	float AltitudeMetres = 0.f;

	virtual void SetupPlayerInputComponent(UInputComponent* InInputComponent) override;
	virtual void MoveForward(float Val) override;
	virtual void MoveRight(float Val) override;
	virtual void MoveUp_World(float Val) override;
	virtual void AddControllerYawInput(float Val) override;
	virtual void AddControllerPitchInput(float Val) override;
	virtual void AddControllerRollInput(float Val) override;
	void RollInput(float Val);

protected:
	virtual void BeginPlay() override;
	virtual void Tick(float DeltaSeconds) override;

private:
	FQuat Orientation = FQuat::Identity;
	float PendingYaw = 0.f, PendingPitch = 0.f, PendingRoll = 0.f, RollAxis = 0.f;
};
