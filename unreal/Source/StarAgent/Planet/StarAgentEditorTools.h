// Editor-only helpers exposed to Python for unreal/tools/ue-remote.py:
// start and end a Play In Editor session. No-ops in a game build.
#pragma once
#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "StarAgentEditorTools.generated.h"

UCLASS()
class STARAGENT_API UStarAgentEditorTools : public UBlueprintFunctionLibrary
{
	GENERATED_BODY()

public:
	/** Starts Play In Editor in a new window (the remote harness screenshots that viewport). */
	UFUNCTION(BlueprintCallable, Category = "StarAgent|Editor")
	static bool StartPlay();

	UFUNCTION(BlueprintCallable, Category = "StarAgent|Editor")
	static void EndPlay();

	UFUNCTION(BlueprintCallable, Category = "StarAgent|Editor")
	static bool IsPlaying();
};
