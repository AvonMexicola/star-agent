// Radial inverse-square gravity toward a planet. Unreal's gravity is a global
// -Z vector, so every actor on a sphere gets one of these.
//
// Characters: sets the Character Movement Component's gravity direction and
// scale each tick, so walking, jumping and sliding follow the local vertical.
// Physics bodies: engine gravity is disabled and the acceleration is applied as
// a force. Same 9.81 m/s^2 at Aeon's base sphere as src/navigation.js.
#pragma once
#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "PlanetGravityComponent.generated.h"

class APlanetActor;

UCLASS(ClassGroup = (StarAgent), meta = (BlueprintSpawnableComponent))
class STARAGENT_API UPlanetGravityComponent : public UActorComponent
{
	GENERATED_BODY()

public:
	UPlanetGravityComponent();

	/** Planet to fall toward; the first APlanetActor in the level when unset. */
	UPROPERTY(EditAnywhere, Category = "Gravity")
	TObjectPtr<APlanetActor> Planet;

	/** Current gravity acceleration, m/s^2 (read-only). */
	UPROPERTY(VisibleAnywhere, Category = "Gravity")
	float CurrentGravity = 0.f;

	/** Unit vector toward the planet centre, world frame (read-only). */
	UPROPERTY(VisibleAnywhere, Category = "Gravity")
	FVector Down = FVector::DownVector;

protected:
	virtual void BeginPlay() override;
	virtual void TickComponent(float DeltaSeconds, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction) override;

private:
	bool bDisabledEngineGravity = false;
};
