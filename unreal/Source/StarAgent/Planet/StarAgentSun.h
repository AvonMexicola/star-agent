// The star as a directional light that drives the SkyAtmosphere, from
// world.js SUN_DIRECTION / SUN_ANGULAR_RADIUS. The physical star disc, corona
// and heat (stellar-world.js) are a later actor.
#pragma once
#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "StarAgentSun.generated.h"

class UDirectionalLightComponent;

UCLASS()
class STARAGENT_API AStarAgentSun : public AActor
{
	GENERATED_BODY()

public:
	AStarAgentSun();

	UPROPERTY(VisibleAnywhere, Category = "Sun")
	TObjectPtr<UDirectionalLightComponent> Light;

	/** Illuminance at the top of the atmosphere, lux. Real sunlight is about 100,000. */
	UPROPERTY(EditAnywhere, Category = "Sun")
	float Illuminance = 100000.f;

	/** Unit direction from the planet toward the star, browser frame (world.js SUN_DIRECTION). */
	static FVector SunDirectionUnreal();
};
