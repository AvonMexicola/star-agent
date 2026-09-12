#include "StarAgentSun.h"
#include "PlanetFrame.h"
#include "AeonSurface.h"
#include "Components/DirectionalLightComponent.h"

FVector AStarAgentSun::SunDirectionUnreal()
{
	// world.js: [.9, .35, .12] normalised with Math.hypot.
	const double L = FMath::Sqrt(.9 * .9 + .35 * .35 + .12 * .12);
	return StarAgent::ToUnrealDirection(.9 / L, .35 / L, .12 / L);
}

AStarAgentSun::AStarAgentSun()
{
	PrimaryActorTick.bCanEverTick = false;
	Light = CreateDefaultSubobject<UDirectionalLightComponent>(TEXT("Light"));
	RootComponent = Light;
	Light->SetMobility(EComponentMobility::Movable);
	Light->Intensity = Illuminance;
	Light->bAtmosphereSunLight = true;
	// Angular diameter 2*asin(SUN_RADIUS/SUN_DISTANCE) in degrees, about 1.10.
	Light->LightSourceAngle = static_cast<float>(FMath::RadiansToDegrees(2.0 * FMath::Asin(StarAgent::Aeon::SunRadius / StarAgent::Aeon::SunDistance)));
	Light->bCastShadowsOnAtmosphere = true;
	// Light travels from the star to the planet: opposite of the sun direction.
	Light->SetRelativeRotation(FRotationMatrix::MakeFromX(-SunDirectionUnreal()).Rotator());
}
