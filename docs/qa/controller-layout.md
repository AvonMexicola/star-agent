# Controller fire and layout verification — 2026-09-07

Author verification of `fix/controller-fire-layout`, based on integration a748be1.
RT/R2 now fires the ship weapon, LT/L2 brakes and disengages drive, and A/B supplies
vertical thrust. Menu → Controller layout and Help → View controller layout open
the same native dialog. The four views explain Flight, On foot, EVA and shortcuts.
Keyboard/pointer fire, menu confirmation/back and suit tool fire are preserved.

## Checks

- `npm test`: 669/669 pass. Tests exercise analog fire independent of thrust,
  brake priority, ship-local/radial vertical movement and neutral arming after
  modal/focus/device interruptions.
- `VITE_DEV_TOOLS=1 npm run build`: passes. Existing large-chunk advisory remains.
- `npm run check:repo` and `npm run plan:checks -- --base origin/dev/all-features`:
  repository check passes; plan inspected. No save, server or database changes.
- Production Chromium patrol run: 3/3 pass in4.2m. Both Nomad and Kestrel complete
  controller-only console acceptance, continuous stick flight to the beacon,
  target/weapon selection, RT engagement and combat report. A/B thrust and LT
  braking work without firing; RT fires without ascent. Held RT does not replay
  across menus, focus, disconnect, replacement or unsupported mapping.
- Keyboard/pointer test passes fire, target cycling, NPC-caused loss, recovery,
  Help → layout entry and phone interaction. No page/console errors in controller
  journeys. Physical Gamepad and independent visual review are not claimed.

## Findings and corrections

The first full unit run found four tests still injecting the old B-brake/RT-ascent
bindings. Updated those fixtures to LT-brake/A-B-ascent and retained their movement
and brake-priority assertions; the full suite then passed. The initial log location
hit the known per-user `/tmp` quota; retained logs and browser profiles use home cache.

The first screenshot exposed the global dialog max-width clipping the right-hand
label column. [Failed desktop capture](controller-layout/initial-clipped-desktop.png)
is retained as evidence. An explicit scoped max-width fixes the controller dialog;
the focused final visual check asserts no horizontal overflow in all four contexts
at1440×900 and390×844. It also checks scrolling to the phone footer and safe return
with RT held. The screenshot review also found and corrected one stale A-fire HUD
hint; the final test asserts RT appears there.

Final focused layout test passes1/1 in45.9s. All four contexts fit at both sizes;
phone footer scrolling and held-RT return pass with zero browser errors. The first
focused test asserted a controller hint before sending controller input; moved the
assertion after the real Menu press, which activates contextual controller hints.

Chromium151.0.7922.173, AMD Radeon860M / ANGLE GLES3.2,1440×900 and390×844.
These are functional/visual checks, not frame-time or independent art acceptance.

- [Desktop flight diagram](controller-layout/desktop-flight.png)
- [Desktop shortcuts](controller-layout/desktop-shortcuts.png)
- [Phone flight diagram](controller-layout/phone-flight.png)
- [Phone lower controls and footer](controller-layout/phone-bottom.png)

Reproduce after building with `npm run test:browser -- -c scripts/space-combat.config.js`.
Set COMBAT_TMPDIR, COMBAT_EVIDENCE and COMBAT_RESULTS to writable home-cache paths
when the known temporary-directory quota is exhausted. The full suite now includes
both patrols, keyboard/pointer recovery, and the focused layout case.
