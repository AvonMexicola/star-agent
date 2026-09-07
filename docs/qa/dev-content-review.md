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
- Combined source through `5a3cf0b` and `643a7d3`: **834 unit tests pass**, zero failures/skips.
- Multiplayer after momentum/remote merge: **90 pass**, one explicit SQL fixture
  skipped without its disposable-database setting. No schema migration was added.
- Production build with `VITE_DEV_TOOLS=1` passes; existing large-chunk advisory
  remains. The API and PostgreSQL data were not used as disposable test fixtures.
- **Six combined Chromium cases pass across focused runs.** Character studio
  (desktop/phone), physical Nomad controller exit/jump/rifle fire/three held
  weapons/return, controller review navigation/build categories/sandbox reload,
  touch review pagination, actual prop/audio studios and remote suit shaders/colors.
  Final review-menu case passed in2.2min; no captured HTTP/page/console errors.
- Initial integration browser failures are retained in local cache: the test
  awaited animation frames after navigating; the sound studio lacked an explicit
  favicon; and the build-menu inspector omitted the debug query that exposes its
  read-only navigation handle. Destination-aware waits, the favicon declaration
  and explicit test debug flag resolved them. No game simulation was mutated to
  get these physical/input checks to pass.
- Full-range repository checks and12 contributor-framework tests pass. Eight
  landmark/server invariants also pass after material4f9d472. The final bundle
  passes its production build; later merges contain QA/docs only.
- Source task ledgers are marked integrated in this combined branch, releasing
  overlapping claims here. Feature owners retain separate ongoing work; this
  status does not declare final asset/gameplay acceptance.

Reproduction:

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
- Burrow `643a7d3` includes the checked steering/cabin corrections and a complete
  owner production controller journey: physical Atlas exit, unload, actual twin
  cutter mining, saved ore/transfer, reload and flight carriage. Keyboard/touch
  and final art acceptance remain pending.
- Fauna `5a3cf0b` includes the successful Pyrebear controller route and a tested
  body-sized footing correction for the Suloher approach stall. Its revised corpse
  still reached the owner's independent 4/5 review; the corrected full controller
  route, motion and touch checks remain owner work. Wildlife and rover are offline; their network replication is not claimed.
- Construction expansion has owner controller workshop/rack/pad/ramp routes.
  Expanded-kit independent art review, hardware timing and pebble exclusion above
  low decks remain open. The earlier Opus score covers the original kit only.
- Landmark material `4f9d472` is integrated after its actual-game shader tour,
  refined fissure rerender and builder image inspection. Eight landmark/server
  invariants pass in the combined branch; geometry, contact and seeds are unchanged.
  Comparison and art/performance limits are in [its record](landmark-weathering/README.md).
- New deer repair, cargo/trading, base power and multiplayer social work continue
  separately. No unfinished source or absent jacket asset was copied here.

## Combined visual evidence

Native Chromium151.0.7922.173, ANGLE GL on AMD Radeon860M; desktop1440×900 and
phone390×844 CSS pixels. These are render/input checks, not FPS acceptance.

- [New character in the hangar with rifle](dev-content-review/character-rifle.png).
- [Jump pose during the physical controller journey](dev-content-review/character-jump.png).
- [Remote suits with three assigned colors and weapon grips](dev-content-review/remote-suits.png).
- [Desktop content-review menu](dev-content-review/review-desktop.png).
- [Touch content-review menu](dev-content-review/review-phone.png).
- [Construction facilities stay within the build screen](dev-content-review/construction-facilities.png).

Raw diagnostics remain in the local cache, outside Git. The three weapons were
visually checked in hand; the gameplay journey fired the rifle and tested that
holding fire through a menu did not spend ammunition after it closed.

## Local delivery

Shared `dev/all-features` was promoted at `2f3249f` on2026-09-07. The existing
persistent preview service was restarted once to pair the frontend and updated
multiplayer authority. Local5178 and its API health proxy return200; PostgreSQL
still listens on51224 using the same cluster directory. The live expedition GLB
hash matches `04f849bafe513f8e2a817895307a2751ebed85f76d4ef81cd0ae793ddc5911fa`.
The character/studio/review routes and refined landmark shader source were
verified over HTTP after restart. Browser QA used the identical runtime from the
isolated production preview; the promotion merge changed only handoff notes.

[Draft PR68](https://github.com/AvonMexicola/star-agent/pull/68) retains the review
branch. Main and public hosting were not deployed by this integration.
