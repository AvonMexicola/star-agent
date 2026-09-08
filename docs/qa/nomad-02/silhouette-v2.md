# Nomad formal silhouette candidate v2 — independent review

**Silhouette and scale: 4.1/5. Required: 4.5/5. Gate: FAIL.**

The ship now reads as a compact enclosed utility craft. The tapered crown,
armored pilot cell and directional drive housings resolve the main v1 shape
problem. The remaining silhouette work is bounded: fit the drive fairings into
the housing and reconcile the rear portal with the tapered shell. Another
concept redesign is unnecessary. The new forebody also causes a separate,
blocking MFD visibility regression.

The 4.1 score concerns primary shape and scale, independently of unfinished
textures or the MFD regression. No final materials/function/motion rubric is
given in this pass.

## Candidate and evidence

Reviewer: `/root/nomad_cutter/nomad_reviewer`; source/assets remained read-only.
Runtime: `http://127.0.0.1:5293/nomad/`, formal v2 after implementation's local
seam and `forceSinglePass` corrections. This report does not score the earlier
implementation-supplied images in `silhouette-v3`.

Exact identities, checked before and after capture:

| File | SHA-256 |
| --- | --- |
| `public/models/nomad.glb` — 2,527,532 bytes | `bd5fa8cc9f7a2ebfba08a647253dfcfb6356ae50471b31844852509c8c8d140d` |
| `src/ship-walkable.js` | `2da34ffe8d79cf410ced0a1a99b9f2811aa2f16643445cd0c32ccf5e0e60e8e2` |
| `assets/ship/nomad_hull.py` | `93044fc3c196cb9460f82ebb324fa869bf2d6236493bed000d919a35d560dc82` |

Self-captured browser studio views at 2026-09-06 23:24–23:26 UTC /
2026-09-07 01:24–01:26 Europe/Amsterdam. Chromium 151.0.7922.173, AMD Radeon
860M / ANGLE GL, DPR/pixel ratio 1, 1440×900 matched views and 1600×900
additional views. Exterior counters: 97 draws / 38,866 triangles. These are
studio counts, not hardware timing or actual-game acceptance.

```sh
npm run test:browser -- -c /tmp/star-agent-nomad-review/silhouette-v2.config.mjs
npm run test:browser -- -c /tmp/star-agent-nomad-review/silhouette-v2.config.mjs --grep supplement
```

Main capture: 1 passed in 13.9 s, zero browser errors/warnings/failed requests.
Thirteen PNGs were written, but `front-1600.png` is a duplicate cockpit pose:
the new studio resize handler reset the first custom camera after the viewport
change. Its recorded camera proves the mismatch; it is preserved and not used
as a front view. `front-corrected-1600.png` supplies the correct front capture,
after viewport/resize settling, with the expected pose asserted.

The supplemental front screenshot completed successfully. A subsequent
reviewer-only ray diagnostic imported a second Three.js module and caused
`WARNING: Multiple instances of Three.js being imported.` The supplementary
test therefore FAILED its zero-warning assertion. This is a reviewer harness
failure after the screenshot, not a candidate warning. It is retained in
`silhouette-v2/supplement.json`; the clean main run remains distinct.

Evidence: `silhouette-v2/evidence.json`, `silhouette-v2/supplement.json`, and PNGs
in that directory. Custom camera captions remain at the previous studio view
because the reviewer directly positioned the camera; metadata, not that UI
caption, identifies those images. GPU/browser work finished and the GPU was
explicitly released before this report was written.

## What is resolved

- The living body has a longitudinal taper and a faceted crown. Repeated
  window-like armor cassettes and the long flat container lid are gone.
- The cockpit now has a solid aft quarter and upper armor; exterior glazing
  reads as dark inset glass, with a clear view through it from the pilot eye.
  Shader compilation produced no error in the main capture.
