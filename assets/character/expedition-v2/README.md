# Expedition suit, second generation

Requested by Cees on 2026-09-07: higher polygon and texture quality, Meshy rigging,
a broad animation set, and convincing held equipment in first/third person.

Base: `feat/flight-options` at `3e0f3b9a5087f3231cfcf3f193a3cec300cfbf7d` (PR 38).
Worktree: `feat/character-fidelity`. This preserves the existing camera controls,
physical navigation, equipment inventory/ammo and weapon obstruction checks.

## Brief

One sealed, 1.85 m humanoid suit, fitted white ceramic armour over graphite fabric,
brushed metal seals, restrained mint status lamps. Slim equipment-free silhouette,
articulated shoulders/knees/elbows and separated fingers. Feet origin; Y up; game
forward -Z. The source rig's facing direction is measured at intake.

Target a substantially more detailed nearby player (roughly 50–60k triangles,
2K or 4K PBR maps), with measured runtime cost. Cees's explicit quality request
supersedes the older 20k / 1K character asset defaults; report actual costs.

Animation intake covers rest, idle, walk, run, jump, crouch, sit/stand, ladder,
damage, wave, rifle/pistol aim and fire, tool use, and reload/interact where Meshy's
library supports them. Record exact source clips and any derived/custom poses.
Navigation remains the movement authority; exported locomotion must be in place.
Ladder clips are animation assets; a playable ladder needs the owning ship's
physical ladder controller and an explicit animation input.

## Reference

`concept.png` was generated with the built-in imagegen tool as a production
reference, not a finished game material or runtime screenshot. Prompt:

> Single full-body realistic adult astronaut, front A-pose, palms forward and
> five separated fingers, feet apart. Fitted white ceramic armour over graphite
> woven fabric, black ribbed flexible joints, detailed slim gloves and boots,
> brushed metal neck seals, restrained mint status lamps, opaque dark teal visor.
> Slim integrated backplate, no detachable equipment. Precise seams and material
> variation with faint wear. Even neutral studio lighting, light grey background,
> minimal perspective, no text, logos, other characters or extra views.

Meshy submission: logged-in Chrome workspace, Image to 3D, Meshy 7 High Detail,
Ultra 2K, Texture enabled, A-Pose enabled, Private. Generation name:
**White Horizon Explorer**. 35 existing Meshy credits used; remesh, rig and
animation additions showed zero further cost. No subscription or credit purchase.

## Retained source and production build

| Stage | Meshy task / retained file | Result |
| --- | --- | --- |
| Textured generation | `01a07ab4-ab9d-744a-ad92-3fed825f57db` | Original 3,057,954-triangle sculpt remains in the private Meshy workspace |
| Triangle remesh, target 60,000 | `01a07aba-b22a-73ae-b161-809f31fc35ac` / `meshy-remesh-pbr.glb` | Source 2K color and 4K packed metallic/roughness map |
| Humanoid rig, 1.85 m | `01a07ac0-3760-71b2-8310-25f2fbe8a997` / `meshy-20-motions.glb` | 62,177 exported triangles, 24 joints, 20 selected motions plus bind pose |
| Separate idle export | Same rig / `meshy-idle.glb` | Meshy **Idle 1**, exported as `Armature\|Idle_02\|baselayer` |

The remesh and rig color images are byte-identical (SHA-256
`d7442b26aa19987391fe4a7f32d1517c0775d40ac7c59500e34cbb9d8095fc11`), confirming
that the restored PBR map belongs to the rig's UVs. Rig export incorrectly assigned
the whole color map as emissive and omitted the roughness/metallic map. The build
removes that emissive assignment. The remesh export has no normal map; none is
claimed in the runtime asset.

From the repository root:

```sh
npm ci
node blender/prepare-avatar.mjs
```

