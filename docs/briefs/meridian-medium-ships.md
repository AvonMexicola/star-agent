# Meridian medium mining ship and rover transport

Cees requests two playable ships between Nomad and Atlas: a dedicated mining ship and a transport that can carry a miner. The working payload is the existing Burrow M-04 rover. Stratum M-05 and Gannet T-06 are working names. This is an active production brief; no new ship is implemented, validated or accepted by this record.

## Result and physical targets

Use the measured [intake](../design/medium-ships-intake.md), with one deliberate authoring improvement: **Gannet has a 5.8 m net clear bay width**, X -2.9 to 2.9, instead of the intake's minimum 5.0 m. This reserves a useful walking margin beside the parked rover. The two freight banks move outward to X -4.1 to -2.9 and 2.9 to 4.1. Door swing, full player sweeps and actual authored support still need testing.

- **Stratum M-05:** closed bounds [-6.5,0,-10] to [6.5,5.6,8], deck1.35, enclosed cabin and physical rear ramp. Keep the intake's1.9m portal and5.2m ramp run, four real MFD mount frames, gear and two actual forward mining muzzles. 384kg named persistent ore bin,32SBU freight, proposed240kg supplies are separate ledgers. Aiming and extraction use actual muzzle rays and committed voxel edits. The first supported targets are existing mineable outcrops/small ring rocks; no giant-asteroid or refining claim.
- **Gannet T-06:** closed bounds [-8,0,-13] to [8,7.2,11], deck1.4, enclosed cabin, one aft belly lift0..1.4m and a **5.8×6.5×3.2m clear rover bay**. Preserve the intake's Z4.5..11 platform and explicit rear ground exit. Burrow park[-.3,1.4,7.525], headingπ; reserve port door and player boarding route. 128SBU freight remains usable with Burrow aboard; proposed960kg supplies are separate. Lift/hatch must secure for flight. No mining tool on the transport.

Geometry targets are binding within each checkpoint; changes to floor/portal/platform/moving envelopes must be communicated and matched in canonical layout before export. Include named nozzle nodes for fleet effects, gear pivots, ramp/lift/hatch parts, pilot eye, standing eye, four MFD mounts and collision part definitions. No scaled copy of a complete existing hull.

## Art and acceptance

Original Meridian ivory ceramic, graphite structure, petrol service panels, brushed mechanism metal, restrained mint status and amber hazards. Stratum has distinct extraction booms and ore machinery; Gannet has a protected rear loading volume and outboard drives. Both need a strong silhouette at30m, fitted panels, believable access mechanisms, measured1.8m human scale and a clear real pilot view. Preserve source/provenance, deterministic Blender builder, editable blend, UV/PBR maps and failed iterations. Use existing Kestrel/hangar workflow; core play and production do not require a paid service.

Default per-ship budget:60k triangles,4MB GLB, textures at most1024² WebP. Count interior and moving fittings; additionally measure loaded Gannet + Burrow + freight. Independent review must satisfy QUALITY (average at least4.0, no applicable criterion below3); silhouette target4.5 before final material detail. Never substitute a studio score for actual cockpit, boarding, mining or rover carriage acceptance.

Full completion includes ship selection, continuous flight/landing, physical keyboard/controller/touch boarding, supported cargo/mining persistence, gear/access cycles and held-input suppression. Gannet must physically load Burrow, allow cabin access, secure/carry it during real flight, land and unload. Validate station fit using actual complete geometry. Keep offline and online claims separate; trusted server hull/tool validation is required before enabling online use.

## Ownership and integration

Base dev/all-features0a18574. Root uses feat/meridian-medium-integration at star-agent-medium-integration. Stratum author owns only new assets/stratum/, blender/build_stratum.py (plus stratum-prefixed helper scripts), public/models/stratum.glb, src/stratum*.js/css, public/dev/stratum.html, hull-only scripts/tests/docs. Gannet author owns equivalent gannet paths in a separate worktree. Root owns this common brief, task metadata and shared fleet/main/navigation/cargo/server/carrier integration. Authors must not modify shared hooks, package.json, existing hulls, rover or common materials without coordination.

Preview ports5580 Stratum,5581 Gannet,5582 integration are reserved; no GPU launch until root coordinates the shared queue. First author delivery is a complete, rebuildable geometry/material candidate and hull-only loader/studio with measured layout, moving poses and budgets. Root integrates runtime after station handoff; existing fleet FX/new Atlas/performance/cargo/hub work stays preserved. Cees gates public merge/release; coherent local checkpoints follow the assigned integration steward.
