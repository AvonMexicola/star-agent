# Combined development build verification

Source branch: `dev/all-features`, from main `48a8468`, with the coherent feature
heads in [the integration guide](../local-development.md). This is a local testing
integration, not a production release or whole-scene art sign-off.

## Checks

- `npm test`: 650 passing after the weather, music, gameplay-audio and Atlas
  geometry integrations (Node 26.7).
- `npm run test:multiplayer`: 79 passing, one PostgreSQL-only check skipped
  without `TEST_DATABASE_URL`. The local runner uses an isolated memory store.
- `npm run build`: passes with dev tools disabled. A dev-tools production build
  also passed at the launcher checkpoint. Existing chunk-size advisories remain.
- Browser ship/world tour: passes (7.0 minutes). Actual launcher clicks, reloads,
  Nomad seat exit/return, Atlas seat exit, Kestrel coastal flight and gear,
  forest, Selene, Pyre, Miasma and stellar renders. Normal save sentinels survive.
- Controller launcher journey: passes (1.4 minutes), using only injected Gamepad
  input for ship/location selection, launch, Menu re-entry and held-stick
  suppression until neutral after closing.
- Phone touch journey: passes (1.1 minutes), 390×844 with `hasTouch: true` and
  actual `tap` events for selection, launch and persistent entry. No horizontal
  overflow. The location list and dialog scroll independently.
- Final integration follow-up: passes (44 seconds), zero hidden Kestrel cargo,
  five clickable map targets, correct star/moon labels, gesture-only soundtrack
  playback/mute and real refreshed Atlas GLB loading in the linked studio.
- Physical gameplay-audio journey: passes (40 seconds), standing from the Nomad
  seat, walking to and opening its rear hatch, leaving along the ramp, real
  carbine fire consuming ammo, cutter playback, map suspension and final mute.
  Metal footsteps, weapon events and cutter state came from actual play.

The passing browser journeys recorded no page or console errors. They were run
as focused invocations, not as one uninterrupted five-case suite. Reproduce with
`npm run dev:all`, then
`npm run test:browser -- -c scripts/dev-launcher.config.js`.

Chromium 151 on Linux, AMD Radeon 860M / ANGLE OpenGL ES 3.2, 1440×900 and
390×844, device scale 1. Controller journeys inject a standard Gamepad; no physical
controller or hardware performance claim. Tests use actual semantic controls,
reloads, physical seat interactions, and shared controller modal navigation.

The first headless attempts crashed with allocation errors and insufficient
resources. `/tmp` was heavily occupied by concurrent worktrees. QA uses shared
memory (removes Playwright's `--disable-dev-shm-usage`) and a disk-backed temporary
browser profile directory; the same app then rendered without those allocation
failures. System/browser defaults and other agents' previews were not changed.
Core stack symbols were unavailable; the exact allocator failure was not isolated.
No core dumps were extracted into the workspace.

One initial browser tour was deliberately interrupted after Nomad/Atlas boarding,
Kestrel coastal flight/gear and map checks because newly committed weather/music
work arrived for integration. That interrupted run is not counted as a pass.

The controller fixture originally awaited frames in a document deliberately
reloaded by Launch; waiting for the new URL instead fixes that test race. An audio
walk fixture first assumed the seat exit faced forward; the real Nomad turns the
walker aft, so the exit journey uses W. Neither failed fixture is counted as a pass.
The map follow-up did expose a refresh exception introduced while updating the
star visibility caption. Computing it inside the chart projection fixes the
overlapping unpositioned buttons; all five actual clicks are now verified.

## Integration fixes

Canonical rock relief is transferred through the detailed Aeon/lunar patch
workers. Grass and forest candidates reject those same protrusions. Parent-triangle
morphs and terrain skirts are retained. All five worlds share the current map,
atmosphere and stellar handling. Moon geology fixtures now distinguish underlying
relief from the added rocks, without inventing a collision surface.

Native Nomad/Kestrel gear drives the shared speed policy; Nomad's berth survives
moving-cabin flight and soft contact. Construction uses the new mineral capacity
without replacing physical ship storage or third-person hand attachments. The
multiplayer join path restores Nomad access controls after leaving Kestrel and
keeps local construction/recipes out of server-authoritative inventory.
Kestrel cannot receive the construction kit, and loaded processed materials
prevent switching into its zero-capacity hold. Gameplay audio preserves actual
moving-cabin velocity for the score, authored Nomad controls and build occlusion.

## Visual evidence

Curated final captures: [desktop launcher](local-development/launcher-desktop.png),
[phone launcher](local-development/launcher-phone.png),
[five-world map](local-development/system-map.png) and
[Atlas studio checkpoint](local-development/atlas-studio.png).
The broader actual scene tour was inspected from its `/tmp` captures; this is
functional integration evidence, not a new whole-scene art or FPS acceptance.

## Limits

The flyable Atlas is the existing 30 m freighter. The 64 m Mark II studio is a
separate inspection route with the refreshed 59,443-triangle geometry/gear
checkpoint. Final materials, review and flight integration remain open.
Character production and pending Meshy shop props are not completed by this merge.
Local multiplayer has no SMTP delivery or durable database. Construction and
recipes are offline only. Per-feature source reviews remain valid only for their
own recorded heads; no new Opus score or production deployment is claimed here.
