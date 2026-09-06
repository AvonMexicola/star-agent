# Star Agent asset production standard

This is the reusable production process requested by Cees after the hangar work:
keep a complete record and use the proceedings as the standard for future assets.
It standardizes **how to produce, integrate, examine and accept an asset**. It does
not certify the current hangar, every inherited mesh, or an unreviewed candidate
as finished art.

Read [QUALITY.md](../QUALITY.md) and [AGENTS.md](../AGENTS.md) first. Those are the
project's authority for architecture, contribution rules, performance budgets and
review. Use this document with the more specific
[ship pipeline](../SHIP-PIPELINE-MEMORY.md) and
[station pipeline](../STATION-PIPELINE-MEMORY.md). The factual reference delivery
is [the hangar production record](qa/hangar-production-record.md).

## 1. Define one reviewable result

Start with the player's experience and the current implementation. Identify the
mesh actually imported by the game, the camera from which it is usually seen,
the actions it must support, and what makes the existing version unfinished.
Screenshots, source code and measured geometry are evidence; a roadmap entry or
a concept image is not proof of runtime behavior.

Write a bounded brief before production:

- Intended role, scale and silhouette at walking distance and approximately 30 m.
- Functional requirements: entrances, reach points, moving parts, storage, displays,
  floor support, ship envelope and interaction labels, as applicable.
- Visual target: faction palette, construction language, material separation,
  lighting and a small set of purposeful props or graphics.
- Reference provenance and what the references influence.
- Explicit scope boundary and the first complete view to finish.

For a large environment, finish one playable area to the agreed standard before
replicating it. The hangar's first area was the cargo terminal, elevator and
adjacent workbench. Adding more boxes throughout the station would not establish
the material, construction and lighting quality of that view.

## 2. Establish ownership and a reproducible baseline

Inspect current PRs, the integration branch and the latest ownership entries in
`HANDOFF.md`. Record the actual base SHA. A stacked PR must name its dependencies;
do not assume that a feature on another branch already exists in the target.

Use an isolated branch/worktree. Never change the branch beneath another agent's
running application. Preserve unrelated edits. Claim files before work, and give
each delegated task concrete ownership and a reviewable output. Parallel work is
most useful when materials, geometry, graphics and integration have clear APIs.

```sh
git worktree add -b feat/asset-name /tmp/star-agent-asset-name origin/feat/visual-fidelity
```

After entering that worktree, install the declared dependencies with `npm ci` if
needed. Use the supported Node version; this pipeline was exercised with the
project's Node 22.12+ requirement. Dependency links and generated reports stay
outside commits. Reserve a free preview port and use `--strictPort` so a reviewer
cannot accidentally inspect another agent's server.

Keep decisions, failures and evidence as work proceeds. Do not reconstruct a
successful-looking story at the end. Record which checks ran before and after
each meaningful correction, and which candidate they tested.

## 3. Measure the runtime contract before modeling

Create a contract table with units, axes, origin, bounds, required names and
interaction points. Measure the exported asset too; authoring assumptions can
change during transform application or export.

Star Agent's shared rules are:

- Game coordinates are metres, Y up; ships use nose -Z and aft +Z.
- World positions are JavaScript doubles relative to the planet centre. Geometry
  and GPU positions remain local. Subtract the double-precision camera origin
  before supplying Float32 positions or instance transforms.
- Terrain rendering and collision use `src/world.js`. An authored station deck
  is a measured model surface; do not introduce a competing planetary floor.
- Physical ship dimensions and navigation must agree with visible cabin, door,
  ramp and lift geometry. Preserve physical boarding.
- Native and custom shaders must retain the logarithmic-depth convention. A
  successful JavaScript build does not establish shader correctness.
- Functional displays derive their values from actual game state. Decorative
  prints and static diagrams must not imply unsupported gameplay.

For a moving assembly, record its pivot, axis, limits, timing, collision state
and behavior with a rider. For a prop, record its placement origin: feet, grip,
backplate or another named attachment. Compare human-scale details with the
project's 1.80 m reference. Test clearance with the complete supported ship or
walking envelope, not a ray through the centre alone.

Treat named hierarchy as an API. A Blender object with several material slots
may export as an Object3D containing several mesh primitives. Inspect the loaded
GLB tree, not just Blender object names. Preserve required wrapper names such as
`Hull` and `HangarInterior`; explicitly test whether each consumer needs a group
or a mesh. Retain single-mesh contracts such as the measured `LandingDeck` unless
the consumer and its tests are deliberately updated together. Do not flatten
animation pivots, collider exclusions or attachment transforms while batching.