Requires Node 22.12+, the existing Three.js dependency, and ImageMagick's `magick`.
No Blender installation, hosted service, credentials or API keys are needed to
rebuild from these retained files. `build.json` records source and output hashes,
durations, canonical clip names and which clips are derived.

The build restores physically lit materials; emits two **2048 × 2048 WebP** maps;
renames the reversed Meshy spine chain; removes clip travel owned by navigation;
corrects grounded poses; closes loop seams; and authors relaxed idle arms, distinct
weapon holds/recoil, and two sparse glove grip shapes. The final glove curl uses
a 31 mm radius and closes the spread fingers around the equipment handles. These shapes curl the real
glove geometry independently. They are not individual finger joints.
Rig-specific support centres place the large gloves along the rifle/cutter's
vertical foregrips; both are verified from opposing close-up renderer views.

Runtime output: `public/models/props/player-expedition.glb`, **62,177 triangles,
24 joints, 26 clips, 8,496,328 bytes**. The two uncompressed RGBA texture maps with
mips would occupy approximately 44.7 MB on the GPU, in addition to mesh/morph data.
The opening and gameplay share one Character instance and its material maps.
A 17,442-triangle shadow index LOD shares the same skin/morph vertex buffers;
the visible color pass always restores the original 62,177 triangles. Its source
is `blender/avatar-shadow.mjs`. Verified animation bounds prevent unnecessary
shadow rendering outside a light's frustum.

The integrated `avatar-legs.mjs` correction moves the imported hip pivots up
17 cm to the flexible thigh seam and retargets the leg tracks offline at 60 Hz.
The resting surface, upper-body motion and original ankle trajectories are
preserved. Its source review and measured limits are retained in
`docs/qa/character-leg-rig/`; it adds no runtime solver or geometry.

The existing rifle had 55 cm of stock behind its trigger hand, which passed
through the shoulder. `fit-rifle-stock.mjs` retracts that rear section to about
22 cm, keeping its barrel, muzzle, trigger and support-grip locations. The
unaltered procedural rifle is retained as `rifle-before.glb`; the runtime carbine
is now about 77 cm long. No other equipment assets are replaced.

## Animation coverage and gameplay

- Native motions: idle breathing/stance (arms relaxed in the build), walking,
  running, crouched/carry/injured walking, jump, sit-down/idle/stand-up, ladder
  mount/loop/finish, wave, hit reaction, death, collect object and rifle reload.
- Derived poses: bind/rest, ladder hold, rifle aim, pistol aim, tool hold, rifle
  and pistol recoil, and a pistol reload variant. Source frame selections and
  durations are explicit in `build.json`; unused source motions remain retained.
- Runtime: locomotion and equipment upper-body layers blend independently. A
  temporary analytic arm solve fits both palms to the equipment and aims its
  barrel, then restores authored bone rotations before the next mixer update.
- `4` or `LB + RB + D-pad right` switches perspective. Walking/EVA use the same
  equipment instance, inventory, ammunition, heat and muzzle-obstruction checks.
  Crosshair rays originate at the camera; mining reach remains 8 m from the
  physical player eye. Menu → Wave is reachable with the standard controller.
- Ladder, seating, reload and pickup animation hooks are available to their
  gameplay owners and can be previewed in `/dev/avatar-studio.html`. This work
  does not add physical ladders, seat interactions, magazine reload mechanics or
  new sources of player damage. Injury input is wired and unit-tested; the game
  currently has no damage source that decreases suit health.

Meshy allowed 20 motions per combined export. A redundant Casual Walk was removed
to fit that limit; Idle 1 was exported separately. Generic Idle did not persist
when added, so it is not used. Chrome blocked the generated asset navigation;
the exact export HTTPS links were downloaded normally with curl. No signed URLs
or authentication material are committed.

## Acceptance

Generation, rigging, animation export and runtime integration are complete.
Acceptance evidence and independent-review status are recorded in
`docs/qa/character/production-record.md`. A generation result alone is not a
visual-review approval or a deployment claim.
