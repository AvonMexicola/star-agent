# Independent community-defense CPU review — rejected original candidate

Reviewer: Nietzsche (`/root/nomad_cutter`), 2026-09-07. Scope: root-authored
security, ramming, deferred combat and room integration. The reviewer authored
the separate hub implementation; no independent acceptance of that own code is
claimed. No production edits, servers or GPU/browser launches during this review.

Source: root `feat/aeon-community-hub`, HEAD `4b5a0b09e647a1af7898dd6596a8b25ccb195a12`
plus its current uncommitted room/hub hooks. Exact reviewed source copies and
SHA-256 values: `/tmp/star-agent-community-defense-review/source-sha256.json`.
The frozen original files remain under that directory's `server/` and `src/`.

**Result: required fixes.** The 19 author policy/contact cases pass, but the
following CPU counterexamples fail the intended behavior. Root acknowledged the
findings and owns security/room/aiming corrections. Subsequent ramming work is an
author role change and will require root review.

## Required findings

1. **P1 — incoming incidents do not participate in victim lifecycle settlement.**
   `server/security.js` stores tasks only under `attack.attacker`; room leave and
   respawn settle only that player's tasks. A victim can disconnect/rejoin while
   their incoming friendship query waits. The captured victim object remains a
   valid old `nav` identity, so the late strike changes/persists the obsolete
   session after the new session is already playing. Reproduction: new session
   completes a valid transfer at revision 1 (pack ammo 59); late strike writes old
   revision 0 (pack ammo 60, health 75) over that account. New live session remains
   health 100/revision 1. Track both participants and settle incoming/outgoing
   incidents before final persistence or replacing/admitting that account's life.

2. **P1 — strike checkpoints can overwrite an already-running inventory request.**
   Tracking participants alone does not fix this variant. Room `persist()` captures
   immutable data before waiting for earlier writes; `onStrike` captures a victim's
   old inventory while their transfer write is in flight. The transfer then
   publishes live revision 1, but the queued strike checkpoint writes revision 0.
   Reproduced without disconnect: live health75/rev1/pack59/ship1; saved
   health75/rev0/pack60/no ship charge. Serialize strike publication/checkpoints
   with inventory requests or checkpoint the current coherent inventory after
   prior request publication. Do not enqueue old transaction snapshots as newer
   durable state.

3. **P2 — flight hull zone membership uses the first-person eye.**
   Room's shot impact uses `victim.nav.shipPosition ?? victim.nav.position`.
   For flight, the second value is the eye, not the canonical hull root used by
   `shipPose` and ramming. Reproduced with a Nomad root 29,999m from station center,
   facing back into the zone: its eye is 30,001.800108m away. A real room shot
   damages the protected hull by25 but causes no defense strike. Use the same
   canonical ship pose point for ship shot and ram classification.

4. **P2 — an asynchronous equip can rearm a pilot after station death.**
   Equip validates item/hub before and after persistence but never life/health.
   A valid equip write is held; a harmful ram kills the requesting pilot while
   it waits. After release, equip assigns `sidearm-pistol`, acknowledges success,
   and leaves health0/modecrashed holding that weapon. Check live epoch/aliveness
   before and after awaited equip persistence, retaining station death stow.

5. **P2 — simultaneous lethal head-on rams depend on iteration order outside the zone.**
   The resolver emits both harmful incidents, but security resolves an unprotected
   first incident synchronously before submitting the second. The second incident
   rejects its now-dead attacker even though both contacts were validated in the
   same motion interval. Reproduced 20m/s head-on contact: incidents damage100 in
   each direction, final hull health `[100,0]` outside; `[0,0]` inside where friend
   lookup yields. Admit all same-tick incidents against their captured live epochs
   before publishing damage, then resolve without erasing already-valid reciprocal
   impacts. Contact admission must not depend on database latency or player order.

6. **P2 — angular hull motion is not captured or resolved correctly.**
   `capturePeerMotion` retains the live `shipPose.rotation` object. Mutating the
   current quaternion also changes the before snapshot. With an independently
   frozen start quaternion, the midpoint angular envelope additionally labels a
   separated start as `initialOverlap`; the resolver skips it. Finally, closing
   speed and stop eligibility use only root translation, so stationary-root
   rotation cannot stop or cause damage. A real Nomad hull yaw of0.02rad in1/30s
   starts separated from a small peer box and ends overlapping, with no incident
   or clipping. Preserve immutable before quaternions; classify initial overlap
   from exact unpadded start geometry; include angular contact-point motion; stop
   rotational sweeps and carry an enclosed player's local pose consistently when
   restoring a clipped hull rotation.

7. **P2 — near battery selection can choose a bore pointing away from its victim.**
   Ten fixed-point iterations are not a valid near-field aiming solver. Selected
   target station-local `[665,30,-10]` produces bore/to-target dot−0.04538;
   `[665,20,0]` produces−0.49610. The event still claims a hitscan strike. For
   barrel offset `(x,0,−29)` and target relative to pitch pivot `P`, require
   `hypot(Px,Pz)>=abs(x)` and `length(P)>=hypot(x,29)`. An exact forward solution:
   `yaw=atan2(-Px,-Pz)+asin(x/hypot(Px,Pz))`,
   `pitch=atan2(Py,sqrt(Px²+Pz²-x²))`,
   forward muzzle distance `sqrt(length(P)²-x²)-29>=0`.
   Reject infeasible bores and select another valid battery; assert forward
   alignment rather than choosing a physically reversed near solution.

## Evidence and limits

- `node --test --test-isolation=none tests/server-security.test.js tests/server-ramming.test.js`:
  **19/19 pass** on original root source.
- Runnable original-counterexample source:
  `/tmp/star-agent-community-defense-review/probe.mjs`.
  Run `node probe.mjs` from that directory. Receipt `results.json` includes the
  exact room transactions, boundary shot, reciprocal contacts and near-bore dots.
- `angular-original.json` independently compares exact pre/post hull overlap and
  records the live quaternion alias and artificial initial-overlap envelope.
  `server/ramming-audit.js` is the frozen original with only its private
  angularSweep exported for read-only measurement; no algorithm was changed.
- Geometry and effects were not browser-rendered. Bastion native/game visual
  review is pending the separate builder's frozen asset. No art score or FPS
  acceptance is claimed. Full integrated hub/trade input journeys remain root QA.
