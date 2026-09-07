# Meshy shop soft props — production record

**KESTREL is optimized, integrated in the isolated review build and visually accepted by Astra at 4.00/5. Unit/build and four focused browser cases pass (touch after fixture correction). Jacket not downloaded; merge and deployment are separate.** The existing reviewed shops are unchanged.
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

## User rejection and GPT-image replacement — 2026-09-07

Cees rejected the final text-to-3D models as visually poor and supplied the
replacement production method: first make an isometric item reference using GPT
image on white with no shadows, then import that reference into Meshy. Earlier
provider completion is preserved as history, not asset approval. The old exports
are no longer the intended deliverable.

Root used the built-in GPT image tool, one call per prop, and inspected both
returned images. The new jacket reads as a carefully folded technical garment
with tucked sleeves, a short collar and structured seams; the ochre roll now
has closed contents and tight straps instead of the open tool rack. Images are
saved in assets/station-shop/soft-props/image-to-3d-v2/, alongside exact prompts,
dimensions, hashes and inspection limitations. Their material relief includes
self-shading; the jacket has slight grey at its lower edge. These are reference
inputs for reconstruction, not validated albedo maps or actual game evidence.

The GPT browser helper's first launch failed before connection because its local
app-server state was read-only in the sandbox. The explicit helper-launch
escalation was approved; it authorizes uploads and replacement generation,
excluding GLB downloads. The helper is assigned the new Meshy Image-to-3D
receipt only. Upload/generation results remain pending until directly observed.


Meshy Image to 3D was reached, but the first chooser attempt timed out. After
inspecting the actual UI and documented troubleshooting, the visible associated
label opened a chooser. Its documented setFiles call for the jacket reference
failed with `Error: {"code":-32000,"message":"Not allowed"}` and
`fileChooser.setFiles failed`. No more specific reason was exposed. The empty
upload field was verified afterwards; neither replacement job was submitted.
This is an upload-tool rejection, not a failed Meshy reconstruction or a credit
issue. No upload bypass or browser settings change was attempted. This attempt
spent zero Meshy credits; no export or game change occurred. Both original PNGs
and hashes remain intact for resuming through a functioning permitted upload.


## Upload permission diagnosis — 2026-09-07

Read-only diagnosis found no saved file-access grant for the installed ChatGPT
Chromium extension. Chromium's DOMHandler::SetFileInputFiles returns the exact
“Not allowed” error when allow_file_access is false, and its extension debugger's
MayReadLocalFiles delegates to util::AllowFileAccess. The supported setting to
check is ChatGPT extension Details > Allow access to file URLs. This is the
likely cause; no setting has been changed and no successful retry is claimed.
User should enable that specific permission in chrome://extensions, then use a
fresh bridge attachment for verification. Do not disable browser security or
change global Codex approval policy. Sources:
https://raw.githubusercontent.com/chromium/chromium/main/content/browser/devtools/protocol/dom_handler.cc
https://raw.githubusercontent.com/chromium/chromium/main/chrome/browser/extensions/api/debugger/debugger_api.cc
https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions


## File-access permission verified — 2026-09-07

Cees confirmed enabling ChatGPT extension > Allow access to file URLs. A fresh
GPT browser attachment then uploaded the exact jacket PNG successfully through
the documented file chooser. The operator visually verified the thumbnail and
submitted one High Detail / Meshy 7 Flagship Image-to-3D job, with Texture on
and Image Enhancement off to retain the supplied reference. This confirms that
the file-access change resolved the observed upload failure in this workflow.

Keep the pre-permission zero-job receipt intact. The continued operations and
actual charges belong to image-to-3d-v2/meshy-after-file-permission-receipt.json.
Model generation, final appearance, topology, maps, exports and game acceptance
remain separate checks; successful input upload establishes none of those.


## First image reconstruction pass and bounded recovery

Both exact PNGs uploaded and were visually matched to their thumbnails. Meshy
7 Flagship High Detail / Ultra 2K was selected with Texture on and Image
Enhancement off. The jacket job failed before geometry and displayed Credits
Refunded. The roll produced 3,004,190 Triangle/Faces and a textured source with
all four PBR preview controls. Its closed form, two straps, two buckles and
layered ends matched the image better than the rejected text-to-3D rack; it was
paler than the source and its textile detail was weak.

