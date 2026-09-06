# Meshy shop soft-prop intake

**Geometry generated in Meshy; provider texturing/remesh in progress. No model
has been downloaded or integrated, and no new asset review is claimed.** Cees authorized Meshy for additional props after the Astra-reviewed
shop pass. This bounded pair adds soft, used objects to the existing rigid
fixtures: a Kestrel maintenance roll and folded Watchkeep protective gear.
Exact original generation prompts, target dimensions and proposed placements
are in [brief.json](brief.json).

The work is isolated on `feat/retail-soft-props`, based on `46b978f`, in
`/tmp/star-agent-retail-props`. The accepted shop preview and shared dirty
station/equipment assets remain untouched. Open PRs were checked: equipment,
fighter, base-building and flight options are separate active work.

## Browser route and access history

The primary conversation exposes no Meshy tool, and no Meshy environment credential or local
Meshy MCP server was found. The available plugin-management interface exposes no
plugin-search action. Existing project handoffs identify the Chrome integration
as the Meshy route. A bounded, read-only `claude -p --chrome` capability check
returned `You've hit your session limit`, with a midnight Europe/Amsterdam reset.
It did not establish browser connection, Meshy login, available credits or a
working generation UI. No generation request was submitted or credit spent.
The access result is retained at `/tmp/star-agent-meshy-capability.txt`.
That failure applies only to the mistakenly selected Claude bridge. It does not
establish that GPT browser access is blocked. Cees corrected the route: use GPT
for the bridge. The GPT Codex helper launched as `gpt-6-astra` and successfully connected the
Node REPL / OpenAI Chrome integration. Meshy’s workspace and Text-to-3D controls
loaded. That read-only check did not confirm login/credits and submitted no job.
A second GPT helper is now checking the account and carrying out the authorized
two-prop generation/export task. The receipt, when available, records actual
results; visible controls alone do not establish successful generation.

## Resume and integration contract

1. Use the GPT/Codex browser bridge for Meshy; do not invoke Claude. Inspect the actual generation
   UI and current job settings; begin with one candidate per saved prompt. Record
   provider job IDs, settings, date and original exported files outside `public`.
   Do not infer success from a submitted job or replace provenance with a prompt.
2. Inspect each model from several angles. Reject fused straps, floating cloth,
   filled folds, baked illumination or unrecognizable forms. Use the existing
   Blender cleanup pipeline with an explicit maximum texture edge of1024; its
   older default is2048 and does not meet this pack's contract. Orient and scale
   to the target bounds and base origin; decimate only after inspecting the folds.
3. Target at most8k triangles, one material,1MB and1024² textures per prop. Keep
   a budget/UV/material report, source hash, exact cleanup command and resulting
   GLB hash. Do not add manifest rows until real assets meet the contract.
4. Proposed positions use the actual counter insert top Y−6.908 from
   `blender/build_station_concourse.py`, not the lower steel worktop Y−6.92.
   The roll footprint is X11.88–12.20/Z−0.48–−0.02; the folded jacket is
   X−12.23–−11.85/Z−0.51–0.01. Check the final exported bounds and actual backing
   before accepting those placements. Both sit inside the existing counter
   silhouette, away from A5 holders, the care note and the terminal at Z1.23.
   No new floor collision, trailing cable or interaction is needed. The proposal
   does not establish that the generated models actually fit.
5. The prepared `src/station-shop-props.js` optional loader passes four focused
   resource/failure/transform tests but is not imported by the game yet. Attach
   local static meshes once per shop under the hub transform after real intake. Reuse their
   resources; no generation API, account or key belongs in runtime. Keep prints,
   inventory reach points, aisle collision and elevator geometry intact.
6. Capture the two affected entry/interior views and closeups in-game at1440×900
   scale1, inspect browser errors and full-size shadows, run affected physical
   purchase/collision checks, then measure the fixed hub GPU/CPU cost. Use unique
   run output paths. Astra reviews the actual integrated candidate; the preceding
   4.00 score does not cover these future assets.

Save rejected candidates and fixes in the production record. This preparation
adds no deployed feature and does not change the broader station PR's merge gate.

Cees later confirmed roughly25k Meshy credits are available for a presentation.
This permits useful visual iteration; it is not a requirement to consume the
balance. Prioritise recognisable, presentation-quality results and retain the
runtime budget/cleanup checks. The initial run remains two props, with actual
credit events in the generation receipt.

## Low-poly steering

Cees explicitly approved Low Poly mode, particularly for the folded jacket.
Prefer the actual Meshy Low Poly mode when available; record what was selected.
The initial two geometry jobs were already submitted under Meshy T1 / Smart
Topology when this steering arrived. Do not relabel those jobs as Low Poly.
Updated working budgets are1,500 target /2,000 maximum triangles for the jacket
and2,500 target /4,000 maximum for the roll. Preserve silhouette folds and let
normal/roughness maps carry stitches and wear. Inspect the cleaned render before
accepting any reduction; the original8k intake cap is an outer limit, not a target.

Cees further clarified that the completed Meshy model can be textured and
reduced in Meshy itself. Next use the existing generated model versions for
provider texturing and Remesh/Low Poly; preserve the original geometry and
record each derived version. Blender remains for final orientation, metre-scale
placement and validation, not the default substitute for Meshy postprocessing.
The denied browser-download action remains separate from these authorized
in-browser edits; do not retry or bypass that denial during postprocessing.

The prepared `blender/finish_shop_soft_prop.py` fits the provider export uniformly
to its metre-scale limits and retains supplied low-poly topology when it meets
the per-prop cap. It preserves the native source and emits a measured candidate
with1024² WebP PBR textures. Python syntax was checked; this script has not run
on the actual props because the GLBs have not been downloaded. It is not evidence
of budget compliance, exported UV correctness or visual acceptance.
