// Spawns Aeon and the sun when the level has none, and starts the player in
// orbit at two radii looking at the planet, like the browser's ?intro=0 start.
#pragma once
#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "StarAgentGameMode.generated.h"

UCLASS()
class STARAGENT_API AStarAgentGameMode : public AGameModeBase
{
	GENERATED_BODY()

public:
	AStarAgentGameMode();

	virtual void InitGame(const FString& MapName, const FString& Options, FString& ErrorMessage) override;
	/** Ignores PlayerStart actors and spawns in orbit at two radii, facing Aeon. */
	virtual void RestartPlayer(AController* NewPlayer) override;
};
