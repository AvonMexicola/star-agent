# Star Agent — quality bar

Cees owns product acceptance; independent reviewers assess applicable criteria and
the integration steward verifies combined behavior. The [review process](docs/development/reviews.md)
explains proportional checks and the distinction between local checkpoints and releases.
A passing build is necessary for code changes, but cannot establish finished art or gameplay.

## 1. Art direction

White armor, matte dark polymer, brushed metal and mint `#b6efd1` accents form the
shared language. Warm amber signals warnings and selected interiors. Use the
existing design tokens, type hierarchy and dialog chrome. Star Citizen is a
fidelity reference, with original designs and assets; existing accepted manufacturer
briefs add their own specific language.

A finished asset has readable silhouette/scale, believable material separation,
bevels/insets where needed, plausible wear and light response, intentional status
lights where called for, correct origin and a game-rendered review. Uniform gray
primitives or unexamined generated meshes are development candidates, not finished ships.
Compare against a measured human and the actual camera, not adjectives.

Maps show position, route and scale; MFDs show real state with clear hierarchy.
Material detail and relief remain coherent across LODs. No unexplained flicker,
z-fighting, holes or hard vegetation disappearance. Interiors are lit by plausible
sources with contact and readable depth. Night scenes must remain intentionally legible.

## 1b. Asset production

Follow [the production standard](docs/asset-production-standard.md), the relevant
pipeline and the accepted brief. Manufactured geometry is authored reproducibly
in Blender with deliberate bevels, topology, UVs and named moving parts. Organic
or generated bases require inspection/cleanup. Use the approved procedural/baked
or painted PBR workflow; texture-generation tools do not replace geometry, UV,
collision or performance work. Preserve any stricter maps-only/UV-freeze requirement
in an existing asset brief. Paid tools need existing spending authorization.

Retain source/provenance, exact prompts/settings when generation is used, reusable
parts/materials, measured GLB/texture/LOD budgets and failed iterations. Inspect
exports in the real loader, then the actual physical game route. Reference art,
Blender renders, studio renders and game captures are distinct evidence.

## 2. Definition of done

For the affected scope, provide:

- Relevant unit/invariant tests and build; actual browser checks for runtime visual/input changes.
- No new page/console errors. Inspect and explain warnings; inherited warnings stay recorded.
- Full reachable keyboard/controller/touch journeys, with focus/neutral-input safety.
  Follow [the controller contract](docs/controller-contract.md); injected input is not hardware testing.
- Real before/after and motion evidence for visual changes; affected scene metrics
  against the budgets below. UI captures include 1440×900 and 390×844.
- Source/asset/protocol/save identity, dependencies, limitations and a resumable handoff.
- Independent review for claimed acceptance. Visual changes require average >=4.0,
  no applicable item below 3, or Cees's explicit scoped exception. Stricter briefs remain binding.

Documentation-only and small low-impact changes use appropriate checks; do not
require a six-scene GPU tour for a spelling fix. Broad renderer changes and release
candidates use the complete scene set. Local integration of a labeled development
checkpoint is allowed by the standing user instruction; it does not mean final acceptance.

## 3. Independent visual rubric

Score applicable dimensions from 1 to 5, with evidence for each. Mark genuinely
inapplicable dimensions N/A rather than awarding a free 5. Record the exact export,
commit and reviewer. A new asset or changed camera/lighting may invalidate an old score.

| Criterion | A strong result |
| --- | --- |
| Silhouette and scale | Reads at use distance, measured against human/ship references |
| Materials and detail | Purposeful bevels, panels, roughness, wear; no uniform or blobby result |
| Lighting and integration | Contact, plausible light response, compatible exposure, no blown details |
| Cohesion | Consistent manufacturer/faction language and interface tokens |
| Information or physical function | Map/gauge communicates truth; controls, grips and clearances work |
| Motion | Stable LOD, no flicker, believable mechanisms and transitions |

Use [the review template](docs/templates/review.md). A different human or agent
session reviews; the builder's own summary or generated reference image is not independent evidence.

## 4. Shared viewpoints

Six reference views, seed 7291: orbit, coast at 95 m facing sea, forest at 95 m,
highlands at 700 m, hangar after the opening doors reveal the planet, and seated
cockpit. Use 1440×900 for current baseline comparisons; older 1600×900 records
remain historical evidence, not directly comparable pixels. Add Selene, Pyre,
Miasma, stellar, gear/ramp and other viewpoints when those systems change.

Keep HUD hidden for art comparisons, visible for interface reviews. Record exact
pose/time/settings when reproducing an opening or weather state. Store curated
captures under `docs/qa/<task>/`; large traces/reports stay ignored or in temporary
CI artifacts. Automated image diffing is not claimed unless its actual tool and
result are provided. A changed image prompts review, not automatic approval.

## 5. Budgets and measurements

Targets on a declared laptop GPU at 1440×900; these are acceptance targets, not a
claim that every current scene meets them:

| Scene | Draw calls | Triangles | Frame time |
| --- | --- | --- | --- |
| Orbit | <=300 | <=400k | <=8 ms |
| Forest surface | <=900 | <=1.8M | <=12 ms |
| Hangar/cockpit | <=600 | <=900k | <=10 ms |
| Opaque modal | Scene skipped or <=25% of the relevant scene cost | — | — |

Default asset targets: props <=10k triangles/1 MB; characters <=20k/2 MB;
ships <=60k/4 MB; textures <=1024² WebP. A stricter feature brief applies. An
exception needs measured reason, affected platforms/settings and explicit approval;
do not silently enlarge budgets to fit an export. Measure texture residency,
materials/draws and LOD behavior as well as download size.

Use a comparable cold/warm/traversal record with sample duration, median/p95 and
resource growth. Shared machine contention and software rasterizers must be stated;
neither establishes hardware FPS acceptance. See [the benchmark template](docs/templates/benchmark.md).

## 6. Maintaining the bar

The steward keeps functional, input, visual and performance findings separate.
Hold a regular fixed-view playtest when reviewers are available; record top defects
with owners and actionable reproductions. Review introduced colors/fonts against
tokens rather than claiming an unimplemented CI palette check. Asset intake follows
its manifest/source/runtime contracts. Prototype flags and honest status keep
experiments usable without representing whiteboxes as release-ready art.
