# Independent Nomad controller review

The four requested Nomad controller scenarios have passing evidence on one frozen
runtime and GLB. This is controller/gameplay acceptance for the tested candidate,
not final asset or material approval. The reviewer changed no production files.
GPU ownership was explicitly returned before writing this report.

| Scenario | Passing evidence |
| --- | --- |
| Desktop full parked utility journey, 1440 × 900 | Attempt 06 report (local archive) |
| Phone viewport full parked utility journey, 390 × 844 | Attempt 06 report (local archive) |
| Assisted moving berth and return to flight | Attempt 04 report (local archive) |
| Rotating inertial berth and return to flight | Attempt 04 report (local archive) |

All four passing reports contain identical start-file digests, unchanged start/end
digests within their run, zero browser warnings, zero page/console/HTTP errors,
and zero failed requests. Chromium was 151.0.7922.173; WebGL reported ANGLE / AMD
Radeon 860M Graphics / radeonsi krackan1 ACO / OpenGL ES 3.2. DPR and render scale
were 1 at both resolutions. No FPS claim is made; the user's Kestrel preview could
remain open. The Node runner's NO_COLOR/FORCE_COLOR warning is separate from the
clean browser diagnostics.

The worktree HEAD was `6f80fc09a5bba7206c2d7251ee07f52c68ac1208`. HEAD alone does
not identify this uncommitted candidate. Primary SHA-256 identities were:

```text
public/models/nomad.glb  33a64aba2093e40768862fb130e81382b1900c11a8913080202efe9d89f204da
src/navigation.js       fa77b583d1c603b560d1e36f7c4c18a6aece1716bda57584fdf8aa78cb0e5887
src/ship-walkable.js    ed24022065c2d4e561e87b0df4cb3f23d815af0824b5ba3d9b78fd04878dd05a
src/main.js             f3013914e403eccafbcdfaa181089da1925e7be5f8765ae29400aa08076807e4
```

The JSON reports retain the full 18-file runtime digest set and git status. The
live test URL was `http://127.0.0.1:5293/?intro=0&seed=7291&debug`.

The parked journeys used the actual Command menu to choose Selene, then Y to
land, X to stand, and the left stick to walk to the berth. They rested and stood,
checked held LS/A/RT suppression across standing, walked to the rear cargo rack,
transferred one repair kit and attached box 5 through D-pad focus/A activation.
They checked modal, blur, disconnect, replacement and unsupported-layout recovery
with held controls, physically walked down and back up the ramp, verified X outside
did not board by teleport, shut the hatch, sat at the chair, launched, and used the
real Gear command to retract. Navigation and rig progress reached zero and the
MFD reached STOWED. After normal reload, saved ship/pack contents matched exactly;
controller X re-entered the cabin and its live rack restored the saved state.

Both moving journeys reached the berth using controller walking while the hull
continued moving, verified the hatch remained secured, held ship-local rest
position, stood safely and returned to controls. The assisted hold travelled
2366.54 m with zero measured local drift and constant 1820.42 m/s hull speed.
The inertial hold travelled 64.56 m and rotated 10.31°, with local drift below
0.000001 m. Returning to the assisted chair resumed normal braking; the first
sample was 1528.16 m/s on the same course. Inertial chair return preserved speed
within 0.11 m/s in the recorded samples. These are gameplay state observations,
not rendering performance measurements.

The final [desktop rack image](controller-desktop-live-fifth-cargo-box.png)
shows four lower boxes and the fifth upper box, together with 05 / 08 installed,
11 / 40 stack slots, 29 / 120 kg supplies and 0 / 60 kg minerals. The
[phone cargo dialog](controller-phone-controller-cargo-result.png)
shows the 5 / 8 mount action and a clear controller focus outline. Its
[fifth-box detail](controller-phone-fifth-cargo-box-phone-detail.png)
confirms the physical upper box. The portrait physical readout requires panning;
it does not fit entirely in one close view. This does not block the readable
inventory route. The final [desktop gear image](controller-desktop-launch-and-stowed-gear.png)
and [phone gear image](controller-phone-launch-and-stowed-gear.png)
show STOWED after the actual menu command.

I also inspected the implementation owner's assembly-v2 gear-stowed, gear-motion
and closed-ramp PNGs. Those are producer captures, not independent controller
captures. They show the folded legs and closed rear portal without the old ramp
projection above the collar. The controller tests establish command/state/rig
synchronization; the owner's separate assembly checks establish the detailed
mesh envelope. No final material/silhouette score is assigned here.

Failed attempts are preserved rather than reclassified as passes:

| Attempt | Actual result and correction |
| --- | --- |
| 01 | No rendered tests: sandbox Chromium launch failure; archive copies also caused duplicate discovery. Fixed launch context and exact spec matching. |
| 02 | Inertial journey passed. Parked routes reached saved box 5, then a screenshot wait incorrectly required new WebGL frames under a modal. Assisted route returned to flight, then a fixed velocity tolerance incorrectly rejected normal assist braking. |
| 03 | Interrupted during boot after launch approval resolved across a GPU/freeze handoff. No acceptance result used. |
| 04 | Both moving tests passed. Both complete physical parked loops passed their route assertions, but the final hidden-ship cache assertion failed after reload. |
| 05 | Both full parked routes again completed; waiting for that cache also failed. Source inspection established that the untouched title view deliberately hides the ship and skips its display updates. |
| 06 | Both parked tests passed after real controller X re-entry before checking the restored physical rack. No production fix was required. |

The earlier explanation that attempts 04/05 were merely a first-frame readiness
race was incomplete. The confirmed reason is the `ship.visible` update gate on
the idle title view. The saved inventory comparisons passed even in those failed
attempts. Attempt 06 tests the correct player-entry lifecycle without deleting or
weakening the persistence assertion.

No blocking production defect was found in these controller journeys. The prior
touch hatch affordance mismatch was reported and fixed by the implementation
owner. The emergency soft-contact gear fix was reviewed in source; this browser
harness does not establish unpowered soft landing or crash while resting.
Physical controllers, native phones and touchscreen input were not used here.
The injected standard Gamepad writes only the fake device; debug access is read
only for steering and assertions. No keyboard, mouse, navigation setters, debug
transit/embark/land actions, direct inventory writes or save writes are used.

Final material/asset review remains pending the intended finish candidate. The
passing gameplay evidence applies to the identities above and must not silently
be attributed to a later GLB or runtime revision.

Archive note added by the implementation owner: original report and complete
failed/passing runs remain at `/tmp/star-agent-nomad-review/`. Only evidence links
were adapted for this repository copy; generated JSON reports are not committed.
The original report SHA-256 is `cd25fdf2090e7585a7f90708ddb430f19bc60eaba045f848fc9e03ad2cfbcdc4`.
The portable harness is `scripts/nomad-controller.config.js` / `.spec.js`.
