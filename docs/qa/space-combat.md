# Space combat verification — 2026-09-07

Feature: `feat/space-combat`. Runtime assets are the existing
`public/models/nomad.glb` (Nomad 02) and `assets/kestrel/kestrel.glb`; no hull source,
textures or GLBs were changed. Both render as NPCs in the main flight renderer.

## Checks

- `npm test`: 90 test-file entries pass on the isolated feature base; all 91 pass
  after integration with the current gameplay-audio and hangar work, including
  the new combat simulation tests.
- `node --test --test-isolation=none tests/space-combat.test.js tests/gamepad.test.js tests/kestrel-flight.test.js`: 30 individual cases pass.
- `VITE_DEV_TOOLS=1 npm run build`: passes. Existing Vite chunk-size advisory remains.
- Actual Nomad and Kestrel controller patrol journeys: pass. Each starts in the
  supported orbital launcher, accepts through native console buttons, flies using
  sticks, changes target/weapon, fires, receives incoming damage, destroys both
  NPCs, files the report and returns to flight. Read-only pose feedback steers
  injected axes; no navigation mutations or gameplay shortcut calls are used.
- Held A suppression: modal close, blur/focus, disconnect/reconnect, replacement
  and unsupported mappings pass in both ship journeys.
- Keyboard/pointer, controlled close-ups, NPC-caused ship loss, Enter recovery and
  phone console layout: pass. Combined with the two controller runs, all three
  feature browser cases pass. The final combined run at `b3f1a87` passes all three
  in 4.4 minutes with no page/console errors.

The account-session request is a signed-out fixture (`{account:null}`), keeping
this offline feature's test independent of the unrelated account server. No other
network, gameplay, damage or NPC functions are mocked. Physical-controller testing
is **not claimed**; keyboard-only tests hide host controllers within that browser
page so hardware input cannot mix with the injected keyboard route.

## Failures found and corrected

1. The initial worktree checkout and headless browser hit the `/tmp` user quota.
   Chromium 151 aborted in `font_data_service_impl.cc:379` with `Disk quota exceeded
   (122)` before the page loaded (PID 2298268, 11:37:02 CEST). The core confirmed
   SIGABRT; no symbols-based browser defect is claimed. The worktree and browser
   temporary files were moved to the home filesystem. No system settings changed.
2. The first completed controller run failed its error assertion because the
   account server was absent. The offline signed-out fixture resolves that test
   dependency; application errors are still checked.
3. Combat telemetry overlapped the existing flight panel. The combat panel moved
   to the left, and hitscan weapons no longer draw a redundant lead ring.
4. Existing ship fire controls were unpositioned and intercepted by the full-screen
   canvas. Explicit desktop/phone positioning makes the pointer route accessible.
5. A short UI timeout accidentally applied to world preload. Loading has its own
   90-second timeout; interaction timeouts remain short.
6. The keyboard-only test initially mixed in a connected host Gamepad and flew off
   course. Its browser page now returns an empty Gamepad list. No system controller
   configuration or physical-device state was changed.
7. The keyboard fixture must wait for the native dialog close event and canvas
   focus before pressing W; inputs during close cleanup are intentionally cleared.
8. Recovery now clears the failed patrol display and returns dispatch to idle.

## Environment and scope

Chromium 151; ANGLE / AMD Radeon 860M Graphics, OpenGL ES 3.2; desktop 1440×900 and
phone console 390×844. Full counters/backend details and test logs remain in
`/tmp/star-agent-combat-evidence/`, `/tmp/combat-browser.log` and
`/tmp/combat-unit.log`. Captured encounter samples with both contacts used roughly
581–585 draw calls and 457–479k triangles. These are renderer counters during
an automated scenario, not a stable FPS benchmark. Reported frame rate varied
with loading, captures and shared-machine activity; no performance sign-off is
claimed. Automatic render resolution remained enabled.

Independent rubric review, physical controller validation and production release
approval remain pending. This local functional slice does not certify the entire
inherited scene or ship artwork. Session resets, separate ground/star damage,
absent rewards, weapon fitting and multiplayer NPC authority are described in
[the combat scope](../space-combat.md).

## Captures

- [Nomad engagement](space-combat/nomad-engagement.png) and [Kestrel engagement](space-combat/kestrel-engagement.png).
- [Combat report](space-combat/report.png) and [ship loss](space-combat/loss.png).
- [Nomad NPC](space-combat/nomad-npc.png) and [Kestrel NPC](space-combat/kestrel-npc.png), controlled viewpoints.
- [Phone console](space-combat/phone-console.png), 390×844.

## Local integration

The combat commits are integrated into `dev/all-features` at `b3f1a87`. Its
`http://127.0.0.1:5178/` preview serves the new simulation module. The existing
launcher, audio paths, Kestrel cargo guard and unrelated unstaged `AGENTS.md` edit
were preserved. [Draft PR #53](https://github.com/AvonMexicola/star-agent/pull/53)
targets the shared integration branch; no production deployment occurred.
