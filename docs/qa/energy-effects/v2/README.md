# Arsenal and slipstream — 2026-09-06

Production Chromium 151.0.7922.173, ANGLE/Vulkan SwiftShader (software).
Desktop 1440 × 900; mobile 390 × 844. These are actual WebGL captures.
No physical controller or hardware FPS validation is claimed.

- [Slipstream](slipstream.png): surrounding cyan/violet filaments, bright wave packets and velocity-aligned streaks, with an open central corridor.
- [Solar lance](laser.png): the live beam frozen using the range’s pause button.
- [Singularity](void.png): violet core, orbital motes and expanding impact rings.
- [Viridian lance](viridian-lance.png): alternate emission color on the same weapon.
- [Ground carbine](ground-rifle-laser.png) and [sidearm](ground-sidearm-pistol.png): real equipped assets and RT-driven geometry impacts.
- [Mining](controller-mining.png) and [saved cargo](controller-cargo.png): cutter extraction and inventory after switching from guns.
- [Mobile arsenal](mobile-arsenal.png): weapon and color controls within the viewport.

Validation: `npm test` passes all 194 cases across 27 files; `npm run build`
produces the game and effects range. `npm run test:browser -- -c
scripts/effects-v2.config.js` passes all three cases with zero recorded errors.

The controller journey starts in orbit. Injected standard Gamepad input selects
and fires the ship laser, uses the visible quick-transit menu, lands, stands,
opens the hatch, walks out and approaches the deposit. It equips and fires both
ground guns, checks that impacts grant no minerals, switches to the cutter,
extracts saved material, opens and navigates cargo, and returns to play. Debug
state is read for steering and assertions; no gameplay setup mutation skips
that route. Held inputs are checked through selection, focus, disconnect,
replacement and unsupported mapping transitions.

A separate keyboard/touch regression uses an explicit ground setup fixture. It
checks rapid equipment switching with delayed assets, held/repeated T across
switches and a modal, and real browser touch events on the firing button.
Range checks cover the three weapon families, color selection, reduced motion
and mobile bounds. Raw reports remain in `/tmp/star-agent-effects-v2`.
