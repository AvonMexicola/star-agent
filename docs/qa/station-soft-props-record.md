# Meshy shop soft props — production record

**Provider finishing complete; export approval pending. No downloaded model, runtime integration, measured asset budget or
new visual acceptance is claimed.** The existing reviewed shops are unchanged.
Work is isolated in `/tmp/star-agent-retail-props`, `feat/retail-soft-props`, based
on the reviewed shop proceedings46b978f. The saved [brief](../../assets/station-shop/soft-props/brief.json)
contains exact original prompts, counter support heights and dimensions.

## User direction and corrected browser route

Cees authorized additional Meshy props, then explicitly said to use GPT for the
bridge. The first Claude Chrome capability check was the wrong route; its session
limit did not establish GPT or Meshy unavailability. A GPT Codex helper launched
as `gpt-6-astra` successfully loaded the configured Node REPL / OpenAI Chrome
integration and Meshy workspace. A subsequent account check established a signed-in
session and sufficient existing credits. No purchase or top-up was performed.

Cees confirmed credits were available for a presentation, approved Low Poly mode
particularly for the jacket, and clarified that Meshy can texture and reduce an
already generated model. The workflow now uses existing Meshy versions for those
stages, preserving the originals. Runtime targets are1,500 triangles for the
folded jacket (maximum2,000),2,500 for the tool roll (maximum4,000), one material
and1MB per GLB,1024² runtime texture edges. These are contracts, not measured
export results.

## Original geometry and first failure

Two exact Text-to-3D prompts were submitted under Meshy T1 / Smart Topology /
Triangle / no pose. Each submission automatically returned four candidates;
no count control or numeric triangle target was exposed at that stage. No
original geometry reroll was submitted. The operator inspected the default
candidate of each batch in the Meshy viewer, including an oblique view.

- Kestrel original:22,431 Faces with Triangle topology; recognizable textile
  pouch/roll with folds, buckles and exposed tool heads. It is more open than the
  requested partially closed roll. UV preparation completed on a separate result
  showing22,429 Faces; actual exported triangles have not been measured.
- Watchkeep original:25,244 Faces with Triangle topology; a folded workcoat-like
  form with crossed sleeves, collar and layers. Its first UV stage failed and
  reported a refund.

First-stage net charge45 credits:40 for the two geometry submissions,10 for two
UV submissions, less5 refunded. Exact observations, prompts, settings, provider
limitations and recovery steps are in the [generation receipt](../../assets/station-shop/soft-props/generation-receipt.json).
Remaining account balances are omitted from the versioned record. Provider job
IDs or unique source permalinks were not exposed; DOM IDs were not invented as
job IDs. Recover the existing models through My Assets using the exact prompt
prefixes, the09/06/2026 date, originalx4 batches and recorded geometry counts.

The attempted GLB export was denied by browser security/approval handling. The
reported reason was: **“The user declined permission for this action.”** No file
was downloaded, and no alternate browser, hidden endpoint, credential extraction
or network route was used to bypass that denial. This export restriction does not
prevent the separately authorized in-browser texturing and remesh operations.

## In-Meshy postprocessing

The second GPT operator completed and released the [postprocessing receipt](../../assets/station-shop/soft-props/postprocess-receipt.json), using the existing
versions. Meshy exposed Remesh with Fixed / Custom / Triangle controls, at a
visible cost of0 credits. The jacket target1,500 yielded a reduced version with
1,207 Faces / Triangle in the UI. Sleeves and collar remain recognizable, with
more angular rims and simplified small details. The reduced version's UV retry
succeeded after the original high-count version failed.

Meshy7 Flagship texturing offers2K,4K and8K;2K is the smallest available. Generate
PBR Maps was enabled. The roll received an ochre/charcoal PBR texturing job and
then a2,500 target reduction. The jacket's first textured result was grey/ivory
instead of the requested petrol/charcoal palette. That visual failure is retained;
one color-focused texturing retry was submitted on the existing reduced jacket.
The colour retry completed with a blue body, pale patches and dark trim. The
roll reduction completed at 2,571 Faces / Triangle but no longer showed a Normal
preview; a final PBR pass on that reduced version restored all four map previews.
Both selected versions are ready for export in Meshy. UI map previews do not prove
correct exported maps, texture dimensions or UV sampling.

Provider finishing completed at 2026-09-06 21:33 UTC. It cost 45 credits: two
zero-cost reductions, a 5-credit UV recovery and four 10-credit texture submissions.
Together with original generation/UV work, the pair cost a net 90 credits. No
new original geometry submission, purchase or top-up occurred in finishing.

The GPT operator inspected front and oblique provider views. The jacket retains
a jagged collar/rim and some angular folds; the roll's pockets remain smoother
than the intended canvas, buckle metal definition is weak, and the original
open-pouch shape remains. No local preview screenshot was saved. These observations
are not root image inspection or independent Astra acceptance. Exact selected
version recovery instructions and rejected intermediate variants are in the receipt.

No download was retried during this provider finishing stage. The prior browser
approval rejection must be resolved before downloading the two exact finished
versions. The accepted shop preview and game runtime remain unchanged.

## Prepared local intake and integration

`blender/finish_shop_soft_prop.py` reuses the shared cleaner, preserves the native
source, fits the flat prop uniformly to its specified bounds, establishes a base
origin, retains provider topology already within the cap, and exports a measured
candidate with WebP maps outside `public`. Blender reduction is only a fallback
for an oversized export. Python syntax passes, but no real model has been processed
because none has been downloaded. Blender's installed exporter exposes WebP options;
its startup reported an unrelated missing cattrs addon dependency and audio warnings.
Those were not represented as a clean asset-processing run.

`src/station-shop-props.js` prepares optional independent GLB loads and hub-local
attachment groups. It preserves PBR resources and keeps failures separate from
station finish. Four focused tests pass for cache reuse, mixed failure isolation,
placement transforms and shared resources. This module is **not imported by the
game yet**; those tests do not establish actual model budgets or visual readiness.

After approved exports: inspect original and cleaned models, measure GLB counts,
UVs, texture sizes and full bounds, verify actual counter support and clearances,
then integrate the optional loader. Use an isolated preview for actual game
screenshots, shader errors, physical purchase/fallback checks and hub GPU/CPU
measurements. Request independent Astra review of that exact integrated candidate.
The prior shops'4.00 score does not cover these future props. Preserve failed
results and update the station pipeline memory and manager handoff on delivery.
