#include "PlanetGravityComponent.h"
#include "PlanetActor.h"
#include "Components/PrimitiveComponent.h"
#include "GameFramework/Character.h"
#include "GameFramework/CharacterMovementComponent.h"
#include "Kismet/GameplayStatics.h"

UPlanetGravityComponent::UPlanetGravityComponent()
{
	PrimaryComponentTick.bCanEverTick = true;
	PrimaryComponentTick.TickGroup = TG_PrePhysics;
}

void UPlanetGravityComponent::BeginPlay()
{
	Super::BeginPlay();
	if (!Planet)
	{
		Planet = Cast<APlanetActor>(UGameplayStatics::GetActorOfClass(this, APlanetActor::StaticClass()));
	}
}

void UPlanetGravityComponent::TickComponent(float DeltaSeconds, ELevelTick TickType, FActorComponentTickFunction* ThisTickFunction)
{
	Super::TickComponent(DeltaSeconds, TickType, ThisTickFunction);
	AActor* Owner = GetOwner();
	if (!Planet || !Owner) return;

	const FVector ToCentre = Planet->GetActorLocation() - Owner->GetActorLocation();
	const double DistanceMetres = ToCentre.Length() / 100.0;
	if (DistanceMetres <= 1.0) return;
	Down = ToCentre / (DistanceMetres * 100.0);
	const double R = Planet->GetRadiusMetres();
	// Inverse-square from the base sphere, as flight-model.js. Inside the sphere
	// (mines, canyons below the reference radius) keep surface gravity.
	const double Ratio = R / FMath::Max(DistanceMetres, R);
	CurrentGravity = static_cast<float>(Planet->GetSurfaceGravity() * Ratio * Ratio);

	if (ACharacter* Character = Cast<ACharacter>(Owner))
	{
		if (UCharacterMovementComponent* Movement = Character->GetCharacterMovement())
		{
			Movement->SetGravityDirection(Down);
			// CMC scales the world's GetGravityZ() (default -980 cm/s^2) by GravityScale.
			const float WorldGravity = FMath::Abs(Movement->GetGravityZ());
			Movement->GravityScale = WorldGravity > 0.f ? (CurrentGravity * 100.f) / WorldGravity : 1.f;
		}
		return;
	}

	if (UPrimitiveComponent* Body = Cast<UPrimitiveComponent>(Owner->GetRootComponent()))
	{
		if (!Body->IsSimulatingPhysics()) return;
		if (!bDisabledEngineGravity)
		{
			Body->SetEnableGravity(false);
			bDisabledEngineGravity = true;
		}
		Body->AddForce(Down * (CurrentGravity * 100.0), NAME_None, /*bAccelChange*/ true);
	}
}