## 4. Build manufactured geometry and retain its source

Use a rebuildable Blender script for hard surfaces, in accordance with
`QUALITY.md`. Keep editable source where that asset's pipeline uses a `.blend`;
the ship builders save editable ships, while the station prop kit is reproduced
from its checked-in builder and manifest. Organic generation follows its own
approved intake process; generation alone is not acceptance.

Prioritize features that explain how an object is made and used:

- Bevels that catch light, recessed joins, panel thickness and edge protection.
- Handles, latches, feet, rails, hinges, seals, mounting brackets and service access.
- Recognizable wheel/axle, drawer, vice, tool, restraint and cabinet assemblies.
- Space for a player to reach the useful face and complete the existing action.

Reuse a small construction family. Wear belongs at handles, corners, wheel paths
and contact points; uniform dirt does not replace construction. Keep low props
outside circulation routes. Props fitted over inherited geometry need explicit
overlap inspection: a new box can conceal an old face while still intersecting
a cart or blocking a player.

Export a manifest with measured assembly bounds, triangles, runtime bytes,
materials, draw primitives, coordinate convention, builder and placement. Group
geometry by reusable material where appropriate. Keep transparent glazing in a
separate batch and preserve its intended shadow behavior.

Measure LOD draw primitives after material and AO changes. Fewer triangles do
not guarantee fewer draws: exporting more material slots can multiply meshes.
Batch compatible static LOD geometry by material while preserving transforms,
required names, collision semantics and visibility groups. Check retained triangle
counts and bounds, then measure actual scene draws. Report mesh primitives and
scene nodes separately; those numbers are not interchangeable.

Do not hide a budget problem by renaming a large asset a kit. Report both the
aggregate and individual assembly costs, and obtain review for any unresolved
exception. Every manifest change must describe the real export.

## 5. Treat generated images as inputs to production

Save image-generation prompts, source files, references and tool provenance in
the repository's authoring area. Give each image a role:

| Image role | Valid use | Acceptance work still required |
|---|---|---|
| Concept or paintover | Communicate composition, material and lighting target | Build actual geometry and inspect the actual renderer |
| Poster illustration | Original scene-lit print artwork | Inspect text, crop, resolution, frame, colour space and fallback |
| Base-colour source | One input to a surface material | Establish mapping, metre scale, repetition, independent relief and roughness |
| Normal/roughness data | Explicitly authored material response | Validate convention, amplitude, colour space and render behavior |

Do not project a concept screenshot onto an environment as its finished texture.
Do not call a generated colour image a completed PBR material. Converting
brightness to greyscale does not establish physical depth or roughness: lighting
already present in the source can create false relief.

Keep runtime textures at the approved dimensions and format, and retain the
full-resolution sources outside `public/`. Record the exact derivative command,
dimensions and encoded bytes. Inspect repetition over several tiles and grazing
angles. A numerical edge probe is useful evidence, but does not certify visual
seamlessness. Mirrored wrapping can remove an edge discontinuity; inspect the
reflected pattern it creates too.

Colour and emissive images use the intended sRGB colour handling. Normal, bump,
roughness and other data maps remain linear data. If a mesh has no UVs, either
author metre-scaled UVs or explicitly implement local projection. Do not stretch
one image over a room merely because a loader accepts the material.

Use deterministic typography and diagrams for exact instructions, capacities,
IDs and safety copy. Keep functional berth numbers and destinations in runtime
UI. Shared atlases and reusable frames reduce payload and draw cost. Palette
and font values come from the established CSS design tokens.

## 6. Integrate one shared resource kit

Prefer an importable decorator or asset factory with a small contract. For the
hangar, materials expose an awaited factory and synchronous `apply(root)`;
graphics expose a group and its readiness promise; Blender props load as one
identity-placed scene. These can be examined independently and composed into the
hero template before collision construction and cloning.

Keep runtime ownership clear:

- Load and configure shared geometry/materials/textures once.
- Build local collision from the geometry that the player actually sees.
- Clone independent transforms and animation state, retaining shared resources.
- Preserve distant LOD and instance batching; shared geometry alone does not
  make multiple visible hero objects one draw call.
- Keep service light counts bounded. A single occupied-bay rig can follow the
  player instead of creating twenty sets of shadow-casting lights.
- Reapply per-mesh policy after constructors that overwrite flags. In this
  project, `Station.prepareMaterials()` enables mesh shadows during attachment.

