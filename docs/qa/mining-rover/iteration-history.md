# Burrow M-04 iteration history

Current disposition: all three recorded input journeys pass at their identified
checkpoints; candidate 10 native static review is 4.04 and keyboard motion is 3.8.
The mixed six-criterion mean is 4.00. The final MFD-footer visual check passes; performance
and Cees's product/PR acceptance remain separate. See the current
[production record](production-record.md).

The entries below preserve the status and failures of earlier checkpoints.
Their pending statements are historical, not the current input/review status.

## Initial implementation checkpoint

Scope: original enclosed four-wheel Meridian vehicle carried by the flyable30m
Atlas. Twin continuous mining heads use actual named muzzle transforms, a120s
full charge,30s recharge and a real96kg ore container. Shared controls provide
physical cabin access, lift operation, surface driving, mining and cargo access.
The developer launcher has an Atlas + Burrow / Selene start.

## Initial evidence

- Initial complete unit checkpoint:711/711 passed.
- Added support/lift/240Hz carry regressions:23 focused tests passed.
- Original independent runtime review: seven concrete findings closed;28 focused
  tests plus CPU boarding/lift/unload and individual barrel obstruction/destination
  probes passed. Its exact hashes and complete scripts remain under
  `/tmp/star-agent-rover-runtime-review` pending curated archival.
- First Vite build and repository checks passed. The inherited large-chunk build
  warning remains; this is not a graphics or performance acceptance result.
- Asset source and exported candidates were reviewed with actual triangle tests,
  not only their boxes. First two failing candidate reports are preserved under
  `/tmp/star-agent-rover-review`. Revisions addressed doorway/step collisions,
  door hinge placement, front glazing gaps, cutter-light overlap, seat location,
  moving suspension and suited-pilot back clearance. Final closure is pending.

No browser, physical controller, audio listening, FPS, motion or art score was
claimed at that checkpoint. The scripted controller journey and reviewer-authored
PBR fixture were ready and queued behind other shared-machine GPU work.

## Reproduction and ownership

Owned worktree `/home/cees/projects/star-agent-mining-rover`, branch
`feat/meridian-mining-rover`, from local development checkpoint4d38827. It depends
on the local menu/RT controls, persistent-account and fitted-weapon integrations;
the eventual PR must identify the relevant unmerged dependencies.

Preview5415 and disposable in-memory API5416 are owned by this lane. Shared
preview5178, API8087 and PostgreSQL51224 are preserved. One GPU test at a time;
read the latest HANDOFF before running the fixture.

```sh
# Serve this worktree with VITE_DEV_TOOLS=1 (or npm run dev:all).
TMPDIR=/path/on/disk npm run test:browser -- -c scripts/mining-rover.config.js
```

The optional `ROVER_SMOKE=1` ends after physical unloading; it does not establish
mining, storage, return or carriage acceptance. Full validation must run without
that flag. Browser temporary files and uncurated reports remain outside the repo.

First browser attempt: Chromium151 / AMD860M ANGLE GLES3.2 launched and rendered with zero page/console errors or warnings, but the owned Vite server lacked VITE_DEV_TOOLS=1. The feature was therefore correctly absent; startup assertion timed out. Saved state and log are retained in the smoke-01 evidence directory. This is not a rover journey pass. The server flag was corrected; no runtime feature code was changed to mask the fixture error.


## 2026-09-07 development checks

The corrected native smoke passed in1.2m: injected Gamepad walking from Atlas's
pilot seat, physical rover access (largest sampled eye displacement42.6mm),
cargo lift descent and forward unloading onto four canonical Selene contacts.
Chromium151.0.7922.173, AMD860M through ANGLE GLES3.2,1440×900, seed7291;
no page/console errors or warnings. The smoke intentionally stopped before mining
and return, so those remain pending.

The first native PBR launch aborted before opening a page because the fixture's
temporary Unix socket path exceeded Chromium's limit. Shortening only the owned
temporary directory fixed that diagnosed setup error; the subsequent seven-view
capture completed without diagnostics. No GPU flags or security settings changed.

Independent candidate04 static review scored3.42/5, below the visual bar. It found
unsupported lower treads, inverted front lettering, repeated diagonal surface
grain/tyre atlas bleed, and insufficiently developed body construction. These
findings prompted a revised asset; the failed review and two before captures are
retained here. Its original fixture's pre-render skinned bounds were stale; the
review explicitly excludes those numbers and corrects skin-matrix updates for
future captures. CPU mechanism checks are a separate scope.

Candidate05's revised body/material export is21,012triangles and2,132,436bytes;
its review is in progress. It exposed compression overlap at the new fender
returns and an inherited final boarding-eye clearance issue after moving the
head-rest. Both are being corrected before final visual/gameplay review.

At that stage the complete unit checkpoint passed714/714 in37.1s. The production build with
VITE_DEV_TOOLS=1 passes; repository checks pass. The usual Vite large-chunk warning
remains. These checks include the composed terrain-obstacle grid and Atlas phone
walking controls; they do not substitute for the pending full input journeys.

Candidate07 is the source checkpoint: SHA67b5c6947b06bb020096696d6ece5116c746d4bf6a7ac53f9acd1e9a92ec89f3,
21,206 triangles,2,181,360 bytes. Stepped stringers now support all three treads
without protruding through them; attached panels/fasteners and wheel compression
clearance pass independent exported-triangle checks. The extra forward boarding
waypoint restores the sampled0.12m eye-sphere clearance. Front text basis is
verified and the approved Meridian emblem retains its alpha channel.

The candidate07 review still recorded inherited header rubber contact with the roof
during initial door opening; final disposition is pending. The complete production
controller journey is running against frozen07. Final static review, keyboard/
touch routes, loading return and integration are not yet claimed.

