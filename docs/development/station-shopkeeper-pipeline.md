# Station shopkeeper production pipeline

SA-NPC-001 adds supplied animated people to existing station shop counters. The
runtime is presentation plus physical torso clearance; existing shop services own
interaction, stock, credits, persistence and warehouse delivery. This record is
resumable production memory, not a claim of final visual acceptance.

## Intake and ownership

Work in an isolated feature branch based on a recorded shared-development SHA.
Check HANDOFF and declare the narrow StationComplex hook, asset directories,
exporters, QA files and preview ports. Keep one author per asset and one integrator
for shared runtime. Preserve user downloads unchanged under each asset's source
folder, with archive/member SHA-256 and sizes. Record unknown generation settings
as unknown. Paid generation is unnecessary for these supplied packs.

Inspect the actual source mesh from front, side and rear before reducing it. Read
GLB accessors, material defaults, skin/inverse binds and animation tracks; confirm
that clips truly share identical geometry/rest rig before combining them. The
Watchkeep Crimson Outrider has four idles; Kestrel Cybertech Mechanic has another
four. Walking/running/falling source clips stay in the archive but are not needed
for a stationary merchant's runtime download.

## Authoring and export

Keep an editable Blend and reproducible Blender script per character. Preserve
head/hands and original painted appearance during protected body reduction;
measure displacement and discarded skin influence weights. Apply the default
20k-triangle, 2 MB and 1024px texture budgets per character. A different character's
budget exception does not transfer. Correct inappropriate full-albedo emission
and default metallic settings, then inspect roughness under neutral light.

Retain one mesh/material/skin where the supplied model allows it. Normalize via
an outer transform to local metres, feet Y=0, front -Z. Use a measured crown/sole
reference (1.72 m Watchkeep, 1.80 m Kestrel), retaining natural weight shifts instead
of deleting all root translation. Combine the compatible source clips and preserve exact tracks where their motion
is appropriate. Inspect resting anatomy: supplied retargeted motion may hold arms
backward or outward despite technically valid skinning. Correct those derived
rotation tracks deliberately, retaining gestures, and identify every changed
track alongside exact source and inverse-bind receipts. Add
small sampled vertical grounding only when the supplied soles require it.

Reimport the actual runtime GLB and evaluate all deformed vertices at 60 Hz across
every clip, endpoints and crossfades. Record the full motion envelope, minimum
sole clearance, loop discontinuity, triangle/material counts, textures and exact
runtime hash. CPU Blender studio images establish export appearance; they do not
establish game lighting, loader binding or a playable route.

## Runtime contract

`src/station-shopkeeper.js` defines separate weapons/equipment actors, URLs, clip
orders and counter placements. Each owns a GLTF load, AnimationMixer, lazy-load
promise and resource disposal. Load once on hub visibility, freeze while hidden,
unfocused or modal-paused, and clamp large update steps. Missing optional assets
fail once and expose an unavailable state without blocking purchases.

Attach both actors to the hub after the station material/shadow conversion pass.
The hub owns double-precision camera rebasing and orientation; character geometry
stays small and local. Never instantiate either character for every hangar pod.
Use the existing shop lighting. The female faces +X behind the left counter and
the male faces -X behind the right. Check the entire exported animation envelope
against the counter, shelf props, floor and ceiling, then verify actual images.
A small stationary torso collision box protects staff space while the original
customer points at x=±10.7 remain reachable. Animated hands are not rigid blockers.

The snapshot exposes independent `station.shopkeepers.weapons/equipment` status,
position and animation counters. A legacy `station.shopkeeper` female alias is
retained for the initial QA fixture. Do not use debug position or inventory writes
to establish physical controller acceptance.

## Verification and delivery

Run lifecycle, crossfade, independent actor, failure/disposal and counter-clearance
unit checks plus the full configured unit suite, build and repository check.
Freeze both export hashes and the production bundle before the browser run. Use
one isolated preview and one browser worker. Check the shared GPU queue and actual
host processes, publish acquisition and release, and retain failed attempts. Set
short writable TMPDIR and Playwright cache paths at process start; configuration
imports happen too late for Playwright's initial transform cache.

`scripts/shopkeeper.spec.js` takes the actual controller route from the Nomad
chair, through the rear hatch/ramp and hangar lift, into both shop customer areas.
Observe each full natural idle cycle, buy a sidearm and repair kit, check held
confirm and movement/fire suppression, modal pause, focus recovery and return to
the hangar. Capture 1440×900 and 390×844 UI and merchant views, browser errors,
renderer/backend/buffer information and continuous motion evidence. A resized
browser is not native touch coverage; injected Gamepad input is not hardware.

Have an independent reviewer inspect actual game images and continuous motion,
record applicable rubric scores and unresolved limitations. Keep source,
implemented, validated, reviewed, locally integrated and publicly deployed status
separate. Retain curated evidence and manifests; leave large generated reports,
recordings, caches and temporary Blender backups ignored. Publish a coherent
commit/PR and hand the exact SHA plus reproduction steps to the integration
steward; shared server restarts and combined promotion remain steward-owned.

Current completion evidence is recorded in the per-character asset QA and
[shopkeeper browser record](../qa/station-shopkeeper-browser.md). This pipeline
must be updated with failed iterations and final delivery identity before closing
the task.

## SA-NPC-001 implementation checkpoints

