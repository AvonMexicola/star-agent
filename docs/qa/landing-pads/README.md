# Landing pad finish — 2026-09-07

User request: placing a pad should immediately produce a white helipad H, white
line textures, edge ramps and landing lights. New placements now atomically buy a
marked deck plus four ordinary ramps; old saved layouts retain their piece count.
Full original flat deck dimensions and landing collision remain unchanged.

Original assets: reproducible `blender/build_base.py` geometry and native Canvas
paint in `src/build/pad-markings.js`. No copied imagery or external asset dependency.
Three cached paint textures, each at most1024 pixels on either side. Pad GLBs retain
five material primitives; paint adds one draw. Four ramps use existing ramp GLBs.
Power controls lens emission and the shared four nearby lights; white paint emits
zero light even though the standard material's unused intensity defaults to1.

| Asset | Triangles | Bytes | SHA-256 |
| --- | ---: | ---: | --- |
| foundation-pad-small | 3,060 | 269,480 | `91db3035c9765ca6a71f69c2c3b82c9ae4bc7b63753916feeee72b057cdf03fd` |
| foundation-pad-medium | 5,580 | 486,236 | `8e9bca205f8612e60642d2060d50414fdb8c48a2d9e0e1a8def74e26b35a0275` |
| foundation-pad-large | 8,604 | 746,308 | `c768045bf73c6139e33ba101818d49896413c3ccba1dd1d1cb5b488879572afe` |

## Evidence

- Full configured unit suite:117 files PASS,32.43s. Final focused pad/state/geometry
  rerun PASS after texture sizing/material disposal correction.
- Production build PASS,4.74s. Existing chunk-size and Node color-env warnings remain.
- Five actual model views PASS1/1,7.1s; Chromium151.0.7922.173,
  AMD Radeon860M ANGLE/OpenGL ES3.2,1440×900,buffer1×,errors[].
  `assets.json` records25draws per studio assembly,6400/8920/11944 triangles
  including four ramps, ground and human reference. These are not FPS measurements.
- Commands: `npm run test:browser -- -c scripts/landing-pad.config.js` for the
  production controller route; `scripts/landing-pad-assets.config.js` for the
  development-only model viewer. Run one worker with disk-backed TMPDIR and
  approved host execution as specified in AGENTS.md.

Final production controller journey PASS1/1 in2.7min (total2.9min), bundle
`main-DPULBWoU.js`. Actual injected Gamepad input only: sandbox spawn → walk →
B/Facilities/pad selection → paid placement of five pieces → walk up east ramp →
aim at H → X designation off/on → build/open/traverse hangar → walk outside →
place extra ramp → reload and compare all saved pieces. `pad-journey.json` has
errors[]. The initial fixed-heading failure is preserved below. Controller state
comes from the shared router; hardware testing remains separate.

## Failed checks retained

First controller attempt physically built/debited the pad and four ramps, walked
onto the deck, toggled designation and opened/traversed a hangar door, then missed
an exterior walking waypoint. Its fixed-heading helper overshot the target; adaptive
Gamepad steering corrects the test. No pose/stock injection or gameplay workaround.
First studio fixture used production preview, which cannot serve its `/src/`
development imports. It timed out before ready. Corrected to the existing asset
configuration's dev server; the failed check is not claimed as a pass.
Raw failed logs/traces: `/home/cees/.cache/star-agent-pad-attempt1/`,
`star-agent-pad-browser.log`, `star-agent-pad-assets.log`, and pad result folders.

The sandbox large-pad unit fixture originally put one apron through a ridge.
It now uses an actually valid site at claim-local[36,0.5,-12], retaining the
atomic radius/cost/write-failure test. Terrain checks were not bypassed.

## Limits

Fixed approaches drop0.6m over4m. Elevated pads permitted by the existing8m piers
may require additional construction to connect to terrain. They are not terrain-
adaptive access bridges. Ordinary individual ramp removal and existing support
rules apply; no refund. Five-piece purchase must fit the per-site1024-piece cap.
The old Atlas footprint is the sizing reference on this isolated branch. A new
larger Atlas from another lane requires the steward to reconcile pad dimensions
and landing profiles; do not overwrite newer flight layouts with this branch.
Hardware Xbox, independent full controller replay, multi-base frame-time/memory
profiling and public deployment are not established by these checks.


## Surface depth correction

Independent moving/grazing captures confirmed interference between the paint
plane and the original concrete top/expansion joints. Disabling received shadows
or enabling polygon offset did not fix it; raising paint hid the recessed fixtures.
The final material instead masks the hidden underlying upward concrete surface
and dark joints only while designation is enabled. The original shadow geometry
is retained, paint keeps depth testing, and unmarking restores the original deck.
No collision, save schema, fixture height or per-pad draw count changes. Focused
pad/finish/motion unit files pass after this correction. Independent final native validation PASS (reviewer-owned S/L captures, bounded
camera movement and actual plain/marked toggles). Final score4.0 average,min3;
no unresolved P1/P2 finding in the finish scope. See
[final review](reviews/final/review.md), source hashes and diagnostics. Remaining
P3 night approach/side-lens brightness is recorded. All five author asset views
were refreshed after this fix and PASS1/1 in7.1s; production rebuild PASS5.03s.
The full controller route predates only this visual mask; the final native review
explicitly exercises designation transitions on the corrected shader. No unrelated
full controller journey was rerun for the mask-only correction.