- Each drive has one flared body, a smaller intake and tapered aft end. The
  repeated equal cans are gone; width and compact utility role are retained.
- Rear handle lands are planar. The nozzles are visibly open and show their
  recessed throats. The earlier capped-cylinder defect is fixed.
- The lower fitted cabin liner feels consistent with the compact shell, while
  the berth, rack and central aisle remain visibly understandable in stills.

## Remaining silhouette fixes

1. **Fit the rear portal to the new shell.** `walking-rear-1600.png`,
   `closed-rear-1600.png` and `side.png` show two square white ears projecting
   above the taper, plus thin wedges sticking outward beside the hatch box.
   `src/ship-walkable.js:141` still makes the original full rectangular jambs
   to y4.0; lines 145–146 retain the original header and top cap. They are now
   exposed above the authored shell, whose aft crown is y3.67. Rebuild or trim
   the visible static jamb/header shell into one compact collar/cassette that
   follows the new rear shoulder. Retain the 1.8×2.5 m opening and enough volume
   for the real retracted slat pack. A small intentional raised cassette is
   acceptable; detached square side ears and thin intersection wedges are not.

2. **Join the drive upper fairing to the housing.** In `side.png`,
   `port-side-1600.png`, `rear.png` and `top.png`, `Drive bridge / rising upper
   fairing` (`assets/ship/nomad_hull.py:53`) appears as a broad white shelf with
   a thick exposed edge and a dark separation from the curved pod. The new
   overall mass is correct, but the join still looks layered/unfinished. Make
   its outside edge share the drive cowl boundary or deliberately overlap it
   as a short fitted armor lip. Close the visible forward triangular gap at
   the cockpit/shoulder joint. Preserve the current primary dimensions and
   taper; solve the seam/attachment instead of adding more plates.

These two corrections should be the next silhouette pass. The small haunch
stabilizers can retain their current scale and direction.

## Priority regression: MFDs obscured by forebody

`cockpit.png` at the unchanged seated eye `[0,2.55,-2.8]`, target `[0,2,-4.15]`
shows only approximately the upper half of all four displays. The lower data
rows and footers are hidden by opaque geometry. V1 showed all four complete
screens from the same pose.

The new `Forebody / floating nose` and `Forebody / anti-glare brow`
(`assets/ship/nomad_hull.py:34`–35) extend back to z−4.05/−4.08 and rise to
y2.075/2.092. The MFD mounts remain near z−4.25, y2.08. Supplementary rays from
the eye hit the authored ceramic rear face around z−4.05, y1.966 and the upper
surface around z−4.076, y2.059 before the lower screen region. This supports the
observed obstruction's source; it is not a glazing-alpha problem.

Recess or notch the rear/inside forebody surface so it sits behind the screen
faces and their lower sight rays, while retaining the exterior nose height and
the usable original console. Do not raise the pilot camera to mask this. Recheck
all four full screen rectangles from the actual seated eye in the renderer.

## Secondary geometry and final-pass notes

- `Habitation / crown` is created at `assets/ship/nomad_hull.py:31` inside the
  `for side in [-1,1]` loop, but its coordinates do not use `side`. Each crown
  segment is therefore duplicated in the same plane. Emit it once. Fine
  surface artifacts appear in several white areas, but this static pass does
  not prove the duplicates cause each artifact or establish flicker timing.
- The formerly blocked engine throats now appear as uniform bright disks
  within a visible dark bore. Their material/detail and powered state should
  be addressed in the finish/runtime pass; this does not require changing the
  accepted recessed nozzle shape.
- Berth/rest body clearance, movement on a moving hull, touch/controller paths,
  cargo persistence and actual-game lighting remain outside this studio
  silhouette check. Still images do not establish those acceptance gates.

Disposition: **4.1/5, below 4.5.** Resolve the two specific joins and the separate
MFD obstruction, remove the duplicate crown, then obtain another independent
capture before applying final acceptance scores.
