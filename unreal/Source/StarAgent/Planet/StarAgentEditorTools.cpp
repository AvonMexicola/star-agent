#include "StarAgentEditorTools.h"
#if WITH_EDITOR
#include "Editor.h"
#include "PlayInEditorDataTypes.h"
#endif

bool UStarAgentEditorTools::StartPlay()
{
#if WITH_EDITOR
	if (!GEditor || GEditor->IsPlaySessionInProgress()) return false;
	FRequestPlaySessionParams Params;
	Params.SessionDestination = EPlaySessionDestinationType::InProcess;
	Params.WorldType = EPlaySessionWorldType::PlayInEditor;
	GEditor->RequestPlaySession(Params);
	return true;
#else
	return false;
#endif
}

void UStarAgentEditorTools::EndPlay()
{
#if WITH_EDITOR
	if (GEditor) GEditor->RequestEndPlayMap();
#endif
}

bool UStarAgentEditorTools::IsPlaying()
{
#if WITH_EDITOR
	return GEditor && GEditor->IsPlaySessionInProgress();
#else
	return false;
#endif
}
