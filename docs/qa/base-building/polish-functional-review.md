# Base polish functional review

Reviewed the dirty candidate based on `4d934d1` on 2026-09-07. This bounded review
covered motion, collision, lights, authored previews, resource ownership/disposal,
dialog scrolling, geometry changes and persistence integration. The reviewer
changed no runtime source and launched no browser or GPU. This is not an Opus
rubric or visual approval. The reviewer authored the separate polish QA script;
root, not this reviewer, executed it.

## Finding

**P2 — controller right-stick scrolling targets the wrong element.**

The new `#build-dialog[open]` rule sets `overflow:hidden`, and `.build-content`
now owns the vertical scroll area. `src/controller-ui.js:82` still applies
`pad.ui.scroll` to `dialog.scrollTop`; `src/gamepad.js:58` supplies right-stick Y
as that value. Opening Recipes and moving only the right stick consequently
does not scroll the recipe list. D-pad navigation still reaches controls because
the focus router calls `scrollIntoView`, so this is a lost scroll binding rather
than a completely inaccessible dialog.

Sent this finding to root during review. Recommended correction: mark the intended
inner scroll region explicitly, resolve it in the shared dialog router with the
dialog as fallback, and exercise right-stick scrolling while focus stays fixed.
This finding was established from the changed DOM/CSS and the active routing
code; no new browser reproduction is claimed here.

**Disposition:** root added `data-controller-scroll` to `.build-content` and
changed the shared router to use that element with the dialog as fallback.
Independently inspected both changes; they address the identified routing mismatch.
Root also added a browser regression requiring more than 80 px of right-stick
scrolling with focus unchanged and the close control still visible. That browser
regression was pending execution when this report was completed; code correction
is verified, browser confirmation is not claimed here.

## Checks that held

- Each placed visual receives private material clones and a private fade uniform;
  geometry, finish textures and GLTF templates remain shared. Repeated opacity
  updates reuse those clones, preserve vertex colours and retain logarithmic depth.
  Disposal releases instance materials, preview edges and the independently owned
  live-display geometry/texture/material without disposing shared model geometry.
- Preview requests use generation IDs. Late results after a piece switch or system
  disposal are disposed instead of replacing the current preview. No collider-box
  placeholder is inserted while an authored model is loading.
- Door motion uses one live fraction for visible leaf transforms, walker collision
  and ray queries. Closing tests the entire movement between the preceding and
  proposed leaf bounds; an entrant pauses motion without advancing its clock.
  Leaving resumes closing, and reversal starts from the current fraction.
- Only the target door boolean is persisted. Interactions write that target before
  animation changes it; failed writes retain the preceding target. Reload starts at
  the saved endpoint. Ship-supplied placements still refresh physical cargo access
  and include payment and construction in one `MiningStore` write.
- Four pooled service lights bound the active light count. Distances and camera
  subtraction stay in double-precision world coordinates. The placement work light
  uses darkness and focus; the fixed console spill remains available in daylight.
- The geometry regression parses actual exported GLBs and ray-checks the stair
  rear overlays and panel status layers. This verifies their distinct depths; it
  does not replace inspection of the resulting highlights or night lighting.

Independent CPU check:

```sh
node --test tests/build-finish.test.js tests/build-motion.test.js tests/build-geometry.test.js
```

All three selected test files passed. Root separately reported passing base-scene,
build-UI and base-polish browser routes with zero errors; those results were not
rerun by this reviewer. Root's latest lighting-only capture and the independent
Opus disposition remain separately recorded evidence. No new save-loss, payment,
material-lifetime or dynamic-door correctness defect was confirmed in this scope.

Root verification follow-up: the updated build-ui browser suite passed4/4 in
11.1s, including right-stick80px scrolling with focus unchanged and Close visible.
