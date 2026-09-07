# Aeon community station production record

This is the development implementation of SA-HUB-001 on
`feat/aeon-community-hub`, stacked on the coherent social/cargo/control snapshot
`aaf08cc` (PR73). It covers Aeon's main orbital station only. Final browser and
candidate06 visual acceptance are in progress; shared integration and public
release are not claimed here.

## Implemented player behavior

The station owns a fixed, inclusive 30,000 m protection sphere in world double
coordinates. A server-resolved damaging shot or harmful ship contact against a
player or their hull inside it applies ordinary impact damage, then immediately
kills the nonfriend aggressor. Accepted, mutual, unblocked friends retain ordinary
friendly damage but receive no station retaliation. Pending requests do not qualify.
The trusted social store decides friendship; clients cannot supply damage, target,
friendship or station membership as authority. The existing death/recovery and
inventory persistence paths handle the result.

Four original Meridian Bastion mounts provide the visible response, including
yaw, elevation, independent barrel recoil and a short beam from the selected bore.
The actual exported geometry provides collision/occlusion. The server computes
the same muzzle transform, and the client rejects mismatched strike origins.
The beam depicts an instantaneous strike; its 200 ms afterimage stays at the
historical shot origin while the barrel returns. It is not a moving projectile.

The twenty berth elevator cabins and a separate community cabin share the normal
physical door and occupancy checks. A player must walk into a cabin and select a
destination. Closed doors precede a **1.3 s interdeck fade/transfer**, followed by
arrival and opening; this is not a continuous kilometre-long elevator shaft.
The player's leased ship remains in its berth. Weapons and mining tools are stowed
and cannot be selected or used in the community volume, including through an
inventory request, delayed equipment save, arrival or reconnect. The HUD and
loadout dialog show the restriction.

Twenty berth kiosks plus the two concourse exchanges share one finite
`aeon-orbital` market and the existing wallet/crate authority. Each resource starts
at 1,024 SBU, has a 4,096 SBU capacity, and has no automatic refill. Both bid and
ask use the scarcity factor `2 * 1024 / (1024 + stock)`, integer quotes and a spread.
Bulk quotes sum the same per-unit stock interval; splitting a transaction creates
no pricing advantage. A purchase needs the player's own physically parked, leased
ship, moving below 1 m/s. It can stay in its berth while its owner visits the hub.
Nomad capacity is 6 SBU; Atlas capacity is 512 SBU. Player-owned shop prices remain
owner-set. See [market rules](../../aeon-station-market.md).

## Authority and regression evidence

| Check | Observed result | Scope |
| --- | --- | --- |
| Complete unit suite on `ff16d64` | 869/869 pass, 44.201 s | Before the later HUD wording and geometry-preserving candidate06 finish; later focused checks cover those changes. |
| Room, ram, defense and hub integration | 45/45 pass, 1.158 s | Actual room ownership, equipment/death races, friendship, zone and contact behavior. |
| Renderer and input hints on candidate06 | 7/7 pass | Actual GLB, muzzle transforms, collision/rebase invariance, disposal and neutral HUD guidance. |
| Full PostgreSQL multiplayer suite | 176/176 pass, zero skips, 9.022 s | Frozen `ff16d64`; owned PostgreSQL16 database, migrations 1/2/4. |
| New community SQL case | 1/1 pass, 0.978 s | Independent store instances, concurrent stale purchase, actual foreign-key rollback after ledger write, durable stock/wallet/crate replay and accepted-friend security. |
| Protocol-only physical route rehearsal | Pass | Normal berth spawn; movement/elevator input only, no pose assignment; not browser or visual evidence. |
| Production builds | Pass | Separate QA output directory; inherited bundle-size warning retained. |

The SQL persistence case reopens independent stores against the same database;
it does not simulate a PostgreSQL process crash. Its first full-suite invocation
failed because the test shut down PostgreSQL before client sockets finished
closing. The corrected fixture waits for the real client end events; it does not
suppress errors. Both the first failure and the zero-skip rerun are retained in
the local acceptance archive. The earlier 41-pass/one-environment-skip focused
run is historical and is superseded by the complete SQL run above.