## Complete controller result

The production candidate09 controller journey passes in2.5m on Chromium151.0.7922.173
/ AMD860M ANGLE GLES3.2 at1440×900, seed7291. It exercises Atlas pilot exit,
physical walking/boarding, lift descent, four-wheel terrain drive, both actual
muzzle beams carving the deposit into rover storage, D-pad/A ore transfer,
modal/focus/disconnect/replacement/unsupported-mapping neutral gates, physical
return onto the lift, cabin exit, Atlas pilot return and flight with the rover
carried. No page/console errors or warnings. The final carried local position is
[-1.599938,4,4.918226], inside the complete lift envelope;11.4163 cumulative cutter
seconds and0.693861kg remain in the bins after the tested transfer.

Two earlier full trials were retained: a staging turn reached a real slope beyond
Selene's flat landing area, then the short route exposed the normalized left stick
limiting steering while driving. The route was shortened and the rover now reaches
its full steering stop with diagonal stick input. The final route passed both
mining and complete return; terrain constraints were not weakened to force it.

This is injected Gamepad evidence, not a physical controller or FPS benchmark.
Keyboard/touch and final independent09 visual assessment were still in progress
at that checkpoint; the candidate 10 follow-through below supersedes that status.

## Candidate 09 native controls and candidate 10 finish

Candidate 09's native static score was 3.86, below the required average. Its first
shadow-off comparison was invalid: toggling global shadows after receiving
programs were cached did not disable the shadow path. A fresh-launch control with
casting/reception disabled identified the diagonal bands as fixture shadow acne.
The final shadow-on fixture fits the frustum to the posed geometry, retains
contact shadows and uses the recorded bias. The invalid comparison remains
historical evidence and is not a texture diagnosis.

Candidate 10 changes rod/cap normals and the ORM payload. The strict
[09→10 comparison](review-candidate-10-delta.md) retains all 21,570 world/local
triangles, UVs, mechanism hierarchy and layout. It does not certify separate
runtime camera, glazing-shadow or touch changes. The new native capture scores
4.04 in the [exact static report](review-visual-10.md); sparse underbody detail and
simple cab/bin massing still limit the score.

## Keyboard and touch iterations

- **input-01 keyboard:** physical boarding, unloading, mining/storage and the
  cargo neutral gate completed. The tab-focus assertion timed out because
  Playwright forced every tab focused. Disabling that fixture override produced
  trusted native blur/focus; no game behavior was weakened to bypass the gate.
- **input-01 touch:** boarding and unloading completed, then the helper released
  the remaining throttle contact instead of the intended steering contact. A
  native diagnostic established the exact released touch IDs. It also exposed a
  real issue: secondary fingers did not generate a native button click while the
  mining finger remained held. A narrow secondary-touch release adapter fixed
  rover/inventory buttons while retaining drag/cancel and duplicate suppression.
- **input-02 keyboard:** the complete 2.9-minute route passed on candidate 10 /
  bounded runtime 84860a6, including native focus safety and return to the Atlas
  pilot. The independent [game/motion review](review-game-10.md) scored motion
  3.8. Its settled cockpit image exposed the footer partly behind the instrument
  shelf; its video exposed abrupt chase contraction under the cargo ceiling.
- **input-02 touch:** mining/save and cargo opening completed, but the fixture
  targeted a hidden second container page. The follow-up uses the visible phone
  pager and Resume header while preserving the held mining contact. This failed
  run was not counted as a full input pass.
- **input-03 touch:** the physical walking helper could not reach the Atlas aisle
  waypoint [1.5, 5.75, −7.7], stopping near [2.28505, 5.75, −8.65311]. Its failed
  journey, last frame and video remain in the local archive. The final fixture
  stabilizes that approach. The same bounded e7e297b follow-up raises the MFD
  footer baseline; that canvas change needs its own settled desktop image.
- **input-04 touch:** the complete native-control route passed in 4.9 minutes on
  frozen e7e297b, including mining/save, held-contact cargo and native focus gates,
  reload, cabin exit and Atlas pilot return. The exact
  [phone follow-up](review-touch-10.md) corroborates endpoint/milestone records
  and portrait controls/inventory. It does not score the new phone video.

The final phone panel hides the physical MFD, so it cannot visually close the
raised footer. The old clipped keyboard image remains in the curated evidence.
Keyboard motion stays 3.8 for the cargo-ceiling contraction. Together with the
five native static scores, the explicit mixed-evidence mean is 4.00; it is not a
replacement whole-game lighting, hardware, performance or release approval.

Original input videos, failed contexts and full JSON remain under the local
`.mining-rover-qa` archive named in the [evidence index](candidate-10/README.md).
No failed attempt is overwritten. The bounded PR recorded 697/697 unit tests at
84860a6 and a 4.49-second final e7e297b production build, with the inherited chunk
warning. These are different source surfaces from the earlier 711/714 totals.
Draft PR #66 remains Cees-gated; final source/docs pushing and integration belong
to the steward. The user's 5417 preview remains frozen; 5419 is the separate QA
candidate. No merge, deployment, physical device or FPS result is claimed.

## Final desktop footer closure — 2026-09-07 19:24 UTC

One settled 1440×900 production frame after physical Atlas-to-rover boarding
on frozen e7e297b closes the raised footer check. Chromium151 / AMD860M native
ANGLE OpenGL ES3.2 reports no errors or warnings. The complete “ATLAS CARGO /
PARKING BRAKE” line clears the lower bezel. The [independent closure](review-footer-10.md)
keeps all previous scores unchanged and grants no new full-journey or performance
acceptance. Earlier clipped/obscured frames remain retained.