A 4,000 target reduction produced 4,085 faces with jagged/uneven rolled ends
and no Normal preview; it was rejected. A separate 8,000 target reduction from
the preserved detailed original produced 8,157 faces. It improved the silhouette
but remained above both the per-prop and outer intake caps, with uneven ends.
One Image Input PBR recovery using the exact roll reference restored Normal and
all four preview modes; the normal preview looked nearly uniform at the inspected
scale. The final provider asset is named KESTREL GPT-image v2 - 8157 PBR -
UNACCEPTED. It is retained for comparison, not accepted for game integration.

Net observed cost for this pass was 45 credits. The receipt distinguishes observed
aggregate charges from inferred staged texture/refund amounts; no ledger was
inspected. No downloads, model-file measurements, local screenshots or game tests
are claimed. Full observations and recovery steps are in
image-to-3d-v2/meshy-after-file-permission-receipt.json.

Root authorized one Smart Topology / Meshy T2 attempt per reference next: jacket
as a recovery from service failure, roll as an alternative following explicit
quality/budget rejection. The earlier operator's no-reroll bound applied to that
one task. This is bounded visual iteration under Cees's existing asset-production
authorization; no unlimited retry or extra reference generation is authorized.
New results belong to meshy-recovery-receipt.json, preserving previous receipts.


## Smart Topology comparison

The bounded Meshy T2 pass produced both originals with automatic textures:
4,330 Triangle/Faces for the jacket and 4,145 for the roll. The jacket now reads
as a compact folded garment with tucked layers, pockets and zipper, rather than
a robe. Its collar rim remains angular, with a pale lower edge/inside-collar
artifact and weak textile relief. The roll's layered end is smoother than the
High Detail reductions, but the canvas remains pale with extra strap-side marks.
All four map previews were opened on the retained originals; their Normal
previews show weak relief. Actual UVs/maps/material counts remain unmeasured.

Reducing the jacket at target 1,900 produced 1,925 faces but damaged the collar,
pockets and hem. Reducing the roll at target 3,800 produced 3,926 faces but
collapsed the end layers into jagged flaps/gaps. Both reductions are retained as
rejected even though their UI counts meet the caps. The better 4,330/4,145
originals remain unaccepted candidates for local inspection. Do not automatically
force the jacket into its initial 2,000-triangle limit; first inspect it at actual
game scale and resolve the budget/shape tradeoff.

A browser target detached during map inspection; the operator reopened the
workspace through the documented recovery flow. No extra Generate click or
permission change followed. Provider failures, browser connection failures and
art rejection are recorded separately.

The prepared Blender intake now reduces an oversized export to its maximum cap
instead of automatically reapplying the lower aspirational target. This avoids
turning a small provider overshoot into another large detail reduction. Its
receipt records the cleanup target, original provider target and cap. Python
syntax passes; there is still no real GLB intake run or exported-budget pass.
The large jacket budget difference requires a decision before using that cleanup,
and the current cap is not silently waived.

Cleanup now refuses inputs more than 10% over the cap rather than silently
crushing a selected higher-detail candidate; smaller overshoot is trimmed to
the cap. This bound covers the observed small count overshoots and rejects the
known large jacket mismatch. Syntax was checked; actual mesh verification remains
pending. This is a local intake guard, not a request for a new user approval flow.


## Permission-resume delivery state

Both bounded provider passes are complete. The Smart Topology recovery retained
WATCHKEEP GPT-image v2 T2 - 4330 PBR - UNACCEPTED (5,212 vertices) and
KESTREL GPT-image v2 T2 - 4145 PBR - UNACCEPTED (3,859 vertices). Their
Base Color, Roughness, Metallic and Normal previews were opened and inspected
by the GPT browser operator. Root has no downloaded model or local provider
screenshot and does not claim an independent visual pass. Names, counts, family
search caveats and recovery steps are in the completed meshy-recovery-receipt.json.

