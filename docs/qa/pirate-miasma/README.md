# Crimson vacuum habitats production record

**Validated development checkpoint — SA-PIRATE-003.** Runtime `cc6b035` adds Veil
Exchange on Miasma and encloses both Veil and the existing Selene Hush Exchange
with actual interlocked two-door vestibules. Both use Crimson structural paint,
rigid safety/faction prints, sealed kit roofs and the four supplied industrial
props. Parent privately composed this source in `65814dc`; shared integration and
export remain the parent's responsibility. No public deployment is claimed.

See the [player guide](../../pirate-vacuum-bases.md), [brief](../../briefs/pirate-miasma.md),
[curated evidence receipt](evidence.json) and [integration handoff](handoff.md).

## Actual validation

- Full Miasma controller journey passed in **6.1 minutes**, on frozen `fabe36b`:
  actual Nomad landing, chair/hatch exit, apron ramp, canonical ground route,
  compound ramp, isolator, both airlock leaves, purchase, cargo view, sale,
  focus/held/disconnect/replacement/unsupported-device gates and two-door return.
  Closing the outer door against the player paused at fraction 0.5 while the
  inner remained shut; X reopened it before traversal continued. Subsequent
  changes only clear visual scenery and move the phone action; navigation,
  collision, airlocks, trade and balance remain unchanged.
- Final focused Miasma02 batch on frozen `cc6b035`: **3 passed in 5.1 minutes**.
  Hush keyboard/native 390×844 phone entry, both doors, purchase/cargo/return
  passed in 52.6 seconds; both pirate habitats and actual Veil burst/retreat
  passed in 2.8 minutes; matching Verdigris exterior/entrance views passed in
  1.3 minutes. Every application error and warning list is empty.
- Actual Veil burst: Nomad shield **180 → 126**, hull **240 → 240** after three
  shots; shot count remained 3 after retreat. The unchanged balance invariants
  verify survival for every supported full-health ship, full cooling intervals,
  pause/retreat reset, piloted landed ships and exclusion of ground-rover cabins.
- Eighteen pirate invariants cover independent stock/discovery, both enclosed
  doors and real swept safety, all five hulls on Veil's pad, ramp support/collision,
  and half-metre canonical ground-route samples. Four new scenery cases inspect
  original GLB vertices/node transforms, accepted slope/wind margins, actual
  mineral instances, player construction changes and unchanged exterior colonies.
  Final three focused test files passed in 1.297 seconds.
- Private combined full 160-file suite passed in 58.507 seconds before the
  scenery addition. Parent's final private `65814dc` composition registers the
  new scenery file: **all 161 normal files passed in 65.57 seconds**, production
  build in 12.57 seconds, repository/plan/diff checks passed. Our final production
  build passed in 6.05 seconds (390 modules). These are separately attributed
  source boundaries, not an assertion that this owner reran the parent's suite.

Chromium 151.0.7922.173, AMD Radeon 860M through ANGLE OpenGL ES 3.2, desktop
1440×900 and phone 390×844; seed 7291, epoch 1788876000000. Controller input is an
injected standard Gamepad. Phone input uses a real coarse-pointer/mobile browser
context but no physical phone. Phone/art poses are explicit presentation fixtures;
the separate controller case physically traverses the full route. Both browser
jobs used the actual host executable/argv guard, one worker, no retries, private
5686/API8686, short disk TMPDIR and unchanged tracked source hashes.

## Final image review

Author and parent integration review inspected the final stills. The previous
plants through Veil's deck/entrance are gone, the phone action no longer overlaps
movement, and rigid roofs, doors, painted walls and flush faction prints read
clearly. Parent inspection is an integration review of author captures, not the
independent own-capture art scoring required by QUALITY.

- [Veil overview](veil-overview.png), [Hush overview](hush-overview.png).
- [Clear Veil entrance](veil-airlock-approach.png), [Hush entrance](hush-airlock-approach.png).
- [Veil interior](veil-sealed-exchange.png), [Hush interior](hush-sealed-exchange.png).
- [Crimson work yard](veil-crimson-work-yard.png), [outer apron branding](veil-outer-apron.png).
- [Scenery before](scenery-before.png) / [after](veil-overview.png).
- [Phone before](phone-before.png) / [after](phone-after.png).
- [Blocked-close result](outer-closing-blocked.png), [actual purchased cargo](trade-cargo.png).
- [Verdigris approach](verdigris-approach.png), [Verdigris entrance](verdigris-entrance.png).

Actual renderer instance transforms, restored with the double camera origin,
confirmed zero construction/canopy or fragment overlaps in all five Veil views
and both Verdigris views. Veil overview retained 84 flora instances and 2,749
fragments; its entrance retained 71 and 2,443. Verdigris retained 60/2,954 at the
approach and 72/2,249 at the entrance. This clears actual piece footprints with
model-sized margins; it does not erase a whole claim radius or alter terrain.

## Retained failures and corrections

The initial smaller Vitriol survey found flat pads but a steep rock corridor.
A first bounded route needed ramps beyond the claim envelope and was rejected.
The final 1,024-candidate/four-orientation survey has core relief 2.096 m, pad
relief 3.709 m and five canonical route waypoints with maximum sampled gradient
0.411. No terrain function was changed. The former Hush test's always-open-door
assumption correctly failed; it now verifies closed collision and actual motion.

Fixture listing initially rejected a callback without Playwright's required
parameter destructuring. No browser launched. Miasma01 then passed both gameplay
cases but its final art case failed after capturing both sites: a second
non-configurable `getGamepads` injection raised `Cannot redefine property:
getGamepads`. The fixture property is now configurable and per-site receipts are
written incrementally. This was separate from the two real visual defects found
in its images: phone-button overlap and plants through construction. Miasma02
passed after those scoped fixes. Original raw `test-results/miasma-01` and
`miasma-02` source receipts, logs, states, images and failure video remain intact.

A multiline sandbox build failed to write the existing symlinked Vite temporary
cache with EROFS. The already-authorized standalone build passed without a new
permission request or an application/configuration workaround. No Chromium
startup failure occurred in either pirate browser batch.

## Provenance, performance and limits

Original tower, station battery and four supplied Crimson GLBs retain their
existing source/provenance in `assets/pirate-*` and the prior
[Hush production record](../pirate-compound/README.md). No new geometry, texture,
normal repair, terrain, shader, global exposure, or flora asset modification was
made. Parent appearance `48be92e` supplies code-native paint and rigid prints;
its later strict identifier validation changes no valid rendered appearance.

Discovery and isolation are independently session-only. Market version 2 adds
Veil's finite stock once and preserves all existing Hush stock in the same atomic
solo commerce document. Normal settlement count stays four. No pressure/air
simulation or new ground NPC enemies are claimed; no unfinished camp/combat
modules are copied. Regular settlements keep their existing online behavior;
secret pirate sites remain solo.

The signature CPU probe averages 0.0449 ms for 357 pieces across three Miasma
claims (10,000 unchanged updates, 79 effective footprints). This is not an FPS
claim. Three-second outer-apron scene samples remain above QUALITY targets:
Veil median 40.5 ms / p95 44.7 ms at scale 0.85, 1,046 draws and 5.51 M triangles;
Hush median 39.9 ms / p95 48.8 ms at scale 1, 451–541 draws and 1.47–1.51 M
triangles. Counts include shadows and streaming; these short observations are not
formal steady-state benchmarks. Physical devices, independent art scoring and
performance acceptance remain pending. No further renderer optimization is
bundled into this bounded site feature.