The two-actor implementation passes all 855 configured unit cases. Production
build succeeds (`main-CdqmaDBv.js`); the inherited >500kB bundle-size warning is
retained, not treated as a merchant-specific regression. The requested plan
against origin/dev/all-features enumerates 780 inherited changed paths, so its
broad database/world suggestions do not describe this bounded client-only delta.
Use the task base 4706d62 and actual changed files to assess scope.

`scripts/shopkeeper-assets-check.mjs` loads the released geometry, skin and
animation buffers through the real Three.js GLTFLoader and plays the actual
runtime animator. Node-only texture references are omitted; no skeleton, node,
accessor, inverse-bind or animation data are changed. This check verifies hash,
byte/triangle budgets, clip names, actual deformed bounds, crossfade grounding and
counter/ceiling clearance. Run all merchants with `node
scripts/shopkeeper-assets-check.mjs`, or pass `weapons` / `equipment` for one.
Set SHOPKEEPER_ASSET_RECEIPT to a unique ignored JSON path to retain a receipt.

The current actual-runtime checks sample 1149 female and 501 male poses (30 Hz,
38.267 / 16.700 seconds): all four idle transitions occur, no loader binding warning
is emitted, female sole extrema are -5.560 / +0.123 mm and male -3.523 / +0.255 mm.
Runtime-cycle counter clearance is 0.507 m female and 0.225 m male. The full individual
male clips reach farther than crossfaded playback (minimum staff-counter gap
about 0.174 m), which remains clear; his overhead stretch reaches 2.217 m above the
deck, below the shop ceiling. Both assets total 39,399 triangles / 3,264,176 bytes.

Historical hashes at the first checkpoint (superseded by user pose correction):

- Watchkeep: 6360429f81004eb9bb5a93626a71ceb55679e5a5aa29f28a188b411ccaefce09.
- Kestrel: cb6238203ea14e55789ece92d912af04a087bf546960ab540e8597b366fb1e97.

A first male reduction discarded 15% of merged-vertex skin influence and was
rejected before runtime acceptance. Protecting joint-boundary vertices reduced
that error to 0.343% while preserving the 19,699-triangle target. Female material
inspection replaced the first 0.41 roughness candidate with 0.72; the exact final
export's independent studio judgment remains silhouette 4 / materials 3 because a
single supplied albedo/material limits separation among cloth, armor and goggles.
These are retained development limitations, not final art approval. Browser
results, exact source commit and shared integration status still need completion.

## User pose rejection and corrective iteration

Before browser acceptance, Cees identified that both supplied idle sets hold
upper arms too far outward and backward, giving a retracted-shoulder posture.
This supersedes the first studio-only review: no blocking mesh deformation did
not establish a believable idle stance. The original two exports above remain
historical, and their preview must not be represented as the corrected result.

Both character authors are correcting the resting shoulder/arm animation baseline
in Blender. Derived bone rotation tracks may now intentionally differ from the
source; exact source packs, unchanged skin/inverse binds and a per-track correction
receipt remain required. Check resting upper-arm direction relative to the torso,
hand position beside the thighs, elbow bend, clothing intersections and gesture
preservation across the full clips and crossfades. Refresh exact export hashes,
editable Blends, dense checks, independent still/motion review and production
preview before the physical game journey. The earlier byte-identical motion
preservation claim applies only to the historical uncorrected candidate.

The loader check now also records torso-relative upper-arm outward/forward angles,
elbow bend and hand position at four phases per clip. The initial pose of each
supplied idle is a resting phase: the regression guard rejects an upper arm more
than 10° behind the torso or more than 25° outward. This intentionally catches the
user-rejected original pose while allowing small natural variation; gestures at
later phases are recorded for review, not forced into a resting-angle threshold.
These numeric checks complement visual inspection and cannot establish comfort,
hand shape or the absence of every clothing intersection.

## Corrected implementation freeze

The final corrected exports retain 39,399 triangles total and ship in 3,477,704
bytes: Watchkeep 1,898,288 / Kestrel 1,579,416. Watchkeep's final hash is
808768844ffdc754d04d5017d2a03908f0055ff5e74544624189e12712580914;
Kestrel's is 8f5052adf0b6d32c26e41d3cf379cb595b18b064f5af2dc6a68a7a2ace579537.
Six shoulder/upper-arm/forearm rotation channels per clip are deliberately
corrected; the other 66 source channels and inverse binds remain exact. Female
resting forearm roll is 60° with gesture attenuation; male uses a per-frame palm
alignment because the source clips have different pronation baselines. Neither
adds finger bones or claims perfect hand articulation. Minor female glove
asymmetry remains nonblocking in the independent studio review.

The unchanged runtime passes 855 configured unit cases. The corrected assets pass
the real-loader cycle and resting-angle guards: female resting upper arms are
6.07–15.54° outward and 0.85–13.27° forward, compared with roughly 30° backward in
the rejected original; male resting upper arms are about 6–10° outward/7–11°
forward. Runtime-cycle counter clearance is 0.577 m female / 0.233 m male. The small
recorded crossfade sole intersections remain 5.56 mm / 3.52 mm. New production build
passes with the same code bundle main-CdqmaDBv.js and the two new model hashes.

All final Blender views and editable sources are refreshed. Watchkeep's complete
original 6360429f candidate and same-studio views remain in its history directory;
Kestrel has a controlled original cb6238 before-front from the same final studio.
The source-versus-reduced geometry comparison must use identical bone poses on
both meshes: intentional arm retargeting is not decimation error. Female's
20-phase comparison therefore explicitly uses original poses before retargeting.
Browser route and final delivery identities follow in the QA record.
