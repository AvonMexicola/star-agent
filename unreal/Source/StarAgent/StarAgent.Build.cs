using UnrealBuildTool;

public class StarAgent : ModuleRules
{
	public StarAgent(ReadOnlyTargetRules Target) : base(Target)
	{
		PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;

		PublicDependencyModuleNames.AddRange(new string[] {
			"Core",
			"CoreUObject",
			"Engine",
			"InputCore",
			"EnhancedInput",
			// Runtime terrain patches: FDynamicMesh3 and UDynamicMeshComponent.
			"GeometryCore",
			"GeometryFramework",
			// Runtime-built placeholder vegetation meshes.
			"MeshDescription",
			"StaticMeshDescription",
			"MeshConversion"
		});

		PrivateDependencyModuleNames.AddRange(new string[] { });

		PublicIncludePaths.AddRange(new string[] {
			"StarAgent",
			// WorldGen is engine-free C++ shared with unreal/tools cross-checks.
			"StarAgent/WorldGen",
			"StarAgent/Planet"
		});
	}
}
