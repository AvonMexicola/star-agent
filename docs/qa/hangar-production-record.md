# Hangar production proceedings and acceptance record

Recorded on 2026-09-06, Europe/Amsterdam. This document preserves the actual
sequence, evidence and reusable lessons behind the Nomad/Atlas, modular port and
hangar finish stack. Cees requested a complete record to use as the production
standard for other assets. The reusable process is
[asset-production-standard.md](../asset-production-standard.md); this is its
specific reference case, not a declaration that all station art is finished.

**Current status:** the completed independent review of HEAD
`4da1a5d1a1acac00b3034fed8f06457a682f6852` (runtime `7a73ecf`) scored
**3.67 and failed the visual acceptance gate**. The
[verbatim review](hangar-opus-review-2026-09-06.md) is archived separately.
The default branch subsequently advanced through `7e7194a` to `85aa836`; its
detailed hull and baked vertex ambient occlusion are integrated with the hangar
finish at candidate `7ddef61db8b2626679266ea64568c1b0a01006e3` in the isolated
`/tmp/star-agent-hangar-current` worktree. The current production build, 21 unit
test files and 18 production browser checks pass. Ceiling, sign and ring
corrections are implemented but await actual game visual verification; hardware performance acceptance remains pending. Historical
passes below remain attributed to their original candidate. The candidate merge
commit exists; PR merge into the default branch and deployment are not claimed.

