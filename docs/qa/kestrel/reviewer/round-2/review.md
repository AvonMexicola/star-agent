# Kestrel blockout: independent silhouette review, round 2

**Criterion 1: 4.5 / 5. Gate: PASS for proceeding to detail.**

The rebuilt ship meets the silhouette brief. It reads as a compact twin-engine
interceptor at approximately 30 m: long fine nose, low single-seat canopy,
continuous swept wing-body, outward-canted tip fins and two substantial exhausts.
The shoulders no longer make a rectangular bar across the front, and the drives
now build gradually out of the lifting body instead of sitting on it as two
straight roof runners. The side profile has a coherent low arc from canopy to
drives, with a thin outboard wing. Human-relative scale remains credible.

This is a silhouette stage pass, not final asset or PR approval. Criteria 2-6
have not been scored. Surface finish, cockpit fit, functionality and motion
remain for the later asset review. Flight/hangar integration is outside scope.

## Evidence

- Visually inspected all six builder EEVEE renders in `../../round-2/`, including
  the now uncropped top view.
- Took and inspected four fresh independent EEVEE views from the immutable
  round-2 `.blend`, using a single neutral material: [top](top-ortho.png),
  [side](side-ortho.png), [front](front-ortho.png),
  [approximately 30 m front quarter](front-quarter-30m.png).
- These are 1200 x 1200 images with an independent 1.80 m figure. They show the
  same geometry without relying on the builder's material boundaries. Neutral
  lighting was adjusted for readable contrast before the final captures.
- Geometry bounds: 13.501 m length, 9.000 m span, 3.199 m height, y = 0 ground
  contact. Source hash was identical before and after capture:
  `4be9b5001249614dea28ba6993cef868a1370d60f28d007b2fe660771dfc7dc9`.
- [Capture metadata](capture-info.json). Reproduce with
  `env ALSOFT_DRIVERS=null blender -b --python docs/qa/kestrel/reviewer/render_round2.py`.
  Blender's installed-extension `cattrs` import warning persists; EEVEE capture
  completed and Blender exited with code 0. No performance claim is made.
- No source/builder/asset edits. Round-1 evidence and its failing score remain
  intact.

## Disposition of the five round-1 findings

| Priority | Finding | Round-2 assessment |
|---|---|---|
| 1 | Constant-depth shoulder slabs | Resolved for silhouette. The rolled outer chine narrows the apparent body and joins the wing in the front and quarter views. |
| 2 | Straight rectangular drive runners | Resolved for silhouette. The peaked, narrowing ceramic housings read as integrated drive volume and retain the large separated exhausts. |
| 3 | Upright trapezoid fins | Resolved. Increased cant, aft rake and shorter upper chord give a stronger swept outline without losing the 3.2 m height/9 m span envelope. |
| 4 | Generic broad outer trailing edge | Improved sufficiently. The outer chord is narrower and the paired fin/wing outline is more deliberate in the uncropped top view. |
| 5 | Canopy placed on a flat deck | Resolved for silhouette. The smoother crest and tapering central spine make the longitudinal profile continuous. |

## Carry forward into surfacing

Two local geometry joins still need careful finishing; neither warrants another
primary-shape rebuild or holds the silhouette gate:

1. `blender/build_fighter.py`, `Drive | lofted ceramic cowl L/R`, aft end near
   z = 5.4: the cowl/drive boundary has narrow triangular tongues in the builder
   top/rear-quarter views. Resolve this into an intentional collar termination
   as the drive is surfaced, preserving the approved long taper and nozzle size.
2. `Shoulder | rolled chine L/R`, forward join around z = -3.6 to -2.7: a short
   stepped lip remains visible beside the nose in the side/quarter views. Blend
   or deliberately terminate that local edge during the seam/intake pass,
   preserving the thin rolled outer chine rather than restoring a vertical wall.

Keep this low silhouette while adding frames, intakes, hatches and mechanisms.
The completed asset still requires the separate full rubric review specified by
the brief; this pass does not establish the final >= 4.2 overall score.
