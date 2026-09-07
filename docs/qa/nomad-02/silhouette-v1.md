# Nomad candidate v1 — independent silhouette review

**Silhouette and scale: 3.4/5. Required: 4.5/5. Gate: FAIL.**

The shorter nose, deeper drive masses and visible furnished rear route improve
the baseline. The closed ship still reads as a glass-front van between two
segmented barrels. The primary shape needs another pass before finish work.
This is a silhouette decision only; no final rubric or gameplay approval is given.

## Candidate and capture

Reviewer: `/root/nomad_cutter/nomad_reviewer`; implementation/source/assets remained
read-only. Base HEAD `6f80fc09a5bba7206c2d7251ee07f52c68ac1208` with live uncommitted
candidate changes. Runtime GLB is 2,444,024 bytes, SHA-256
`21450518a624009344e8e2db062ed8c02f3d4a29cd63ce8015dddb446ad6fc22`.
Hash checked before and after capture.

Independently captured 13 views at `http://127.0.0.1:5293/dev/ship.html`,
2026-09-06 22:54 UTC / 2026-09-07 00:54 Europe/Amsterdam. Chromium 151.0.7922.173,
AMD Radeon 860M through ANGLE GL, DPR/render pixel ratio 1, 1440×900 matched views
and 1600×900 additional views. Browser studio, ACES exposure 1.1. These are actual
renderer images in an isolated studio; they are not actual-game integration.

Command:

```sh
npm run test:browser -- -c /tmp/star-agent-nomad-review/silhouette-v1.config.mjs
```

Capture test: 1 passed in 11.6 s. No browser errors, browser warnings or failed
requests. The Node harness printed only the existing NO_COLOR/FORCE_COLOR
environment warning. Exterior studio scene counters: 101 draws / 37,926 triangles;
this is not a hardware frame-time benchmark or complete ship budget audit.

Evidence: `silhouette-v1/evidence.json` and the 13 PNGs next to it. GPU/browser
work finished and the GPU was explicitly released to the parent before writing
this report.

## Top five fixes

1. **Shape the habitation body along its length.** In `assets/ship/nomad_hull.py`
   lines 36–40 and 83–86, `Habitation / inset roof` is a 5.7 m constant-height
   slab, the chamfer is a constant band, and four near-identical upright cassettes
   keep the container outline intact. `side.png`, `port-side-1600.png`,
   `top.png` and `closed-30m-1600.png` make this unambiguous. Use a real raked or
   stepped crown with a deliberate high point, taper the aft shoulder toward
   the portal, and make the service belt follow that geometry. Replace repeated
   full-height white rectangles with one or two large directional armor forms
   over a recessed service zone. Resolve the matching runtime roof/ceiling in
   `src/ship-walkable.js:72` instead of hiding a box inside a lower new roof.
   Preserve standing headroom and the rack top at y3.17; taper outside x±1.65.

2. **Turn the canopy into an enclosed cockpit volume.** `Canopy / rear post`,
   `window belt`, `angled side spar` and `forward roof` in
   `assets/ship/nomad_hull.py:28`–33 and 84 currently outline an almost empty
   glass trapezoid. From `front-1600.png` one sees the entire cabin and rear
   opening through it; from 30 m it has the visual character of a bus windscreen.
   Give the brow visible thickness and a shaped transition into the habitation
   shoulder, add substantial aft side-cheek/upper-quarter armor, and raise the
   lower side sill around the control pods. Shape a deliberate smaller inset
   window aperture around the pilot rather than leaving the whole side polygon
   transparent. Keep the front center clear, preserve all four MFDs and validate
   the seated eye `[0,2.55,-2.8]`. A modest glass tint/reflection pass will later
   help enclosure but does not replace those geometry changes.

3. **Make the drives directional and integrated.** `Drive / chamfered ceramic
   cowl` at `assets/ship/nomad_hull.py:49` repeats three nearly equal-radius
   octagonal cylinders. The profile is flat from intake to aft taper, creating
   a stacked-can read. Use a narrower intake throat, a clear compressor/shoulder
   bulge and a long tapered aft housing, with unequal cowl lengths. Carry the
   bridge up into the upper hull shoulder; the current fairing at y2.55 only
   supports their midline. Raising the drive/root assembly modestly while
   keeping the top inside y4.28 is a viable way to make the body and drives read
   together. Keep the aft exhaust outside the boarding lane. Preserve the
   useful current width and compact stabilizer scale rather than adding span.

4. **Build the rear portal from deliberate planar sections.**
   `Portal / flared outer jamb` at `assets/ship/nomad_hull.py:77` is one
   non-planar six-vertex face. In `walking-rear-1600.png` the broad white jamb
   produces arbitrary triangular patches and still resembles a blank cabinet
   door. Divide it into a real inset door frame, a flat grab-handle land, and
   separately planar angled outer cheeks that continue into the tapered body.
   Retain the clear 1.8 m opening, the visible threshold and the handles. The
   ramp and framed view into the fitted cabin are strengths to preserve.

5. **Open the nozzle geometry.** At `assets/ship/nomad_hull.py:62`,
   `rod('Drive / nozzle cavity', …3.41→3.97…)` makes a capped cylinder.
   Its aft cap at z3.97 hides `recessed luminous throat` at z3.72–3.74.
   All rear views show flat dark disks rather than a recessed engine. Replace
   the cap with an open annular wall and put the throat behind the visible
   bore; keep the three lips only if their spacing reads as actual nested
   construction. This is a confirmed source cause for the observed flat disks,
   not a request to compensate with brighter emission.

Secondary exterior opportunity: `Stabilizer / canted tip` presently reads as a
separate upright plate on a horizontal shelf. Use one continuous bent/tapered
root-to-tip shape or simplify the vertical element; keep this secondary to the
habitation/cockpit/drive forms.

## Cabin observations, without gameplay acceptance

- `boarding.png` shows an understandable central route, port berth, port aft
  rack and starboard chest. The new furniture gives the ship a useful solo role.
  No obvious aisle obstruction appears in these stills, but no capsule sweep
  or real boarding/rest journey was performed in this pass.
- `rack.png` shows four physical boxes and the screen shows `04 / 08`, plus
  slot and mass data. The partly empty upper shelf is visually truthful. Cargo
  persistence and interaction are outside this silhouette pass.
- `berth.png` has a readable mattress, pillow, folded cover, restrained lower
  storage and local light. Final finish should separate fabric from hard shell;
  head/eye placement and rising motion remain unobserved here.
- `cockpit.png` preserves all four unobstructed MFDs. Cargo access copy now says
  `AFT RACK / STARBOARD`, resolving the preliminary copy concern.
- Fine striping/shadow artifacts on some white surfaces and the fixture's old
  `SHORT RANGE SURVEYOR` caption are final-pass review items, not grounds to
  postpone the primary shape corrections.

Disposition: **not ready to proceed to the final finish/acceptance gate**.
Rebuild the primary forms, then obtain a new independent silhouette capture.
This report preserves the v1 failure and must not be relabeled as a later pass.
