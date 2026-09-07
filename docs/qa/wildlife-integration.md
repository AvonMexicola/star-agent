# Wildlife development integration

7 September 2026. Integration steward, `feat/dev-wildlife-review`.
The checked wildlife source `e904192` (PR69) is combined with the current local
development checkpoint `4706d62`. Both combined physical browser encounters pass. This source is served by
the shared local development build at runtime `c4f6b5b`.

## Included work and overlap

- Tidebacks live on Aeon's dry low coastland and defend themselves after a hit.
- Mallow grazers live in grassland and retreat after injury without attacking.
- The supplied deer has a repaired walk and a standalone rig viewer. It is not
  spawned in the world.
- Later Suloher medical/controller and settled Pyrebear image evidence is retained.

The merge preserves the current cargo, social tools, sparse landmark revision,
character, flight model, building-pad support and Burrow binding. The current
building raycast already forwards the animal's collision envelope, so that whole
current hook was retained. Both new habitat test files were added to the existing
test list. Documentation and handoff append conflicts retain both owners' records.

Runtime changes are confined to client wildlife modules, two development starts
and their main-loop wiring. Server, database and multiplayer protocol sources
have no delta from the live baseline. Animals remain offline and session-local;
there is no new NPC replication or persistence claim.

## Combined verification

At `36a5a56` (runtime merge `ab18437`):

- **869 unit tests pass**, zero failures/skips, in 52.39 seconds. The normal
  package test list ran with Node test concurrency limited to two.
- **40 focused checks pass** for habitats, collision/targeting, simulation and
  the ship/location launcher. These are also included in the full unit total.
- Production build with `VITE_DEV_TOOLS=1` passes in 7.07 seconds; main bundle
  `main-DOLopA0u.js`. The existing large-bundle advisory remains.
- Repository and whitespace checks pass across 134 paths. The change plan was
  reviewed manually: no SQL/protocol source is changed, so the previously checked
  persistent database is not reused as a wildlife fixture.
- Source and built GLBs match the exact reviewed export hashes:

| Asset | Bytes | SHA-256 |
| --- | ---: | --- |
| Tideback | 1,119,644 | `ba95f093ffa9703670456457ce299d0865051503b137eb15ebd5de3cd619de9e` |
| Mallow | 978,832 | `78598117a9a47bbc0eebedd708a8248a1a1e4a61b5923e9bb6e7640a16f41bb9` |
| Deer | 1,195,536 | `83addc21751d295043c11f754dcd7e9a3ac7ebc77ec1f216b870be7a465e0f77` |

## Browser and visual scope

The feature-owner [browser ledger](aeon-fauna-browser.md) records two passing
model-viewer checks, a physical Tideback controller encounter and the corrected
Mallow encounter. The [deer record](deer-rig.md) retains the separate loader,
playback and mobile preview check. Source/Blender provenance and the scoped
independent asset reviews remain linked from [wildlife QA](aeon-wildlife.md).

The integration reuses both existing physical encounter cases against the combined
production build on isolated port 5566. It owns no account API or SQL fixture.
They exercise landing, exiting the ship, walking around the hull, peaceful
observation, actual ammunition/health, species response and held-trigger safety
through the shared gameplay menu. **Both pass**: Tideback 2.8 minutes and Mallow
2.7 minutes, total 5.6 minutes, with empty page/console error lists. The Tideback
check records one bite (player 94 HP), four rounds and one defeated animal. The
Mallow check records two rounds, an actual retreat over 0.5 m, no bites and player
health remaining 100. The fixture allows more than one round during the injected
trigger hold and asserts real ammunition use rather than a fixed shot count.

Linux Chromium **151.0.7922.173**, native **ANGLE / AMD Radeon 860M / OpenGL ES
3.2**, viewport **1280 × 800**, auto render resolution, grass distance 80 m and
75% density. Final scene targets are 1024 × 640 at 0.8 scale for Tideback and
1088 × 680 at 0.85 scale for Mallow. Inputs are an injected standard Gamepad with physical landing and
walking, not physical hardware. Both runs use the exact built wildlife source
and assets above.

The steward inspected the four actual-game captures below. Both species have
visible textured bodies, intact silhouettes and leg contact without a missing
shell surface or gross burial in these views. The defeated Tideback holds its
authored pose. Mallow's face/body and health feedback remain visible after its
retreat. Existing waypoint, boarding and equipment overlays crowd the center;
this is a functional development checkpoint, not final HUD or motion acceptance.

| Encounter | Peaceful view | Response view |
| --- | --- | --- |
| Tideback | [Calm beach encounter](wildlife-integration/aeon-amphibian-peaceful.png) | [Defeated pose](wildlife-integration/aeon-amphibian-defeated.png) |
| Mallow | [Grassland encounter](wildlife-integration/aeon-grazer-peaceful.png) | [After injury and retreat](wildlife-integration/aeon-grazer-retreat.png) |

The first invocation failed before Chromium because Playwright's default temporary
transform cache hit a quota. The corrected invocation sets process-start
`TMPDIR`, `FAUNA_TMPDIR` and `PWTEST_CACHE_DIR` to a writable task cache; no game
or assertion change was needed. Another owner's launch briefly overlapped browser
startup and was stopped by that owner. Both failures/coordination records are
retained; no exclusive-GPU timing or performance claim is made. The successful
job exited normally and released its browser/preview before shared promotion.

Reproduce after a development-enabled production build:

```sh
VITE_DEV_TOOLS=1 npm run build
TMPDIR=/writable/task-cache FAUNA_TMPDIR=/writable/task-cache \
PWTEST_CACHE_DIR=/writable/task-cache/transforms \
npm run test:browser -- -c scripts/wildlife-integration.config.js --max-failures=1
```

Create the writable cache directory first. The fixture serves only its local
production client on 5566, and mocks an anonymous auth-session response. Source
records and failed attempts remain in the feature-owner ledgers; temporary test
videos, complete JSON states and generated reports are not committed.

No physical controller, complete native-touch encounter, continuous-motion art
acceptance or hardware FPS result is claimed. The tested export and bounded
development integration remain distinct from those outstanding acceptance gates.


## Local delivery

The steward preserved shared owner notes in `1c9278c`, merged the checked candidate
`c160ece` as **`c4f6b5b`**, and retained both sides of all three journal conflicts.
Runtime, assets, fixtures and package files match the tested candidate exactly.
Only client wildlife/assets, development entries, evidence and the portable cargo
SQL fixture follow-up join the existing cargo/social/rock development build.

HTTP health passes on 5178 and the direct API on 8087. Both habitat modules, the
dev launcher options, simulation, targeting, rendered-fauna module and main entry
match committed source after Vite import/environment normalization. All three
live GLBs match the byte counts and SHA-256 values above; the deer viewer returns
HTTP 200. The persistent preview remains on the same process and start time;
its PostgreSQL cluster retains inode 947632. No service restart, schema operation,
account mutation or shared database fixture was needed for this client-only delta.

Refresh http://localhost:5178/, press **F2**, choose Nomad and **Aeon · Tideback
beach** or **Aeon · Mallow grassland**, then land and walk out. The deer viewer is
`/scripts/fixtures/creature-rig.html?model=deer`. The two fauna tasks are locally
integrated. Main and public hosting were not updated by this integration.

A separately found PR73 cargo-test cache-path failure was corrected in `5f0d94f`
and consumed here as `054dcf1`; all seven affected cargo server tests pass,
including isolated PostgreSQL. It changes no game/runtime behavior; see
[the CI follow-up](social-cargo-integration.md#hosted-check-portability-follow-up).
