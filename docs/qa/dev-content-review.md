# Combined development content review

2026-09-07 · SA-INT-002 · local review integration, not a production release or
independent asset acceptance. Source inventory and use instructions are in
[local development](../local-development.md).

## Integration boundaries

Isolated `feat/dev-content-review` began at shared dev `afe0654`, incorporating
the concurrent audio receipt `6d3abb0`. The original dirty checkout and feature
owners' worktrees remain intact. Character checkpoint `0bb6a6a` preserves the
explicitly requested owner candidate, source, texture/font licenses and its exact
asset hash; the receipt is `character/dev-review-checkpoint.json`.

The combined character uses the expedition model in local play and remote
presentation, preserves glTF required-clip metadata and optional shadow indices
across cached clones, and uses the new palm calibration without the old secondary
wrist correction. Assigned server colors, independent skeleton/material ownership,
shared geometry lifetime and authoritative health remain intact.

Semantic merges preserve current targeting/landmark contacts, ship fittings,
RT/LT flight controls, controller neutral gates, build placement sounds, rover
envelope collision/mining transactions and fauna medical updates before movement.
The build wheel owns LB/RB category changes while open; global gameplay tabs retain
their keyboard bracket route. Third-person mining range is measured from the
player eye for both existing deposits and newly streamed loose rocks.

Dev → Content review exposes the character, rover, supplied construction sandbox,
Atlas/station previews, Kestrel prop and audio. Special starts clear conflicting
sandbox/rover query flags. The props and sound studios now also bundle into a
production preview. Isolated Vite servers can set `STAR_AGENT_VITE_CACHE` to avoid
invalidating another worktree's optimized dependencies when sharing node_modules.

## Verification

- Character/remote integration: 78 character/equipment/camera checks and 10 remote
  checks passed with the actual expedition rig and authored weapon geometry.
- Initial full candidate exposed an obsolete mining fixture and a loose-rock
  third-person range mismatch; both corrected, three focused mining tests pass.
- Combined source through `fabc9d4`: **831 unit tests pass**, zero failures/skips.
- Multiplayer after momentum/remote merge: **90 pass**, one explicit SQL fixture
  skipped without its disposable-database setting. No schema migration was added.
- Production build with `VITE_DEV_TOOLS=1` passes; existing large-chunk advisory
  remains. The API and PostgreSQL data were not used as disposable test fixtures.
- Combined browser review is pending. Reproduction:

```sh
VITE_DEV_TOOLS=1 npm run build
MULTIPLAYER_SERVER=http://127.0.0.1:8087 npm run preview -- --port 5523 --strictPort
STAR_AGENT_VITE_CACHE=/path/to/isolated/cache VITE_DEV_TOOLS=1 npm run dev -- --port 5522 --strictPort
npm run test:browser -- -c scripts/content-review.config.js
```

One native Chromium job at a time. The configuration keeps profiles and raw
evidence under the user's cache rather than the quota-limited shared `/tmp`.
The remote visual fixture uses synthetic peer snapshots; it is shader/rig/color
evidence, not a new two-account network journey. Controller gameplay tests use
injected standard Gamepads, not physical hardware.

## Remaining feature acceptance

- Character art/motion and whole-scene performance acceptance remain as recorded
  by its owner; the higher asset budget does not waive the scene timing target.
- The 64 m Atlas is a studio asset. Current flyable Atlas remains 30 m. Station
  exterior is an opt-in geometry checkpoint with material work still open.
- Burrow `44eb3a2` has verified boarding/lift/unload and CPU safeguards. The owner
  is refining steering and the complete mining/return route; keyboard/touch and
  final art acceptance are pending.
- Fauna `91a2ac0` includes the successful Pyrebear controller route. Suloher chase
  around obstructing terrain, final corpse motion and touch checks remain owner
  work. Wildlife and rover are offline; their network replication is not claimed.
- Construction expansion has owner controller workshop/rack/pad/ramp routes.
  Expanded-kit independent art review, hardware timing and pebble exclusion above
  low decks remain open. The earlier Opus score covers the original kit only.
- New deer repair and further landmark material refinement started separately;
  no unfinished source or absent jacket asset was copied into this checkpoint.
