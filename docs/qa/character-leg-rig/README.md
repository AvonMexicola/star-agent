# Expedition thigh deformation correction — 2026-09-07

Archived leg-author handoff. Hashes and acceptance here describe that scoped
review candidate; the combined character and subsequent glove changes are
tracked in [the character production record](../character/production-record.md).

Status: the correction for Cees's report of strange upper-leg deformation in
jumping and crouching is integrated into the current character candidate and
served on its existing preview, 5318. This is not a claim that the complete
character is signed off or in the combined build.

## Reproduction and cause

Open `/dev/avatar-studio.html`, select Expedition suit v2, choose Crouch walk or
press Jump, and orbit to the side. The imported rig places its hip joints at
0.834/0.836 m, partway down the ceramic thigh armour. The measured mesh has its
flexible hip seam near 1 m; the knees already align with their joint covers at
0.578/0.586 m. The resulting skeletal thighs are only 25–26 cm long, against
42–43 cm shins. The upper plate bends around the wrong point in deep poses.

The original pivot capture uses magenta for the hip joints, cyan for knees and
yellow for the pelvis root/ankles. It is a screenshot from the actual renderer,
with temporary joint markers added for inspection.

## Correction

`blender/avatar-legs.mjs` raises the two hip joints by 17 cm while retaining the
resting knee/ankle positions. Inverse bind matrices are updated so the resting
mesh remains unchanged. The build retargets six leg/foot rotation tracks at
60 Hz against the source ankle positions, using the authored knee hinge axis
to prevent a pole flip at a straight knee. The builder verifies this measured
source anatomy before applying the correction to a future regenerated model.

This changes no geometry, UVs, texture maps, skin weights, glove morphs or
upper-body bone tracks. The arm IK and weapon socket code are untouched. It
adds no runtime solver, draw call or triangle. The GLB retains 62,177 triangles,
24 joints and 26 clips; the denser offline leg tracks increase it to 8,495,256
bytes, within the character owner's recorded 9 MB exception.

Isolated reviewed asset SHA-256:
`3c4752180f207819dcecc3a1deb31fc8df54e89da835b8c9139473be56c00d20`.
After integrating the source hook into the owner's newer hand-refinement
candidate and rebuilding there, the first integrated asset was
`70011cfd93a581e50be160ab1e3e10b2ad303ac068b7d5e84114477ed3bb24d9`.
Its byte/triangle/joint/clip counts are the same. The older reviewed binary was
not copied over the newer hand work.
The owner subsequently continued glove refinement and rebuilt again with the
leg correction retained: `04f849bafe513f8e2a817895307a2751ebed85f76d4ef81cd0ae793ddc5911fa`,
8,496,328 bytes. The latest 10 leg/real-character regressions pass on that asset.
The builder report records 10,208 ankle samples with a largest keyframe residual
of 0.024 mm. Independently sampled intermediate frames keep the original feet
within 3 mm. This preserves the source trajectories, not new terrain foot IK.

## Validation and failed iterations

- 84 focused tests pass: the actual exported rig, new anatomical/continuity/
  source-preservation regressions, character state machine, equipment and camera.
  Every original upper-body joint is compared through all source animations;
  existing tests also recheck both palms, weapon aim and glove morphs.
- Full `npm test`: 508 tests pass, no failures, cancellations or skips.
- Production build passes, with the inherited large Three/GLTFLoader chunk warning.
- Deterministic before/after inspection covers rest, crouch, three jump phases and
  sitting from front/side. Final run: 12 renders, no browser errors or warnings.
  Chromium 151.0.7922.173, AMD Radeon 860M / ANGLE OpenGL ES 3.2, 1440 × 1100.
  These frozen poses establish shape; the continuity regression tests motion
  numerically. Full captures remain in the local task cache; selected images here.
- The first pivot-only iteration changed the foot arc. Retargeting against the
  source ankle fixed that; no new terrain floor or navigation height was added.
- A knee pole based on the old knee relative to the new hip flipped near full
  extension. Using the authored hinge axis removes that reversal. The original
  clip suite peaks at 1,265 degrees/second; the final correction peaks at 1,017.
- Initial 30 Hz retargeting missed the 3 mm foot-path bound between keys in
  Running. Resampling at 60 Hz passes it. A comparison also initially measured
  unnormalised imported world quaternions; the test now compares unit rotations.

- Production browser checks: 2/2 pass. Studio checks cover desktop/phone,
  animation selection and all three held items. The injected standard Gamepad
  journey covers opening → walking → equip/fire rifle → camera switching →
  flashlight → Wave/menu and held-trigger suppression → physical boarding →
  launch/retract gear. No physical Xbox/Bluetooth test is claimed.

Command: `CHARACTER_URL=http://127.0.0.1:5323 CHARACTER_CACHE=<task-cache>/browser
npm run test:browser -- -c scripts/character.config.js scripts/character.spec.js
scripts/opening.spec.js -g 'character studio|controller hangar reveal'`.

The independent [Opus review](visual-review.md) took its own 12 fresh renders and
accepted this bounded correction at 4.2/5, no criterion below 3. It confirms the
reported mid-thigh buckling is fixed. Three small hip/knee skin-weight polish
items and continuous-motion art review remain with the character owner; the
review explicitly distinguishes frozen poses from observed playback. No new
hardware FPS or full-character art approval is claimed. The first CLI invocation
used minimal mode, which skips OAuth/keychain; it reported not logged in. The
normal authenticated invocation completed the preserved review.

## Ownership and integration

Prepared at `/home/cees/projects/star-agent-leg-rig` on
`fix/character-leg-deformation`, from an isolated snapshot of the character
owner's uncommitted candidate on `feat/character-fidelity` / base `3e0f3b9`.
After recording the intended narrow source integration in both shared and owner
HANDOFF files, the helper/test/capture files and checked builder/npm-test patch
were applied to the current owner worktree. Its newer `avatar-grips.mjs`,
equipment code, sockets, capture scripts and existing character tests were
verified unchanged by this integration. Its GLB was rebuilt from those current
sources. The existing character preview on 5318 serves that new asset (hash
verified over HTTP). The combined preview on 5178 and deployed sites are unchanged.

The character feature does not yet have a commit containing its new builder and
assets, so do not merge this branch into the main game as a standalone feature.
The portable handoff package contains only these bounded additions. They are
already applied to the current owner worktree; for another checkout:

1. Copy `blender/avatar-legs.mjs`, `tests/character-legs.test.js` and
   `scripts/character-leg-review.mjs` into the current character candidate.
2. Apply `owner-integration.patch` after checking its contexts. It adds the builder
   import/call/report and includes the regression file in `npm test`.
3. Rebuild with `node blender/prepare-avatar.mjs`; keep the owner's current
   manifest and source. Do not copy an older `main.js`, runtime or entire manifest.
4. Run the focused tests and character browser checks, then include this defect
   and the before/after evidence in final independent character acceptance.

The shared HANDOFF records this correction and its ownership. The complete
candidate and its later owner updates have not been committed on their behalf.
Current owner `npm test` also passes 508 tests and its production build passes.
Its production studio/controller recheck passes 2/2 (2.2 minutes), using the
same command above with port 5324 and a separate owner-browser evidence cache.
The owner continued hand refinement during that recheck, so it is not presented
as an immutable whole-feature release gate. The latest leg/character regression
rerun passes 10/10 after that subsequent owner rebuild.
