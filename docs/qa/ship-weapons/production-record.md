# Ship weapons production record

Current status: implemented and functionally checked development candidate. The
final independent visual review is in progress. Local integration is complete.
No release acceptance or deployment claim. Runtime follow-up: `2faa71c`.
Draft [PR61](https://github.com/AvonMexicola/star-agent/pull/61); local integration
`5842404`, recorded`931ea10`, now served at<http://127.0.0.1:5178/>.
Base `a748be101aad4ea672a157481044ce9ed6b03e35`, isolated branch
`feat/ship-weapon-fittings`. Brief: [ship-weapons](../../briefs/ship-weapons.md).

## Source and fit

Nine original Meridian Blender guns: Cobalt pulse, Solar lance, Singularity in S1,
S2 and S3. Hollow named barrel tips, keyed mating feet, beveled receiver armor,
service panels, cooling structure and distinct emitter assemblies. Source blend
opens as an editable lineup. Original procedural base color / ORM / tangent normal
maps are 1024² with baked vertex contact shading; no external imagery or service.
Nomad and Kestrel hull sources/UVs were not modified.

Current kit SHA256 `308a1ebeae4b1d5119dd98f96d21cc478335a638317fde19fdc542703f9cde67`:
2,806,012 bytes; 25,852 stored triangles including all six adapters; 2,232–3,368
triangles and two material draws per selected gun. All nine variants share three
WebP maps and one cached kit download. At rest only the chosen family is visible.
The actual Three sheet confirms each selected gun's two draws. Combined scene
metrics and independent review remain separate from these component counts.

Nomad uses 15 mm annular spacers. Kestrel's nose fork moves its S2 gun 1.05 m
forward; outboard return posts and wing footings follow independently sampled hull
surfaces. The open central channel preserves gear motion. Atlas roof pads and an
aft bridge between radiator fins support its three guns. Mark II keeps its original
three sockets and aft-facing bore. Flight and walking/EVA envelopes include the
actual fitted groups, without adding cabin floors.

## Reproduce

```
python3 blender/ship_weapon_textures.py
ALSOFT_DRIVERS=null blender -b --factory-startup -noaudio --python-exit-code 1 --python blender/build_ship_weapons.py
python3 blender/pack_ship_weapons.py
npm test
VITE_DEV_TOOLS=1 npm run build
npm run check:repo
npm run test:browser -- -c scripts/ship-weapons.config.js
npm run test:browser -- -c scripts/ship-weapons-patrol.config.js -g 'controller patrol'
node scripts/ship-weapon-sheet.mjs
node scripts/ship-weapon-review.mjs
```

Python needs Pillow (used isolated Pillow12.3.0); Blender5.2.0 LTS; Node26.7.0.
Browser configs default to the owned production preview5410, with memory API5411.
The independent kit sheet temporarily serves5412 and closes its server/browser.
Where `/tmp` has a quota, set `TMPDIR` to an existing private writable directory
on a filesystem with space. `SHIP_WEAPONS_OUTPUT`, `KESTREL_FLIGHT_OUTPUT` and
`COMBAT_EVIDENCE` can likewise keep captures/reports off a full `/tmp`. No global
Chromium or system configuration is changed.

## Checked so far and retained failures

- Full unit suite685/685, production build and repo helper pass at2faa71c.
  The build retains the existing Vite chunk-size warning; browser scenes compile.
- Nomad, Kestrel and Atlas actual production keyboard/pointer selection/fire and
  gear interlock pass (45.9/46.7/44.9s); 1440×900 and390×844 captures, no browser
  errors/warnings. These first views precede the final05 foundation refinements.
- Native Three PBR kit sheet passes all nine variants: Chromium151, AMD860M
  ANGLE OpenGL ES3.2,1536×1152, no errors/warnings. No FPS benchmark claim.
- CPU tests retain actual exported mesh transforms at25billion-metre origins,
  muzzle/flash agreement, exact size matching, projectile tail/range and damage,
  NPC current-pose firing, obstruction, equipment collision and load failure.
- Initial texture authoring failed because system Python lacked Pillow; repaired
  with an isolated authoring environment. No runtime dependency added.
- Initial sampled nose package omitted the wide mating foot; exact mesh review
  caught its gear collision. Nose offset revised. Review also caught Nomad's
  protruding connector and the steep nose chine; current spacers/lofts address it.
- First browser crashed before page load: SIGABRT, font_data_service_impl.cc379,
  `Disk quota exceeded (122)` in its core. A private disk TMPDIR fixed startup;
  this was distinct from the earlier repository Crashpad SIGTRAP. Extracted core
  copies were deleted. No browser startup retries with security/GPU flag changes.
- First sheet imported Three twice; a Vite fixture module fixed it. A unit run
  raced the GLB packer and correctly failed the manifest-byte check; sequential
  frozen-artifact rerun passed. Neither failure is counted as successful evidence.

NPC damage now follows the same24/42 pulse profiles, with1.5s/1.75s spacing. Actual
CPU patrol defeats a stationary Nomad in20.9s versus51.15s previously; this is a
real difficulty increase. All three injected-controller patrols pass at the final05 geometry: accept the
contract, fly the full approach with the stick, select/aim/fire, destroy both
contacts, file the report and return to flight. Nomad20shots/16hits/7incoming;
Kestrel13shots/9hits/4incoming. These results do not establish general balance.
No physical controller hardware or listening approval is claimed.

## Final functional corrections and checks

- Review reproduced stale held fire across an online/offline transition, acceptance
  of an empty gun body, partially attached guns after a missing foundation, and a
  stale hidden Nomad firing transform. The runtime now clears/disarms online input,
  validates body geometry and every foundation before fitting, and updates the hull
  pose even when its cockpit mesh is hidden. Malformed-body/atomic-failure regressions
  are retained. Neither unavailable guns nor online mode can produce offline fire.
- Independent geometry review examined36 actual mount/family combinations,193 gear
  poses,36 own-hull muzzle rays and nine exported tip planes. Final05 has no sampled
  gear/static/ray intersections, tip-plane error0m, and supported footings. The
  review also caught a suit trapped by an initial attachment overlap: gradual
  outward walking/EVA escape now passes while further entry remains blocked.
- The station obstruction query now tests the actual shot origin even when the
  player is90km away; an NPC or exterior barrel cannot bypass the wall because of
  an unrelated player-distance shortcut.
- Kestrel physical boarding/departure helper passes in1.7m on the final runtime:
  descend/reboard the port ladder, secure canopy/ladder, station lift, retract gear,
  fly clear, approach Selene, land and exit. Only the inter-body approach uses the
  existing explicit quick-transit fixture. The old helper first waited for a retired
  entry card, then pressed B during traversal without resuming the newer construction
  modal. Both fixture mismatches are recorded; the final route completes physically.
- A screenshot write also failed EDQUOT before that route. Moving output to a disk
  directory fixed it; neither that attempt nor the two fixture failures counts as
  a pass. Existing temporary evidence was moved with its original path preserved.
- Real touch events on a390×844 mobile context select and hold the Atlas S3
  Singularity trigger, then stop cleanly on release (44.6s). The MarkII studio loads
  threeS3 mounts and preserves its aft +Z bore (2.6s). No page errors; the studio
  also has no console warnings/errors. The phone test establishes the weapon
  controls, not a complete touch-only spaceflight/navigation journey.
- Current captures are [Atlas touch](atlas-touch.png), [MarkII studio mount](atlas-mark-ii-mounts.png)
  and [Kestrel physical surface exit](kestrel-surface-ladder.png). Studio and game
  evidence are distinct. Full temporary reports remain outside Git.

## Local integration boundary

The remote feature base remainsa748be1. The shared local preview advanced tof8e48d9
with RT fire, the tabbed gameplay menu and persistent PostgreSQL accounts. A separate
integration candidate preserves those changes: RT fires, A/B supplies vertical
thrust, LT brakes, Menu → Ship selects weapons/gear. The weapon PR remains bounded
and does not absorb those separate unmerged PR histories. No database schema,
protocol or persistent service change is made by this feature.

Combined686 unit checks, build and all three full RT patrols pass (4.8m total).
A separate combined Nomad check confirms the hidden first-frame barrel position
and all three keyboard/pointer families (42.6s). Its presentation fixture initially
assumed the dev launcher hid the hull, then forgot to restore the HUD activation
flag; those fixture failures are retained and corrected without runtime changes.
Independent [runtime closure](integration-review.md) passes all four source findings,
41focused tests, and exact hidden muzzle transforms at25billion metres. The
[mount review](mount-review.md) retains its original finding and appended closure.
Final independent visual review is pending at this update. Performance figures above
are component counts; no median/p95 or final FPS acceptance is claimed.


## Reviewer-authored visual fixture

Mendel authored the bounded capture script; root executed it through the available
hardware runner and returned the six unchanged PNGs for his independent inspection.
The script verifies the final05 kit hash before and after serving. Chromium151 /
AMD860M ANGLE GLES3.2,1440×900, native Three PBR, six captures, zero page/console
errors or warnings. This is an isolated controlled export fixture, with exact runtime
fitting code. It is separate from actual-game input/boarding captures and does not
certify whole-game lighting, motion or FPS.

[Three families](01-families.png), [sizes with1.8m reference](02-human-scale.png),
[Kestrel underside](03-kestrel-underside.png), [nose foundation](04-kestrel-nose.png),
[Nomad port fit](05-nomad-fit.png), [Atlas roof](06-atlas-roof.png).
Reproduce with `SHIP_WEAPON_REVIEW_OUTPUT` and `TMPDIR` set to writable directories,
then `node scripts/ship-weapon-review.mjs` (temporary port5414). The archived script
changes only machine-specific root/output paths from the reviewer-supplied fixture.
