# Medium ships integration record

Status on 2026-09-08: isolated implementation checkpoint; not browser accepted,
independently approved, integrated into shared development, or deployed.

Stratum is an 18 m medium miner with two actual articulated barrel origins, a
40 m cutting range, a 120-second battery and 30-second recharge. Accepted voxel
worker results atomically save ore into its separate 384 kg bin. Its 32 SBU
freight and 240 kg supplies remain separate inventories. Gannet is a 24 m
transport with 128 SBU freight, 960 kg supplies, a 5.8 m clear vehicle bay and an
ordered rear hatch/elevator. Its carrier adapter follows all four Burrow wheel
contacts, vetoes straddling movement and secures the vehicle for flight.

Both have fleet/development selection, authored access, canonical gear, physical
cabin interaction, four live MFDs and named propulsion origins. The new ships
are limited to solo/development use; no new multiplayer hull or mining authority
is claimed. The normal game remains responsible for ship motion, collision,
surface sampling, input routing and inventory publication.

## Source checkpoints and checks

The integration began on development0a18574, consumed committed tractor638a5e4
and fleet43fadf1, and preserves the new 64 m Atlas/carrier contracts. Stratum
asset d77a015 and Gannet8b5ef41 were copied only from verified frozen allowlists.
Gannet geometry07/98a9eea fixes actual roof/cassette gaps and hatch self-collision;
geometry08 removes its centre mullion and geometry09/12d8152 clears the inner MFD
faces and joins their backing supports. All twelve current Gannet asset tests
pass. Stratum clear-windscreen08aa2b1 removes only its 36-triangle centre mullion;
all ten asset checks pass. Both studio builds pass; this alone establishes
bundling, not image or shader correctness.

Seventeen focused integration/mining cases pass, including actual GLB barrel
transforms, large-coordinate cuts, self-occlusion, twenty-one input/safety gates,
real worker/store/save-failure behavior, persistence, full rover lift movement,
ground exit and reverse loading. A later independent review correction extends
the existing seven medium cases with the real EVA aisle and power restoration;
all seven pass. The development-enabled production build passes. No test
threshold, dependency or warning limit was weakened.

The first full configured unit run reports **1,005/1,010 passed**, with five
failures in older Atlas pad/opening/station fixtures. Four reproduce on pristine
fleet43fadf1; the saved-Atlas opening file is unchanged from that dependency.
After consuming the steward's checked fixture follow-ups79bf96e/fb472725, all
22 adjacent fixture checks pass. The next complete configured run passes
**1,013/1,013** (44.360 seconds, zero skips); the original failure is retained. An earlier three-failure SBU run also reproduced on43fadf1; after
consuming the owner's f3312c correction, all31 SBU/station/medium cases pass.

## Findings retained and corrected

- First Gannet lift descent hit its own supporting platform with a rover body
  corner. Walking support now distinguishes its current deck top from an
  underside approach; full descent, terrain exit and reverse loading pass.
- Independent review found new cabins omitted from the touch controls,
  missing exterior EVA solids and a power-off interaction that latched the
  Gannet mechanism off. Eligibility/labels, exterior solids and canonical
  Navigation power synchronization were corrected.
- Whole-part fairing boxes then blocked a physically empty aft EVA aisle.
  Those conservative boxes are split around the authored clear room volumes;
  measured walls, floors and gates remain solid. Independent replay passes
  113/113 EVA steps,326/326 Gannet walking steps and199/199 Stratum steps, while
  the actual drive obstacles still block. The actual Navigation vehicle branch
  synchronizes mechanism power before its early return on191 sampled ticks.
- Cees prohibited central cockpit struts. Both new assets now omit their centre
  mullions and retain their glazing and functional layout. Burrow's exact
  44-triangle removal is committed in d2f7eb0 and consumed here. Its paired native
  comparison passes at the same seated eye; the existing PR66 contains the
  [before/after evidence](../mining-rover/windscreen-open/README.md).
- Full medium flight touch controls add translation, brake and launch/landing.
  Native canvas drag uses tracked pointer coordinates, owns its gesture, and
  cancels on pointer loss, focus loss and actual dialog transitions. Review found
  that an unmoved held pointer could survive a menu round trip; the final dialog
  observer closes that path and requires a fresh press.
- Occupied Burrow now routes controller Menu9 before its vehicle early return,
  matching the steward's checked cfe69b7 fix. Ship mining also publishes its stopped
  state immediately on focus loss, when the animation loop may be suspended.

Read-only review receipts, original failures and source hashes are retained in
`/tmp/star-agent-medium-review`. Build/unit/dependency receipts use
`/tmp/star-agent-medium-*.log`. Asset records retain their own earlier failures.
These finite CPU checks do not certify continuous arbitrary collisions, native
input, full pressure simulation, image quality or performance.

## Remaining acceptance

Corrected assets must render with their actual textures/shaders and clear
settled pilot views. Complete controller, keyboard and native-touch journeys
must cover landing/flight, boarding, real extraction and saved ore, and physical
rover unload/reload/carry/landing. Check full cargo and actual station fit,
held-input suppression, source stability and console diagnostics. Independent
art review and the contributor checks precede a review PR and steward handoff.
The one shared GPU queue is coordinated in HANDOFF. Stratum's first desktop
studio run captured twelve views but failed on one HTTP404; phone was not run.
The isolated HTML now uses an inline favicon and failed-response logging includes
URLs; the corrected native rerun is pending. The independent static image
[review](stratum-native-review-01.md) fails: mean3.26, silhouette3.4 against the
brief's4.5 target, materials2.6. An authored hull/material refinement is active.
Motion, portrait and actual gameplay remain pending. Gannet's first native
studio and real controller journey are prepared but have not run.

The development build03 passes in6.01 seconds (`main-Dw8Hai8Z.js`), including
the final drag observer added after the full unit run. Existing chunk-size
advisories remain recorded. Its isolated preview5582 uses a disposable in-memory
test API8582; shared services, databases and the user's5596 tab are untouched.
