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
all nine current asset tests pass. Stratum's ten asset checks pass. Both studio
builds pass; that establishes bundling, not image or shader correctness.

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
The steward has supplied checked fixture follow-ups79bf96e/fb472725 for separate
consumption. This is an unresolved full-suite result at this checkpoint, not a
passing suite. An earlier three-failure SBU run also reproduced on43fadf1; after
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
- Cees prohibited central cockpit struts. Both first asset candidates contained
  them; authors are removing only those mullions before native inspection.
  Burrow's corresponding exact44-triangle removal is committed in d2f7eb0 and
  already consumed here. No preview deployment is implied.

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
The one shared GPU queue is coordinated in HANDOFF; no medium browser has run
at this checkpoint.
