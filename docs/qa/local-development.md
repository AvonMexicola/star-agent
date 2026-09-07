# Combined development build verification

Source branch: `dev/all-features`, from main `48a8468`, with the coherent feature
heads in [the integration guide](../local-development.md). This is a local testing
integration, not a production release or whole-scene art sign-off.

## Checks

- `npm test`: 641 passing after the weather/music integrations.
- `npm run test:multiplayer`: 79 passing, one PostgreSQL-only check skipped
  without `TEST_DATABASE_URL`. The local runner uses an isolated memory store.
- `VITE_DEV_TOOLS=1 npm run build`: passes. Existing chunk-size advisories remain.
- Browser journey: in progress; final outcome recorded below before delivery.

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

## Limits

The flyable Atlas is the existing 30 m freighter. The 64 m Mark II studio is a
separate inspection route, and the exterior refresh is still in its owner's tree.
Character production and pending Meshy shop props are not completed by this merge.
Local multiplayer has no SMTP delivery or durable database. Construction and
recipes are offline only. Per-feature source reviews remain valid only for their
own recorded heads; no new Opus score or production deployment is claimed here.
