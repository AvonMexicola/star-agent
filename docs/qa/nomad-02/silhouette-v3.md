# Nomad formal silhouette candidate v3 — independent review

**Silhouette and scale: 4.5/5. Required: 4.5/5. Primary silhouette gate: PASS.**

The compact habitation body, inset cockpit, fitted drive shoulders and restrained
stabilizers now read as one practical solo craft at the matched exterior and
approximately 30 m views. The broad body-to-drive shelves and square rear ears
that blocked v2 are resolved. Proceed to finish/detail and actual-game review;
there is no remaining request for a primary shape redesign.

This is not final asset acceptance. A visible closed-ramp fit/envelope issue
remains below, and materials, lighting, full function, motion and performance
still need their separate final checks.

## Identity and evidence

Reviewer: `/root/nomad_cutter/nomad_reviewer`, read-only implementation/source/assets.
Frozen candidate served at `http://127.0.0.1:5293/nomad/`. The exact identities
were checked before and after the independent capture and did not change:

| File | SHA-256 |
| --- | --- |
| `public/models/nomad.glb` — 2,524,860 bytes | `c9b0b96fbfabe551e0d72c83c77e1036be46863d78540e8a440a0fdb9b07d963` |
| `assets/ship/nomad_hull.py` | `32a5cd0cd95040b07a83e48b01ad8c6a46cf07310a8b2391a5f3b96469f91c03` |
| `src/ship-walkable.js` | `3bf60ef86b62a49af71fd9ee1d4fb2ed63fdfe406c1b8e7ff994337c4ddac14c` |

Captured at 2026-09-06 23:34 UTC / 2026-09-07 01:34 Europe/Amsterdam.
Chromium 151.0.7922.173, AMD Radeon 860M through ANGLE GL, DPR/pixel ratio 1,
1440×900 matched views plus 1600×900 additional views. Browser studio, ACES
exposure 1.1. This is independent renderer evidence, not actual-game lighting.

```sh
npm run test:browser -- -c /tmp/star-agent-nomad-review/silhouette-v3.config.mjs
```

Result: **1 passed in 14.3 s**; 13 views, zero browser errors, warnings or failed
requests. The earlier reviewer's viewport race was corrected by waiting for
resize before setting the custom camera; `front-1600.png` now has the correct
recorded front pose. No second Three.js module was injected. The command's Node
runner still prints the existing NO_COLOR/FORCE_COLOR environment warning.

`silhouette-v3/evidence.json` contains every camera, viewport, door state and
runtime scene count. Exterior counters were 97 draws / 38,826 triangles, with
the same GLB throughout. These are studio counts, not frame-time measurements
or a completed asset-budget audit. Custom images retain the prior UI caption
because the reviewer directly moved the camera; evidence metadata identifies
the actual view.

Images inspected: exterior, rear, side, top, boarding, berth, rack, cockpit,
front, port side, walking-height rear, closed 30 m and closed rear. The browser
exited and the GPU was explicitly released before report writing.

## Closed findings

| Earlier finding | Observed v3 result |
| --- | --- |
| Container-like flat habitation and separate barrel drives | Tapered crown and directional pods retain the more coherent v2 form. The closed 30 m view reads as one compact utility ship. |
| Floating upper drive shelves | `exterior.png`, `side.png`, `top.png` and both rear views show thin fitted shoulders joining the cowl. The forward closure forms a deliberate dark structural face. |
| Square rear ears and thin intersection wedges | Trimmed jambs and the compact central cassette follow the rear body. The doorway remains the visual focal point in `walking-rear-1600.png` and `boarding.png`. |
| Forebody hides lower MFD rows | `cockpit.png` shows all four complete screens, lower rows and footers from unchanged `[0,2.55,-2.8]`. The recess is effective without raising the eye. |
| Duplicated crown segments | The source now emits the crown only for `side == 1`. The read-only source check confirms the duplicate creation path was removed. |

The useful rear route, berth, rack and leg placement remain visually consistent
with the small practical role. Exterior glazing reads dark; interior glazing
preserves a clear forward view. This still does not establish walking/collision
or rest/rise behavior.

## Remaining closure/envelope issue for final acceptance

`closed-rear-1600.png` and `closed-30m-1600.png` show the top of the raised ramp
projecting above the new hatch cassette as a flat dark tab. The source still
uses the full `hypot(3.2,1)` rigid ramp, rotated to −π/2 about pivot y=1 when
closed. That geometry implies a maximum y of approximately **4.35261 m**, which
is above the declared `SHIP_LAYOUT.flightBounds.max[1]` of **4.28 m** and about
0.30 m above the new collar. This height is derived from the runtime ramp
geometry/transform, not a fresh measured composite bounding box.

This is separate from the now-accepted primary shape. Reconcile the closed pose
by folding/retracting or otherwise physically fitting the ramp into the hull,
then measure the complete closed runtime assembly. Preserve the existing 3.2 m
deployed run and the y1→0 walking plane; shortening the working ramp would
invalidate its physical route. Test the combined slat/ramp travel after the
mechanical correction, including clearance and rider support. A GLB-only bound
check cannot establish this runtime moving-part contract.

## Finish and final review still pending

- Broad armor and cabin surfaces are still largely uniform. Final material
  separation, constructed panel/service details, edge treatment and restrained
  wear remain unreviewed; this silhouette pass does not certify those surfaces.
- The bright, uniform engine throat disks need powered-state/material treatment
  in the final pass. The recessed nozzle shape itself is accepted.
- The shoulder registration is partly obscured/clipped by revised geometry in
  side views. Reposition it on an exposed, intentionally oriented surface during
  the graphics/finish pass.
- Final actual-game exposure/shadows, desktop/phone reach, full keyboard and
  controller/touch journeys, berth transitions, moving-hull support, persistent
  cargo state and missing-asset behavior remain pending.
- The revised slat track animation is visible in source but was not independently
  exercised as a complete moving sequence in this still-capture pass. No motion
  score or claimed full-envelope/slat collision result is inferred.
- Final six-item rubric target remains average at least 4.2, every item at least
  4, with actual-game and self-captured evidence. No merge or delivery approval
  is implied by the primary silhouette pass.

Disposition: **primary silhouette PASS at 4.5/5; proceed to finish/detail while
fixing the bounded closed-ramp issue. Overall asset acceptance remains pending.**