Preserve authored vertex data when decorating materials. `COLOR_0` can contain
baked ambient occlusion, deck tint and seam shading. A replacement standard
material with `vertexColors=false` silently discards those contributions. Inspect
the geometry attribute and the source material's colour flag; cache coloured and
uncoloured variants instead of toggling compile flags per mesh or per frame.
Share textures across variants and pod clones, report the actual material count,
and retain deliberately distinct authored shade families that are not mapped.
Test both representative mixed geometry and the real exported asset; compare how
many colour-bearing primitives still render their vertex colour after decoration.

Trace emission through export and runtime before tuning a light. glTF can fold
an authored strength below one into emissive RGB; compare effective RGB times
intensity, including any constructor multiplier. Adjust the intended diffuser or
sign independently so navigation lights and functional displays retain their
meaning. Verify preparation is idempotent across shared clones.

Loading failures must leave coherent behavior. Commit readiness only after all
required resources and synchronous setup succeed. Optional posters can retain a
complete local atlas fallback. Missing finish resources may retain the original
station, while core gameplay remains usable. Verify these cases deliberately;
do not leave an unhandled rejected promise or claim every image loaded when it
did not.

Review all side effects outside the asset's occupied area. A narrower sun shadow
frustum and altered bias/intensity must restore their previous values on exit.
Transparent panes and painted signs must not become opaque shadow cards.
Actual equipment and frame contact shadows should remain.

## 7. Reconcile the current game rather than replacing it

Before final review, compare the candidate against the actual target branch.
Resolve overlaps semantically. Never copy an old `main.js` or `navigation.js`
over a newer implementation to make one asset work.

Use a compatibility checklist driven by real dependencies:

- Opening scene, physical spawn and selected ship layout.
- Input ownership, controller polling, pointer capture and modal/fade lifecycles.
- Camera handover, final render origin and LOD selection.
- Door animation control and corresponding collision.
- Flight, docking, boarding, ramps/lifts and ship switching.
- Inventory migration, conservation, capacity and persistence.
- Travel collision, stable station centre and world/body transitions.
- Audio gesture gating and existing visual systems outside the changed area.

The hangar merge exposed why these details matter: the opening uses a tilted
deck, a cinematic camera can differ from the physical player, and the active bay
is not the correct centre for a whole-station travel keep-out volume. Those are
general integration lessons, not merely cosmetic concerns.

## 8. Validate contracts, play, failure behavior and appearance separately

Run meaningful checks against the real artifacts. Prefer measured bounds,
conserved state, actual sweeps and player journeys over tests that reproduce
the implementation's constants without examining their consequences.

| Gate | Required evidence |
|---|---|
| Source/export | Rebuild command, source revision, asset manifest, exact hashes, parse success |
| Physical | Actual GLB bounds, named pivots/anchors, floor rays, full-envelope sweeps and reach points |
| Material/shader | Correct mapping/colour spaces, actual browser compilation, missing-resource behavior |
| Gameplay | Production keyboard/controller/touch paths where supported, state and input restoration |
| Visual | Same-camera before/after, walking-scale detail and fixed project viewpoints |
| Performance | Browser/backend, resolution, render scale, scene counts and representative frame measurement |
| Independent review | Functional review followed by the required visual rubric and recorded disposition |

Use `npm test`, `npm run build` and the focused production browser configuration.
Then run the integration journeys affected by the final merge. Do not repeatedly
run unrelated suites after a green result without a new change, failure or
unresolved concern. Isolate slow graphics suites so they do not compete for the
same software GPU and create misleading timeouts.

A test fixture may place the player at a controlled location for reliable
inspection. State that fact. A services fixture beginning in a side aisle is not
proof of a complete flight and boarding journey; retain a separate real journey.
Wait for terrain/resource readiness and stable LOD before visual captures.

When a test fails, record the observed behavior first. Distinguish runtime bugs
from test synchronization defects. The hangar's controller helper required a
button state to span actual gamepad polling frames; a fixed short wall-clock
delay was not sufficient under slow rendering. Fix the synchronization contract,
then rerun the affected check. Do not relax assertions to conceal a real issue.

## 9. Label evidence and apply the project quality gates

Keep concept, Blender studio, isolated material fixture and actual game images
distinct in filenames or captions. Only the actual game establishes integration
with its renderer, exposure, shadows, camera and geometry. Preserve an instructive
first pass or rejected view when it explains a correction.

Follow the current `QUALITY.md` viewpoint and review requirements. At the time
this standard was recorded, these included seed 7291, fixed orbit/coast/forest/
highlands/opening/cockpit captures, 1600×900 review views, 1440×900 performance
context and 390×844 UI coverage. A 2% screenshot difference is a review item,
not an automatic failure or permission to replace the baseline.