The cargo SQL test also adopts the upstream `5f0d94f` temporary-directory
portability fix. It uses the operating system's temporary directory rather than
an author's private cache path. No cargo assertion, transaction or runtime rule
changes with that fix.

The [initial authority review](reviews/initial-authority-review.md) identified
real lifecycle, equipment and ramming defects. The subsequent bounded fixes and
regressions retain those findings. The independent
[renderer closure](reviews/bastion-renderer-closure.md) verifies actual mesh
intersections and rebasing, asynchronous load disposal and reconnect dedup reset.
Its 108 mesh-face hits / 648 vertex checks do not substitute for gameplay images.

## Bastion source and motion

Candidate06 is `adf6c5b03da18710a3d97341dd503ec95433e564d81610ed67037b226af8e4ca`:
9,177 triangles, 908,388 bytes, nine primitives, two materials and three 512²
lossless WebP maps. Original deterministic geometry, source Blend/exporter,
material sources and provenance are retained in `assets/station-defense`.
See [the asset production history](../../../assets/station-defense/PRODUCTION.md).

The exact candidate05-to-06 comparison passes all twelve checks: expanded
oriented local/world triangles, rig and all corner data except normals and bore
UVs are unchanged. A deliberate 1 mm vertex mutation fails the probe, and an
unchanged-file control passes. All 188 sampled yaw/pitch/recoil poses pass the
corrected motion audit: 77,720 candidate triangle pairs, 1,316 actual world-pose
checks, maximum pose error 0.0000137871 m. The only allowed contacts are explicit
journal engagement and the full-recoil rear end stop. This finite audit is not a
continuous swept-solid or station placement certificate.

The same-camera native05 review scored **3.60**, below the 4.0 bar. Its
[unmodified report](reviews/bastion-native-05.md) remains part of the record.
Candidate06 improves circular surface normals, dark rough open bores and subtle
PBR finish without changing geometry. Its native review is pending; no art score
is inferred from successful export or motion tests.

## Browser acceptance in progress

The physical fixture walks a normally spawned player from their berth into the
lift, visits the concourse, verifies disabled equipment selection, buys and sells
an actual 2 SBU crate through the shared market, and returns to the original
berth with the same parked ship and lease. Separate controller, keyboard and
native Chromium touch routes are provided. The controller case includes held
trigger suppression across menu closure, actual tab focus, disconnect, replacement
and unsupported mapping. Read-only world state supplies steering feedback;
no player pose or game action is assigned.

A separate four-account defense fixture uses explicitly documented **server
initial EVA poses**. The browser witness enters through the controller menus;
real authenticated WebSocket peers accept friendship, fire one friendly shot,
then one nonfriend shot. Assertions cover ordinary damage, exemption, exactly one
lethal strike, its rendered identity, recoil and return. Native screencast frames
are retained around the short beam for visual inspection. This is not evidence
of a controller-operated firing or physical approach journey.

Preserved earlier physical-browser failures: attempt01 had a webserver working-
directory error; attempt02 selected zero cases with an over-anchored filter;
attempt03 loaded the game but expected the account dialog before entering through
the current developer launcher; attempt04 physically reached the hub before an
assertion read the weapon from the inventory instead of the own-player snapshot.
Attempt05 was explicitly interrupted when another reserved GPU job started;
it is not a pass. Corrected fixture assertions use the actual shared UI and state.
No application defect was hidden by those harness changes.

## Remaining boundaries

The current authoritative online combat path covers handheld hits on players or
hulls and actual peer ship rams. Mounted ship guns still have no authoritative
online damage path; they must enter this same resolved-impact service when added.
Missed shots do not count as damage. The station provides reactive punishment,
not immunity: the original hit can kill its victim, including friendly fire.
A failed friendship lookup refuses the protected impact and retaliation instead
of guessing a relationship; consumed ammunition is not refunded.

Online equipment retail is not added by this work. Additional stations are not
spawned; their later implementation can register separate station zones/markets.
Hardware controllers, physical phones, whole-station performance and public
release remain separate from injected Gamepad/native touch browser evidence.
