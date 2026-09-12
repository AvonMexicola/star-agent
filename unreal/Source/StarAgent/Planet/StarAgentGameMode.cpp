#include "StarAgentGameMode.h"
#include "PlanetActor.h"
#include "PlanetFrame.h"
#include "StarAgentFlyPawn.h"
#include "StarAgentSun.h"
#include "AeonSurface.h"
#include "Kismet/GameplayStatics.h"

AStarAgentGameMode::AStarAgentGameMode()
{
	DefaultPawnClass = AStarAgentFlyPawn::StaticClass();
}

void AStarAgentGameMode::InitGame(const FString& MapName, const FString& Options, FString& ErrorMessage)
{
	Super::InitGame(MapName, Options, ErrorMessage);
	UWorld* World = GetWorld();
	if (!UGameplayStatics::GetActorOfClass(World, APlanetActor::StaticClass()))
	{
		World->SpawnActor<APlanetActor>(APlanetActor::StaticClass(), FTransform::Identity);
	}
	if (!UGameplayStatics::GetActorOfClass(World, AStarAgentSun::StaticClass()))
	{
		World->SpawnActor<AStarAgentSun>(AStarAgentSun::StaticClass(), FTransform::Identity);
	}
}

void AStarAgentGameMode::RestartPlayer(AController* NewPlayer)
{
	// planet.js initial observer: (0, 0, 2R) in the browser frame, facing the centre.
	const FVector Location = StarAgent::ToUnreal(0.0, 0.0, StarAgent::Aeon::Radius * 2.0);
	const FRotator Rotation = FRotationMatrix::MakeFromX(-Location.GetSafeNormal()).Rotator();
	RestartPlayerAtTransform(NewPlayer, FTransform(Rotation, Location));
}