**Historical checkpoint:** runtime candidate `7a73ecfb50c801dab55de5b5eb5f357aa15d6ad8` for
[PR #20](https://github.com/AvonMexicola/star-agent/pull/20), based on integration
branch `feat/visual-fidelity` at `029cae8`. Its parent integration commit
`1eeb5b4` passed 151 unit tests and the production build. The subsequent bounded
exterior-visibility fix passed the full 152-test suite and build. All 17 unique combined browser cases
passed across the documented runs and focused reruns before that exterior fix.
The complete eight-view production tour subsequently passed at `7a73ecf`, with
zero browser errors, warnings, failed requests or unexpected closures. These
functional and capture results preceded the completed failed visual review.
The verification ledger is [hangar-integration.md](hangar-integration.md).

## Brief and development sequence

Cees first requested a better Blender ship with accessible storage, retained
flight/boarding behavior and four rectangular MFDs. Follow-up work introduced an
unlockable larger freighter with cargo elevators, improved Nomad's chair and
removed its display-obstructing centre strut. The scope then expanded to a much
more detailed hangar, cargo terminal with Take all, removal of floor cables,
twenty modular bays, a physical elevator entrance with explicit transit to a hub,
and huge slowly rotating station rings. Port Olisar was the visual reference.

After the modular port worked, Cees correctly identified its remaining blockout
appearance and suggested image generation for textures. The response was a
specific finish plan and original generated source art, followed by explicitly
authorized parallel agent implementation. Subsequent inspection drove a second
pass over bright upper windows, nearby storage, shadow quality and gallery detail.
The final integration reconciled the entire stack with the current playable
opening, travel, water and player interface instead of replacing those systems.

### Traceable commit chronology

Times below are Git author timestamps in Europe/Amsterdam (`+02:00`), not claimed
measurements of task duration. Follow the commits for exact source changes.

| Date/time | Commit | Result and record |
|---|---|---|
| 2026-09-05 17:29 | `9370c53` | Original Blender Nomad, physical cargo storage and four live MFDs; ship PR #4 |
| 2026-09-05 19:50 | `ec48742` | Complete ship pipeline memory and manager notification recorded |
| 2026-09-06 00:29 | `3e5ef97` | Unlockable Atlas and physical cargo lift systems introduced |
| 2026-09-06 08:27 | `8b5b84d` | Nomad cockpit refinement; Atlas boarding/lift/docking verification |
| 2026-09-06 08:52 | `d0070da` | Ship verification and manager handoff, including lift overview |
| 2026-09-06 09:17 | `32430fb` | Modular orbital port, cargo transfer and walkable elevator hub |
| 2026-09-06 09:50 | `431369b` | Hangar detail, instanced distant bays and verified station journeys; PR #16 reference |
| 2026-09-06 10:03 | `af1f190` | Finish target, original poster and material sources; art pack PR #17 |
| 2026-09-06 10:45 | `79eae9a` | Shared surface kit, Blender props, prints and service-corner lighting |
| 2026-09-06 11:22 | `77ccf3c` | Gallery glazing, manufactured storage fittings and shadow refinement |
| 2026-09-06 12:43 | `1eeb5b4` | Merge of the current opening/travel integration into the modular hangar stack |
| 2026-09-06 13:02 | `7a73ecf` | Distant exterior cutoff, controller-test polling correction, reproducible per-view captures and production records |

`1eeb5b4` has parents `77ccf3c` and `029cae8`; `7a73ecf` follows it. They are
review-branch candidates, not proof that PR #20 has merged into the default branch. PR #14
contains the Atlas dependency; PR #16 the modular station; PR #17 the source art.
The manager's separate station hull refinement in PR #22 was outside this
historical candidate; the resumed integration below incorporates the newer base.
Other branches visible in Git history are not automatically included features.

## Workspaces and ownership

Production used isolated worktrees, preserving the shared application checkout:

| Phase | Worktree / branch | Ownership |
|---|---|---|
| Atlas | `/tmp/star-agent-freighter-work`, `feat/unlockable-freighter` | Ship modeling, lift systems and ship integration |
| Modular port | `/tmp/star-agent-hangar-work`, `feat/modular-hangar` | Station builder, complex, services and inventory bulk transfer |
| Art direction | `/tmp/star-agent-hangar-art`, `art/hangar-finish` | Finish brief, concept and generated source images |
| Finish implementation | `/tmp/star-agent-hangar-finish`, `feat/hangar-finish` | Three bounded agent lanes, root integration and verification |
| Reviewed integration | `/tmp/star-agent-hangar-merge`, `integrate/hangar-finish` | Preserved candidate reviewed at `4da1a5d`, runtime `7a73ecf`, base `029cae8` |
| Resumed integration | `/tmp/star-agent-hangar-current` | Isolated reconciliation with default `85aa836` (including `7e7194a`); root owns final verification and delivery |

The materials agent owned the new material decorator and focused tests; the props
agent owned the Blender prop builder, GLB and measured manifest; the graphics
agent owned printed artwork placement and atlas generation. Root owned shared
runtime integration, lighting, production journeys, PR and handoff. Read-only
cross-reviews identified integration and loading hazards before final checks.

During the final merge, the materials agent owned `station.js`, StationComplex's
opening/pose compatibility and new integration tests; the graphics agent owned
navigation integration; the props agent reconciled station builder/GLB conflicts;
root owned main/index/package and the combined application. File claims prevented
agents from overwriting each other's runtime changes. Manager communication was
recorded through the project's append-only handoff process.

## Source art and provenance

All geometry and graphics in this contribution are original procedural or
image-generated work. Port Olisar informed the industrial orbital-port direction;
no Star Citizen models, textures or branding are bundled.

The built-in ChatGPT `image_gen` tool produced three saved sources. Exact prompts,
tool identification and the concept's input reference are in
[assets/station/prompts.json](../../assets/station/prompts.json).

| Source | Dimensions | Role and actual treatment |
|---|---|---|
| `hangar-finish-target-v1.png` | 1586×992 | Concept paintover of `docs/images/aeon-hangar.png` at `431369b`; captioned CONCEPT, never used as an in-game room texture |
| `selene-poster-v1.png` | 1024×1536 | Original full-frame print artwork; text inspected; resized into a physical frame with scene-lit material |
| `charcoal-deck-basecolor-v1.png` | 1254×1254 | Base-colour source for approximately 2 m of non-slip floor; independent procedural roughness/bump added in runtime |

The provenance JSON initially described the art-pack checkpoint when those
sources were not yet integrated. During final record preparation, root corrected
its status and added the actual poster/deck runtime derivative paths while
preserving every exact prompt string. The concept remains a concept.
High-resolution sources remain outside `public/`.

Runtime derivative commands used ImageMagick for resizing, metadata removal and
WebP encoding:

```sh
magick assets/station/textures-source/charcoal-deck-basecolor-v1.png -resize 1024x1024 -strip -quality 86 public/textures/station/material-charcoal-deck.webp
magick assets/station/textures-source/selene-poster-v1.png -resize 683x1024 -strip -quality 85 public/textures/station/poster-selene.webp
```

The floor source was not assumed seamless because its prompt requested it. An
initial edge probe measured average differences of 13.65 left/right and 13.96
top/bottom against 11.86 for an interior neighbouring-column comparison (0–255).
Those measurements did not certify a seamless tile. Runtime uses native mirrored
wrapping with 2 m source coverage and a 4 m full reflected cycle; actual game
repetition and grazing angles were inspected.

The freight poster, safety diagram, maintenance/serial labels and gallery
schematics are deterministic JavaScript graphics. They share one 1024×1024
canvas atlas. Exact instructions remain authored text; static gallery diagrams
do not claim live traffic or occupancy data.

## Historical artifact identity at runtime candidate 7a73ecf

These values were read from the actual files and manifest in the integration
worktree. The station hull remains the modular port asset; props are a separate
identity-placed GLB attached before shared collision construction.

| Runtime artifact | Encoded bytes | Geometry / dimensions |
|---|---:|---|
| `public/models/station.glb` | 2,213,240 | 68,296 triangles, 89 glTF mesh primitives |
| `public/models/station_lod1.glb` | 247,420 | 6,896 triangles, 43 glTF mesh primitives |
| `public/models/station-props.glb` | 2,564,192 | 36,232 triangles; eight opaque material batches and one glazing batch |
| `public/textures/station/material-charcoal-deck.webp` | 361,128 | 1024×1024 colour image |
| `public/textures/station/poster-selene.webp` | 209,626 | 683×1024 colour image |

SHA-256 identities:

```text
65bdd58c816b770f7cdb28b9fe241fcc75238e6dbc42409c64c9a9afb2518e6f  public/models/station.glb
a7de9c94a1c9032f11dd87f5f3cc8c57b4eabb92f85f19cff9073590c3028c50  public/models/station_lod1.glb
8bb03f3fc13f75e7797e43fb3fcfeccf3b5d694d283eac4b00b8b2fd7253692b  public/models/station-props.glb
e93f4405baad58dac781b6599c4a4da81d360f5c1b545d055d615e709e15cba4  public/textures/station/material-charcoal-deck.webp
7f8d29f82512cbcf203271ebf52baa5fda995f91681cc48d81cc9f348c0f04d1  public/textures/station/poster-selene.webp
```

The prop manifest is
[assets/station/props-manifest.json](../../assets/station/props-manifest.json).
Individual assembly triangle counts are CargoDolly 5,692; StrappedPallet 3,392;
BenchDress 7,680; FireCabinet 1,592; TerminalTrim 2,592; ElevatorJamb 752;
LeftStorage and RightStorage 4,512 each; OperationsGallery 5,508. Every assembly
is below 10,000 triangles. The aggregate kit exceeds the 1 MB single-prop budget;
individual encoded assembly byte sizes were not separately measured. Do not use
the aggregate batching description as a claim that every byte budget is approved.

The surface kit has nine shared runtime materials: seven finishes plus gallery
backing and observation glass. Three surface textures account for an estimated
7,077,888 decoded bytes including full mip chains, approximately 6.75 MiB. That
excludes posters/atlas, shadows and all existing textures. The graphics group has
ten meshes and 576 triangles after gallery labels were added. Sharing resources
across pods does not make every nearby hero an instanced draw.

## Physical and runtime contracts at the historical checkpoint

| Contract | Implemented value / behavior |
|---|---|
| Coordinates | Game metres, X right, Y up, Z aft; Blender maps game `(x,y,z)` to `(x,-z,y)` and glTF converts Y-up once |
| Deck | X `[-21,21]`, Z `[-22,26]`, top Y `-8`; 0.4 m visible slab |
| Structural floor | Top Y `-8.4`, below the visible deck; hero and LOD retain the opening lane's fix |
| Named nodes | `LandingDeck`, `LandingPad`, `ApproachPoint`, `DoorTrigger`, `HangarDoor_L`, `HangarDoor_R` |
| Door animation | `DoorsOpen`, approximately 5.0416665 s, independent mixers/colliders per bay |
| Pad anchor | `[0,-8,2]` |
| Clear circulation | Side aisles X `±12`; rear crosswalk Z `20`; terminal approach `[-12,-6.25,20.7]` |
| Terminal screen | Centre `[-12,-6.28,22.69]`, facing -Z, clear display region 1.72×1.12 m |
| Elevator | Physical door at Z `22.3`, enter cabin around Z `24`; hub door at Z `14.3` |
| Pods | Two banks of ten at Z `±520`, 190 m X spacing; second bank yaw π; stable IDs 01–20 |
| Rings | Radius 1,450 m, opposing rotation `0.00045 rad/s`, approximately 3.9 h/revolution |
| Runtime sharing | Hero/LOD geometry and materials plus one local pod BVH; independent door transforms; distant instanced batches |
| Camera | Double-precision physical player and final cinematic render origin remain separate |
| Opening pose | Common supplied direction/orientation/altitude for pods and hub; deck up follows orientation; active bay locked during opening |
| Passenger transit | Explicit elevator action; changes passenger frame/position, preserves parked ship and its inventory |
| Warehouse / ship / pack | 10,000 kg / 120 kg Nomad or 2,400 kg Atlas / 20 kg; capacity-aware Take all, conservation and one-write schema-2 persistence |

The gallery stays within X `±12.15`, Y `[0.3,3.8]`, Z `[23.75,24.365]`. It is
shallow decorative architecture above the floor, not a walkable control room.
Storage fittings stay outside `|X|=17.8344`, with inward handles included. Dolly
and pallet were moved forward so they end before Z `18.8`, clearing inherited
storage stacks and their new skins. The original clear-path, screen-ray and
full Atlas-envelope checks were retained through that expansion.

## Rebuild and reproduction

Use the supported Node version, installed project dependencies and Blender.
Blender 5.2.0 LTS was used for the station pipeline. Commands run from the chosen
isolated worktree:

```sh
env ALSOFT_DRIVERS=null blender --background --factory-startup -noaudio --python-exit-code 1 --python blender/build_station.py -- --out public/models/station.glb
env ALSOFT_DRIVERS=null blender --background --factory-startup -noaudio --python-exit-code 1 --python blender/build_station.py -- --out public/models/station_lod1.glb --lod
env ALSOFT_DRIVERS=null blender --background --factory-startup -noaudio --python-exit-code 1 --python blender/build_station_props.py
```

Optional studio evidence uses `-- --render <path>` and, for the upper gallery,
`--view gallery` on `build_station_props.py`. Those are studio compositions,
not production game captures. The final merge did not need to rebuild the hull:
the conflict was the explanatory structural-floor comment, and both sides
already used the same separated floor geometry. Modular hero/LOD binaries were
retained and measured.

```sh
npm test
npm run build
npm run test:browser -- -c scripts/hangar-finish.config.js
npm run test:browser -- -c scripts/hangar-merge.config.js
```

The finish configuration uses a production build and port 5225. The merged
configuration uses port 5238, one worker and its own `/tmp` report/build output.
The independent tour harness supports a separately served production build:

```sh
node scripts/hangar-integration-tour.mjs --url http://127.0.0.1:5239 --out /tmp/star-agent-hangar-review/screens --extras --perf1440
```

The tour explicitly waits for ready assets, drained terrain workers, required
LOD and stable patch counts before captures. Do not point it at an old preview
and assume the results belong to the latest candidate. Record the served commit.

## Observed problems, decisions and corrections

| Observation / failure | Correction and retained evidence |
|---|---|
| Detailed station still looked like a blockout | Finished one service corner with material separation, manufactured assemblies, prints and task lights; retained concept and first-pass captures |
| All 89 original hull primitives lacked UVs | Added dominant-face local metre UV generation for missing attributes; native standard shaders retained log depth |
| Generated floor colour was not a complete PBR material | Used sRGB colour plus independent linear procedural microrelief/roughness with restrained manufacturing detail |
| Floor hoses entered walking routes | Removed floor cables in the modular builder; retained wall reels/overhead services and swept aisle tests |
| Structural floor and deck could fight at eye level | Preserved the opening lane's separate slab top at -8.4; hero/LOD ray and moving-camera checks |
| Initial material name put floor texture on mechanical cases | Changed prop dark steel alias from `FinishDeck` to `FinishDark` |
| Old coarse bench tools protruded through new dressing | Moved the new toolboard outward and added physical standoffs; counter overlay remains approximately 5 cm above original top |
| Dolly/pallet overlapped inherited storage | Moved both forward, added manufactured skins and explicit manifest-zone separation checks |
| Upper control window clipped to white | Original `ControlGlass` strength 1.6 was doubled by Station preparation; replaced only that surface with a dim opaque gallery back and separate tinted forward glazing |
| Text/sign/glass cast chunky or opaque shadows | Applied per-mesh policy after Station attachment; retained opaque equipment/frame shadows, narrowed interior sun frustum to 90 m and restored flight settings outside |
| Finish setup could leave lighting active after a graphics failure | Committed finish resources/status only after all required setup/readiness succeeded |
| Optional poster failure had no complete visual fallback | Kept the deterministic freight atlas print while loading and on failure; handled readiness without putting promises in JSON-cloned userData |
| Current opening/travel were absent from the older stack | Merged current integration semantically; preserved main/navigation systems instead of copying older files over them |
| Tilted station lost correct up or pod spacing | Applied shared orientation before local pod offset/yaw; exposed true deck normal; tested all twenty bays and hub |
| Cinematic camera could select another bay | Locked intro bay and separated physical bay selection from camera-origin rendering/LOD |
| Saved Atlas opening used Nomad-sized spawn/camera assumptions | Spawned ahead of selected layout's complete hull and cleared the Atlas camera; retained physical lift boarding |
| Travel keep-out followed active berth | Used fixed `station.centre` for the whole complex |
| Closed-dialog elevator fade allowed competing shortcuts | Kept input paused through the fade and made help/transit respect `nav.enabled`; ordinary Help destination flow still works |
| Controller menu check failed with a 250 ms release delay under slow rendering | Button release missed a gamepad poll; helper now waits for `Gamepad.previous` and armed state. Five focused cases, including the affected player-interface checks, subsequently passed |
| First fixed tour stopped after three world captures | Browser closed before highlands, with no recorded page errors/warnings; cause unknown. Capture harness changed to a fresh browser per world view; restarted eight-view tour passed; no game memory fix claimed |
| Orbit retained distant station exterior draw cost | Comparison found 477 baseline draws/304,642 triangles versus 570/326,758 for candidate; the exact additional 93 draws/22,116 triangles came from always-visible `createExterior()` while pods/LOD culled beyond 600 km. Added camera-based exterior cutoff with restoration and collision-preservation regression; full 152-test suite/build passed afterward |

One new local-collider assertion initially compared re-evaluated floating-point
bounds for exact equality across a different camera origin. Differences were
approximately `1e-13` m. The assertion now requires agreement within `1e-8` m;
it still verifies collision pose preservation and is not a weakened walking or
ship-clearance check.

## Evidence catalogue and what each item proves

| Evidence | Classification / limit |
|---|---|
| [Finish plan](../hangar-finish-plan.md), generated target | Art direction and source analysis; not implementation or renderer proof |
| [Original modular hangar](../images/aeon-hangar.png) | Actual game before the finish pass |
| [First finish pass](hangar-finish-first-pass.png) | Preserved actual game view before gallery/storage/shadow corrections |
| [Final corner](hangar-finish-corner.png), [terminal](hangar-finish-terminal.png), [posters](hangar-finish-posters.png), [props](hangar-finish-props.png), [gallery](hangar-finish-gallery.png), [deck](hangar-finish-deck.png) | Actual game captures from the finish branch before current opening/travel integration |
| [Prop corner](hangar-props-corner.png), [prop gallery](hangar-props-gallery.png) | Blender studio review of assemblies; not actual game lighting or navigation |
| [Graphics atlas](hangar-graphics-atlas.png), [frame fixture](hangar-graphics-frame-review.png) | Typography/material fixture; not full station performance evidence |
| [Graphics implementation record](hangar-graphics.md) | Source placement, atlas/readiness behavior and isolated/browser findings |
| [Integration ledger](hangar-integration.md) | Candidate-specific combined tests, remaining checks and independent review status |
| `scripts/hangar-integration-tour.mjs` | Reproducible independent production capture harness; its existence is not a completed review |

Earlier finish captures used Chromium 151.0.7922.173, ANGLE Vulkan SwiftShader,
seed 7291, viewport 1440×900 and screenshot render scale 1. The recorded scene
range was 273–410 draws and 399,166–460,822 triangles including shadow passes.
These are historical finish-branch counts, not measurements of the merged
opening candidate or a claim of meeting the hardware frame-time budget.

Controlled view fixtures and the services fixture are labelled separately from
the Nomad physical journey. The latter actually flies through the hangar doors,
docks, walks the hatch/ramp, returns to the seat and launches. Atlas checks cover
unlock, lift state/interlocks, boarding and persistence. Services checks cover
Take all, physical elevator entry, hub/berth 20/parked-ship return and ring motion.

## Historical verification chronology through the reviewed candidate

- Original modular port checkpoint: 81 unit tests and seven browser cases were
  recorded in the station pipeline. A mobile destination-row assertion was
  updated for the actual seven-destination menu; runtime UI was unchanged.
- Refined finish checkpoint: 91 unit tests and seven browser cases were recorded
  in [the implementation report](../hangar-finish-implementation.md). Missing-props
  and missing-poster behavior were included; normal visual capture recorded no
  page/console/shader errors. Those results precede current integration.
- Candidate `1eeb5b4`: 151 unit tests and production build passed, with the
  existing bundle-size advisory. Initial four combined browser tests passed:
  Nomad opening/boarding/launch; controller handover and `intro=0`; moving-camera
  floor checks at render scales 1 and .55; saved Atlas opening/camera/fleet/map.
- The subsequent twelve-case group completed with eleven passes and one
  player-interface controller-release synchronization failure. After the helper
  fix, all five focused cases passed in approximately 2.2 minutes, including
  saved Atlas, elevator input timing and all three player-interface checks. Root
  confirmed all 17 unique integration browser cases passed across these runs;
  this is not a claim of one uninterrupted seventeen-case run. The controller
  helper correction was a later working-tree test change, not part of `1eeb5b4`.
- The first fixed tour captured orbit (570 draws/326,758 triangles), coast
  (422/489,185) and forest (525/1,359,235), then its browser closed before
  highlands. It recorded zero page errors/warnings before closure. This was an
  incomplete tour; its cause was unknown. An independent comparison identified
  the distant exterior visibility cost described above. The cutoff correction
  and its new regression passed the full 152-test suite and build; the restarted
  tour was still pending. These are not yet final candidate performance results.
  The restart design uses a fresh browser per world view: it establishes isolated
  viewpoint rendering, not one uninterrupted travel tour. The two actual travel
  browser cases passed separately. The baseline orbit's 477 draws also exceeds the
  documented 300-draw budget and does not establish budget approval by comparison.
- The restarted fresh-session tour at `7a73ecf` measured orbit at 477 draws and
  304,642 triangles, exactly matching the recorded baseline after exterior
  culling. Its observed frame interval was 337.5 ms on software rendering; this
  is not a laptop GPU frame-time result. All eight views completed at 13:05:50
  Amsterdam with zero errors/warnings/failed requests/unexpected lifecycle events.
  Root inspected the captures. The final ledger links every image and records
  all counts, 1440×900 affected-scene observations and 390×844 menu evidence.
  The affected views use 344–435 draws and 516,064–645,481 triangles at 1440×900.
  Existing orbit draw-budget and hardware-timing gates remain explicitly open.
- The first independent Opus invocation returned HTTP 429 and reported a session
  reset at 13:50 Europe/Amsterdam on 2026-09-06. This was initially a pending gate.
  The later completed review at HEAD `4da1a5d` (runtime `7a73ecf`) supplied its own
  captures and scored 3.67, below the required 4.0. Its disposition was
  **MERGEABLE: NO**. The exact report is preserved in
  [the review archive](hangar-opus-review-2026-09-06.md); no waiver is recorded.

### Historical acceptance at the reviewed candidate

| Gate | Status at this checkpoint | Final evidence / disposition |
|---|---|---|
| Unit tests | PASS, 152 at runtime candidate `7a73ecf` | Includes exterior visibility/collision restoration regression |
| Production build | PASS at `7a73ecf` | Existing large-bundle advisory retained; no dependency expansion |
| Combined browser regression | PASS, 17 unique cases across documented runs/reruns | Later render-only cutoff covered by full units and final production tour |
| Fixed screenshot tour | PASS, all eight scene views at `7a73ecf` | [Images, counts, environment and limitations](hangar-integration.md#final-production-tour); manual inspection, no pixel-diff certification |
| Independent visual review | FAIL, mean 3.67 at `4da1a5d` / runtime `7a73ecf` | [Completed report and self-capture record](hangar-opus-review-2026-09-06.md); revised visuals require re-review |
| Hardware performance gate | NOT ESTABLISHED by SwiftShader results | Record designated hardware measurements or explicit exception |
| Merge | NOT RECORDED | Verified merge SHA/time required |
| Deployment | NOT RECORDED | Verified deployment identifier/URL/time required |

The art limits recorded for that candidate were explicit: the operations gallery is decorative,
some distant storage and wall/ceiling construction still read as blockout, bright
navigation boards and hub furniture need further finish work, and the wider
concept target has not been fully achieved. Twenty physical pods do not provide
multiplayer allocation, networking or shared inventory authority. Static gallery
schematics do not provide live operations control. The separate hull refinement
in PR #22 required its own integration and evidence; the resumed work below
addresses that dependency without transferring old acceptance to the new export.

Use this record's traceability, failure handling, clear ownership, real-artifact
tests and honest review gates as the standard for the next asset. Do not reuse
a historical pass count, an unreviewed image or an old preview as new acceptance.


## Resumed integration after the completed review

This section records the later working state on 2026-09-06. It supersedes the old
pending-review label; it does not rewrite the reviewed artifacts, hashes or test
results above. The reviewed worktree remains separate from the current integration.

1. The independent review of `4da1a5d` / runtime `7a73ecf` completed with a 3.67
   average and a failed merge disposition. Its three principal blockers were the
   near-black ring treatment, blown-out ceiling diffusers and weak wayfinding
   contrast. Character-shadow visibility and MFD readability were additional
   findings. The original report is archived without editorial changes.
2. The default branch advanced to `7e7194a`, introducing a more detailed hull,
   additional authored material shades and baked `COLOR_0` ambient occlusion/tint.
   The actual merge input is the later default commit
   `85aa836c70d5c955235a0230a457b4c5c5d937d5`, confirmed from `MERGE_HEAD` in
   `/tmp/star-agent-hangar-current`. It also includes hierarchy and deck-grid fixes.
   The earlier `7e7194a` label identified the hull change, not the final merge base.
   Replacing the newer
   hull with the old finish binary would discard this work, so the builders and
   runtime contracts are being reconciled in the isolated tree.
3. Material splitting during export changed the shape of named objects. Grouped
   `Hull` and `HangarInterior` nodes restore those runtime lookup contracts while
   retaining the new material primitives. `LandingDeck` remains a single measured
   mesh. This is a hierarchy compatibility correction, not permission to change
   the walking floor or ship clearance.
4. The finish decorator initially discarded baked vertex shading on mapped
   materials. It now selects cached coloured/uncoloured material variants while
   retaining the shared texture kit and authored unmapped shades. Parsed combined
   hero checks retain vertex colour rendering on all **83 coloured primitives**.
   This verifies attribute/material compatibility; visual AO balance still needs
   examination in the actual revised renderer.
5. LOD material batching reduced the rebuilt distant model from **48 to 27
   meshes/batches**, retaining **6,932 triangles**. A lower triangle count alone
   would not have revealed the additional draws caused by material splitting.
   Runtime scene cost must still be measured at the final candidate. A subsequent
   rebuild reported the hero at 3,838,580 bytes, 90,424 triangles and 110 nodes,
   and the LOD at 250,796 bytes, 6,932 triangles and 15 nodes. These are later
   integration-lead measurements; node counts are not interchangeable with the
   preceding mesh/batch counts. Final asset hashes remain to be recorded.
6. Ceiling emission, backed sign readability and ring surface treatment are
   implemented in the builder and runtime, but **not visually verified** at this
   checkpoint. The lead reports effective diffuser emission of 1.4, wayfinding
   emission of 1.2, text backplates fitted to local text bounds and the ring
   material treatment in place. Source inspection found that Station preparation
   doubles nonzero material emissives once across shared instances. Therefore an
   authored light strength is not its final runtime brightness; the adjustment
   must preserve unrelated navigation and functional emissives. glTF may fold
   strengths below one into emissive RGB, so inspect RGB multiplied by intensity.
7. The reviewer's observation of an indistinct character shadow is retained, but
   its proposed altitude-cutoff cause does not match the source: `main.js` already
   forces the sun's shadow flag near the station, and placeholder and loaded
   character meshes enable shadow casting. The image finding requires further
   lighting/occlusion inspection, not another copy of those flags.
8. A hardware-capable Chromium configuration is now available with **AMD Radeon
   860M through ANGLE GL**, as reported by the integration lead's renderer probe.
   Earlier review timings were ANGLE Vulkan SwiftShader. Hardware availability
   does not establish the frame budget: representative benchmarks are **pending**.

The next completed checkpoint is runtime candidate
`7ddef61db8b2626679266ea64568c1b0a01006e3`, whose parents are the reviewed
`4da1a5d1a1acac00b3034fed8f06457a682f6852` and default
`85aa836c70d5c955235a0230a457b4c5c5d937d5`. This is an actual candidate merge
commit, not a claim that PR #20 merged into the default branch.

At this candidate, the integration lead reports the production build and
**21 unit test files** passing. The latter is Node's file-level result; no
inferred internal case count is recorded. The completed production browser run
records **18 passed (5.0m)** in `/tmp/star-agent-hangar-current-browser.log`, using
`/tmp/star-agent-hangar-current.config.mjs` and the actual AMD GPU through ANGLE
GL. It covers the existing combined journeys and the new modal zero-draw
regression. Its isolated production server used port 5248.

The latest review preview is `http://127.0.0.1:5249/`. Port 5239 remains the old
`4da1a5d` reviewed candidate, runtime `7a73ecf`; it must not supply evidence for
the new revision. Final hardware captures under
`/tmp/star-agent-hangar-hardware-final` and independent Opus re-review are pending.
Hardware browser regression success is not a frame-budget measurement.

### Current acceptance boundary

| Gate | Current disposition |
|---|---|
| Revised export/material contracts | Grouped required nodes, 83 coloured primitives preserved, LOD 48 → 27 at 6,932 triangles; final integrated verification remains the lead's responsibility |
| Ceiling/sign/ring appearance | Implemented; actual game captures and visual review pending |
| Independent visual acceptance | Historical candidate FAILED at 3.67; no pass or waiver recorded for the revision |
| Hardware performance | AMD Radeon 860M / ANGLE GL available; benchmark and budget disposition pending |
| Final combined regression/build | PASS at `7ddef61`: production build, 21 unit test files, 18 production browser checks in 5.0m; hardware and visual gates remain separate |
| Merge/deployment | Candidate merge `7ddef61` exists; PR merge into the default branch and deployment are not recorded |

The integration lead will append the final served candidate, commands, evidence,
review result and any verified merge/deployment outcome. This checkpoint claims
neither completed polish nor a completed acceptance cycle.