Smart Topology pass cost: 30 credits per observed UI changes, no refund or
extra texture/UV recovery charge. Together with the preceding image pass, this
resume used a recorded net 75 Meshy credits; historical text-to-3D work was
90 more. No account balance is included, no ledger was inspected, and the
receipts retain the stated limits of charge attribution.

Validation in this root continuation: receipts parse, source PNG hashes match,
prior-receipt hashes are checked, prepared Blender intake Python syntax passes
and git diff whitespace checks pass. No new game build, shader render, FPS,
physical interaction test, exported triangle/material/byte budget or independent
Astra review was run. No runtime import, merge or deployment occurred.

At this historical checkpoint, export approval was pending; the explicit approval
and fresh browser export outcome are recorded below. Reconcile the jacket budget before automated
cleanup; apply only minimal overshoot correction to a viable roll. Retain all
failed variants and budget/appearance issues until actual validation resolves them.

## Explicit download approval; fresh export blocker — 2026-09-07

Cees answered “yes you can” to downloading these two retained originals. That
approval supersedes the historical refusal for these files. The GPT browser
operator attempted each normal visible GLB download once, after checking the
exact original's Triangle/Faces/Vertices counts and four PBR controls. No new
provider work, credit spending or settings changes were requested.

Both attempts disabled the download controls while processing, timed out waiting
20 seconds for the documented download event, then displayed `assets.meshy.ai
is blocked`, `This page has been blocked by Chromium`, `ERR_BLOCKED_BY_CLIENT`.
No new automatic approval denial was returned. The visible browser error alone
does not establish which component caused the block. No signed URL fetch, hidden
API, alternate browser channel or security-setting bypass was attempted.

`assets/station-shop/soft-props/image-to-3d-v2/export-receipt.json` records both
selections, visible export settings, attempted download method and absent local
paths. Native GLB resolution/content, size, hashes and headers remain unmeasured
because no file was obtained. Signed destinations and account details are omitted.

Prepared `blender/review_shop_soft_props.py` imports a source without changing it,
records evaluated meshes/UVs/materials/images/bounds/transforms, and renders front,
opposite and underside studio views with a CPU renderer. Images are explicitly
labelled Blender studio evidence, not game-renderer acceptance. Actual Meshy
inspection and all game integration remain blocked on local source files.

Read-only static inspection of the installed ChatGPT extension found header-only
DNR session rules and no explicit Meshy host/download blocking rule. The cause
therefore remains unattributed; no browser configuration was changed.

Inspector smoke run used the existing helmet-standalone.glb, Blender 5.2.0,
Cycles CPU / 4 threads, 320×320, 4 samples. All three PNGs rendered, their hashes
and report were verified, and root inspected all three images. Metadata measured
7,300 triangles / 7 materials; input SHA remained unchanged. Evidence is in
/tmp/star-agent-studio-inspector-smoke. This verifies the inspection utility on
an existing asset only. Blender emitted installed-addon cattrs/registration and
audio warnings, then lingered after writing its completed report; root terminated
only this smoke process. A clean Blender process exit is not claimed. Python
syntax, all prop-receipt JSON and git whitespace checks pass; no new game build
or browser/performance test was warranted for this utility-and-record change.

## Manual KESTREL delivery and measured runtime candidate — 2026-09-07

Cees downloaded the versions they judged acceptable. The new KESTREL filename
matched the intended native export; exact header, length, SHA and mesh/material
counts were verified. Only that current file was copied from Downloads. An older
kestrel_meshy_clean GLB measured34,768 triangles and was not substituted. The
requested jacket was not found; clarification was requested while roll work
continued. Historical browser failures remain in their original receipts.

`manual-import-receipt.json` records source 5,253,528 bytes / 4,145 triangles and
runtime 268,872 bytes / 4,000 triangles, one material and all three WebP PBR maps.
Blender source and processed views were inspected from front, rear and underside.
The source is coherent, with complete underside and continuous straps. Minimal
cleanup preserves the folds and buckles; runtime 1024px weave is less detailed
than source 2048px textures. Uniform dimensions are .279×.130×.291m. This is
small decorative counter stock, not a new purchasable/inventory item.

