# Aeon community station production record

**The feature is ready for local integration from runtime `004979d`.** All three
physical input journeys, the actual defense witness and current-head hosted CI
pass. Bastion08 passes independent native visual review at4.00/5. The separate
[actual-game review](reviews/actual-game-visual.md) passes the shown mounted strike,
return endpoint and phone UI, while retaining the recording gap and broader motion limits. This is the
security, passenger-concourse and finite-market contribution for Aeon's main
orbital station; it does not certify final exterior materials, whole-station
performance or public release.

Draft [PR76](https://github.com/AvonMexicola/star-agent/pull/76) stacks on PR73's
coherent social/cargo/control foundation (`aaf08cc`, including the later portable
SQL-test fix `5f0d94f`). The shared dev branch has since gained tractor, handheld
art, wildlife and performance work. Read the [integration map](reviews/integration-map.md)
before combining them: their identically numbered protocol4 and ledger version1
have different extensions. The build steward owns that semantic integration and
the forthcoming Atlas/station refit; Cees gates public merge/release.

## Player behavior

The station owns a fixed, inclusive **30,000 m sphere centered on the station**,
in world double coordinates. A server-resolved damaging shot or harmful ship
contact against a player or their hull inside it applies ordinary impact damage,
then immediately kills a nonfriend aggressor. Accepted, mutual, unblocked friends
retain ordinary friendly damage without retaliation. Pending requests do not
qualify. The authoritative social store decides friendship; clients cannot supply
trusted damage, targets, relationships or station membership. Existing death,
recovery and inventory persistence handle the result.

Four original Meridian Bastion batteries provide yaw, elevation, independent
barrel recoil and a visible strike from the selected bore. Client and server use
the same actual muzzle transform; mismatched origins are rejected. The instant
strike leaves a200ms afterimage at its historical origin while the barrel returns.
Admitted retaliation deliberately uses unconditional hitscan, as requested; other
station structures do not provide immunity through line-of-sight obstruction.

Players physically enter one of20 berth elevator cabins, select a destination,
and visit the separate community cabin. Normal doors, occupancy, thresholds and
collision checks apply. Closed doors precede a **1.3s interdeck fade/transfer**;
this is not a continuous kilometre-long shaft. The leased ship remains in its
berth. Weapons and tools are stowed and cannot be selected or used in the community
volume, including through inventory requests, delayed equipment saves, arrival
or reconnect. The HUD and loadout dialog explain the restriction.

Twenty berth kiosks and two hub exchanges share one finite `aeon-orbital` market
and the existing wallet/crate authority. Each resource starts at1,024SBU, caps
at4,096SBU and does not refill automatically. Both bid and ask use scarcity
`2 * 1024 / (1024 + stock)`, integer prices and a spread. Bulk quotes sum the same
per-unit interval, so splitting a transaction gives no pricing advantage. A
purchase needs the player's own physically parked, leased ship moving below1m/s;
it can remain in its berth while the player visits the hub. Nomad holds6SBU;
current Atlas holds512SBU. Player-owned shop prices remain owner-set.
See [market rules](../../aeon-station-market.md).

## Validation and inspected evidence

| Check | Observed result and boundary |
| --- | --- |
| Full controller journey07 | PASS2.3min on `cc529d4`/asset07: normal berth spawn, walk into lift, hub equipment restriction, buy/sell2SBU and return to the original parked ship/lease. Native tab focus and held-input gates across menu, disconnect, replacement and unsupported mappings pass. |
| Keyboard and native-touch journeys09 | PASS1.6min each on `004979d`/asset08. Both complete the same physical route and real trade. No pose or action assignment; read-only state guides actual input. Touch uses Chromium's native touch input at390×844, not a physical phone. |
| Actual defense witness01 | PASS54.2s on `004979d`/asset08. Four authenticated accounts use real WebSockets and accepted friendship. Friendly shot: target100→75, shooter remains alive, no strike. Nonfriend shot: target75→50, attacker health/ship health0, weapon cleared, one rendered station strike. Recoil peak0.6m returns to0. |
| Current hosted checks | [Run34162315302](https://github.com/AvonMexicola/star-agent/actions/runs/34162315302) passes all5 required jobs on exact `004979d`: source/unit/build, plan, multiplayer/database, browser and verify. No docs-only successor is implied by that identity. |
| Local authority/regressions | Earlier full869units pass44.201s;45room/ram/security/hub tests pass1.158s. Later asset08 renderer/security tests17/17 pass235ms. |
| PostgreSQL acceptance |176/176 multiplayer tests pass, zero skips,9.022s on `ff16d64`. The focused community case passes0.978s: independent stores, concurrent stale purchase, real foreign-key rollback after ledger write, stock/wallet/crate replay and accepted-friend security. This reopens stores, not a PostgreSQL crash simulation. |
| Asset08 integrity and motion |16 additive checks pass;188/188 actual-GLB poses,77,720 candidate triangle pairs and1,316 independent pose assertions pass15.405s. These finite poses do not prove continuous self-collision freedom. |
| Complete articulation envelope | Analytic endpoint/stationary evaluation of all19,001 actual vertices proves radius≤29.574313216m and Y0..38.044104395m over allowed pitch/recoil/all yaw, inside the conservative radius29.6/Y0..38.1 bound. |
| Actual station placement | All4 foundations have full measured triangle support; zero non-contact station triangles intrude into the conservative articulation cylinder. Closest upper structure lies6.411933m beyond it. The audit pins the current assembled station and must be repeated after bay resizing. |
| Native render/visual review08 |5/5 same-camera views pass with no diagnostics. Independent [native review](reviews/bastion-native-08.md):4.00/5 across5 applicable still-image criteria; motion excluded. |

All final browser cases use Chromium151.0.7922.173, native ANGLE AMD Radeon860M /
radeonsi krackan1 ACO / OpenGL ES3.2. Gameplay views are1440×900 or390×844;
asset-native views are1600×900. No page/console errors or warnings were captured.
Production builds retain the inherited large-chunk warning. These runs establish
no hardware-controller, physical-phone or whole-game FPS claim.

The market journeys verify stock1024→1022→1024 and wallet1500→1459→1483: a2SBU
basalt purchase costs41CR; resale returns24CR. The same ship and berth lease remain
throughout. The defense fixture explicitly assigns **server initial EVA poses**;
the witness enters through real controller menus, but this is not a physical
approach or controller-operated firing journey. Native frames show the beam at
the actual barrel. The59-frame record has a128→439ms gap around recoil return;
retain that limit when reviewing temporal quality.

Curated actual images:
[concourse](controller-concourse.png), [controller restriction](controller-hands-free.png),
[controller trade](controller-market-buy.png), [return](controller-return.png),
[phone elevator](touch-elevator.png), [phone restriction](touch-hands-free.png),
[phone market](touch-market.png), [mounted turret](defense-before.png),
[actual strike](defense-strike.jpg), [return pose](defense-return.png),
[native whole asset](bastion-08-wide.png), [open bores](bastion-08-bores.png),
[service panels](bastion-08-service-panels.png).

Original receipts, videos and failed attempts remain outside Git under the local
`.community-hub-qa` archive. Independent reports retain their original evidence
paths; the curated links above are the portable repository selection. Generated
test reports and recordings are not committed.

## Source and retained findings

Bastion08 SHA256 is
`8d0dcbb6395479ad083cd609217833b97c74008acdd15b72ed9182ced46b64ae`:
9,877triangles,948,632bytes,9primitives,2materials and3×512² lossless WebP maps.
The deterministic Blender builder, editable source, original PBR maps and
provenance remain in `assets/station-defense`. All9,177 original07 triangles,
UVs, normals and rig records remain;700 triangles add supported service covers,
journal backing rings, captive heads and identifiers. The [source handoff](reviews/bastion-source-08.md)
records their exact mounting coordinates and declared contacts.

Earlier native reviews [05](reviews/bastion-native-05.md),
[06](reviews/bastion-native-06.md) and [07](reviews/bastion-native-07.md) scored
3.60/3.90/3.90 and remain failures.06 improved curved metal and dark open bores;
07's broad enamel texture treatment remained too faint.08 closes that visible
manufactured-detail finding with actual fitted geometry. Its acceptance is not
retroactively applied to the earlier versions.

The [initial authority review](reviews/initial-authority-review.md) identified real
lifecycle, equipment and ramming defects, followed by focused fixes/regressions.
The independent [renderer closure](reviews/bastion-renderer-closure.md) verified
108 actual mesh-face hits/648 vertex checks, rebase stability, disposal and
reconnect deduplication. Those CPU findings do not substitute for game images.

Retained browser failures:01 wrong webserver cwd;02 over-anchored filter selected
zero cases;03 wrong account-entry expectation;04 wrong snapshot weapon field;
05 explicitly interrupted for a GPU launch race;06 attempted walking after the
controller shortcut reopened the inventory.07 controller passed, then keyboard's
unconditional F closed the already-open shared elevator; it also reported an
unscoped teardown error/exit143 without another printed stack.08 was explicitly
interrupted after another nearly simultaneous GPU launch. Corrected09 only calls
a closed door, waits for full opening and uses the actual modal/input router;
keyboard and touch pass. None of the failed, zero-case or interrupted runs is
counted as a pass.

The first complete SQL fixture stopped PostgreSQL before its clients had ended;
the correction awaits their real end events. The first PR76 hosted attempt also
failed before module loading because the synthetic base merge duplicated the
portable `tmpdir` import. The exact upstream5f0d94f fix was merged; later hosted
runs on78fa508 and004979d pass. Neither earlier failure is hidden or recast as
application success.

## Remaining boundaries

Current authoritative online combat covers handheld hits on players/hulls and
peer ship rams. Mounted ship guns still need an authoritative online damage path
that calls this same resolved-impact service. Misses do not count as damage.
Retaliation is reactive: the original hit can kill its victim. Failed friendship
lookup refuses protected impact/retaliation instead of guessing; consumed ammo
is not refunded.

Some valid firing directions intersect station structures; enforcement intentionally
ignores that occlusion. The legacy fallback exterior has different support planes
and is excluded from placement acceptance. A new64mAtlas/refitted bay assembly
must preserve human-scale elevator/terminal frames and repeat surrounding-geometry
checks. The integration map also identifies tractor lease/tool restrictions and
PERF inventory-cache updates needed when composing the newer shared branch.

Online equipment retail, additional stations, final exterior material work,
whole-station performance and public release remain separate work. This delivery
adds no database reset, migration or alternative economy store.