The recorded hangar/cockpit budget is at most 600 draws, 900,000 triangles and
10 ms per frame on the designated laptop GPU at 1440×900. Read current budgets
before reuse. Software-rendered SwiftShader results establish rendering and
counts, not approval of a hardware frame-time budget. State whether counts
include shadow passes, and separate texture-memory estimates from measured totals.

Probe the actual browser renderer before recording hardware performance. The
presence of a laptop GPU does not prove Chromium uses it. Record the unmasked
renderer, browser launch flags, device/backend, viewport and render scale alongside
the measurements. ANGLE GL on an AMD Radeon 860M and ANGLE Vulkan SwiftShader are
different validation environments; software timing cannot stand in for hardware
timing. A successful hardware probe is availability evidence, not a frame-budget
pass. Fresh-browser captures establish individual views; retain separate continuous
travel and lifecycle checks when those behaviors matter.

Functional checks and builds cannot replace visual review. `QUALITY.md` requires
Claude functional review followed by Opus rubric review averaging at least 4.0,
with no criterion below 3, or an explicit Cees “polish later” decision. A reviewer
rate limit or unavailable service is a pending gate, not a passed review. Record
the actual reviewer, candidate, self-captured evidence, scores, findings and fixes.
Archive the exact completed report with provenance. Keep observed image defects
separate from a reviewer's proposed source-level cause: inspect the actual active
flags and update order before changing code. Preserve the report while recording
any correction to its diagnosis separately. After a new base, export or visual
fix, label old test counts and review scores as historical and obtain acceptance
for the revised candidate.

## 10. Deliver the record with the asset

The final PR should explain the player-visible problem and resulting behavior,
link the reproducible source and evidence, state what actually passed, and name
remaining limits. Update the description around the final integrated change.
Record dependency resolution, target SHA, final candidate SHA and any exception.

Append a concrete `READY FOR REVIEW: <files>` handoff. If the user authorizes
merge, complete the concrete review work and required checks; do not invent an
extra approval flow. Preserve required gates until they are satisfied or explicitly
waived. Keep merge status distinct from deployment status and verify each before
claiming it. Finish by updating the acceptance record below and the relevant
pipeline memory; future work should not need to rediscover the same constraints.

## Copyable asset acceptance record

Use this template in a new `docs/qa/<asset>-production-record.md`. Remove irrelevant
fields with an explanation rather than filling them with fictional evidence.

```markdown
# <Asset> production and acceptance record

Record date / timezone:
Brief and player-visible result:
Scope and explicit exclusions:
References / provenance / saved prompts:
Source builders and editable files:
Runtime entry point and actual imported asset:
Base branch and SHA:
Candidate SHA / PR / dependencies:
Ownership (geometry, materials, graphics, integration, tests, reviewer):

## Contract
Units / axes / origin:
Measured bounds / scale reference:
Required node names and loaded node types / pivots / animations:
Vertex attributes (including COLOR_0) / mapped and preserved material families:
Floor / collision / interaction / movement contracts:
Shared resources / LOD / visibility strategy:

## Reproduction and identity
Tool versions:
Exact rebuild and texture-derivative commands:
Manifest path:
Asset path / bytes / triangles / draw primitives / scene nodes / SHA-256:
Hero and LOD before/after batching / named hierarchy preservation:
Texture dimensions / encoded bytes / colour space / estimated decoded memory:

## Proceedings
Commit/date | Observation or decision | Change | Evidence
Include failures, fixes, regression consequences and unresolved findings.

## Verification
Command | Candidate | Result and count | Evidence path
Actual player journey vs controlled fixture:
Missing-resource / denied-storage / input restoration checks:
Browser / unmasked GPU renderer / backend / launch flags / viewport / render scale / seed:
Draw calls / triangles / ms per frame / shadow-count convention:
Warnings and their disposition:

## Visual evidence
Concept:
Blender studio / isolated fixture:
Actual game same-camera before/after:
Fixed project viewpoints / phone UI:
Independent reviewer / self-captured evidence / rubric scores / findings:
Fixes and re-review, or explicit named waiver:

## Acceptance
Functional gate: PENDING / PASS / FAIL, evidence:
Visual gate: PENDING / PASS / FAIL / explicit waiver, evidence:
Performance gate: PENDING / PASS / FAIL / explicit exception, evidence:
Remaining limitations and next asset work:
Manager handoff:
Merge SHA/time: PENDING until verified
Deployment identifier/URL/time: PENDING until verified
Final record updated by / date:
```