The optional resource loader now enables KESTREL alone, attaches once under
hub.group and preserves authored maps/contact shadows. Geometry/material resources
are shared; no floor collider, berth copy or speculative jacket request is added.
Focused tests cover successful and failed optional attachment plus collision-tree
identity. Full npm test: 186 passed. Production build passed with its chunk-size
warning. Candidate servers: 5262 dev / 5263 production; accepted 5260 unchanged.
Independent actual-game review and physical shop browser checks follow below.

## Actual-game findings and bounded corrections

The first independent Astra pass loaded the real optimized GLB on Chromium 151 /
AMD 860M / ANGLE GL at 1440×900, render scale 1. Actual vertex audit measured
minY=-6.908, matching the insert top; one placement, no berth copies. The reviewer
scored 3.83 (4/4/3/4/4/4): the displaced dark cast shadow weakened contact. The
dev-only human-scale viewer also failed a bare Three.js import and lacked a
favicon. This pass is retained as an intermediate failure, not final acceptance.

Correction: KESTREL receives scene shadows but no longer casts the displaced
shadow. One lazily shared 64² alpha contact-AO plane within its footprint adds
approximate soft static contact shading at base+.00075m. No global light/shadow
bias or physical collision changed. Future jacket shadow policy is untouched.
The GLB still has one material/4000triangles; runtime contact geometry adds one
material and 2 triangles. Existing tests verify shared resources, transparent
texture edges, absence on load failure and collision invariants.

The props page now imports through a source-module dependency bridge, explicitly
uses the existing favicon and retains true 1m grid squares. Its prior adaptive
scale made that label incorrect for small props. After these code changes,
npm test 186/186 and production build pass again; candidate bundle is
index-CoFnp-fX.js. Independent final captures and browser results follow.

## Final KESTREL delivery and validation

Astra independently captured and inspected 12 final images, including the human
and true metre grid. Final rubric 4/4/4/4/4/4 =4.00, no item below 3. The final
game and props viewer record zero console errors/warnings. Final bundle
index-CoFnp-fX.js SHA256363bf688666e94b55d7bf460e887732e57e4e45917c168c48b893312fb8b8081;
GLB SHA remains 76d741972c05ddffe76d1c51f6607109cfd3dc265510b9f62876105e4d2357d7.
Source and runtimestudio plus before/after game images are retained in
docs/qa/station-soft-props/. Review reasoning, actual metadata and numerical
timing limits are in docs/qa/station-shop-props-review.md.

Final controlled visibility delta: +2draw calls /+4002submitted triangles.
Visible291draws/498220triangles versus hidden289/494218. One4000tri mesh plus
a2tri contact plane; the previous two4000tri shadow submissions are gone.
Chromium 151.0.7922.173 / AMD Radeon860M / ANGLE GL,1440×900,DPR1,render scale 1.
Outside browser jobs were active: timings are potentially contended, not a
causal latency estimate or whole-scene performance approval.

Root ran186 unit tests and production build successfully after runtime fixes.
Four focused browser cases were exercised on the same final production runtime
using one worker and hardware GL at full render scale. Concourse resource/UV
checks and missing-artwork fallback passed. Physical hangar aisle→passenger
elevator→armory→controller purchase→return→cargo transfer→reload passed 44.2s.
The touch case initially timed out during docking: its captured UI showed a
connected controller and open help modal, which pauses play. Isolating host
gamepads only in that touch context fixed the fixture; the 390×844tap purchase,
delivery/balance feedback, scrolling and close/resume case passed 11.1s on its
focused rerun. This is 3 initial passes plus 1 successful corrected-case rerun,
not a claim that the initial four-test command was green. Hardware Xbox input
itself was not tested: controller actions use the existing synthetic fixture.

Candidate remains isolated on feat/retail-soft-props, production 5263 and dev 5262.
Accepted 5260 and shared runtime work were preserved. User-supplied current
KESTREL was the only confirmed new download; no speculative jacket was enabled.
All raw provider originals, reference prompts and images, rejected iterations,
Blender source, cleanup script, measured receipts and review corrections remain
available as the reusable production record. No additional Meshy credits spent.
