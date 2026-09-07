# Community hub, fleet and tractor union

The checked community delivery `b622dec` (runtime `004979d`) is semantically merged into fleet `43fadf14b13498981082ff5052d323f573329621`. Merge checkpoint: `ce57805`. This record covers CPU integration and placement; final combined browser validation and dev promotion belong to the integration steward.

The union keeps protocol **5**, the full-size Atlas and its real ramp/crew-lift snapshots, Burrow surface/carrier hooks, roof/base power/cloud, shopkeeper actors, handheld art, and the fleet engine/audio gate. The solo and authenticated multiplayer shoulder opening and final camera-origin ordering are retained. Exact follow-ups consumed: `40af554` → `114516e`, `f3312c5981d874e8ed3e9c5940260470aa737fdb` → `3562590`, `772bb50` → `53fc21a`, and `fb472725eab1da43b26c19b05f9b865b4d8dbde3` → `2d7760b`. The final opening fixture is byte-identical to the last checked handoff; an overlapping local fixture edit was superseded.

Finite stock and detached tractor cargo share the existing version-1 commerce ledger. Legacy normalization preserves accounts, grid cells, loose positions/leases, receipts and revision. All physical tractor context comes from the transaction's ledger, and snapshots publish only after successful commit. Hub/passenger restrictions cover equip, visible tools, grab/move/align/stow and queued actions; release remains available. A received neutral input is required before authority can relock after leaving the restriction. Cached multiplayer and local cargo panels invalidate their equipment restrictions when the physical hub/transit state changes. The broadcast still samples shared public state once and preserves recipient-private hub, inventory and account state.

`SA-HUB-001` remains in review on the integration branch. Its completed `main.js` and `station-complex.js` integration claims have been released to the existing fleet/NPC owners; this resolves the two overlapping-claim registry errors without changing the checker or marking visual review complete. Both original HANDOFF histories remain present.

## CPU verification

Own `npm ci` and Prisma generation ran in the isolated worktree. PostgreSQL tests created disposable directories and loopback ports, migrated their own databases, and closed them afterwards. No shared database, service, branch or GPU process was changed.

- Combined command below: **243/243 passed**, zero skipped, 20.58 seconds, on `eba7758`.
- Exact incoming final opening fixture: **6/6 passed** on `2d7760b`; no runtime or other test changed after the combined run.
- `npm run build`: **passed**, 313 modules, `main-CEVXV4ku.js`; existing large-chunk advisory remains.
- `npm run check:repo`: **passed** after the claim handoff.
- `git diff --check`: **passed**.

The union-specific regressions include market plus loose-cargo PostgreSQL restart/replay, transaction-local tractor validation with a forced commit failure, physical hub/private account snapshots, passenger tool denial with safe lease release, held input versus received-neutral rearming, and open cached manifest restrictions. Existing fleet audio/music, engine telemetry, actual Atlas geometry/SBU clearance, physical boarding/launch, Burrow terrain/ramp/carrying, remote geometry, community security/friendship, and passenger routes run in the combined group.

```sh
node --test --test-isolation=none \
  tests/station-market.test.js tests/station-hub-policy.test.js tests/station-defense.test.js \
  tests/server-station-market.test.js tests/server-station-hub.test.js \
  tests/server-community-room.test.js tests/server-community-persistence.test.js \
  tests/server-security.test.js tests/server-ramming.test.js tests/server-cargo.test.js \
  tests/server-performance.test.js tests/cargo-tractor.test.js tests/sbu-cargo.test.js \
  tests/sbu-persistence.test.js tests/multiplayer-ui-performance.test.js \
  tests/multiplayer-ui.test.js tests/remote-players.test.js tests/server-room.test.js \
  tests/station-fleet-hangar.test.js tests/atlas-playable.test.js \
  tests/station-shopkeeper.test.js tests/controller-hints.test.js \
  tests/gameplay-audio.test.js tests/music.test.js tests/rover-carrier.test.js \
  tests/rover-surface-start.test.js tests/engine-state.test.js \
  tests/opening-navigation.test.js tests/opening-support.test.js tests/station.test.js
```

The initial fixture checks exposed three SBU cases using retired `atlas.glb`, the former cargo-floor aim height, and the removed belly elevator. Exact checked `f3312c` replaces them with real new-Atlas geometry, loading-ramp and crew-lift assertions while retaining the finite four-SBU price of 83 credits. A further opening fixture used the unscaled bay and belly elevator; final checked `fb472725` verifies the real refitted-bay start, physical front ramp, secured loading door, crew lift and saved-hull pilot seat. These fixture failures were retained and corrected; no runtime collision or support check was relaxed.

## Refit Bastion placement

`assets/station-defense/check_placement.mjs` now calls the actual `fleetHangarAsset` wrapper. Shell scale is `[1,1.6,2.6]`, anchor `[0,-8,26]`, deck top Y−8 and Z−98.8..26. Props, cabin geometry and service positions remain at human scale. All 242 keyframes of the two linear hangar-door translation tracks bound the entire door motion. Both passenger-cabin placements and the full linear leaf motion, shipped counter dressing, 20 transformed bay bounds and outward mouth corridors are included.

The exact audited source is `eba7758f84a469813383dfdd8e04667a4d3ff967`; subsequent changes affect only tests/task documentation. Native Three geometry loading substitutes inert textures in memory. Bastion08 SHA-256 is `8d0dcbb6395479ad083cd609217833b97c74008acdd15b72ed9182ced46b64ae`; exterior SHA-256 remains `5b39b183030d529a710de0b2dad308a36a8e597b067d3061d82f01bb721b76e6`. The report also hashes the current runtime assembly and audit sources.

All four existing mount roots pass: zero non-contact station triangles in the conservative R29.6/Y0..38.1 full-motion cylinder, complete foundation support, and positive collider/assembly separations. The minimum margins are:

| Measured separation | Metres |
| --- | ---: |
| Fixed authored structure / collider | 6.411932555 |
| Enlarged bay, props and moving door bounds | 415.520001984 |
| Outward measured mouth corridor | 589.200000000 |
| Hub/concourse bounds | 613.199999237 |
| Rotating ring axial envelope | 298.400000000 |

```sh
BASTION_PLACEMENT_OUT=/tmp/star-agent-hub-union-placement \
  node assets/station-defense/check_placement.mjs
```

The raw CPU logs and placement JSON remain outside Git at `/home/cees/.cache/star-agent-hub-union/`. This supersedes only the surrounding-station portion of the old placement certificate. It changes no defense geometry, mount root or authority policy. **Ten of twelve diagnostic muzzle rays are obstructed**: a placement pass does not certify clear firing arcs. Arbitrary ship trajectories, user-built objects, shopkeeper skeletal motion, native controller/touch behavior, shaders/materials, animation quality and FPS are not certified here. No browser/GPU run was performed by this integration agent.
