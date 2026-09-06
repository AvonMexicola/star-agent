# Meshy shop soft-prop intake

**Prepared only. No generation job, downloaded model, runtime placement or review
is claimed.** Cees authorized Meshy for additional props after the Astra-reviewed
shop pass. This bounded pair adds soft, used objects to the existing rigid
fixtures: a Kestrel maintenance roll and folded Watchkeep protective gear.
Exact original generation prompts, target dimensions and proposed placements
are in [brief.json](brief.json).

The work is isolated on `feat/retail-soft-props`, based on `46b978f`, in
`/tmp/star-agent-retail-props`. The accepted shop preview and shared dirty
station/equipment assets remain untouched. Open PRs were checked: equipment,
fighter, base-building and flight options are separate active work.

## Access check and blocker

This session exposes no Meshy tool, and no Meshy environment credential or local
Meshy MCP server was found. The available plugin-management interface exposes no
plugin-search action. Existing project handoffs identify the Chrome integration
as the Meshy route. A bounded, read-only `claude -p --chrome` capability check
returned `You've hit your session limit`, with a midnight Europe/Amsterdam reset.
It did not establish browser connection, Meshy login, available credits or a
working generation UI. No generation request was submitted or credit spent.
The access result is retained at `/tmp/star-agent-meshy-capability.txt`.
This is a tooling/session blocker, not an asset or game failure.

## Resume and integration contract

1. Restore a usable Meshy browser/tool connection. Inspect the actual generation
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
5. Attach local static meshes once per shop under the hub transform. Reuse their
   resources; no generation API, account or key belongs in runtime. Keep prints,
   inventory reach points, aisle collision and elevator geometry intact.
6. Capture the two affected entry/interior views and closeups in-game at1440×900
   scale1, inspect browser errors and full-size shadows, run affected physical
   purchase/collision checks, then measure the fixed hub GPU/CPU cost. Use unique
   run output paths. Astra reviews the actual integrated candidate; the preceding
   4.00 score does not cover these future assets.

Save rejected candidates and fixes in the production record. This preparation
adds no deployed feature and does not change the broader station PR's merge gate.
