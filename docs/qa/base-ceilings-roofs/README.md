# Ceiling lights and rounded roof evidence

Development checkpoint for PR71, isolated preview5557. Source4325c0b introduced
the six assets; fc6b281 corrected the controller fixture;9aefa1e fixes independent
functional findings. Shared5178 integration and public deployment are not claimed.

## Verified

| Check | Source | Result |
| --- | --- | --- |
| Full npm test |7e34acd|116 configured files pass32.82s|
| Dedicated placement/profile/landing/switch tests |9aefa1e|7/7 pass|
| Surrounding geometry/state/removal/power/collision |9aefa1e|5 configured files pass|
| Production controller build, walk, switch, reload |7e34acd|1/1 pass2.5min; no captured errors|
| Bumper tabs and responsive Roofs menu |fc6b281|1/1 pass11.4s;1440×900 and390×844|
| Actual GLB studio, six pieces and assembled kit |4325c0b/fc6b281|1/1 pass6.1s;7 views; no captured errors|

The final controller recheck on7e34acd passes1/1 in2.5min after review fixes,
with no captured page/console errors. No new asset or shader
was introduced by those fixes. Physical Xbox testing is separate from the injected
Gamepad journey. The journey starts in the shipped supplied build sandbox, uses
actual controller movement, menus and placement, and never teleports or seeds a
completed building. Its lamp ID/switch and saved pieces are in journey.json.

Browser151.0.7922.173; actual asset renderer is AMD Radeon860M, ANGLE OpenGL ES3.2,
1440×900. assets.json records the isolated view counts including studio support
geometry; these are not per-asset counts or whole-world frame-time acceptance.
Roofkit is38 draws/11,174triangles. Source/export budgets and exact file hashes
remain in public/models/base/manifest.json. No GPU FPS or continuous-motion claim.

## Captures

- roofkit.png: original rounded edge and corner joined above real ceilings/walls,
  with1.8m scale reference.
- ceiling-light.png: fixture below the structural ceiling in the actual loader.
- roof-flat/edge/corner/triangle/quarter.png: individual original tiles.
- rounded-roof-built.png: actual controller-built moon shelter.
- ceiling-light-on/off.png: same walking position and aim before/after X.
- roofs-desktop/phone.png: actual native construction UI.

The author inspected all views. The emitter appears bright in the moon exposure;
its metal frame and surrounding concrete remain distinct, while off is dark.
This inspection does not substitute for independent final art acceptance.

## Failures and review

The first production attempt stopped at the existing unsupported ceiling socket
after an empty-sky aim. The fixture now uses real LB snap cycling; its optional
auth probe now targets own8557 rather than absent8084. Original screenshot/state/
log remain in the task evidence attempt-01, with no runtime support rule weakened.

The initial independent review request timed out without model output. The host
retry completed in670.731s and produced functional-review-01.md: roof tops lacked
walkable support, square skins did not inherit angled ceilings, and emissive
power updates lagged actual lights. All corrected in9aefa1e with explicit
regressions; duplicate mount snaps and ineffective height hints also corrected.
Independent follow-up closed those three findings. Its supplied-still visual
score is3.6/5, below final acceptance; see functional-visual-review-02.md. It
then identified expanded roof support at the eave.7e34acd fixes that with a
feet-centre upper-surface rule, preserving full-radius structural ceiling and
wall collision. Tests now compare descending feet to the visible profile,
climb the shoulder and walk off the edge. Height hint composition is conditional.
Final art polish and independent recheck remain open.

check:repo remains blocked by inherited overlapping task claims. plan:checks
passes but includes672 inherited changed paths against its old remote baseline;
it is a suggested plan, not validation of unrelated features. The Blender export
wrote all32assets/manifest, then its audio shutdown hung; only its owned process
was stopped after completed exports were validated. No clean Blender exit claim.

Complete behavior and reproduction: ../../base-ceilings-roofs.md.


Reviewed game captures from4325c0b/fc6b281 are preserved in reviewed-game/.
The first unsupported-socket view is first-unsupported-socket.png. The root
folder's game captures record that final focused controller check separately.
Follow-up physical evidence does not silently replace an earlier review score.


Final production build passes5.91s (Vite existing chunk-size warning retained).
The first and follow-up reviews are evidence for their named source/images;
7e34acd's final eave correction is author-tested, not independently re-reviewed.
The final near-fixture on view still clips the diffuser and held-tool highlights:
lighting polish remains open, consistent with the3.6 review. The current lamp
provides useful warm illumination, switch/power behavior is verified, and these
limits are not hidden as final art acceptance.
